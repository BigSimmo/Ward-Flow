/**
 * TWO SMALL COUNTS THE SCREENS WORK OUT INLINE TODAY (figures spec 2.5 and 2.6, D-220).
 *
 * - `referralsAwaitingDecision`: the referrals still waiting on somebody's answer, plus (R-BEDS-13)
 *   a community referral every asked ward declined. The rail's Referrals badge (`ward-nav-counts.ts`)
 *   and the coordinator's Home queue (`coordinatorReferralQueue`, `ward-referrals.ts`) read the same
 *   set; this is its one home.
 * - `needsYouCount`: Home's "Needs you" tab, act now plus the referrals to decide (A9-04). It is a
 *   sum that was already ruled (Q260); the function only names it so the words can say how the
 *   figures relate ("12 need you: 6 act now, 6 to decide").
 *
 * The rail (`ward-nav-counts.ts`) and Home's Needs you tab read these; the other inline copies of
 * the referral filter are counted in `tests/ward-figure-dictionary-inline-baseline.json`.
 */
import { isAwaitingAnswer, referralAllWardsDeclined, referralState } from "@/components/ward-management/ward-referrals";
import type { Referral } from "@/components/ward-management/ward-model";

/**
 * `queued` is `referralState`'s word for "no destination has accepted and they have not all
 * declined". It stays "queued" when the only destinations were withdrawn (O-17.11), so a referral
 * must also have a destination still awaiting an answer. R-BEDS-13: a community referral every
 * asked ward declined also stays for the coordinator to act on (`coordinatorReferralQueue`).
 */
export function referralsAwaitingDecision<T extends Referral>(referrals: readonly T[]): T[] {
  return referrals.filter(
    (referral) =>
      (referralState(referral) === "queued" && referral.destinations.some(isAwaitingAnswer)) ||
      referralAllWardsDeclined(referral),
  );
}

/** Home's "Needs you": the act-now figure (`alertsNowFigures().actNow`) plus the referrals to decide. */
export function needsYouCount(actNow: number, toDecide: number): number {
  return actNow + toDecide;
}
