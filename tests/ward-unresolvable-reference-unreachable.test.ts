// tests/ward-unresolvable-reference-unreachable.test.ts
//
// 🔴 THE ANSWER TO "WHY IS THE UNRESOLVABLE-DEPARTMENT SENTENCE NOT TESTED WHERE IT RENDERS?"
// AND IT IS A FINDING, NOT A TESTING GAP.
//
// Ward Lead's ruling, 2026-09-12, on being told the ruled sentence is asserted only at the helper:
// pin one RENDER site by making the seed able to produce a dangling movement THROUGH THE REDUCER,
// the way the app would — and "if the seed genuinely CANNOT express a dangling movement, that is
// not a testing obstacle, it is a finding. A state the screen renders a sentence for, that nothing
// in the model can produce, is a branch defending against something that cannot happen."
//
// MEASURED 2026-09-12: IT CANNOT. Both ids are validated before they are ever written.
//
//     RAISE_REFERRAL       the ONLY writer of `Movement.originEdId` in the whole reducer
//                          (one site), and it refuses an id no emergency department matches
//     ACCEPT_IN_PRINCIPLE  writes `acceptedUnitId`, and refuses an id no unit matches
//     the seed             0 of 50 movements carry an unresolvable value of either
//
// ⚠️ SO THE BRANCH IS UNREACHABLE BY CONSTRUCTION, not merely absent from today's fixture. No
// dispatch any screen can make will produce a movement that renders it.
//
// 🔴 AND THE RIGHT CONCLUSION IS NOT "DELETE THE BRANCH". The owner's standing rule is that every
// invented figure in this prototype is replaced with real data, and a dangling reference is exactly
// what arrives with real data — a department decommissioned, a ward renamed, an id that meant
// something in another system. The branch is a guard against the data change that is planned, and
// its wording is a clinical-safety ruling (blame the RECORD, not the network).
//
// ✅ WHAT THIS FILE DOES INSTEAD OF A RENDER TEST: it pins the UNREACHABILITY. If either refusal is
// ever removed, the branch becomes reachable, and whoever removed it is told here that the ruled
// sentence now needs a render-site assertion — which is the moment that test becomes possible and
// necessary, and not before.

import { describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { allEmergencyDepartments, allUnits, NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { wardMovements } from "../src/components/ward-management/ward-movements";

const NOW = NOW_ANCHOR;
const NO_SUCH_ED = "ed-that-does-not-exist-9999";
const NO_SUCH_UNIT = "unit-that-does-not-exist-9999";

/**
 * ⚠️ **`seedWardFlowState` TAKES A SCENARIO, NOT AN INSTANT — and the first version of this file
 * passed `NOW` into it.** 🔴 **`vitest` does not typecheck and neither does the pre-commit hook, so
 * a whole suite passed while calling a function with the wrong argument.**
 *
 * 🔴 **AND MY FIRST NOTE ABOUT IT WAS ITSELF WRONG, WHICH IS THE PART WORTH KEEPING.** It said an
 * unrecognised value *"falls through to the standard seed"*. **It does not.** `scenarioUnits`
 * returns the standard units for `"standard"` and takes the SCARCE branch for **everything else** —
 * so the test was seeding a network where every third ward has one bed and the rest have none.
 * ⚠️ **Reported by another lane reading my fix rather than my code.**
 *
 * ✅ **The assertions below did hold, for a reason the wrong note did not give:** they are about the
 * reducer REFUSING unknown ids and about `wardMovements`, neither of which depends on the unit set.
 * **A green run was never evidence the call was right, and the first correction was not evidence
 * the reasoning was either.**
 */
function seeded(): WardFlowState {
  return seedWardFlowState();
}

function newestRejection(state: WardFlowState) {
  const rejection = state.rejections.at(-1);
  if (rejection === undefined) throw new Error("the reducer accepted the event — there is no rejection to read");
  return rejection;
}

describe("no dispatch in this application can create an unresolvable department or ward reference", () => {
  it("has the two ids genuinely unresolvable, or every refusal below is about nothing", () => {
    expect(
      allEmergencyDepartments().some((department) => department.id === NO_SUCH_ED),
      "the fixture now contains the id this file uses as its impossible one — pick another, or " +
        "every assertion here is asserting that a VALID id was refused",
    ).toBe(false);
    expect(allUnits().some((unit) => unit.id === NO_SUCH_UNIT)).toBe(false);
  });

  it("refuses to raise a movement from a department it cannot find", () => {
    const before = seeded();
    const after = wardFlowReducer(before, {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW,
      edId: NO_SUCH_ED,
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        specialling: false,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
    });

    expect(
      after.movements.length,
      "a movement was created with a department id that resolves to nothing. The screens' " +
        "unresolvable-department sentence is now REACHABLE, and it must be asserted where it " +
        "renders rather than only at `departmentLabel`",
    ).toBe(before.movements.length);
    expect(newestRejection(after).reason).toContain(NO_SUCH_ED);
  });

  /**
   * ⚠️ **THE SECOND HALF, AND IT IS A DIFFERENT WRITER.** `acceptedUnitId` is written by
   * `ACCEPT_IN_PRINCIPLE`, not by the creation path — so the first test says nothing about it, and
   * the ward sentence would have been left unaccounted for.
   */
  it("refuses to accept a movement into a ward it cannot find", () => {
    const before = seeded();
    const movement = before.movements.find((candidate) => candidate.closure === undefined);
    expect(movement, "no open movement in the seed — this refusal cannot be reached").toBeDefined();

    const after = wardFlowReducer(before, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW,
      movementId: movement!.id,
      unitId: NO_SUCH_UNIT,
    });

    expect(
      after.movements.find((candidate) => candidate.id === movement!.id)?.acceptedUnitId,
      "a movement was accepted into a ward id that resolves to nothing. The screens' " +
        "unresolvable-ward sentence is now REACHABLE and needs a render-site assertion",
    ).toBe(movement!.acceptedUnitId);

    /*
     * 🔴 THE REASON IS DELIBERATELY NOT ASSERTED TO NAME THE UNIT, AND FINDING OUT WHY MADE THIS
     * FINDING STRONGER.
     *
     * The first draft asserted the refusal quoted the unknown id. It does not — the reducer
     * refused EARLIER, on the movement's stage, and a movement at an acceptable stage would then
     * have been refused on "does not hold a live referral", which is checked BEFORE the unit
     * lookup. ⚠️ An unknown unit can never hold a live referral, so `ACCEPT_IN_PRINCIPLE`'s own
     * "no unit found" branch is ITSELF unreachable through this path.
     *
     * ✅ So there are TWO gates in front of a dangling `acceptedUnitId`, not one, and the property
     * worth pinning is the STATE — the movement was not accepted — rather than which gate stopped
     * it. Pinning the sentence would have made this test fail the day the gates were reordered,
     * for no clinical reason at all.
     */
    expect(after.rejections.length, "the reducer accepted it and recorded nothing").toBeGreaterThan(
      before.rejections.length,
    );
  });

  /**
   * 🔴 **THE OTHER HALF OF "UNREACHABLE": the hand-authored seed.** The reducer refusing to create
   * one is only half the claim — the fixture is written by hand and nothing stops it carrying a
   * dangling id directly. **This is the assertion that expires first**, and when it does, a render
   * test becomes both possible and necessary.
   */
  it("has no seeded movement carrying either dangling reference", () => {
    const departments = new Set(allEmergencyDepartments().map((department) => department.id));
    const units = new Set(allUnits().map((unit) => unit.id));

    expect(
      wardMovements
        .filter((movement) => !departments.has(movement.originEdId))
        .map((movement) => `${movement.id} -> ${movement.originEdId}`),
      "the seed now carries a dangling department — the sentence is reachable by rendering and " +
        "should be asserted there",
    ).toEqual([]);
    expect(
      wardMovements
        .filter((movement) => movement.acceptedUnitId !== undefined && !units.has(movement.acceptedUnitId))
        .map((movement) => `${movement.id} -> ${movement.acceptedUnitId}`),
      "the seed now carries a dangling ward — the sentence is reachable by rendering",
    ).toEqual([]);
  });
});
