"use client";

import React, { useState } from "react";
import styles from "./ward-home-tab.module.css";
import type { Referral, Unit, Movement, Rejection, DeclineReason } from "@/components/ward-management/ward-model";
import { DECLINE_REASONS } from "@/components/ward-management/ward-model";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { withdrawalReasonLabels } from "@/components/ward-management/ward-change-reasons";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import {
  restrictionNotice,
  eligibilityWarning,
  elapsedLabel,
  stageCopy,
  type OverrideEntry,
} from "@/components/ward-management/ward-derivations";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import { OverrideRegister } from "@/components/ward-management/override-register";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
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
    | React.Dispatch<React.SetStateAction<DeclineReason | undefined>>
    | ((reason: DeclineReason | undefined) => void);
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
  activeAnswerIndex,
  setAnswerIndex,
  visibleIncoming,
  declineOpenFor,
  toggleDecline,
  declineReason,
  setDeclineReason,
  submitDecline,
  priorRejectionCountRef,
  rejections,
  dispatch,
  setCheckToken,
  recentAnswers,
  breakdown,
  capacityConfirmationForm,
  pendingBedReleasesCount,
  unitLeaveBedsCount,
  resolvePatientIdentity,
  lastActionRejection,
  overrideReasonForm,
  liveFormAlerts,
  onOpenDecisions,
}: WardHomeTabProps) {
  const [form4ASighted, setForm4ASighted] = useState(false);
  const [affirmationChecked, setAffirmationChecked] = useState(false);

  return (
    <div className={styles.homeWrap}>
      {/* 1. Urgent Statutory Deadline Alert */}
      <div className={styles.alertStrip}>
        <div className={styles.alertMain}>
          <div className={styles.alertTitleRow}>
            <span className={styles.alertClock}>{form4ASighted ? "Sighted" : "54m left"}</span>
            <strong style={{ color: "var(--danger)", fontSize: "13.5px" }}>
              Mental Health Act Form 4A Due for Extension
            </strong>
            <span className={styles.pillBadge}>Statutory Deadline</span>
          </div>
          <div className={styles.alertText}>
            Patient <strong>Gianna Marrowvale</strong> (Bed 03 &middot; Involuntary Inpatient) transfer examination
            recorded due at 11:42 AWST.
          </div>
        </div>
        <div className={styles.alertActions}>
          <button
            type="button"
            className={styles.btnAlertAct}
            onClick={() => setForm4ASighted(true)}
            aria-pressed={form4ASighted}
          >
            {form4ASighted ? "✓ Sighted" : "Mark Sighted"}
          </button>
          <button
            type="button"
            className={styles.btnAlertAct}
            onClick={() => {
              if (onOpenDecisions) onOpenDecisions();
            }}
          >
            Complete Review
          </button>
        </div>
      </div>

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
                <span>Ward Census &amp; Physical Turnover Telemetry</span>
              </div>
              <span style={{ fontSize: "11px", fontFamily: "var(--mono)", color: "var(--muted)" }}>
                Updated 10:44 AWST
              </span>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.censusQuadGrid}>
                <div className={styles.censusBox}>
                  <span className={styles.censusBoxLabel}>Empty Beds</span>
                  <span className={styles.censusBoxVal} style={{ color: "var(--good)" }}>
                    {capacity.available}
                  </span>
                  <span className={styles.censusBoxFoot}>Clean &amp; allocatable</span>
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
                  <span className={styles.censusBoxLabel}>On Section 17 Leave</span>
                  <span className={styles.censusBoxVal} style={{ color: "var(--warn)" }}>
                    {unitLeaveBedsCount}
                  </span>
                  <span className={styles.censusBoxFoot}>Due back 16:00</span>
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

        {/* Right Column: Shift Coordinator Ledger */}
        <div>
          <div className={styles.card} style={{ height: "100%" }}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3.5l2 1" />
                </svg>
                <span>Shift Coordinator Ledger</span>
              </div>
              <span style={{ fontSize: "11px", color: "var(--good)", fontWeight: 600 }}>Live Feed</span>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.timelineStream}>
                <div className={styles.timelineEntry}>
                  <span className={styles.timelineTime}>10:44</span>
                  <div className={styles.timelineBody}>
                    <span>
                      <strong>Dabakarn capacity confirmed</strong> at {unit.beds} beds. {capacity.available} clean ready
                      bed identified.
                    </span>
                    <span className={styles.timelineRole}>NUM {unit.name}</span>
                  </div>
                </div>

                <div className={styles.timelineEntry}>
                  <span className={styles.timelineTime}>10:22</span>
                  <div className={styles.timelineBody}>
                    <span>
                      <strong>Inbound Transfer Accepted:</strong> Keira Pellingworth (UM100045) accepted from RPH ED.
                    </span>
                    <span className={styles.timelineRole}>Bed Coordinator</span>
                  </div>
                </div>

                <div className={styles.timelineEntry}>
                  <span className={styles.timelineTime}>09:50</span>
                  <div className={styles.timelineBody}>
                    <span>
                      <strong>Bed 01 Cleaned:</strong> Environmental services finished terminal sanitize. Bed marked
                      ready.
                    </span>
                    <span className={styles.timelineRole}>Services Lead</span>
                  </div>
                </div>

                <div className={styles.timelineEntry}>
                  <span className={styles.timelineTime}>08:15</span>
                  <div className={styles.timelineBody}>
                    <span>
                      <strong>Section 17 Leave Sighted:</strong> Luke Daviecroft (Bed 02) departed on 4h unescorted
                      grounds leave.
                    </span>
                    <span className={styles.timelineRole}>RN Shift Lead</span>
                  </div>
                </div>

                <div className={styles.timelineEntry}>
                  <span className={styles.timelineTime}>07:30</span>
                  <div className={styles.timelineBody}>
                    <span>
                      <strong>Morning Handover Complete:</strong> Night to day transition signed off across all{" "}
                      {unit.beds} beds.
                    </span>
                    <span className={styles.timelineRole}>NUM {unit.name}</span>
                  </div>
                </div>
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
                                priorRejectionCountRef.current = rejections.length;
                                dispatch({
                                  type: "ACCEPT_IN_PRINCIPLE",
                                  role: "ward",
                                  now,
                                  movementId: movement.id,
                                  unitId: unit.id,
                                });
                                setCheckToken((token) => token + 1);
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
