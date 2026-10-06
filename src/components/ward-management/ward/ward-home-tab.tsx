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
    actionLabel?: string;
    actionTarget?: "answer" | "arrival" | "discharges";
    movementId?: string;
  }>;
  onOpenDecisions?: () => void;
  morningRollupConfirmed?: boolean;
  onConfirmMorningRollup?: () => void;
  onOpenConfirmNumbers?: () => void;
  onOpenArrival?: (movementId: string) => void;
  onOpenDischarges?: () => void;
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
  morningRollupConfirmed = false,
  onConfirmMorningRollup,
  onOpenConfirmNumbers,
  onOpenArrival,
  onOpenDischarges,
}: WardHomeTabProps) {
  const { bedReleases, leaveBeds = [] } = useWardFlow();
  const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
  const [localChecks, setLocalChecks] = useState<Record<string, Instant | null>>({
    drugs: null,
    seclusion: null,
    afternoon: null,
  });
  const [sidePane, setSidePane] = useState<"log" | "awaiting">(presentation === "answer" ? "awaiting" : "log");

  // Derived real ward activity events for overhauled Shift Coordinator Log
  const pendingBedReleases = bedReleases.filter(
    (release) => release.unitId === unit.id && release.state !== "discharged",
  );
  const dischargedBedReleases = bedReleases.filter(
    (release) => release.unitId === unit.id && release.state === "discharged",
  );
  const unitLeaveBeds = (leaveBeds ?? []).filter((bed) => bed.unitId === unit.id);
  const soonestLeaveReturn = unitLeaveBeds.reduce<Instant | null>((soonest, bed) => {
    if (soonest === null || bed.expectedReturn < soonest) return bed.expectedReturn;
    return soonest;
  }, null);

  function toggleLocalCheck(id: string) {
    setLocalChecks((current) => ({ ...current, [id]: current[id] === null ? now : null }));
  }

  function focusAwaiting() {
    setSidePane("awaiting");
    window.requestAnimationFrame(() => {
      const target = document.getElementById("ward-awaiting-answer");
      target?.scrollIntoView({ block: "nearest" });
      target?.focus();
    });
  }

  function runAlert(alert: (typeof liveFormAlerts)[number]) {
    if (alert.actionTarget === "answer") {
      focusAwaiting();
      return;
    }
    if (alert.actionTarget === "arrival" && alert.movementId) onOpenArrival?.(alert.movementId);
    if (alert.actionTarget === "discharges") onOpenDischarges?.();
  }

  const capacityConfirmed = unit.allocatable.confirmedAt !== undefined;
  const referralsClear = incoming.length === 0;
  const shiftChecks = [
    capacityConfirmed,
    morningRollupConfirmed,
    referralsClear,
    localChecks.drugs !== null,
    localChecks.seclusion !== null,
    localChecks.afternoon !== null,
  ];
  const checksDone = shiftChecks.filter(Boolean).length;

  type LogRow = {
    key: string;
    at: number;
    timeLabel: string;
    title: string;
    detail: string;
    status: string;
    nested?: Array<{ key: string; detail: string }>;
  };
  const logRows: LogRow[] = [];
  if (capacityConfirmed && unit.allocatable.confirmedAt !== undefined) {
    logRows.push({
      key: "capacity",
      at: unit.allocatable.confirmedAt,
      timeLabel: formatInstant(unit.allocatable.confirmedAt),
      title: "Capacity confirmed",
      detail: `${unit.allocatable.value} beds allocatable`,
      status: "Verified",
    });
  }
  if (pendingBedReleases.length === 1) {
    const release = pendingBedReleases[0];
    logRows.push({
      key: release.id,
      at: release.confirmedAt,
      timeLabel: formatInstant(release.confirmedAt),
      title: "Bed expected out",
      detail: `Departure ${formatInstant(release.expectedAt)}${release.waitingOn ? ` · ${release.waitingOn}` : ""}`,
      status: release.state === "confirmed" ? "Confirmed" : "Expected",
    });
  } else if (pendingBedReleases.length > 1) {
    const ordered = [...pendingBedReleases].sort((left, right) => left.expectedAt - right.expectedAt);
    const next = ordered[0];
    logRows.push({
      key: "releases",
      at: Math.max(...pendingBedReleases.map((release) => release.confirmedAt)),
      timeLabel: formatInstant(Math.max(...pendingBedReleases.map((release) => release.confirmedAt))),
      title: `${pendingBedReleases.length} beds expected out`,
      detail: `Next at ${formatInstant(next.expectedAt)}`,
      status: "Expected",
      nested: ordered.map((release) => ({
        key: release.id,
        detail: `${formatInstant(release.expectedAt)}${release.waitingOn ? ` · ${release.waitingOn}` : ""}`,
      })),
    });
  }
  for (const release of dischargedBedReleases) {
    logRows.push({
      key: `clean-${release.id}`,
      at: release.confirmedAt,
      timeLabel: formatInstant(release.confirmedAt),
      title: "Departure completed",
      detail: release.preparationNote ?? (release.preparing ? "Being made ready" : "Clean not recorded"),
      status: "Clean",
    });
  }
  for (const leaveBed of unitLeaveBeds) {
    logRows.push({
      key: `leave-${leaveBed.id}`,
      at: leaveBed.confirmedAt,
      timeLabel: formatInstant(leaveBed.confirmedAt),
      title: "Approved leave",
      detail: `Expected back ${formatInstant(leaveBed.expectedReturn)}`,
      status: "Leave",
    });
  }
  if (accepted.length > 0) {
    logRows.push({
      key: "inbound",
      at: now,
      timeLabel: "Now",
      title: "Inbound accepted",
      detail: `${resolvePatientIdentity(accepted[0]).displayName}${accepted.length > 1 ? ` and ${accepted.length - 1} more` : ""}`,
      status: "En route",
    });
  }
  logRows.sort((left, right) => right.at - left.at);

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
          <span className={styles.alertClock}>{alert.countdown}</span>
          <div className={styles.alertMain}>
            <strong>{alert.title}</strong>
            <p className={styles.alertText}>{alert.text}</p>
          </div>
          {alert.actionLabel ? (
            <button type="button" className={styles.btnAlertAct} onClick={() => runAlert(alert)}>
              {alert.actionLabel}
            </button>
          ) : null}
        </div>
      ))}

      <div className={styles.homeGrid}>
        <div className={`${styles.card} ${styles.bedsCard}`}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>
              <span>Beds now</span>
            </div>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.censusRow}>
              <div className={styles.censusMetric}>
                <span className={styles.censusBoxLabel}>Empty</span>
                <span className={styles.censusBoxVal} data-tone="good">
                  {capacity.available}
                </span>
                <span className={styles.censusBoxFoot}>Ready</span>
              </div>
              <div className={styles.censusMetric}>
                <span className={styles.censusBoxLabel}>Inbound</span>
                <span className={styles.censusBoxVal}>{accepted.length}</span>
                <span className={styles.censusBoxFoot}>Accepted</span>
              </div>
              <div className={styles.censusMetric}>
                <span className={styles.censusBoxLabel}>Leaving today</span>
                <span className={styles.censusBoxVal}>{pendingBedReleasesCount}</span>
                <span className={styles.censusBoxFoot}>{breakdown.confirmedToday} confirmed</span>
              </div>
              <div className={styles.censusMetric}>
                <span className={styles.censusBoxLabel}>On leave</span>
                <span className={styles.censusBoxVal} data-tone={unitLeaveBedsCount > 0 ? "warn" : undefined}>
                  {unitLeaveBedsCount}
                </span>
                <span className={styles.censusBoxFoot}>
                  {soonestLeaveReturn === null ? "None due" : `Back ${formatInstant(soonestLeaveReturn)}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={`${styles.card} ${styles.checksCard}`}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>
              <span>Shift checks</span>
            </div>
            <span className={styles.checkBadge}>
              {checksDone} of {shiftChecks.length} done
            </span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.checkItem}>
              <div className={styles.checkLeft}>
                <span className={styles.checkMark} data-done={capacityConfirmed} aria-hidden="true" />
                <span>
                  <strong>Capacity numbers.</strong>{" "}
                  {capacityConfirmed && unit.allocatable.confirmedAt !== undefined
                    ? `Confirmed ${formatInstant(unit.allocatable.confirmedAt)}.`
                    : "Not confirmed this shift."}
                </span>
              </div>
              {capacityConfirmed ? (
                <span className={styles.statusWord} data-tone="good">
                  Verified
                </span>
              ) : (
                <button type="button" className={styles.btnAlertAct} onClick={() => onOpenConfirmNumbers?.()}>
                  Confirm
                </button>
              )}
            </div>
            <div className={styles.checkItem}>
              <div className={styles.checkLeft}>
                <span className={styles.checkMark} data-done={morningRollupConfirmed} aria-hidden="true" />
                <span>
                  <strong>Morning rollup.</strong> {morningRollupConfirmed ? "Confirmed today." : "Still due."}
                </span>
              </div>
              {morningRollupConfirmed ? (
                <span className={styles.statusWord} data-tone="good">
                  Verified
                </span>
              ) : (
                <button type="button" className={styles.btnAlertAct} onClick={() => onConfirmMorningRollup?.()}>
                  Confirm
                </button>
              )}
            </div>
            <div className={styles.checkItem}>
              <div className={styles.checkLeft}>
                <span className={styles.checkMark} data-done={referralsClear} aria-hidden="true" />
                <span>
                  <strong>Unanswered referrals.</strong>{" "}
                  {referralsClear ? "None waiting." : `${incoming.length} waiting.`}
                </span>
              </div>
              {referralsClear ? (
                <span className={styles.statusWord} data-tone="good">
                  Clear
                </span>
              ) : (
                <button type="button" className={styles.btnAlertAct} onClick={focusAwaiting}>
                  Answer
                </button>
              )}
            </div>
            {(
              [
                ["drugs", "Controlled drug count", "Tick when the register has been checked."],
                ["seclusion", "Seclusion check", "Tick when the suite and duress alarm have been checked."],
                ["afternoon", "Afternoon sign-off", "Tick when the midday numbers have been signed."],
              ] as const
            ).map(([id, label, hint]) => (
              <div className={styles.checkItem} key={id}>
                <label className={styles.checkLeft}>
                  <input
                    type="checkbox"
                    checked={localChecks[id] !== null}
                    onChange={() => toggleLocalCheck(id)}
                    aria-label={label}
                  />
                  <span>
                    <strong>{label}.</strong> {hint} On this screen only. Not sent.
                  </span>
                </label>
                <span className={styles.statusWord} data-tone={localChecks[id] !== null ? "good" : "warn"}>
                  {localChecks[id] !== null ? formatInstant(localChecks[id]) : "Due"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.sideColumn}>
          <div className={styles.sideSwitch} role="tablist" aria-label="Shift log or awaiting answer">
            <button
              type="button"
              role="tab"
              aria-selected={sidePane === "log"}
              className={styles.sideSwitchBtn}
              onClick={() => setSidePane("log")}
            >
              Shift log
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sidePane === "awaiting"}
              className={styles.sideSwitchBtn}
              onClick={() => setSidePane("awaiting")}
            >
              Awaiting your answer
              <span className={styles.sideCount}>{incoming.length}</span>
            </button>
          </div>
          <div className={styles.logCard} data-active={sidePane === "log" ? "true" : "false"}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <span>Shift log</span>
              </div>
              <span className={styles.statusWord} data-tone="good">
                Active
              </span>
            </div>
            <div className={styles.logBody}>
              {logRows.length === 0 ? (
                <p className={styles.timelineEmpty}>No shift activity recorded yet.</p>
              ) : (
                <ol className={styles.timelineStream}>
                  {logRows.map((row) => (
                    <li key={row.key} className={styles.timelineEntry}>
                      <span className={styles.timelineTime}>{row.timeLabel}</span>
                      <span className={styles.timelineDot} aria-hidden="true" />
                      <span className={styles.timelineBody}>
                        <strong>{row.title}</strong>
                        <span className={styles.timelineDetail}>{row.detail}</span>
                        {row.nested ? (
                          <details className={styles.timelineMore}>
                            <summary>Times ({row.nested.length})</summary>
                            <ul className={styles.timelineNested}>
                              {row.nested.map((item) => (
                                <li key={item.key}>{item.detail}</li>
                              ))}
                            </ul>
                          </details>
                        ) : null}
                      </span>
                      <span className={styles.statusWord}>{row.status}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <section
            id="ward-awaiting-answer"
            aria-label="Awaiting your answer"
            className={`${styles.card} ${styles.awaitingCard}`}
            data-active={sidePane === "awaiting" ? "true" : "false"}
            tabIndex={0}
          >
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <h2 className={styles.awaitingHeading}>
                  {presentation === "answer" ? "Bed request" : "Awaiting your answer"}
                </h2>
              </div>
              <span className={styles.statusWord}>{incoming.length} waiting</span>
            </div>
            <div className={styles.cardBody}>
              {incoming.length === 0 ? (
                <p className={styles.placeholder}>No referral is currently awaiting an answer from {unit.name}.</p>
              ) : (
                <ul className={styles.awaitingList}>
                  {visibleIncoming.map((movement) => {
                    const blocked = referralAnswerBlocked(movement, unit);
                    const notice = restrictionNotice(movement, unit);
                    const eligibilityIssue = eligibilityWarning(movement, unit, now);
                    const declineOpen = declineOpenFor === movement.id;

                    return (
                      <li key={movement.id} className={styles.awaitingRow} data-testid={`ward-incoming-${movement.id}`}>
                        <div className={styles.awaitingIdentity}>
                          <span className={styles.awaitingName}>Incoming patient</span>
                          <span className={styles.awaitingMeta}>
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

                        <div className={styles.awaitingActions}>
                          <button
                            type="button"
                            data-testid={`ward-accept-${movement.id}`}
                            aria-disabled={blocked ? "true" : undefined}
                            aria-describedby={blocked ? `ward-accept-unavailable-${movement.id}` : undefined}
                            title={blocked ?? undefined}
                            className={`${styles.btnAlertAct} ${styles.btnAccept}`}
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
                            {WARD_ACTION_REJECTION_LABELS[lastActionRejection.attempted] ??
                              lastActionRejection.attempted}{" "}
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
        </div>
      </div>

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
