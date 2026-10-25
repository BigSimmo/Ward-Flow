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
import { Badge, Button, EmptyState, StatusGlyph, TextInput, buttonClass, durMinutes } from "@/components/wf";
import { DischargeFollowUp } from "./discharge-follow-up";
import { ReadyToLeave } from "./discharge-ready-to-leave";
import { SupportNotificationChecklist } from "../movements/support-notification-checklist";
import pageStyles from "./discharges-third-edition.module.css";
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
import type { DischargeWorkspaceState } from "./use-discharge-workspace-state";

/* The discharge detail panel's three states, moved unchanged from `discharge-board.tsx`. */

const DETAIL_TABS = [
  ["milestones", "Milestones"],
  ["barriers", "Barriers"],
  ["transport", "Transport"],
  ["dossier", "Dossier"],
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
  return (
    <div className={pageStyles.drawerTabs} role="tablist" aria-label="Discharge inspection sections">
      {DETAIL_TABS.map(([id, label], index) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${id}`}
          aria-controls={`${idPrefix}-panel-${id}`}
          aria-selected={drawerTab === id}
          tabIndex={drawerTab === id ? 0 : -1}
          className={`${pageStyles.drawerTab} ${drawerTab === id ? pageStyles.drawerTabActive : ""}`}
          onClick={() => setDrawerTab(id)}
          onKeyDown={(event) => {
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? DETAIL_TABS.length - 1
                  : event.key === "ArrowRight"
                    ? (index + 1) % DETAIL_TABS.length
                    : event.key === "ArrowLeft"
                      ? (index - 1 + DETAIL_TABS.length) % DETAIL_TABS.length
                      : null;
            if (next === null) return;
            event.preventDefault();
            setDrawerTab(DETAIL_TABS[next][0]);
            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
          }}
        >
          {label}
          {id === "barriers" && hasBlocker ? <span className={pageStyles.tabBadgeAlert}>!</span> : null}
        </button>
      ))}
    </div>
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
          title={isPhone ? "Milestones" : undefined}
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

/** A bed release opened from Now: the phone sheet or the desktop panel, milestones, barriers and dossier. */
export function DischargeReleaseDetail({
  s,
  detailRelease,
}: {
  s: DischargeWorkspaceState;
  detailRelease: BedRelease;
}) {
  const tabIdPrefix = useId();
  const {
    dayZero,
    now,
    setPopulation,
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
    openRecord,
    detailTone,
    detailBadgeLabel,
    releasePaneClass,
  } = s;
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
  return (
    <>
      {isPhone ? (
        <>
          {/* v10 phone release sheet: the ward leads; person and UMRN on one subline. */}
          <div className={pageStyles.phIdentity}>
            <h3 className={pageStyles.patientFullName}>{unitLabel(selectedUnit, detailRelease.unitId)}</h3>
            <p className={pageStyles.phIdentityMeta}>
              {[
                healthServiceLabel(selectedUnit),
                linkedReleaseRecord ? recordName(linkedReleaseRecord) : null,
                linkedReleaseRecord?.identity.kind === "linked" ? linkedReleaseRecord.identity.patient.umrn : null,
              ]
                .filter(Boolean)
                .join("\u00a0· ")}
            </p>
            {detailTone ? (
              <Badge tone={detailTone} size="sm">
                {detailBadgeLabel}
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
            <div>
              <dt>When</dt>
              <dd>
                {detailRelease.state === "discharged"
                  ? "Departed"
                  : detailRelease.expectedAt < now
                    ? "Past the ward's date"
                    : BAND_LABELS[releaseBand(detailRelease, now) as ReleaseBand]}
              </dd>
            </div>
            <div>
              <dt>Against date</dt>
              <dd>
                {detailRelease.state !== "discharged" && detailRelease.expectedAt < now ? (
                  <>
                    <StatusGlyph tone="danger" size={9} /> {durMinutes(now - detailRelease.expectedAt)} past
                  </>
                ) : detailRelease.state !== "discharged" ? (
                  `In ${durMinutes(detailRelease.expectedAt - now)}`
                ) : (
                  "Met"
                )}
              </dd>
            </div>
            <div>
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
              <h3 className={pageStyles.patientFullName}>
                {linkedReleaseRecord ? recordName(linkedReleaseRecord) : unitLabel(selectedUnit, detailRelease.unitId)}
              </h3>
              <p className={pageStyles.identityMeta}>
                {linkedReleaseRecord?.identity.kind === "linked" && (
                  <span className={pageStyles.mono}>UMRN {linkedReleaseRecord.identity.patient.umrn}</span>
                )}
                <span>{unitLabel(selectedUnit, detailRelease.unitId)}</span>
                <span>{healthServiceLabel(selectedUnit)}</span>
              </p>
            </div>
            {detailTone ? (
              <Badge tone={detailTone} size="sm">
                {detailBadgeLabel}
              </Badge>
            ) : null}
          </div>
          <dl className={pageStyles.detailStats}>
            {detailRelease.state !== "discharged" && detailRelease.expectedAt < now ? (
              <div>
                <dt>Overdue</dt>
                <dd>{durMinutes(now - detailRelease.expectedAt)}</dd>
              </div>
            ) : detailRelease.state !== "discharged" ? (
              <div>
                <dt>Due in</dt>
                <dd>{durMinutes(detailRelease.expectedAt - now)}</dd>
              </div>
            ) : null}
            <div>
              <dt>{detailRelease.state === "discharged" ? "Released" : "Expected"}</dt>
              <dd>
                {recordedMoment(
                  detailRelease.state === "discharged" ? detailRelease.confirmedAt : detailRelease.expectedAt,
                  dayZero,
                )}
              </dd>
            </div>
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
      ) : linkedReleaseRecord ? (
        <Button
          variant="ghost"
          size="sm"
          className={pageStyles.bridgeButton}
          onClick={(e) => {
            setPopulation("records");
            openRecord(linkedReleaseRecord, e.currentTarget);
          }}
        >
          View patient discharge record →
        </Button>
      ) : null}

      {isPhone ? null : tabList(Boolean(detailRelease.blocker))}

      <div {...releasePanelProps("milestones")} className={releasePaneClass("milestones")}>
        <RecordedDischargeMilestones
          title={isPhone ? "Milestones" : undefined}
          milestones={[
            {
              label: "Expected discharge date",
              state: "complete",
              detail: recordedMoment(detailRelease.expectedAt, dayZero),
            },
            {
              label: "Release stage recorded",
              state: detailRelease.state === "expected" ? "pending" : "complete",
              detail: `${detailRelease.state} · ${recordedMoment(detailRelease.confirmedAt, dayZero)}`,
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
            Preparation recorded: {detailRelease.preparationNote ?? "Reason not recorded"}. This is informational and
            does not establish completion.
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

      <div {...releasePanelProps("barriers")} className={releasePaneClass("barriers")}>
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
            <p className={pageStyles.note}>Clinical, pharmacy and transit clearance are not recorded here.</p>
          </div>
        )}
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
          {phoneReleaseMore ? "Hide transport and dossier" : "Show transport and dossier"}
        </button>
      ) : null}
      <div {...releasePanelProps("transport")} className={releasePaneClass("transport")}>
        <dl className={pageStyles.factList}>
          <dt>Booking reference</dt>
          <dd>Not recorded</dd>
          <dt>Provider</dt>
          <dd>Not recorded</dd>
          <dt>Unit</dt>
          <dd>{unitLabel(selectedUnit, detailRelease.unitId)}</dd>
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
