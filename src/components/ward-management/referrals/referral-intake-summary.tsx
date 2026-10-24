"use client";

import { formatInstantWithDay, type Instant } from "../ward-clock";
import { useOptionalWardFlowSelect } from "../ward-flow-provider";
import { clearanceChecklistWords, referralNeedsWords, type ReferralIntakeDetails } from "./referral-submission";
import { ReferralDocumentLinks } from "./referral-flow-panels";
import styles from "./ward-referral-drawer.module.css";

/**
 * A submitted Perth time ("2026-10-24T10:00+08:00") read as every other referral time is: the
 * board clock, with its day when it is not today. A view rendered without the provider (some
 * tests) has no board day to place it on, so it shows the clock face typed. Undefined when nothing
 * usable was recorded.
 */
export function submittedTime(
  value: string | undefined,
  board: { now: Instant; dayZero: Date } | null,
): string | undefined {
  const at = value === undefined ? NaN : Date.parse(value);
  if (value === undefined || !Number.isFinite(at)) return undefined;
  if (!board) return /T(\d{2}:\d{2})/.exec(value)?.[1];
  return formatInstantWithDay(Math.round((at - board.dayZero.getTime()) / 60_000), board.now);
}

export function ReferralIntakeSummary({ intake }: { intake?: ReferralIntakeDetails }) {
  const board = useOptionalWardFlowSelect("now", "dayZero");
  if (!intake) return null;
  return (
    <details className={styles.refCard}>
      <summary>Submitted documentation and referrer details</summary>
      <div className={styles.confirmationFacts}>
        <span>
          <strong>Catchment</strong>
          {intake.catchment.teamName} · confirmed{intake.catchment.service ? ` · ${intake.catchment.service}` : ""}
        </span>
        <span>
          <strong>Medical clearance</strong>
          {intake.medicalClearance.cleared
            ? "Cleared"
            : `Pending · expected ${submittedTime(intake.medicalClearance.expectedAt, board) ?? "time not recorded"}`}
        </span>
        {!intake.medicalClearance.cleared && (
          <span>
            <strong>Clarification contact</strong>
            {intake.medicalClearance.contactName} · {intake.medicalClearance.contactPhone}
          </span>
        )}
        <span>
          <strong>Triage and RAMP</strong>
          {intake.triageAndRampCompleted ? "Completed" : "Not completed"}
        </span>
        <span>
          <strong>Referrer</strong>
          {intake.referrer.name} · {intake.referrer.role}
        </span>
        <span>
          <strong>Contact</strong>
          {intake.referrer.phone} · {intake.referrer.email}
        </span>
        <span>
          <strong>Location / service</strong>
          {intake.referrer.location}
        </span>
        <span>
          <strong>Reason for referral</strong>
          {intake.reasonForReferral || "Not recorded"}
        </span>
        <span>
          <strong>Legal status</strong>
          {intake.legalStatus}
        </span>
        <span>
          <strong>Recorded risk flags</strong>
          {intake.riskFlags.join(", ") || "None selected"}
        </span>
        {intake.clearanceChecklist && Object.keys(intake.clearanceChecklist).length > 0 && (
          <span>
            <strong>Clearance checklist</strong>
            {clearanceChecklistWords(intake.clearanceChecklist)}
          </span>
        )}
        {intake.needs && (
          <span>
            <strong>{intake.needs.kind === "community" ? "Follow-up needs" : "ED needs"}</strong>
            {referralNeedsWords(intake.needs).join(", ") || "None recorded"}
          </span>
        )}
        {intake.arrival && (
          <span>
            <strong>Proposed arrival</strong>
            {intake.arrival.transport} · {submittedTime(intake.arrival.estimatedAt, board) ?? "Time not recorded"}
            {intake.arrival.reference ? ` · ${intake.arrival.reference}` : ""}
          </span>
        )}
      </div>
      <ReferralDocumentLinks charts={intake.charts} />
    </details>
  );
}
