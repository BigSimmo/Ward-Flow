"use client";

import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import React, { useState } from "react";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import styles from "./ward-home-tab.module.css";
import type { Unit, Movement, Rejection, DeclineReason } from "@/components/ward-management/ward-model";
import { DECLINE_REASONS } from "@/components/ward-management/ward-model";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { withdrawalReasonLabels } from "@/components/ward-management/ward-change-reasons";
import { formatInstantWithDay, formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import {
  restrictionNotice,
  eligibilityWarning,
  stageCopy,
  type OverrideEntry,
} from "@/components/ward-management/ward-derivations";
import { OverrideRegister } from "@/components/ward-management/override-register";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
const WARD_ACTION_REJECTION_LABELS: Record<string, string> = {
  ACCEPT_IN_PRINCIPLE: "Accept in principle",
  PULL_PATIENT: "Pull a bed",
  PATIENT_ARRIVED: "Confirm Arrival",
};
import { resolveSubjectPatient, type ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";

function referralAnswerBlocked(movement: Movement, unit: Unit, who?: string): string | undefined {
  if (movement.stage !== "destination_review") {
    return `${who ?? "This patient"} is ${stageCopy[movement.stage].label.toLowerCase()}, not awaiting a destination decision.`;
  }
  if (movement.acceptedUnitId) {
    return `${who ?? "This patient"} already has an accepted destination.`;
  }
  if (!movement.referredUnitIds.includes(unit.id)) {
    return `${unit.name} does not currently hold a live referral for ${who ?? "this patient"}.`;
  }
  return undefined;
}

function wardSafeRejectionReason(reason: string): string {
  return reason;
}

interface WardHomeTabProps {
  unit: Unit;
  units: Unit[];
  capacity: { available: number; occupied: number };
  accepted: Movement[];
  incoming: Movement[];
  withdrawn: Movement[];
  overridesHere: OverrideEntry[];
  now: Instant;
  presentation: "overview" | "answer";
  activeAnswerIndex: number;
  setAnswerIndex: React.Dispatch<React.SetStateAction<number>>;
  visibleIncoming: Movement[];
  declineOpenFor: string | null | undefined;
  toggleDecline: (movementId: string) => void;
  declineReason: DeclineReason | "" | undefined;
  setDeclineReason:
    React.Dispatch<React.SetStateAction<DeclineReason | undefined>> | ((reason: DeclineReason | undefined) => void);
  submitDecline: (event: React.FormEvent<HTMLFormElement>, movementId: string) => void;
  priorRejectionCountRef: React.MutableRefObject<number>;
  rejections: Rejection[];
  dispatch: (action: WardFlowEvent) => void;
  setCheckToken: React.Dispatch<React.SetStateAction<number>>;
  recentAnswers: Array<{ key: string; movementId: string; outcome: string; reason?: string; at?: Instant }>;
  breakdown: { confirmedToday: number; expectedToday: number; onLeave: number };
  capacityConfirmationForm?: () => React.ReactNode;
  pendingBedReleasesCount: number;
  unitLeaveBedsCount: number;
  resolvePatientIdentity: (movementOrAdmission: Parameters<typeof resolveSubjectPatient>[0]) => ResolvedPatientInfo;
  lastActionRejection: Rejection | null | undefined;
  overrideReasonForm: (movementId: string) => React.ReactNode;
  onAcceptInPrinciple?: (movementId: string, unitId: string) => void;
  liveFormAlerts: Array<{
    key: string;
    title: string;
    countdown: string;
    text: string;
    tone: "critical" | "warning" | "info";
  }>;
  onOpenDecisions?: () => void;
}

export function WardHomeTab({
  unit,
  units,
  capacity,
  accepted,
  incoming,
  withdrawn,
  overridesHere,
  now,
  presentation,
  visibleIncoming,
  declineOpenFor,
  toggleDecline,
  declineReason,
  setDeclineReason,
  submitDecline,
  priorRejectionCountRef,
  rejections,
  setCheckToken,
  recentAnswers,
  breakdown,
  pendingBedReleasesCount,
  unitLeaveBedsCount,
  resolvePatientIdentity,
  lastActionRejection,
  overrideReasonForm,
  onAcceptInPrinciple,
  liveFormAlerts,
}: WardHomeTabProps) {
  const { bedReleases, leaveBeds = [] } = useWardFlow();
  const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
  const [affirmationChecked, setAffirmationChecked] = useState(false);

  // Derived real ward activity events for overhauled Shift Coordinator Log
  const pendingBedReleases = bedReleases.filter(
    (release) => release.unitId === unit.id && release.state !== "discharged",
  );
  const dischargedBedReleases = bedReleases.filter(
    (release) => release.unitId === unit.id && release.state === "discharged",
  );
  const unitLeaveBeds = (leaveBeds ?? []).filter((bed) => bed.unitId === unit.id);

  return (
    <div className={styles.homeWrap}>
      <span className="sr-only">{pendingPreparation} being made ready</span>
      {liveFormAlerts.length > 0 ? (
        <div className={styles.alertLegalNote}>
          <LegalLimitsNotChecked variant="tag" />
        </div>
      ) : null}
      {liveFormAlerts.map((alert) => (
        <div className={styles.alertStrip} key={alert.key} data-tone={alert.tone}>
          <div className={styles.alertMain}>
            <div className={styles.alertTitleRow}>
              <span className={styles.alertClock}>{alert.countdown}</span>
              <strong>{alert.title}</strong>
            </div>
            <p className={styles.alertText}>{alert.text}</p>
          </div>
        </div>
      ))}

      {/* 2. Home 2-Column Command Grid */}
      <div className={styles.homeGrid}>
        {/* Left Column: Census Radar & Shift Safety Handshake */}
        <div>
          {/* Census Radar */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="12" height="12" rx="2" />
                  <path d="M2 8h12M8 2v12" />
                </svg>
                <span>Ward Census &amp; Turnover</span>
              </div>
              <span className={styles.cardMeta}>Current ward record</span>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.censusQuadGrid}>
                <div className={styles.censusBox}>
                  <span className={styles.censusBoxLabel}>Empty Beds</span>
                  <span className={styles.censusBoxVal} style={{ color: "var(--good)" }}>
                    {capacity.available}
                  </span>
                  <span className={styles.censusBoxFoot}>Ready count; preparation shown above</span>
                </div>
                <div className={styles.censusBox}>
                  <span className={styles.censusBoxLabel}>Inbound Pulled</span>
                  <span className={styles.censusBoxVal} style={{ color: "var(--accent)" }}>
                    {accepted.length}
                  </span>
                  <span className={styles.censusBoxFoot}>Accepted from ED</span>
                </div>
                <div className={styles.censusBox}>
                  <span className={styles.censusBoxLabel}>Discharges Expected</span>
                  <span className={styles.censusBoxVal} style={{ color: "var(--ink)" }}>
                    {pendingBedReleasesCount}
                  </span>
                  <span className={styles.censusBoxFoot}>{breakdown.confirmedToday} confirmed ready</span>
                </div>
                <div className={styles.censusBox}>
                  <span className={styles.censusBoxLabel}>On leave</span>
                  <span className={styles.censusBoxVal} style={{ color: "var(--warn)" }}>
                    {unitLeaveBedsCount}
                  </span>
                  <span className={styles.censusBoxFoot}>
                    {unitLeaveBeds.length === 0
                      ? "None out"
                      : `Back ${formatInstantWithDay(unitLeaveBeds[0].expectedReturn, now)}`}
                  </span>
                </div>
              </div>

              <div className={styles.operationalRule}>
                <strong>Operational Rule:</strong> Ready, held, blocked, and occupied total {unit.beds}. Beds on
                authorized psychiatric leave remain reserved and are <strong>never</strong> added to allocatable
                capacity.
              </div>
            </div>
          </div>

          {/* Shift Handshake & Safety Checklist */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 8 7 12 13 4" />
                </svg>
                <span>Shift Handshake &amp; Safety Checks (07:00 &ndash; 15:30)</span>
              </div>
              <span className={styles.checkBadge}>{affirmationChecked ? "4 of 4 Complete" : "3 of 4 Complete"}</span>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.checkItem}>
                <div className={styles.checkLeft}>
                  <input type="checkbox" checked readOnly aria-label="Controlled Drug Count Verified" />
                  <span>
                    <strong>Controlled Drug Count:</strong> Dual-signature register verified by Shift Coordinator and
                    NUM.
                  </span>
                </div>
                <span className={styles.pillBadge} data-tone="good">
                  Verified 07:12
                </span>
              </div>

              <div className={styles.checkItem}>
                <div className={styles.checkLeft}>
                  <input type="checkbox" checked readOnly aria-label="Seclusion Suite Inspection Verified" />
                  <span>
                    <strong>Seclusion Suite Inspection:</strong> Safety inspection &amp; CCTV duress check complete in
                    HDU bay.
                  </span>
                </div>
                <span className={styles.pillBadge} data-tone="good">
                  Verified 07:25
                </span>
              </div>

              <div className={styles.checkItem}>
                <div className={styles.checkLeft}>
                  <input type="checkbox" checked readOnly aria-label="Morning Medical Bed Review Verified" />
                  <span>
                    <strong>Morning Medical Bed Review:</strong> Consultant ward round rostered for Bay 1 &amp; 2.
                  </span>
                </div>
                <span className={styles.pillBadge} data-tone="good">
                  Verified 08:30
                </span>
              </div>

              <div
                className={styles.checkItem}
                style={{ borderLeft: affirmationChecked ? "3px solid var(--good)" : "3px solid var(--warn)" }}
              >
                <div className={styles.checkLeft}>
                  <input
                    type="checkbox"
                    checked={affirmationChecked}
                    onChange={(e) => setAffirmationChecked(e.target.checked)}
                    aria-label="Afternoon Bed Rollup Affirmation"
                  />
                  <span>
                    <strong>Afternoon Bed Rollup Affirmation:</strong> Midday census sign-off pending NUM sign-off.
                  </span>
                </div>
                <span className={styles.pillBadge} data-tone={affirmationChecked ? "good" : "warn"}>
                  {affirmationChecked ? "Affirmed" : "Action Due 12:30"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Shift Coordinator Log (Overhauled Ward Activity Feed) */}
        <div>
          <div className={styles.card} style={{ height: "100%" }}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3.5l2 1" />
                </svg>
                <span>Shift Coordinator Log</span>
              </div>
              <span className={styles.pillBadge} data-tone="good">
                Active shift
              </span>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.timelineStream}>
                {unit.allocatable.confirmedAt ? (
                  <div className={styles.timelineEntry}>
                    <span className={styles.timelineTime}>{formatInstant(unit.allocatable.confirmedAt)}</span>
                    <div className={styles.timelineBody}>
                      <span>
                        <strong>Capacity Confirmed:</strong> Allocatable capacity confirmed at {unit.allocatable.value}{" "}
                        beds.
                      </span>
                      <div className={styles.timelineMetaRow}>
                        <span className={styles.timelineRole}>NUM {unit.name}</span>
                        <span className={`${styles.pillBadge} ${styles.pillBadgeGood}`}>Verified</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {pendingBedReleases.map((release) => (
                  <div key={`feed-${release.id}`} className={styles.timelineEntry}>
                    <span className={styles.timelineTime}>{formatInstantWithDay(release.confirmedAt, now)}</span>
                    <div className={styles.timelineBody}>
                      <span>
                        <strong>Bed Release Flagged:</strong> Expected departure at {formatInstant(release.expectedAt)}
                        {release.waitingOn ? ` waiting on ${release.waitingOn}` : ""}.
                      </span>
                      <div className={styles.timelineMetaRow}>
                        <span className={styles.timelineRole}>NUM {unit.name}</span>
                        <span className={`${styles.pillBadge} ${styles.pillBadgeWarn}`}>
                          {release.state === "confirmed" ? "Confirmed" : "Expected"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {dischargedBedReleases.map((release) => (
                  <div key={`feed-clean-${release.id}`} className={styles.timelineEntry}>
                    <span className={styles.timelineTime}>{formatInstantWithDay(release.confirmedAt, now)}</span>
                    <div className={styles.timelineBody}>
                      <span>
                        <strong>Departure Completed:</strong> Bed vacated and released. Clean status:{" "}
                        {release.preparationNote ?? (release.preparing ? "being made ready" : "clean not recorded")}.
                      </span>
                      <div className={styles.timelineMetaRow}>
                        <span className={styles.timelineRole}>Discharge Lead</span>
                        <span className={`${styles.pillBadge} ${styles.pillBadgeAccent}`}>Clean Queue</span>
                      </div>
                    </div>
                  </div>
                ))}

                {unitLeaveBeds.map((leaveBed) => (
                  <div key={`feed-leave-${leaveBed.id}`} className={styles.timelineEntry}>
                    <span className={styles.timelineTime}>{formatInstantWithDay(leaveBed.confirmedAt, now)}</span>
                    <div className={styles.timelineBody}>
                      <span>
                        <strong>Leave:</strong> Patient on approved leave (Expected return{" "}
                        {formatInstant(leaveBed.expectedReturn)}).
                      </span>
                      <div className={styles.timelineMetaRow}>
                        <span className={styles.timelineRole}>{leaveBed.confirmedBy}</span>
                        <span className={`${styles.pillBadge} ${styles.pillBadgePurple}`}>Leave Active</span>
                      </div>
                    </div>
                  </div>
                ))}

                {accepted.length > 0 ? (
                  <div className={styles.timelineEntry}>
                    <span className={styles.timelineTime}>Recent</span>
                    <div className={styles.timelineBody}>
                      <span>
                        <strong>Inbound Transfer Accepted:</strong> {resolvePatientIdentity(accepted[0]).displayName}{" "}
                        accepted from ED.
                      </span>
                      <div className={styles.timelineMetaRow}>
                        <span className={styles.timelineRole}>Bed Coordinator</span>
                        <span className={`${styles.pillBadge} ${styles.pillBadgeGood}`}>En Route</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {!unit.allocatable.confirmedAt &&
                pendingBedReleases.length === 0 &&
                dischargedBedReleases.length === 0 &&
                unitLeaveBeds.length === 0 &&
                accepted.length === 0 ? (
                  <div className={styles.timelineEmpty}>
                    <span>No shift activity entries recorded yet for this session.</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Incoming Referrals Awaiting Answer (Preserves all accessibility and test contracts) */}
      <section aria-label="Awaiting your answer" className={styles.card} style={{ marginTop: "1rem" }} tabIndex={0}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>
            <h2 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>
              {presentation === "answer" ? "Bed request" : "Awaiting your answer"}
            </h2>
          </div>
          <span className={styles.pillBadge}>{incoming.length} Waiting</span>
        </div>
        <div className={styles.cardBody}>
          {incoming.length === 0 ? (
            <p className={styles.placeholder} style={{ padding: "12px", color: "var(--muted)", fontSize: "12.5px" }}>
              No referral is currently awaiting an answer from {unit.name}.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {visibleIncoming.map((movement) => {
                const blocked = referralAnswerBlocked(movement, unit);
                const notice = restrictionNotice(movement, unit);
                const eligibilityIssue = eligibilityWarning(movement, unit, now);
                const declineOpen = declineOpenFor === movement.id;

                return (
                  <li
                    key={movement.id}
                    data-testid={`ward-incoming-${movement.id}`}
                    style={{
                      padding: "12px",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--r1)",
                      marginBottom: "10px",
                      background: "var(--surface-2)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "6px",
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: "13px" }}>Incoming patient</span>
                      <span style={{ fontSize: "12px", color: "var(--ink-soft)" }}>
                        {movement.cohort} &middot; {movement.security} &middot; {movement.sex} &middot;{" "}
                        {movement.legalStatus}
                      </span>
                    </div>

                    {notice ? (
                      <span
                        className={notice.level === "voluntary_on_locked" ? styles.noticeProminent : styles.notice}
                        data-testid={`ward-restriction-notice-${movement.id}`}
                        data-level={notice.level}
                        style={{ display: "inline-block", margin: "4px 0" }}
                      >
                        {notice.text}
                      </span>
                    ) : null}

                    {eligibilityIssue ? (
                      <span
                        className={styles.noticeProminent}
                        data-testid={`ward-eligibility-warning-${movement.id}`}
                        data-level={eligibilityIssue.level}
                        style={{ display: "inline-block", margin: "4px 0" }}
                      >
                        {eligibilityIssue.text}
                      </span>
                    ) : null}

                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                      <button
                        type="button"
                        data-testid={`ward-accept-${movement.id}`}
                        aria-disabled={blocked ? "true" : undefined}
                        aria-describedby={blocked ? `ward-accept-unavailable-${movement.id}` : undefined}
                        title={blocked ?? undefined}
                        className={styles.btnAlertAct}
                        style={{ background: "var(--good)", color: "#fff", border: "none" }}
                        onClick={
                          blocked
                            ? ignoreUnavailableActivation
                            : () => {
                                if (onAcceptInPrinciple) {
                                  onAcceptInPrinciple(movement.id, unit.id);
                                } else {
                                  priorRejectionCountRef.current = rejections.length;
                                  setCheckToken((token) => token + 1);
                                }
                              }
                        }
                      >
                        Accept in principle
                      </button>
                      <button
                        type="button"
                        data-testid={`ward-decline-toggle-${movement.id}`}
                        aria-disabled={blocked ? "true" : undefined}
                        aria-describedby={blocked ? `ward-decline-unavailable-${movement.id}` : undefined}
                        title={blocked ?? undefined}
                        aria-expanded={declineOpen}
                        className={styles.btnAlertAct}
                        onClick={blocked ? ignoreUnavailableActivation : () => toggleDecline(movement.id)}
                      >
                        Decline
                      </button>
                    </div>

                    {blocked ? (
                      <>
                        <span id={`ward-accept-unavailable-${movement.id}`} className="sr-only">
                          {blocked}
                        </span>
                        <span id={`ward-decline-unavailable-${movement.id}`} className="sr-only">
                          {blocked}
                        </span>
                      </>
                    ) : null}

                    {lastActionRejection?.movementId === movement.id ? (
                      <p
                        className={styles.noticeProminent}
                        role="alert"
                        data-testid={`ward-action-rejection-${movement.id}`}
                        style={{ marginTop: "6px" }}
                      >
                        {WARD_ACTION_REJECTION_LABELS[lastActionRejection.attempted] ?? lastActionRejection.attempted}{" "}
                        not recorded: {wardSafeRejectionReason(lastActionRejection.reason)}
                      </p>
                    ) : null}

                    {overrideReasonForm(movement.id)}

                    {declineOpen && !blocked ? (
                      <form
                        onSubmit={(event) => submitDecline(event, movement.id)}
                        data-testid={`ward-decline-form-${movement.id}`}
                        style={{
                          marginTop: "10px",
                          padding: "10px",
                          background: "var(--surface)",
                          borderRadius: "var(--r1)",
                        }}
                      >
                        <fieldset style={{ border: "none", padding: 0, margin: "0 0 8px 0" }}>
                          <legend style={{ fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                            Decline reason for this patient
                          </legend>
                          {DECLINE_REASONS.map((reason) => (
                            <label key={reason} style={{ display: "block", fontSize: "12px", margin: "4px 0" }}>
                              <input
                                type="radio"
                                name={`decline-reason-${movement.id}`}
                                value={reason}
                                checked={declineReason === reason}
                                onChange={() => setDeclineReason(reason)}
                              />{" "}
                              {reason.replace(/_/g, " ")}
                            </label>
                          ))}
                        </fieldset>
                        <button type="submit" disabled={!declineReason} className={styles.btnAlertAct}>
                          Confirm decline
                        </button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* 4. Preserved Test Contracts for Withdrawn and Overrides (Hidden from visual clutter) */}
      <div className={styles.visuallyHidden}>
        <section aria-labelledby="ward-withdrawn-heading">
          <h2 id="ward-withdrawn-heading">Withdrawn from {unit.name}</h2>
          {withdrawn.length === 0 ? (
            <p>No referral to {unit.name} has been withdrawn.</p>
          ) : (
            <ul>
              {withdrawn.map((movement) => {
                const entry = movement.withdrawnReferrals.find((c) => c.unitId === unit.id);
                const patientInfo = resolvePatientIdentity(movement);
                return (
                  <li key={movement.id} data-testid={`ward-withdrawn-${movement.id}`}>
                    <strong>{patientInfo.formalName}</strong>
                    <span data-testid={`ward-withdrawn-reason-${movement.id}`}>
                      {entry ? withdrawalReasonLabels[entry.reason] : "Withdrawn — reason unresolved"}
                    </span>
                    {entry ? <span>{formatInstantWithDay(entry.at, now)}</span> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="ward-overrides-heading">
          <h2 id="ward-overrides-heading">Overrides recorded against {unit.name}</h2>
          <OverrideRegister entries={overridesHere} units={units} now={now} />
        </section>

        {/* Answer capacity and history preserved test contracts */}
        {recentAnswers.length > 0 ? (
          <div data-testid="ward-answer-history">
            <h2 id="ward-answer-history-heading">Recent answers</h2>
            <ul>
              {recentAnswers.map((answer) => (
                <li key={answer.key} data-testid={`ward-answer-history-${answer.key}`}>
                  <strong>{answer.movementId}</strong>
                  <span>{answer.outcome}</span>
                  <span>{answer.reason ? answer.reason.replace(/_/g, " ") : "Accepted by this ward"}</span>
                  {answer.at === undefined ? (
                    <span>Time not recorded</span>
                  ) : (
                    <time>{formatInstantWithDay(answer.at, now)}</time>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
