/**
 * TWO SMALL COUNTS THE SCREENS WORK OUT INLINE TODAY (figures spec 2.5 and 2.6, D-220).
 *
 * - `referralsAwaitingDecision`: the referrals still waiting on somebody's answer. The rail's
 *   Referrals badge (`ward-nav-counts.ts`) and Home's referral queue (`referralQueueOrder`,
 *   `ward-referrals.ts`) each hold this filter; this is its one home.
 * - `needsYouCount`: Home's "Needs you" tab, act now plus the referrals to decide (A9-04). It is a
 *   sum that was already ruled (Q260); the function only names it so the words can say how the
 *   figures relate ("12 need you: 6 act now, 6 to decide").
 *
 * Phase 1: new home only. The rail and Home keep their inline copies until phase 2 points them here;
 * `tests/figure-decision-counts.test.ts` pins that they agree on the seed.
 */
import { isAwaitingAnswer, referralState } from "@/components/ward-management/ward-referrals";
import type { Referral } from "@/components/ward-management/ward-model";

/**
 * `queued` is `referralState`'s word for "no destination has accepted and they have not all
 * declined". It stays "queued" when the only destinations were withdrawn (O-17.11), so a referral
 * must also have a destination still awaiting an answer.
 */
export function referralsAwaitingDecision<T extends Referral>(referrals: readonly T[]): T[] {
  return referrals.filter(
    (referral) => referralState(referral) === "queued" && referral.destinations.some(isAwaitingAnswer),
  );
}

/** Home's "Needs you": the act-now figure (`alertsNowFigures().actNow`) plus the referrals to decide. */
export function needsYouCount(actNow: number, toDecide: number): number {
  return actNow + toDecide;
}
