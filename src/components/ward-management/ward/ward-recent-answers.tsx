"use client";

// Simplification 26 Nov 2026 (area 3, item 2): this ward's recorded answers, shared by the standalone
// Answer view and the Ward page's Referrals tab, where they fold under "This ward's answers".

import type { Instant } from "@/components/ward-management/ward-clock";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { isWaitlistReason } from "@/components/ward-management/ward-waitlist";
import { DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import type { DeclineReason, Movement } from "@/components/ward-management/ward-model";
import { MissingValue } from "@/components/wf/missing-value";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import styles from "./ward-screen-referrals-tab.module.css";

export type WardRecentAnswer = {
  key: string;
  movementId: string;
  outcome: "Accepted in principle" | "Declined" | "Waitlisted";
  at?: Instant;
  reason?: DeclineReason;
};

/** Newest first: each acceptance in principle and each decline this ward recorded. */
export function wardRecentAnswers(movements: readonly Movement[], unitId: string): WardRecentAnswer[] {
  return movements
    .flatMap((movement) => {
      const answers: WardRecentAnswer[] = [];
      if (movement.acceptedUnitId === unitId) {
        answers.push({
          key: `${movement.id}-accepted`,
          movementId: movement.id,
          outcome: "Accepted in principle",
          at: movement.acceptedAt,
        });
      }
      movement.declines
        .filter((decline) => decline.unitId === unitId)
        .forEach((decline, index) => {
          answers.push({
            key: `${movement.id}-declined-${index}`,
            movementId: movement.id,
            // A9-05: "No suitable bed" puts the referral on this ward's wait list.
            outcome: isWaitlistReason(decline.reason) ? "Waitlisted" : "Declined",
            at: decline.at,
            reason: decline.reason,
          });
        });
      return answers;
    })
    .sort((left, right) => (right.at ?? Number.NEGATIVE_INFINITY) - (left.at ?? Number.NEGATIVE_INFINITY));
}

/** The Referrals tab's folded list: closed by default, its count in the summary. */
export function WardRecentAnswersFold({ unitId }: { unitId: string }) {
  const { movements, resolvePatientIdentity } = useWardFlowSelect("movements", "resolvePatientIdentity");
  const now = useWardFlowClock();
  const answers = wardRecentAnswers(movements, unitId);
  // Audit three #24 (28 Nov 2026): a fold with nothing in it goes.
  if (answers.length === 0) return null;
  return (
    <details className={styles.recentFold} data-testid="ward-referrals-recent-answers">
      <summary>
        <span className={styles.recentTitle}>Answers to ED bed requests</span>
        <span className={styles.recentCount}>{answers.length}</span>
      </summary>
      {answers.length === 0 ? (
        <p className={styles.recentEmpty}>No answers recorded yet.</p>
      ) : (
        <ul className={styles.recentList}>
          {answers.map((answer) => {
            const identity = resolvePatientIdentity({ movementId: answer.movementId });
            return (
              <li key={answer.key}>
                <span className={styles.recentName}>{identity.formalName}</span>
                {answer.at === undefined ? (
                  <MissingValue reason="not_recorded" className={styles.recentTime} />
                ) : (
                  <time className={styles.recentTime}>{formatInstantWithDay(answer.at, now)}</time>
                )}
                <span className={styles.recentLine}>
                  {identity.umrn} · {answer.outcome}
                  {answer.reason
                    ? ` · ${DECLINE_REASON_LABELS[answer.reason] ?? answer.reason.replace(/_/g, " ")}`
                    : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}
