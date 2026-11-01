"use client";

import { useEffect, useId, useRef, useState } from "react";
import { DischargeCareJourney } from "./discharge-care-journey";
import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { releaseBand, type ReleaseBand } from "@/components/ward-management/ward-bed-availability";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { parseReleaseDayInstant } from "@/components/ward-management/ward/release-day";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import type { DischargeRecord } from "@/components/ward-management/ward-discharge-records";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { patientHref } from "@/components/ward-management/shell/ward-facade";
import { Badge, Button, EmptyState, PillTabs, StatusGlyph, TextInput, buttonClass, durMinutes } from "@/components/wf";
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

/* The discharge detail panel's three states, moved unchanged from `discharge-board.tsx`. */

const DETAIL_TABS = [
  ["milestones", "Milestones"],
  ["barriers", "Barriers"],
  ["transport", "Transport"],
  ["dossier", "Record"],
] as const;

function tabPanelProps(
  prefix: string,
  tab: DischargeWorkspaceState["drawerTab"],
  active: DischargeWorkspaceState["drawerTab"],
) {
  return {
    role: "tabpanel",
    id: `${prefix}-panel-${tab}`,
    "aria-labelledby": `${prefix}-tab-${tab}`,
    tabIndex: 0,
    hidden: active !== tab,
  } as const;
}

/** The detail panel's tabs: milestones, barriers, transport and dossier. */
function DischargeDetailTabs({
  idPrefix,
  hasBlocker,
  drawerTab,
  setDrawerTab,
}: {
  idPrefix: string;
  hasBlocker: boolean;
  drawerTab: DischargeWorkspaceState["drawerTab"];
  setDrawerTab: DischargeWorkspaceState["setDrawerTab"];
}) {
  // Mock-up (1 Nov 2026): the kit's pill tabs, a rounded track with the chosen tab raised, as Home's
  // Activity panel. Barriers carries a danger glyph while a blocker is recorded.
  return (
    <PillTabs
      items={DETAIL_TABS.map(([id, label]) => ({
        id,
        label,
        tone: id === "barriers" && hasBlocker ? ("danger" as const) : undefined,
      }))}
      value={drawerTab}
      onChange={setDrawerTab}
      label="Discharge inspection sections"
      idPrefix={idPrefix}
      fill
      className={pageStyles.detailTabs}
    />
  );
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
  const tabIdPrefix = useId();
  const {
    dayZero,
    dispatch,
    now,
    showUpdateDate,
    setShowUpdateDate,
    newTimeDraft,
    setNewTimeDraft,
    isPhone,
    drawerTab,
    setDrawerTab,
    selectedUnit,
    detailTone,
    detailBadgeLabel,
  } = s;
  const tabList = (hasBlocker: boolean) => (
    <DischargeDetailTabs
      idPrefix={tabIdPrefix}
      hasBlocker={hasBlocker}
      drawerTab={drawerTab}
      setDrawerTab={setDrawerTab}
    />
  );
  return (
    <>
      <div className={pageStyles.identity}>
        <div className={pageStyles.identityText}>
          <h3 className={pageStyles.patientFullName}>{recordName(activeRecord)}</h3>
          <p className={pageStyles.identityMeta}>
            {activeRecord.identity.kind === "linked" && (
              <span className={pageStyles.mono}>UMRN {activeRecord.identity.patient.umrn}</span>
            )}
            <span>{unitLabel(selectedUnit, activeRecord.unitId)}</span>
          </p>
        </div>
        {detailTone ? (
          <Badge tone={detailTone} size="sm">
            {detailBadgeLabel}
          </Badge>
        ) : null}
      </div>
      <dl className={pageStyles.detailStats}>
        <div>
          <dt>Expected out</dt>
          <dd>{recordedMoment(activeRecord.expectedDischargeAt, dayZero)}</dd>
        </div>
        <div>
          <dt>Blocker</dt>
          <dd>{activeRecord.blockReason ? "Recorded" : "None"}</dd>
        </div>
      </dl>

      {tabList(Boolean(activeRecord.blockReason))}

      <div
        {...tabPanelProps(tabIdPrefix, "milestones", drawerTab)}
        className={drawerTab === "milestones" ? pageStyles.tabPane : pageStyles.tabPaneHidden}
      >
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
              label: "Recorded discharge blocker",
              state: activeRecord.blockReason ? "blocked" : "pending",
              detail: activeRecord.blockReason ?? "No discharge blocker recorded",
            },
            {
              label: "Physical departure",
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

      <div
        {...tabPanelProps(tabIdPrefix, "barriers", drawerTab)}
        className={drawerTab === "barriers" ? pageStyles.tabPane : pageStyles.tabPaneHidden}
      >
        {activeRecord.blockReason ? (
          <div className={pageStyles.barrierBox}>
            <div className={pageStyles.barrierText}>
              <span className={pageStyles.barrierCause}>
                <StatusGlyph tone="danger" size={9} />
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

      <div
        {...tabPanelProps(tabIdPrefix, "transport", drawerTab)}
        className={drawerTab === "transport" ? pageStyles.tabPane : pageStyles.tabPaneHidden}
      >
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

      <div
        {...tabPanelProps(tabIdPrefix, "dossier", drawerTab)}
        className={drawerTab === "dossier" ? pageStyles.tabPane : pageStyles.tabPaneHidden}
      >
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
                        setDateMessage("Expected departure updated.");
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
                <TextInput
                  id="ward-discharge-new-time-input"
                  name="newExpectedDischargeTime"
                  type="time"
                  aria-label="New expected discharge time"
                  data-testid="ward-discharge-new-time-input"
                  disabled={datePending}
                  value={newTimeDraft}
                  onChange={(e) => setNewTimeDraft(e.target.value)}
                  required
                />
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
              <dt>Recorded blocker</dt>
              <dd className={pageStyles.blocker}>{activeRecord.blockReason}</dd>
            </>
          )}
          <dt>Recorded departure</dt>
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
}: {
  s: DischargeWorkspaceState;
  detailRelease: BedRelease;
  openOn: ReleasePanelPart | null;
}) {
  const tabIdPrefix = useId();
  const {
    dayZero,
    now,
    isPhone,
    phoneReleaseMore,
    setPhoneReleaseMore,
    drawerTab,
    setDrawerTab,
    readyChange,
    setReadyChange,
    ticksFor,
    setTick,
    linkedReleaseRecord,
    releaseOnCto,
    selectedUnit,
    detailTone,
    detailBadgeLabel,
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
  const heldUp = detailRelease.state !== "discharged" && detailRelease.blocker !== null;
  const badgeLabel = heldUp ? HELD_UP : detailBadgeLabel;
  const tabList = (hasBlocker: boolean) => (
    <DischargeDetailTabs
      idPrefix={tabIdPrefix}
      hasBlocker={hasBlocker}
      drawerTab={drawerTab}
      setDrawerTab={setDrawerTab}
    />
  );
  const releasePanelProps = (tab: DischargeWorkspaceState["drawerTab"]) =>
    isPhone ? {} : tabPanelProps(tabIdPrefix, tab, drawerTab);
  const personName = linkedReleaseRecord ? recordName(linkedReleaseRecord) : null;
  const wardName = unitLabel(selectedUnit, detailRelease.unitId);
  return (
    <>
      {isPhone ? (
        <>
          {/* Redesign (Josh, 30 Oct): the person leads, surname first; the ward second. */}
          <div className={pageStyles.phIdentity}>
            <h3 className={pageStyles.patientFullName}>{personName ?? wardName}</h3>
            <p className={pageStyles.phIdentityMeta}>
              {[
                personName ? wardName : null,
                healthServiceLabel(selectedUnit),
                linkedReleaseRecord?.identity.kind === "linked" ? linkedReleaseRecord.identity.patient.umrn : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {detailTone ? (
              <Badge tone={detailTone} size="sm">
                {badgeLabel}
              </Badge>
            ) : null}
          </div>
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
        </>
      ) : (
        <>
          <div className={pageStyles.identity}>
            <div className={pageStyles.identityText}>
              <div className={pageStyles.identityTitle}>
                <h3 className={pageStyles.patientFullName}>{personName ?? wardName}</h3>
                {detailTone ? (
                  <Badge tone={detailTone} size="sm">
                    {badgeLabel}
                  </Badge>
                ) : null}
              </div>
              <p className={pageStyles.identityMeta}>
                {linkedReleaseRecord?.identity.kind === "linked" && (
                  <span className={pageStyles.mono}>{linkedReleaseRecord.identity.patient.umrn}</span>
                )}
                <span>{wardName}</span>
                <span>{healthServiceLabel(selectedUnit)}</span>
              </p>
            </div>
          </div>
          <dl className={pageStyles.factTiles}>
            <div>
              <dt>{detailRelease.state === "discharged" ? "Released" : "Expected out"}</dt>
              <dd>
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
                <dd>{durMinutes(detailRelease.expectedAt - now)}</dd>
              </div>
            ) : (
              <div>
                <dt>Stage</dt>
                <dd>Departed</dd>
              </div>
            )}
          </dl>
        </>
      )}

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

      {isPhone ? null : tabList(Boolean(detailRelease.blocker))}

      <div {...releasePanelProps("milestones")} className={releasePaneClass("milestones")}>
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
                    label: "Recorded discharge blocker",
                    state: detailRelease.blocker ? ("blocked" as const) : ("pending" as const),
                    detail: detailRelease.blocker ?? "No discharge blocker recorded",
                  },
                ]),
            {
              label: "Physical departure",
              state: detailRelease.state === "discharged" ? "complete" : "pending",
              detail:
                linkedReleaseRecord?.leftAt != null
                  ? recordedMoment(linkedReleaseRecord.leftAt, dayZero)
                  : detailRelease.state === "discharged"
                    ? "Departure recorded; time not recorded"
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

      <div ref={panelRef} {...releasePanelProps("barriers")} className={releasePaneClass("barriers")}>
        <div ref={barrierRef} tabIndex={-1} className={releaseList.focusTarget} aria-label="Barriers">
          {detailRelease.blocker ? (
            <div className={pageStyles.barrierBox}>
              <div className={pageStyles.barrierText}>
                <span className={pageStyles.barrierCause}>
                  <StatusGlyph tone="danger" size={9} />
                  {detailRelease.blocker}
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
      <div {...releasePanelProps("transport")} className={releasePaneClass("transport")}>
        <dl className={pageStyles.factList}>
          <dt>Booking reference</dt>
          <dd>Not recorded</dd>
          <dt>Provider</dt>
          <dd>Not recorded</dd>
          <dt>Unit</dt>
          <dd>{wardName}</dd>
        </dl>
      </div>

      <div {...releasePanelProps("dossier")} className={releasePaneClass("dossier")}>
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
              <dt>Blocker</dt>
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

/** Nothing selected: the prompt and, on Now, the first blocked releases. */
export function DischargeRestingDetail({ s }: { s: DischargeWorkspaceState }) {
  const { units, population, records, releaseGroups, visibleReleaseGroups, selectRelease } = s;
  return (
    <div className={pageStyles.resting}>
      <EmptyState icon={ClipboardList} title="Select a record to view dates, blockers and ward follow-up." />
      {population === "releases" && visibleReleaseGroups.includes("blocked") && releaseGroups.blocked.length > 0 && (
        <div className={pageStyles.restingQueue}>
          <h3 className={pageStyles.sectionLabel}>
            Blocked <span className={pageStyles.groupCount}>{releaseGroups.blocked.length}</span>
          </h3>
          <ul>
            {releaseGroups.blocked.slice(0, 4).map((rel) => {
              const u = units.find((candidate) => candidate.id === rel.unitId);
              const l = records.find((candidate) => candidate.admissionId === rel.admissionId);
              return (
                <li key={rel.id}>
                  <button
                    type="button"
                    className={pageStyles.restingItem}
                    onClick={(e) => selectRelease(rel.id, e.currentTarget)}
                  >
                    <StatusGlyph tone="danger" size={9} />
                    <span className={pageStyles.restingItemText}>
                      <span className={pageStyles.restingItemTitle}>
                        {unitLabel(u, rel.unitId)} {l ? `· ${recordName(l)}` : ""}
                      </span>
                      <span className={pageStyles.secondary}>{rel.blocker}</span>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" className={pageStyles.restingArrow} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
