import { WAITLIST_INSTEAD_OF_DECLINE_REASONS } from "@/components/ward-management/ward-legal-clock";
import type { Movement } from "@/components/ward-management/ward-model";

const WAITLIST_REASONS: readonly string[] = WAITLIST_INSTEAD_OF_DECLINE_REASONS;

/**
 * This ward's waitlist answer still stands. The reducer keeps the marker after the request ends, so
 * a withdrawal or an ordinary decline newer than the last waitlist answer means the marker is left
 * over from an earlier request, and a re-referral to this ward is waiting on a fresh answer.
 */
export function waitlistStands(movement: Movement, unitId: string): boolean {
  if (!(movement.waitlistedUnitIds ?? []).includes(unitId)) return false;

  // Reducer-written answers retain append order because provider timestamps are minute-granular.
  // In particular, a decline and a waitlist answer can have the same `at` value.
  const answers = movement.referralAnswerHistory?.filter((answer) => answer.unitId === unitId);
  const latestAnswer = answers?.at(-1);
  if (latestAnswer) return latestAnswer.answer === "waitlisted";

  // Legacy/hand-authored movements predate answer ordering; retain the timestamp fallback for
  // those records.
  let waitlistedAt = Number.NEGATIVE_INFINITY;
  let endedAt = Number.NEGATIVE_INFINITY;
  for (const decline of movement.declines) {
    if (decline.unitId !== unitId) continue;
    if (WAITLIST_REASONS.includes(decline.reason)) waitlistedAt = Math.max(waitlistedAt, decline.at);
    else endedAt = Math.max(endedAt, decline.at);
  }
  for (const withdrawal of movement.withdrawnReferrals) {
    if (withdrawal.unitId === unitId) endedAt = Math.max(endedAt, withdrawal.at);
  }
  return endedAt <= waitlistedAt || endedAt === Number.NEGATIVE_INFINITY;
}
