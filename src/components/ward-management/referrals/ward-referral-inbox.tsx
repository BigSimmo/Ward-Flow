"use client";

import { useState } from "react";
import { useWardFlow, useWardFlowClock } from "../ward-flow-provider";
import { REFERRAL_DECLINE_REASONS, type ReferralDeclineReason } from "../ward-model";
import { DECLINE_REASON_LABELS, wardTransferNeedsCoordinator } from "../ward-referrals";
import { ReferralIntakeSummary } from "./referral-intake-summary";
import styles from "./ward-referral-drawer.module.css";

export function WardReferralInbox({ unitId }: { unitId: string }) {
  const { wardReferralInbox, resolvePatientIdentity, dispatch, rejections, units } = useWardFlow();
  const now = useWardFlowClock();
  const [attempt, setAttempt] = useState<{ id: string; count: number } | null>(null);
  const newestRejection = attempt && rejections.length > attempt.count ? rejections.at(-1) : undefined;
  const lastError = newestRejection?.movementId === attempt?.id ? newestRejection?.reason : null;
  const entries = wardReferralInbox?.(unitId) ?? [];
  const [reasons, setReasons] = useState<Record<string, ReferralDeclineReason | "">>({});
  if (!entries.length) return null;
  return (
    <section className={styles.refCard} aria-label="Ward referral inbox">
      <h2 className={styles.refCardTitle}>Referral inbox · {entries.length}</h2>
      {lastError && (
        <p className={styles.flowError} role="alert">
          {lastError}
        </p>
      )}
      {entries.map((entry) => {
        const patient = resolvePatientIdentity({ patientId: entry.patientId });
        const live = entry.state === "queued" && entry.withdrawnAt === undefined;
        const coordinatorAccepts = wardTransferNeedsCoordinator(entry, unitId, units);
        return (
          <article className={styles.refCard} key={entry.id}>
            <h3 className={styles.refCardTitle}>
              {patient.displayName} · {entry.id}
            </h3>
            <p className={styles.refCardSubtitle}>
              {entry.withdrawnAt !== undefined
                ? "Withdrawn by referrer"
                : entry.waitlistedAt !== undefined && live
                  ? "Waitlisted"
                  : entry.state === "cancelled"
                    ? "Cancelled — accepted elsewhere"
                    : entry.state === "queued"
                      ? "Awaiting review"
                      : entry.state === "accepted"
                        ? "Accepted"
                        : `Declined · ${entry.declineReason ? DECLINE_REASON_LABELS[entry.declineReason as ReferralDeclineReason] : "Reason not recorded"}`}
            </p>
            <p className={styles.patientStory}>{entry.history || "Patient story not recorded"}</p>
            <ReferralIntakeSummary intake={entry.intake} />
            {live && (
              <div className={styles.answerOptions}>
                {coordinatorAccepts ? (
                  <p className={styles.refCardSubtitle}>Coordinator accepts transfers from another hospital</p>
                ) : (
                  <button
                    type="button"
                    className={styles.patientChipBtn}
                    onClick={() => {
                      setAttempt({ id: entry.id, count: rejections.length });
                      dispatch({
                        type: "ACCEPT_REFERRAL",
                        role: "ward",
                        now,
                        referralId: entry.id,
                        destinationKind: "psychiatric_ward",
                        unitId,
                      });
                    }}
                  >
                    Accept referral
                  </button>
                )}
                <button
                  type="button"
                  className={styles.patientChipBtn}
                  onClick={() => {
                    setAttempt({ id: entry.id, count: rejections.length });
                    dispatch({
                      type: "DECLINE_REFERRAL",
                      role: "ward",
                      now,
                      referralId: entry.id,
                      destinationKind: "psychiatric_ward",
                      unitId,
                      reason: "no_suitable_bed",
                      waitlist: true,
                    });
                  }}
                >
                  Waitlist
                </button>
                <label className={styles.flowField}>
                  Decline reason
                  <select
                    className={styles.fieldSelect}
                    value={reasons[entry.id] ?? ""}
                    onChange={(event) =>
                      setReasons((current) => ({
                        ...current,
                        [entry.id]: event.target.value as ReferralDeclineReason | "",
                      }))
                    }
                  >
                    <option value="">Choose a reason</option>
                    {REFERRAL_DECLINE_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {DECLINE_REASON_LABELS[reason]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={styles.patientChipBtn}
                  disabled={!reasons[entry.id]}
                  onClick={() => {
                    const reason = reasons[entry.id];
                    if (reason) {
                      setAttempt({ id: entry.id, count: rejections.length });
                      dispatch({
                        type: "DECLINE_REFERRAL",
                        role: "ward",
                        now,
                        referralId: entry.id,
                        destinationKind: "psychiatric_ward",
                        unitId,
                        reason,
                      });
                    }
                  }}
                >
                  Decline referral
                </button>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
