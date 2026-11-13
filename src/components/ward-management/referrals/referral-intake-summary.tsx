"use client";

import {
  clearanceChecklistWords,
  referralCatchmentWords,
  referralNeedsWords,
  referrerContactWords,
  transportLabel,
  type ReferralIntakeDetails,
} from "./referral-submission";
import { ReferralDocumentLinks } from "./referral-document-links";
import styles from "./ward-referral-drawer.module.css";
import { useOptionalWardFlowSelect } from "../ward-flow-provider";
import { formatReferralIntakeTime } from "../ward-referral-seed-time";
import { useClockZoneLabel } from "@/components/ward-management/use-clock-zone-label";
import { referralExpectedTime } from "./referral-expected-time";

export function ReferralIntakeSummary({ intake }: { intake?: ReferralIntakeDetails }) {
  const board = useOptionalWardFlowSelect("now", "dayZero");
  const zone = useClockZoneLabel();
  if (!intake) return null;
  return (
    <details className={styles.refCard}>
      <summary>Submitted documentation and referrer details</summary>
      <div className={styles.confirmationFacts}>
        <span>
          <strong>Catchment</strong>
          {referralCatchmentWords(intake.catchment)}
        </span>
        <span>
          <strong>Medical clearance</strong>
          {intake.medicalClearance.cleared
            ? "Cleared"
            : `Pending · expected ${referralExpectedTime(intake.medicalClearance.expectedAt, intake.medicalClearance, board?.dayZero, board?.now, zone)}`}
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
          {referrerContactWords(intake.referrer)}
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
            {referralNeedsWords(intake.needs, zone).join(", ") || "None recorded"}
          </span>
        )}
        {intake.arrival && (
          <span>
            <strong>Proposed arrival</strong>
            {transportLabel(intake.arrival.transport)} ·{" "}
            {formatReferralIntakeTime(intake.arrival.estimatedAt, intake.arrival, board?.dayZero, board?.now, zone)}
            {intake.arrival.reference ? ` · ${intake.arrival.reference}` : ""}
          </span>
        )}
      </div>
      <ReferralDocumentLinks charts={intake.charts} toFollow={intake.chartsToFollow} />
    </details>
  );
}
