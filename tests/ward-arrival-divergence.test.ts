import { describe, expect, it } from "vitest";

import { bedIsOccupied } from "../src/components/ward-management/ward-admissions";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * 🔴 **TWO FIELDS ARE CALLED `arrivedAt`, THEY ARE ALLOWED TO DISAGREE, AND NOTHING TESTED THAT.**
 *
 * `Admission.arrivedAt` is `Instant | null` — *"`null` until they get here — including for a pulled
 * bed."* `Movement.transport.arrivedAt` is `Instant | undefined` — absent until transport delivers.
 * **`PATIENT_ARRIVED` writes the first UNCONDITIONALLY and the second only when `movement.admissionId`
 * resolves to an admission still `"pulled"`** (`ward-flow-reducer.ts:2146-2155`).
 *
 * ⚠️ **SO A MOVEMENT CAN LEGITIMATELY REACH `transport.arrivedAt` SET AND `closure: "arrived"` WITH NO
 * `Admission.arrivedAt` EVER WRITTEN**, and the reducer says why in its own words: a movement whose
 * `pulled` stage was hand-authored in the seed has no `admissionId`, and *"fabricating one here would
 * invent an occupant this reducer never created."*
 *
 * ## 🔴 What this file is FOR, because it is not what the task said
 *
 * **The task this came from described a live double-allocation defect hiding in the two absences.
 * There is none.** `bedIsOccupied` decides on `state` alone and never reads `arrivedAt` — its comment
 * forbids the exact tightening that would cause the defect, and five test files pin it. **That was
 * re-derived from the code before this file was written, and the premise did not survive.**
 *
 * ✅ **What did survive is narrower and worth guarding: nothing would notice if somebody closed it the
 * wrong way round.** A reviewer seeing `transport.arrivedAt` set while the admission says `null` has
 * an obvious-looking repair available — write both, or search the ward for a `pulled` admission to
 * attach. **Both are wrong, both look like tidying, and neither would have gone red.**
 *
 * 🔴 **This is a guard against a FUTURE FIX, which is the right instrument when current behaviour is
 * correct and fragile.** It asserts the divergence is permitted, not that it is desirable.
 *
 * ✅ **THE OTHER BRANCH IS ALREADY COVERED AND IS NOT RE-TESTED HERE.**
 * `ward-pull-admission-lifecycle.test.ts:148-159` walks a movement through a real `PULL_PATIENT`,
 * dispatches `PATIENT_ARRIVED`, and asserts the admission becomes `occupied` with `arrivedAt` set —
 * so the linked half of this branch has a guard. ⚠️ **A draft of this file re-created that walk and
 * could not get past the transport preconditions; a fragile duplicate of existing coverage is worse
 * than a citation, so it was removed rather than made to work.**
 *
 * ⚠️ **POPULATION.** The reducer over the standard seed at one instant, on ONE hand-authored movement.
 * It says nothing about what any screen renders from either field, and it does not re-prove the
 * linked branch.
 */

const NOW = NOW_ANCHOR;

/**
 * Hand-authored in the seed as far as `moving` with transport collected, so it carries NO
 * `admissionId` — the specimen the divergence needs.
 *
 * 🔴 **AND ITS WARD MUST ALSO HOLD A `pulled` ADMISSION, WHICH IS NOT INCIDENTAL.** The first
 * specimen (`WF-006`, RGH Adult Secure) satisfied every stated precondition and **the mutation still
 * passed**: the tempting wrong fix — *when the movement has no `admissionId`, search the ward for a
 * pulled admission and mark that one* — found nothing to steal on that ward, so it changed nothing
 * and the guard stayed green. ⚠️ **A guard that cannot fail on the repair it exists to forbid is the
 * defect it was written to prevent.** `WF-014` lands on Ward 2K, which does hold one.
 */
const HAND_AUTHORED = "WF-014";

function arrive(state: WardFlowState, movementId: string): WardFlowState {
  return wardFlowReducer(state, {
    type: "PATIENT_ARRIVED",
    role: "officer",
    now: NOW,
    movementId,
  } as Parameters<typeof wardFlowReducer>[1]);
}

function movement(state: WardFlowState, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no movement ${id} in seeded state`);
  return found;
}

describe("the two arrivedAt fields are allowed to disagree", () => {
  it("🔴 ANTI-VACUITY — the specimen really is a pulled movement with no admission link", () => {
    const state = seedWardFlowState("standard");
    const found = movement(state, HAND_AUTHORED);

    /*
     * 🔴 **ALL THREE PRECONDITIONS, BECAUSE THE FIRST DRAFT OF THIS FILE PASSED ON A REJECTED EVENT.**
     * `PATIENT_ARRIVED` refuses unless the movement is `moving` AND transport has collected. I first
     * chose a `pulled` specimen; the dispatch was REFUSED, nothing changed, and **"no admission gained
     * an arrival" was trivially true because no event had been applied at all.** The divergence case
     * would have passed forever on a reducer that did nothing.
     */
    expect(found.stage, `${HAND_AUTHORED} is not moving, so PATIENT_ARRIVED refuses it`).toBe("moving");
    expect(
      found.transport?.collectedAt,
      `${HAND_AUTHORED} has not been collected, so PATIENT_ARRIVED refuses it`,
    ).toBeDefined();
    expect(found.closure, `${HAND_AUTHORED} is already closed, so PATIENT_ARRIVED refuses it`).toBeUndefined();

    // 🔴 THE PRECONDITION THE MUTATION TAUGHT US. Without a pulled admission on this ward there is
    // nothing for a fabricating fix to attach, so the divergence case would pass over a wrong
    // reducer — see the note on HAND_AUTHORED.
    expect(
      state.admissions.filter((admission) => admission.unitId === found.acceptedUnitId && admission.state === "pulled")
        .length,
      `${found.acceptedUnitId} holds no pulled admission, so a fix that stole one would find nothing ` +
        "and this file could not catch it — pick a specimen whose ward has one",
    ).toBeGreaterThan(0);
    expect(
      found.admissionId,
      `${HAND_AUTHORED} now carries an admissionId, so it can no longer demonstrate the divergence — ` +
        "find another hand-authored pulled movement rather than deleting this file",
    ).toBeUndefined();
  });

  it("writes the transport arrival and leaves the absent admission exactly alone (audit 2026-09-25 §3 items 2, 5, 6)", () => {
    const before = seedWardFlowState("standard");
    const after = arrive(before, HAND_AUTHORED);
    const moved = movement(after, HAND_AUTHORED);

    // 🔴 THE EVENT MUST HAVE BEEN APPLIED. A refusal leaves state untouched, and every assertion
    // below would then hold for the wrong reason — see the anti-vacuity case.
    expect(
      after.rejections.length,
      `PATIENT_ARRIVED was REFUSED: ${after.rejections[after.rejections.length - 1]?.reason ?? "unknown"}. ` +
        "Nothing was applied, so the divergence below would pass over an unchanged state.",
    ).toBe(before.rejections.length);
    expect(moved.transport?.arrivedAt, "transport arrival was not written").toBe(NOW);
    expect(moved.closure?.outcome, "the movement did not close as arrived").toBe("arrived");

    // Audit 2026-09-25 §3 items 2, 5, 6: this reducer used to invent an "AD-ARR-" admission here —
    // locked without taking a locked bed, back-dated to the referral's open time, at discharge
    // revision 1 — directly contradicting its own comment that an absent admission is left exactly
    // alone. That branch is removed: no admission is synthesized, and the movement stays unlinked.
    const gainedArrival = after.admissions.filter(
      (admission) =>
        admission.arrivedAt === NOW && before.admissions.find((was) => was.id === admission.id)?.arrivedAt !== NOW,
    );
    expect(gainedArrival, "no admission should be fabricated for a hand-authored movement with none").toHaveLength(0);
    expect(after.admissions, "the admission list itself must be untouched").toEqual(before.admissions);
    expect(moved.admissionId, "the movement must not gain an admissionId it never had").toBeUndefined();
  });

  it("🔴 and the bed does NOT become free because nobody is recorded as arriving", () => {
    const before = seedWardFlowState("standard");
    const after = arrive(before, HAND_AUTHORED);
    expect(after.rejections.length, "the arrival was refused, so this compares a state with itself").toBe(
      before.rejections.length,
    );
    const unitId = movement(before, HAND_AUTHORED).acceptedUnitId;
    if (unitId === undefined) throw new Error("the specimen has no accepted unit");

    /*
     * The property the absent task was worried about, asserted from the other end. `bedIsOccupied`
     * reads `state` and never `arrivedAt` — so a bed spoken for by a pull stays spoken for whether or
     * not anybody has arrived. A tightening to require `arrivedAt` would make this ward's occupied
     * count DROP across an arrival event, which is the double-allocation the comment on
     * `bedIsOccupied` describes: the ward finds out when two people turn up for one bed.
     */
    const occupiedBefore = before.admissions.filter((a) => a.unitId === unitId && bedIsOccupied(a)).length;
    const occupiedAfter = after.admissions.filter((a) => a.unitId === unitId && bedIsOccupied(a)).length;

    expect(
      occupiedAfter,
      `beds counted as taken on ${unitId} fell from ${occupiedBefore} to ${occupiedAfter} across an ` +
        "arrival — a bed that was spoken for has been handed back while somebody is still coming to it",
    ).toBeGreaterThanOrEqual(occupiedBefore);
  });
});
