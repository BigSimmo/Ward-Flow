"use client";

import { clearanceChecklistWords, referralNeedsWords, type ReferralIntakeDetails } from "./referral-submission";
import { ReferralDocumentLinks } from "./referral-flow-panels";
import styles from "./ward-referral-drawer.module.css";
import { useOptionalWardFlowSelect } from "../ward-flow-provider";
import { formatReferralIntakeTime } from "../ward-referral-seed-time";

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
            : `Pending · expected ${formatReferralIntakeTime(intake.medicalClearance.expectedAt, intake.medicalClearance, board?.dayZero, board?.now)}`}
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
            {intake.arrival.transport} ·{" "}
            {formatReferralIntakeTime(intake.arrival.estimatedAt, intake.arrival, board?.dayZero, board?.now)}
            {intake.arrival.reference ? ` · ${intake.arrival.reference}` : ""}
          </span>
        )}
      </div>
      <ReferralDocumentLinks charts={intake.charts} />
    </details>
  );
}
