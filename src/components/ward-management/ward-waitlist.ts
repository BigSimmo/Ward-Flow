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
  let waitlistedAt = Number.NEGATIVE_INFINITY;
  let endedAt = Number.NEGATIVE_INFINITY;
  for (const decline of movement.declines) {
    if (decline.unitId !== unitId) continue;
    if (decline.reason !== undefined && WAITLIST_REASONS.includes(decline.reason))
      waitlistedAt = Math.max(waitlistedAt, decline.at);
    else endedAt = Math.max(endedAt, decline.at);
  }
  for (const withdrawal of movement.withdrawnReferrals) {
    if (withdrawal.unitId === unitId) endedAt = Math.max(endedAt, withdrawal.at);
  }

  // The reducer appends ward answers in order, which settles answers recorded in the same clock
  // minute. An ending newer than the last recorded answer still ends the waitlist, in case a path
  // wrote the ending without adding to the history.
  const latestAnswer = movement.referralAnswerHistory?.filter((answer) => answer.unitId === unitId).at(-1);
  if (latestAnswer) return endedAt <= latestAnswer.at && latestAnswer.answer === "waitlisted";

  // Records from before the answer history go by timestamps alone.
  if (endedAt === Number.NEGATIVE_INFINITY) return true;
  if (endedAt !== waitlistedAt) return endedAt < waitlistedAt;
  // Same minute on the clock. A waitlist answer keeps the ward's live referral and a withdrawal or
  // ordinary decline removes it, so the referral still being live means the waitlist came last.
  return movement.referredUnitIds.includes(unitId);
}
