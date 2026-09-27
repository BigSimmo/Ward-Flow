import type { Movement } from "../ward-model";

/**
 * 🔴 **REFERRALS INTO ONE WARD — THREE FIGURES, NO TOTAL, AND THE MISSING TOTAL IS THE DESIGN.**
 *
 * The drawing's band is *Received · Accepted · Declined · Still open · Accepted share*, with
 * **Received defined as the other three added together**. ⚠️ **That sum is wrong for two independent
 * reasons, and only one of them is the prototype's no-history limit.**
 *
 * 🔴 **ONE: THE THREE MIX TENSES.** Measured on the reducer rather than inferred from the field names:
 *
 *     referredUnitIds   LIVE. Emptied by `ACCEPT_IN_PRINCIPLE` and by `WITHDRAW_REFERRAL`, and the
 *                       declining unit is filtered out by `DECLINE`. It answers *asking RIGHT NOW*.
 *     acceptedUnitId    CUMULATIVE. Cleared by `WITHDRAW_ACCEPTANCE` and by nothing else — it
 *                       survives the patient arriving and survives closure, and closed movements are
 *                       never removed from state. It answers *EVER accepted, and not taken back*.
 *     declines[]        CUMULATIVE and append-only. It answers *EVER declined*.
 *
 * **One current figure beside two lifetime ones. Adding them adds different periods together, and
 * the result would look like a plausible intake total.**
 *
 * 🔴 **TWO: THEY CAN OVERLAP.** `DECLINE` removes a unit from the live list and locks it out of
 * nothing, so a ward can decline a movement and later accept the same one. **That movement then
 * appears in two of these counts.** `tests/ward-statistics-ward-referrals.test.ts` constructs exactly
 * that case rather than asserting it cannot happen.
 *
 * ✅ **So there is no `received` and no `acceptedShare` on this type, deliberately.** This family
 * already has the cautionary case: `dischargeDateOutcomes` (`ward-statistics.ts`) carries a doc
 * comment saying its three figures are not a partition and must never be summed — and a live ward
 * page still once read *"Of 1 with a date written down, 1 met, 0 missed and 11 moved"*. **A figure
 * that must not be summed is safest when there is nothing to sum it into.**
 *
 * ⚠️ **AND THE DRAWING'S "this month" FRAMING IS NOT USED, WHICH IS D-4.** Nothing in the model
 * bounds a month, so a month-scoped tally would be a figure whose denominator does not exist. **Each
 * name below says what it measures instead.**
 *
 * ⚠️ **A referral is never addressed to a NAMED WARD** — `ReferralDestination`'s `psychiatric_ward`
 * arm carries bed criteria and no unit id. These figures come from the acute bed SEARCH
 * (`Movement`), which is a different mechanism and genuinely per-unit. That distinction is why this
 * module reads movements and not referrals.
 */
export type WardReferralTally = {
  /** Movements whose live referral list still names this ward. Shrinks as each one resolves. */
  readonly askedAndWaiting: number;
  /** Movements this ward accepted and has not taken back — including people who have since arrived. */
  readonly everAccepted: number;
  /** Movements this ward has ever declined. Append-only, so this only ever grows. */
  readonly everDeclined: number;
};

export function wardReferralTally(movements: readonly Movement[], unitId: string): WardReferralTally {
  return {
    askedAndWaiting: movements.filter((movement) => movement.referredUnitIds.includes(unitId)).length,
    everAccepted: movements.filter((movement) => movement.acceptedUnitId === unitId).length,
    everDeclined: movements.filter((movement) => movement.declines.some((decline) => decline.unitId === unitId)).length,
  };
}
