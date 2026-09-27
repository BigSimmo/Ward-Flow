/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { wardReferralTally } from "@/components/ward-management/statistics/statistics-ward-referrals";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Decline, Movement } from "@/components/ward-management/ward-model";

/**
 * 🔴 **REFERRALS INTO ONE WARD — THREE FIGURES THAT MUST NEVER BE ADDED UP, AND THE DRAWING ADDS
 * THEM UP.**
 *
 * The drawing's band is *Received · Accepted · Declined · Still open · Accepted share*, with
 * **Received defined as the other three summed**. ⚠️ **Two things are wrong with that and only one of
 * them is the no-history limit.**
 *
 * 🔴 **FIRST: THE THREE MIX TENSES.** Measured on the reducer, not inferred:
 *
 *     referredUnitIds   LIVE. Emptied by ACCEPT_IN_PRINCIPLE and by WITHDRAW_REFERRAL, and the
 *                       declining unit is filtered out by DECLINE. It answers "asking RIGHT NOW".
 *     acceptedUnitId    CUMULATIVE. Cleared only by WITHDRAW_ACCEPTANCE — it survives arrival and
 *                       closure, and closed movements are never removed from state. It answers
 *                       "EVER accepted and not taken back".
 *     declines[]        CUMULATIVE and append-only. It answers "EVER declined".
 *
 * **One current figure and two lifetime ones. Summing them counts different periods together.**
 *
 * 🔴 **SECOND: THEY CAN OVERLAP.** `DECLINE` removes a unit from `referredUnitIds` but leaves the
 * ward re-referrable, so one ward can decline a movement and later accept it. **The same movement
 * then appears in two of these counts**, and the test below constructs exactly that rather than
 * asserting it cannot happen.
 *
 * ✅ **So this derivation publishes no total and no share.** The family already has the cautionary
 * case: `dischargeDateOutcomes` carries a doc comment saying its three figures are not a partition,
 * and a live ward page still once read *"Of 1 with a date written down, 1 met, 0 missed and 11
 * moved"*. **A figure that must not be summed is safest when there is nothing to sum it into.**
 */

/**
 * 🔴 **A REAL `DeclineReason`, AND THE TYPECHECK IS WHAT TAUGHT ME THERE ARE THREE DECLINE
 * VOCABULARIES IN THIS MODEL, NOT TWO.**
 *
 * My first draft wrote `"no_suitable_bed"` here — a member of `REFERRAL_DECLINE_REASONS`, which is
 * the vocabulary for a REFERRAL ADDRESSING saying no. ⚠️ **`Movement.declines` uses `DECLINE_REASONS`,
 * a different list of seven about the acute bed SEARCH.** Six tests passed green on the wrong value,
 * because an `as Movement["declines"]` cast silenced the one thing that could tell.
 *
 * ✅ **The casts are gone and the reason is typed** — a cast plus a runner that does not typecheck is
 * how a wrong value ships looking tested. **And this happened hours after I built the third
 * vocabulary and wrote a guard against anybody merging two of them.**
 */
const A_DECLINE: Decline = { unitId: "placeholder", at: 0, reason: "no_bed" };

const SEED = seedWardFlowState();
const TEMPLATE = SEED.movements[0];
const UNIT = "rph-adult-secure";

function bend(changes: Partial<Movement>): Movement {
  expect(TEMPLATE, "the seed carries no movements, so this suite would assert nothing").toBeDefined();
  return { ...structuredClone(TEMPLATE!), referredUnitIds: [], declines: [], ...changes } as Movement;
}

describe("referrals into one ward", () => {
  it("counts a ward that is being asked right now", () => {
    const tally = wardReferralTally([bend({ id: "WF-m1", referredUnitIds: [UNIT, "other-ward"] })], UNIT);
    expect(tally.askedAndWaiting).toBe(1);
    expect(tally.everAccepted).toBe(0);
    expect(tally.everDeclined).toBe(0);
  });

  /**
   * ⚠️ **AN ACCEPTANCE SURVIVES THE PATIENT ARRIVING, AND CALLING THIS FIGURE "AWAITING ARRIVAL"
   * WOULD BE FALSE.** `acceptedUnitId` is cleared by one event only — a withdrawal of the acceptance
   * — so it still names this ward long after the person is in the bed.
   */
  it("counts an acceptance that has already led to an arrival", () => {
    const tally = wardReferralTally(
      [bend({ id: "WF-m1", acceptedUnitId: UNIT, stage: "arrived" as Movement["stage"] })],
      UNIT,
    );
    expect(tally.everAccepted).toBe(1);
    expect(tally.askedAndWaiting, "an accepted movement is no longer asking").toBe(0);
  });

  it("counts a decline this ward recorded, whatever happened to the movement afterwards", () => {
    const tally = wardReferralTally([bend({ id: "WF-m1", declines: [{ ...A_DECLINE, unitId: UNIT }] })], UNIT);
    expect(tally.everDeclined).toBe(1);
  });

  /**
   * 🔴 **THE ANTI-SUMMING PROOF, AND IT CONSTRUCTS THE OVERLAP RATHER THAN ASSERTING IT AWAY.** One
   * ward can decline a movement and later accept it — `DECLINE` removes it from the live list and
   * locks it out of nothing. **The same movement lands in two counts, so the two cannot be added.**
   */
  it("puts one movement in two counts when a ward declined it and later accepted it", () => {
    const tally = wardReferralTally(
      [
        bend({
          id: "WF-m1",
          declines: [{ ...A_DECLINE, unitId: UNIT }],
          acceptedUnitId: UNIT,
        }),
      ],
      UNIT,
    );

    expect(tally.everDeclined).toBe(1);
    expect(tally.everAccepted).toBe(1);
    // One movement, two counts. Any "received" total built from these would count it twice.
  });

  it("counts only this ward", () => {
    const tally = wardReferralTally(
      [
        bend({ id: "WF-m1", referredUnitIds: ["elsewhere"] }),
        bend({ id: "WF-m2", acceptedUnitId: "elsewhere" }),
        bend({ id: "WF-m3", declines: [{ ...A_DECLINE, unitId: "elsewhere" }] }),
      ],
      UNIT,
    );
    expect(tally).toEqual({ askedAndWaiting: 0, everAccepted: 0, everDeclined: 0 });
  });

  /**
   * ⚠️ **The anti-vacuity pass over the real seed.** Every case above is a bent fixture; without this
   * the suite would describe a function nothing shipped ever reaches, and all three figures could be
   * nought on every real ward while the tests stayed green.
   */
  it("finds at least one seeded ward being asked, one that accepted, and one that declined", () => {
    const tallies = SEED.units.map((unit) => wardReferralTally(SEED.movements, unit.id));

    expect(
      tallies.some((tally) => tally.askedAndWaiting > 0),
      "no seeded ward is being asked",
    ).toBe(true);
    expect(
      tallies.some((tally) => tally.everAccepted > 0),
      "no seeded ward has accepted anything",
    ).toBe(true);
    expect(
      tallies.some((tally) => tally.everDeclined > 0),
      "no seeded ward has declined anything",
    ).toBe(true);
  });
});
