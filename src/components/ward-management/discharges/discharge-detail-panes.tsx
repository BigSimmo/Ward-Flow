"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DischargeCareJourney } from "./discharge-care-journey";
import Link from "next/link";
import { releaseBand, type ReleaseBand } from "@/components/ward-management/ward-bed-availability";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { parseReleaseDayInstant } from "@/components/ward-management/ward/release-day";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import type { DischargeRecord } from "@/components/ward-management/ward-discharge-records";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { patientHref } from "@/components/ward-management/shell/ward-facade";
import {
  Button,
  Field,
  StatusGlyph,
  StatusPill,
  TIME_FIELD_ERROR,
  TimeField,
  buttonClass,
  durMinutes,
} from "@/components/wf";
import { DischargeFollowUp } from "./discharge-follow-up";
import { ReadyToLeave } from "./discharge-ready-to-leave";
import { SupportNotificationChecklist } from "../movements/support-notification-checklist";
import pageStyles from "./discharges-third-edition.module.css";
import releaseList from "./discharge-release-list.module.css";
import {
  BAND_LABELS,
  unitLabel,
  healthServiceLabel,
  recordStage,
  recordName,
  recordedMoment,
} from "./discharge-board-model";
import { RecordedDischargeMilestones } from "./discharge-board-parts";
// Closing-the-loop package B (24 Oct 2026): discharge arrangements, loaded when idle.
import { DischargeDependenciesPanel } from "./discharge-logistics-lazy";
import { HELD_UP, pastWords, type ReleasePanelPart } from "./discharge-release-actions";
import type { DischargeWorkspaceState } from "./use-discharge-workspace-state";
import { DischargeMessageWard } from "./discharge-message-ward";

/*
 * The discharge detail panel, moved from `discharge-board.tsx`. Drawer review (6 Nov 2026): it opens
 * in the kit PanelDrawer at every width. The drawer draws the head (name, one subtitle line, status
 * tag) and the tabs; these panes draw only the body.
 */

/** The drawer's tabs: milestones, held up, transport and the record. */
export function dischargeDrawerTabs(hasBlocker: boolean) {
  return [
    { id: "milestones" as const, label: "Milestones" },
    {
      id: "barriers" as const,
      // Post-merge audit (4 Nov 2026): Held up carries the amber glyph while a blocker is recorded.
      label: hasBlocker ? (
        <>
          <StatusGlyph tone="warning" size={9} />
          Held up
        </>
      ) : (
        "Held up"
      ),
    },
    { id: "transport" as const, label: "Transport" },
    { id: "dossier" as const, label: "Record" },
  ];
}

export type DischargeDrawerHead = { title: ReactNode; subtitle: ReactNode; tag: ReactNode; hasBlocker: boolean };

function subtitleLine(parts: (ReactNode | null | undefined | false)[]) {
  const shown = parts.filter(Boolean) as ReactNode[];
  return (
    <span className={pageStyles.drawerSubtitle}>
      {shown.map((part, index) => (
        <span key={index} className={pageStyles.drawerSubtitlePart}>
          {index > 0 ? <span aria-hidden="true">· </span> : null}
          {part}
        </span>
      ))}
    </span>
  );
}

/** The head of an admission record opened from History. */
export function recordDrawerHead(s: DischargeWorkspaceState, record: DischargeRecord): DischargeDrawerHead {
  return {
    title: recordName(record),
    subtitle: subtitleLine([
      record.identity.kind === "linked" ? (
        <span className={pageStyles.mono}>UMRN {record.identity.patient.umrn}</span>
      ) : null,
      unitLabel(s.selectedUnit, record.unitId),
    ]),
    tag: s.detailTone ? <StatusPill tone={s.detailTone}>{s.detailBadgeLabel}</StatusPill> : null,
    hasBlocker: Boolean(record.blockReason),
  };
}

/**
 * The head of a bed release opened from Now, the same on a phone and a wider screen: the person,
 * surname first (or the ward when no person is linked), then UMRN, ward and service on one line.
 */
export function releaseDrawerHead(s: DischargeWorkspaceState, release: BedRelease): DischargeDrawerHead {
  const record = s.linkedReleaseRecord;
  const personName = record ? recordName(record) : null;
  const wardName = unitLabel(s.selectedUnit, release.unitId);
  const heldUp = release.state !== "discharged" && release.blocker !== null;
  return {
    title: personName ?? wardName,
    subtitle: subtitleLine([
      record?.identity.kind === "linked" ? (
        <span className={pageStyles.mono}>UMRN {record.identity.patient.umrn}</span>
      ) : null,
      personName ? wardName : null,
      healthServiceLabel(s.selectedUnit),
    ]),
    tag: s.detailTone ? <StatusPill tone={s.detailTone}>{heldUp ? HELD_UP : s.detailBadgeLabel}</StatusPill> : null,
    hasBlocker: Boolean(release.blocker),
  };
}

function paneClass(tab: DischargeWorkspaceState["drawerTab"], active: DischargeWorkspaceState["drawerTab"]) {
  return tab === active ? pageStyles.tabPane : pageStyles.tabPaneHidden;
}

/** An admission record opened from History: identity, milestones, barriers, transport and dossier. */
export function DischargeRecordDetail({
  s,
  activeRecord,
}: {
  s: DischargeWorkspaceState;
  activeRecord: DischargeRecord;
}) {
  const [datePending, setDatePending] = useState(false);
  const [dateMessage, setDateMessage] = useState("");
  const [dateTimeWrong, setDateTimeWrong] = useState(false);
  const datePendingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const actor = s.recordActorFor(activeRecord.unitId);
  const canUpdateDate = actor.role === "ward" || actor.role === "coordinator";
  const {
    dayZero,
    dispatch,
    now,
    showUpdateDate,
    setShowUpdateDate,
    newTimeDraft,
    setNewTimeDraft,
    drawerTab,
    selectedUnit,
  } = s;
  return (
    <>
      <dl className={pageStyles.detailStats}>
        <div>
          <dt>Expected out</dt>
          <dd>{recordedMoment(activeRecord.expectedDischargeAt, dayZero)}</dd>
        </div>
        <div>
          <dt>Held up by</dt>
          <dd>{activeRecord.blockReason ? "Recorded" : "None"}</dd>
        </div>
      </dl>

      <div className={paneClass("milestones", drawerTab)}>
        <RecordedDischargeMilestones
          title="Milestones"
          milestones={[
            {
              label: "Expected discharge date",
              state: activeRecord.expectedDischargeAt === null ? "pending" : "complete",
              detail:
                activeRecord.expectedDischargeAt === null
                  ? "Not recorded"
                  : `${recordedMoment(activeRecord.expectedDischargeAt, dayZero)} · Set by ${activeRecord.dischargeDateSetBy ?? "role not recorded"}`,
            },
            {
              label: "Discharge confirmation",
              state: activeRecord.dischargeConfirmedAt === null ? "pending" : "complete",
              detail:
                activeRecord.dischargeConfirmedAt === null
                  ? "Not recorded"
                  : `${recordedMoment(activeRecord.dischargeConfirmedAt, dayZero)} · ${activeRecord.dischargeConfirmedBy ?? "Role not recorded"}`,
            },
            {
              label: "Recorded hold-up",
              state: activeRecord.blockReason ? "blocked" : "pending",
              detail: activeRecord.blockReason ?? "Nothing recorded holding it up",
            },
            {
              label: "Discharge",
              state: activeRecord.leftAt === null ? "pending" : "complete",
              detail: activeRecord.leftAt === null ? "Not recorded" : recordedMoment(activeRecord.leftAt, dayZero),
            },
          ]}
        />
        <dl className={pageStyles.factList}>
          <dt>Destination</dt>
          <dd>
            {LEAVING_DESTINATIONS.find((item) => item.id === activeRecord.leavingDestination)?.label ?? "Not recorded"}
          </dd>
        </dl>
      </div>

      <div className={paneClass("barriers", drawerTab)}>
        {activeRecord.blockReason ? (
          <div className={pageStyles.barrierBox}>
            <div className={pageStyles.barrierText}>
              <span className={pageStyles.barrierCause}>
                <StatusGlyph tone="warning" size={9} />
                {activeRecord.blockReason}
              </span>
              <span className={pageStyles.secondary}>Recorded discharge blocker</span>
            </div>
          </div>
        ) : (
          <div className={pageStyles.barrierBox}>
            <span className={pageStyles.barrierCause}>
              <StatusGlyph tone="success" size={9} />
              No discharge blocker recorded
            </span>
            <p className={pageStyles.note}>Clinical, pharmacy and transit clearance are not recorded here.</p>
          </div>
        )}
      </div>

      <div className={paneClass("transport", drawerTab)}>
        <dl className={pageStyles.factList}>
          <dt>Booking reference</dt>
          <dd>Not recorded</dd>
          <dt>Provider</dt>
          <dd>Not recorded</dd>
          <dt>Route</dt>
          <dd>
            {unitLabel(selectedUnit, activeRecord.unitId)} →{" "}
            {LEAVING_DESTINATIONS.find((item) => item.id === activeRecord.leavingDestination)?.label ?? "Not recorded"}
          </dd>
        </dl>
      </div>

      <div className={paneClass("dossier", drawerTab)}>
        <dl className={pageStyles.factList}>
          <dt>Expected discharge</dt>
          <dd>
            {recordedMoment(activeRecord.expectedDischargeAt, dayZero)}
            {/* Walkthrough D8 (25 Sept 2026): not offered once the person has left, because the
                              reducer refuses a new date for a departed stay. */}
            {recordStage(activeRecord) === "departed" ? null : !showUpdateDate ? (
              <div className={pageStyles.inlineAction}>
                <Button
                  size="sm"
                  data-testid="ward-discharge-update-date-btn"
                  disabledReason={canUpdateDate ? undefined : "Only the ward or coordinator can update this date."}
                  onClick={() => {
                    setDateMessage("");
                    setDateTimeWrong(false);
                    setShowUpdateDate(true);
                    setNewTimeDraft(
                      activeRecord.expectedDischargeAt !== null
                        ? formatInstant(activeRecord.expectedDischargeAt)
                        : "14:00",
                    );
                  }}
                >
                  Update expected departure
                </Button>
              </div>
            ) : (
              <form
                className={pageStyles.timeForm}
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!canUpdateDate || datePendingRef.current) return;
                  let parsed: number | undefined;
                  if (/^\d+$/.test(newTimeDraft.trim())) {
                    parsed = Number(newTimeDraft.trim());
                  } else {
                    const today = parseReleaseDayInstant(now, "today", newTimeDraft);
                    const recorded = activeRecord.expectedDischargeAt;
                    parsed =
                      today === undefined || recorded === null
                        ? today
                        : today +
                          (Math.floor(recorded / MINUTES_PER_DAY) - Math.floor(now / MINUTES_PER_DAY)) *
                            MINUTES_PER_DAY;
                  }
                  // An unfinished or not-real time stops the save with words (PR #1474 review).
                  if (parsed === undefined) setDateTimeWrong(true);
                  if (parsed !== undefined) {
                    datePendingRef.current = true;
                    setDatePending(true);
                    setDateMessage("");
                    try {
                      const outcome = await dispatch({
                        type: "UPDATE_EXPECTED_DISCHARGE",
                        role: actor.role,
                        ...(actor.role === "ward" ? { actingUnitId: actor.actingUnitId } : {}),
                        admissionId: activeRecord.admissionId,
                        expectedDischargeAt: parsed,
                        now,
                      });
                      if (!mountedRef.current) return;
                      if (outcome?.status === "accepted" && outcome.isCurrent?.() !== false) {
                        setShowUpdateDate(false);
                        setDateMessage("Expected discharge updated.");
                      } else {
                        setDateMessage(
                          outcome?.message ??
                            "Update was not confirmed. Your time is kept; review the record before trying again.",
                        );
                      }
                    } catch {
                      if (mountedRef.current)
                        setDateMessage(
                          "Update was not confirmed. Your time is kept; review the record before trying again.",
                        );
                    } finally {
                      datePendingRef.current = false;
                      if (mountedRef.current) setDatePending(false);
                    }
                  }
                }}
              >
                <Field
                  label="New expected discharge time"
                  hint="HH:MM"
                  id="ward-discharge-new-time-input"
                  error={dateTimeWrong ? TIME_FIELD_ERROR : undefined}
                >
                  <TimeField
                    name="newExpectedDischargeTime"
                    data-testid="ward-discharge-new-time-input"
                    disabled={datePending}
                    value={newTimeDraft}
                    onValueChange={(time) => {
                      setDateTimeWrong(false);
                      setNewTimeDraft(time);
                    }}
                    required
                  />
                </Field>
                <Button
                  type="submit"
                  size="sm"
                  variant="pri"
                  data-testid="ward-discharge-save-time-btn"
                  disabledReason={datePending ? "Waiting for confirmation" : undefined}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  data-testid="ward-discharge-cancel-time-btn"
                  disabledReason={datePending ? "Waiting for confirmation" : undefined}
                  onClick={() => setShowUpdateDate(false)}
                >
                  Cancel
                </Button>
              </form>
            )}
            {dateMessage ? <p role="status">{dateMessage}</p> : null}
          </dd>
          <dt>Date recorded</dt>
          <dd>
            {recordedMoment(activeRecord.dischargeDateSetAt, dayZero)}
            <span className={pageStyles.secondary}>{activeRecord.dischargeDateSetBy ?? "Role not recorded"}</span>
          </dd>
          <dt>Discharge confirmation</dt>
          <dd>
            {activeRecord.dischargeConfirmedAt === null
              ? "Not confirmed"
              : recordedMoment(activeRecord.dischargeConfirmedAt, dayZero)}
            <span className={pageStyles.secondary}>{activeRecord.dischargeConfirmedBy ?? "Role not recorded"}</span>
          </dd>
          {activeRecord.blockReason && (
            <>
              <dt>Recorded hold-up</dt>
              <dd className={pageStyles.blocker}>{activeRecord.blockReason}</dd>
            </>
          )}
          <dt>Recorded discharge</dt>
          <dd>{recordedMoment(activeRecord.leftAt, dayZero)}</dd>
          <dt>Destination</dt>
          <dd>
            {LEAVING_DESTINATIONS.find((item) => item.id === activeRecord.leavingDestination)?.label ?? "Not recorded"}
          </dd>
        </dl>
        <DischargeFollowUp key={activeRecord.id} record={activeRecord} actor={s.recordActorFor(activeRecord.unitId)} />
        <DischargeCareJourney
          key={`care-${activeRecord.id}`}
          record={activeRecord}
          actor={s.recordActorFor(activeRecord.unitId)}
        />
        {/* Advisory carer/PSP/MHAS checklist: renders only for an involuntary patient's discharge. */}
        <SupportNotificationChecklist
          key={`notify-${activeRecord.id}`}
          admissionId={activeRecord.admissionId}
          role={s.recordActorFor(activeRecord.unitId).role}
        />
      </div>
    </>
  );
}

/**
 * A bed release opened from Now. Redesign (Josh, 30 Oct): the phone leads with the person, surname
 * first, then the ward; "When" says once how the release stands against its date; the badge says
 * "Held up". `openOn` is the part a row's button promised: Chase opens on the barriers, and Confirm
 * date on the release's own "New expected out" control, in its discharge arrangements beside the
 * barriers (`RECORD_DISCHARGE_PLAN_CHANGE`, which also marks earlier confirmations to check again).
 */
export function DischargeReleaseDetail({
  s,
  detailRelease,
  openOn,
  departure,
}: {
  s: DischargeWorkspaceState;
  detailRelease: BedRelease;
  openOn: ReleasePanelPart | null;
  /** "Going to", chosen before Record discharge; it sits in the body, not the crowded foot. */
  departure?: ReactNode;
}) {
  const {
    dayZero,
    now,
    isPhone,
    phoneReleaseMore,
    setPhoneReleaseMore,
    readyChange,
    setReadyChange,
    ticksFor,
    setTick,
    linkedReleaseRecord,
    releaseOnCto,
    selectedUnit,
    releasePaneClass,
  } = s;
  const barrierRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // The part a row's button named gets the focus, after the panel's own first-control focus. The
  // arrangements (with the release's own "New expected out" date control) load when idle, so the
  // date control is looked for a few times before giving up.
  useEffect(() => {
    if (openOn === null || openOn === "milestones") return;
    let tries = 0;
    let timer = 0;
    const look = () => {
      const target =
        openOn === "date"
          ? panelRef.current?.querySelector<HTMLElement>(
              '[data-testid="ward-discharge-dependencies"] select[aria-label="Day"]',
            )
          : barrierRef.current;
      if (target) {
        target.focus({ preventScroll: true });
        target.scrollIntoView?.({ block: "center" });
      } else if (tries++ < 20) timer = window.setTimeout(look, 100);
    };
    timer = window.setTimeout(look, 0);
    return () => window.clearTimeout(timer);
  }, [openOn]);
  const overdue = detailRelease.state !== "discharged" && detailRelease.expectedAt < now;
  const wardName = unitLabel(selectedUnit, detailRelease.unitId);
  return (
    <>
      {/* The drawer's head names the person, then UMRN, ward and service, the same at every width. */}
      {isPhone ? (
        <dl className={pageStyles.phFacts}>
          <div>
            <dt>{detailRelease.state === "discharged" ? "Released" : "Expected out"}</dt>
            <dd className={pageStyles.mono}>
              {recordedMoment(
                detailRelease.state === "discharged" ? detailRelease.confirmedAt : detailRelease.expectedAt,
                dayZero,
              )}
            </dd>
          </div>
          {/* One cell for how the release stands against its date (was When and Against date). */}
          <div>
            <dt>When</dt>
            <dd>
              {detailRelease.state === "discharged" ? (
                "Departed"
              ) : overdue ? (
                <>
                  <StatusGlyph tone="danger" size={9} /> {pastWords(now - detailRelease.expectedAt)}
                </>
              ) : (
                `${BAND_LABELS[releaseBand(detailRelease, now) as ReleaseBand]} · in ${durMinutes(detailRelease.expectedAt - now)}`
              )}
            </dd>
          </div>
          <div className={releaseList.factWide}>
            <dt>Destination</dt>
            <dd>
              {LEAVING_DESTINATIONS.find((item) => item.id === linkedReleaseRecord?.leavingDestination)?.label ??
                "Not recorded"}
            </dd>
          </div>
        </dl>
      ) : (
        <dl className={pageStyles.factTiles}>
          <div>
            <dt>{detailRelease.state === "discharged" ? "Released" : "Expected out"}</dt>
            <dd className={pageStyles.mono}>
              {recordedMoment(
                detailRelease.state === "discharged" ? detailRelease.confirmedAt : detailRelease.expectedAt,
                dayZero,
              )}
            </dd>
          </div>
          {overdue ? (
            <div data-tone="danger">
              <dt>Overdue by</dt>
              <dd>
                <StatusGlyph tone="danger" size={9} />
                {pastWords(now - detailRelease.expectedAt).replace(/ past$/, "")}
              </dd>
            </div>
          ) : detailRelease.state !== "discharged" ? (
            <div>
              <dt>Due in</dt>
              <dd className={pageStyles.mono}>{durMinutes(detailRelease.expectedAt - now)}</dd>
            </div>
          ) : (
            <div>
              <dt>Stage</dt>
              <dd>Departed</dd>
            </div>
          )}
        </dl>
      )}
      {departure}

      {isPhone && linkedReleaseRecord?.identity.kind === "linked" ? (
        // A4-22 (audit round 2): on the phone the link opens the person's own page
        // rather than switching the board to History and losing the selection.
        <Link
          className={buttonClass({ variant: "ghost", size: "sm", className: pageStyles.bridgeButton })}
          href={patientHref(linkedReleaseRecord.identity.patient.id)}
        >
          Patient page →
        </Link>
      ) : null}

      <div className={releasePaneClass("milestones")}>
        <RecordedDischargeMilestones
          title="Milestones"
          milestones={[
            {
              label: "Expected discharge date",
              state: "complete",
              detail: recordedMoment(detailRelease.expectedAt, dayZero),
            },
            {
              label: "Release stage recorded",
              state: detailRelease.state === "expected" ? "pending" : "complete",
              detail: `${detailRelease.state.charAt(0).toUpperCase()}${detailRelease.state.slice(1)} · ${recordedMoment(detailRelease.confirmedAt, dayZero)}`,
            },
            // A4-23 (audit round 2): the phone shows the blocker panes together, so
            // the blocker is said once, in its own box below, not again as a milestone.
            ...(isPhone
              ? []
              : [
                  {
                    label: "Recorded hold-up",
                    state: detailRelease.blocker ? ("blocked" as const) : ("pending" as const),
                    detail: detailRelease.blocker ?? "Nothing recorded holding it up",
                  },
                ]),
            {
              label: "Discharge",
              state: detailRelease.state === "discharged" ? "complete" : "pending",
              detail:
                linkedReleaseRecord?.leftAt != null
                  ? recordedMoment(linkedReleaseRecord.leftAt, dayZero)
                  : detailRelease.state === "discharged"
                    ? "Discharge recorded; time not recorded"
                    : "Not recorded",
            },
          ]}
        />
        {detailRelease.preparing ? (
          <p className={pageStyles.note}>
            Preparation recorded: {detailRelease.preparationNote ?? "Reason not recorded"}.
          </p>
        ) : null}
        <ReadyToLeave
          onCto={releaseOnCto}
          ticked={ticksFor(detailRelease.id)}
          onToggle={(itemId) => {
            const on = !ticksFor(detailRelease.id).includes(itemId);
            setTick(detailRelease.id, itemId, on);
            setReadyChange({ releaseId: detailRelease.id, itemId, ticked: on });
          }}
          lastChange={readyChange?.releaseId === detailRelease.id ? readyChange : null}
          onUndo={() => {
            if (readyChange) setTick(readyChange.releaseId, readyChange.itemId, !readyChange.ticked);
            setReadyChange(null);
          }}
          onDismiss={() => setReadyChange(null)}
        />
      </div>

      <div ref={panelRef} className={releasePaneClass("barriers")}>
        <div ref={barrierRef} tabIndex={-1} className={releaseList.focusTarget} aria-label="Held up">
          {detailRelease.blocker ? (
            <div className={pageStyles.barrierBox}>
              <div className={pageStyles.barrierText}>
                <span className={pageStyles.barrierCause}>
                  <StatusGlyph tone="warning" size={9} />
                  {detailRelease.blocker}
                </span>
                <span className={pageStyles.secondary}>Recorded discharge blocker</span>
              </div>
              {/* DC1 (Josh, 3 Nov 2026): the coordinator asks the ward beside the hold-up itself. */}
              {s.releaseActor.role === "coordinator" && detailRelease.state !== "discharged" ? (
                <DischargeMessageWard
                  release={detailRelease}
                  who={linkedReleaseRecord ? recordName(linkedReleaseRecord) : "this patient"}
                  wardName={selectedUnit?.name ?? "the ward"}
                  now={now}
                  dispatch={s.dispatch}
                />
              ) : null}
            </div>
          ) : (
            <div className={pageStyles.barrierBox}>
              <span className={pageStyles.barrierCause}>
                <StatusGlyph tone="success" size={9} />
                No discharge blocker recorded
              </span>
            </div>
          )}
        </div>
        <DischargeDependenciesPanel
          release={detailRelease}
          now={now}
          dayZero={dayZero}
          role={s.releaseActor.role}
          dispatch={s.dispatch}
        />
      </div>

      {isPhone ? (
        <button
          type="button"
          className={pageStyles.phMore}
          aria-expanded={phoneReleaseMore}
          onClick={() => setPhoneReleaseMore((open) => !open)}
        >
          {phoneReleaseMore ? "Hide transport and record" : "Show transport and record"}
        </button>
      ) : null}
      <div className={releasePaneClass("transport")}>
        <dl className={pageStyles.factList}>
          <dt>Booking reference</dt>
          <dd>Not recorded</dd>
          <dt>Provider</dt>
          <dd>Not recorded</dd>
          <dt>Unit</dt>
          <dd>{wardName}</dd>
        </dl>
      </div>

      <div className={releasePaneClass("dossier")}>
        <dl className={pageStyles.factList}>
          <dt>{detailRelease.state === "discharged" ? "Recorded release" : "Expected release"}</dt>
          <dd>
            {recordedMoment(
              detailRelease.state === "discharged" ? detailRelease.confirmedAt : detailRelease.expectedAt,
              dayZero,
            )}
          </dd>
          {detailRelease.waitingOn && (
            <>
              <dt>Waiting on</dt>
              <dd>{detailRelease.waitingOn}</dd>
            </>
          )}
          {detailRelease.blocker && (
            <>
              <dt>Held up by</dt>
              <dd className={pageStyles.blocker}>{detailRelease.blocker}</dd>
            </>
          )}
          <dt>Last reported</dt>
          <dd>
            <WardFreshness
              confirmedAt={detailRelease.confirmedAt}
              confirmedByRole={detailRelease.confirmedBy}
              now={now}
            />
            <span className={pageStyles.secondary}>{recordedMoment(detailRelease.confirmedAt, dayZero)}</span>
          </dd>
          {detailRelease.preparing && (
            <>
              <dt>Bed preparation</dt>
              <dd>{detailRelease.preparationNote ?? "In progress · reason not recorded"}</dd>
            </>
          )}
        </dl>
      </div>
    </>
  );
}
