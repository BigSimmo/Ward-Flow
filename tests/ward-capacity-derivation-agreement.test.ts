// tests/ward-capacity-derivation-agreement.test.ts
//
// 🔴 MERGE 02'S OWN PROMISE, WHICH NOTHING HAS EVER CHECKED.
//
// The Morning route (retired outright 2026-09-17, owner answer 41) redirected the morning
// bed-state board to the Capacity screen and stated the fold was "the same figures, on the
// same frozen-versus-live axis".
// Those two screens do not share a derivation: Capacity reads `capacity-derivations.ts` (built on
// `unitCapacity`), the morning board reads `ward-morning-rollup.ts` (built on `capacityBreakdown`).
//
// The two agree today only because the arithmetic was COPIED. `ward-bed-availability.ts` says so in
// as many words, immediately above the line:
//
//     // Copied verbatim from `unitCapacity` in ward-derivations.ts — the one number a coordinator
//     // acts on must not drift from the five-state bed grid's own arithmetic.
//
// ⚠️ A COMMENT SAYING TWO COPIES MUST NOT DRIFT IS NOT A CHECK THAT THEY HAVE NOT. Nothing in this
// repository compared them until this file. A change to either expression leaves the other silently
// behind, both screens keep rendering a plausible integer, and the only signal is that a coordinator
// on one screen is told a different number of free beds than a coordinator on the other.
import { describe, expect, it } from "vitest";

import {
  bedsPendingPreparation,
  capacityBreakdown,
  openBedsNow,
} from "../src/components/ward-management/ward-bed-availability";
import { unitCapacity } from "../src/components/ward-management/ward-derivations";
import { bedReleases, leaveBeds } from "../src/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const units = allUnits();

describe("the two capacity derivations agree, unit by unit", () => {
  /*
   * The anti-vacuity floor, on the DENOMINATOR. Every assertion below lives inside a loop over
   * `units`; an empty network would pass this file having compared nothing, which is the failure
   * that looks exactly like success. Deliberately a floor and not a pinned count — the network is
   * synthetic and expected to change, and pinning 23 would redden this file for every unit added.
   */
  it("has units to compare, so the loop below is not vacuous", () => {
    expect(units.length, "allUnits() is empty, so nothing below compares anything").toBeGreaterThan(10);
  });

  it.each(units.map((unit) => [unit.id] as const))(
    "%s reports the same Ready and Held through both modules",
    (unitId) => {
      const unit = units.find((candidate) => candidate.id === unitId)!;
      const breakdown = capacityBreakdown(unit, bedReleases, leaveBeds, NOW_ANCHOR);
      const grid = unitCapacity(unit, bedReleases);

      expect(
        breakdown.availableNow,
        `Ready has drifted for ${unitId}. Capacity shows ${grid.available} and the morning rollup ` +
          `shows ${breakdown.availableNow}. Both render as a plain integer, so whichever screen a ` +
          "coordinator happens to be on decides how many free beds they believe there are.",
      ).toBe(grid.available);

      expect(breakdown.held, `Held has drifted for ${unitId}: ${breakdown.held} against ${grid.held}.`).toBe(grid.held);
    },
  );

  /*
   * 🔴 THE THIRD COPY, FOUND ONLY BECAUSE THE MUTATION HARNESS REFUSED AN AMBIGUOUS ANCHOR.
   *
   * `Math.min(unit.allocatable.value, unit.empty.value)` is written out FOUR times in live ward
   * source — `unitCapacity`, `capacityBreakdown`, `openBedsNow`, and the eligibility gate. The
   * loop above pins the first two against each other. This pins the third.
   *
   * ⚠️ **THE FOURTH IS DELIBERATE AND IS NOT GUARDED HERE.** `ward-eligibility.ts` computes it
   * inline on purpose and its own comment forbids routing through `capacityBreakdown`, because
   * that would couple referral matching to a bed-release model no ward clinician has validated.
   * That reason is good and this file must not "fix" it by importing one into the other. It is
   * recorded rather than closed.
   *
   * **What `openBedsNow` adds beyond the base figure is the owner's ruling of 2026-09-05:** Ready
   * counts beds the reducer then refuses to admit anyone into, so the pullable count subtracts the
   * ones still being made ready. The ruling was explicitly NOT to change Ready itself — so this
   * asserts the SUBTRACTION happens here and nowhere upstream. A future edit that "tidied" the
   * subtraction into `capacityBreakdown` would move a figure the owner ruled must not move — and
   * the loop ABOVE is what catches that, because Ready would then stop matching `unitCapacity`.
   *
   * ⚠️ **A SECOND `expect` PINNING "Ready ITSELF DID NOT MOVE" WAS WRITTEN HERE AND REMOVED.** It
   * compared exactly the two values the loop above already compares, so it could never be the
   * assertion that caught anything — it would sit green through every mutation and read, to anyone
   * counting guards, as extra protection. One tautology dressed as a second opinion is worse than
   * no second opinion, because it is counted.
   */
  /*
   * 🔴 THE FLOOR THIS LOOP CANNOT DO WITHOUT, ADDED AFTER A MUTATION CONTRADICTED THE PREDICTION.
   *
   * Deleting the subtraction from `openBedsNow` was predicted to redden 23 cases. **It reddened
   * ONE.** `bedsPendingPreparation` is zero for 22 of the 23 units, so for those 22 the assertion
   * reads `max(0, ready - 0) === max(0, ready - 0)` — arithmetically satisfied whatever the code
   * does, and utterly silent.
   *
   * ⚠️ **THE OWNER'S 2026-09-05 RULING IS THEREFORE GUARDED BY EXACTLY ONE FIXTURE ROW** — the
   * `arm-adult-open` release that `capacity-derivations.ts` names as its worked example. If that
   * row is ever edited away, every case below stays green while guarding nothing at all, and the
   * only visible change is a number in a passing run.
   *
   * So the floor is on the DISCRIMINATING POPULATION, not on the loop's length: at least one unit
   * must actually have a bed pending preparation, or this file has stopped asking its question.
   */
  it("has at least one unit with a bed being made ready, or the loop below tests nothing", () => {
    const discriminating = units.filter((unit) => bedsPendingPreparation(unit.id, bedReleases) > 0);
    expect(
      discriminating.length,
      "no unit in the fixture has a bed pending preparation, so `max(0, ready - 0)` is compared " +
        "against `max(0, ready - 0)` for every unit and the subtraction could be deleted entirely " +
        "without reddening anything here.",
    ).toBeGreaterThan(0);
  });

  it.each(units.map((unit) => [unit.id] as const))(
    "%s: the pullable count is Ready minus the beds still being made ready, and Ready itself is untouched",
    (unitId) => {
      const unit = units.find((candidate) => candidate.id === unitId)!;
      const ready = unitCapacity(unit, bedReleases).available;
      const pending = bedsPendingPreparation(unit.id, bedReleases);

      expect(
        openBedsNow(unit, bedReleases),
        `the pullable count for ${unitId} is not Ready (${ready}) minus the ${pending} bed(s) still ` +
          "being made ready. Either the subtraction moved, or a third copy of the Ready arithmetic drifted.",
      ).toBe(Math.max(0, ready - pending));
    },
  );
});
