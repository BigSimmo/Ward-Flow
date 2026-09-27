import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

/** `rph-adult-secure` carries 20 beds in `ward-sites.ts`; `rph-older-adult` carries 14. */
const UNIT = "rph-adult-secure";

function confirm(value: number, unitId: string = UNIT) {
  const before = seedWardFlowState();
  const after = wardFlowReducer(before, {
    type: "CONFIRM_CAPACITY",
    role: "ward",
    now: NOW,
    unitId,
    actingUnitId: unitId,
    expectedRevision: before.units.find((unit) => unit.id === unitId)!.allocatable.revision ?? 0,
    value,
  });
  return {
    before: before.units.find((candidate) => candidate.id === unitId)!,
    after: after.units.find((candidate) => candidate.id === unitId)!,
    state: after,
  };
}

/**
 * The reducer is the trust boundary, and for this one event it was not acting like one.
 *
 * ⚠️ WHAT WAS ACTUALLY WRONG, stated precisely so nobody later "fixes" more than this. The ward
 * screen already bounds its own input (`min={0} max={unit.beds}`, plus a negative guard in
 * `submitCapacity`). The reducer did not, writing `allocatable.value` straight from the event. That
 * is backwards relative to this file's own repeated doctrine that a refusal belongs in the engine,
 * because a screen check is bypassed by any other call site and by every test that builds an event
 * by hand.
 *
 * ⚠️ AND THE HARM IS NARROWER THAN THE 17 SEPT AUDIT IMPLIED. State could not be corrupted:
 * `tests/ward-flow-reducer.test.ts`'s "arrival capacity floor" deliberately USES the unbounded
 * write — restating 5 allocatable beds on a unit with 1 — to prove `PATIENT_ARRIVED` refuses once
 * physically empty beds run out rather than driving `empty.value` negative. The residual exposure
 * was a DISPLAYED allocatable figure larger than the ward physically has.
 *
 * 🔴 SO THE BOUND IS `unit.beds`, NOT `empty.value`. Bounding to `empty.value` would forbid exactly
 * the restatement that floor test depends on, and would also be wrong on its own terms: a ward
 * restating what it can allocate is allowed to disagree with a stale feed figure. Twenty beds is a
 * physical fact about the building; two empty ones is a claim about right now.
 *
 * 🔴 AND IT REFUSES RATHER THAN CLAMPS. A ward typing 30 into a 20-bed ward has made a mistake worth
 * telling them about. A silent clamp to 20 would record a number the ward never said and read back
 * as agreement.
 */
describe("CONFIRM_CAPACITY bounds a ward's restated allocatable count", () => {
  it("accepts a count inside the ward's bed count", () => {
    const { after } = confirm(12);
    expect(after.allocatable.value).toBe(12);
    expect(after.allocatable.source).toBe("ward");
    expect(after.allocatable.confirmedAt).toBe(NOW);
  });

  it("accepts a count exactly equal to the ward's bed count", () => {
    const { after, before } = confirm(20);
    expect(before.beds).toBe(20);
    expect(after.allocatable.value).toBe(20);
  });

  it("accepts zero, which is a ward saying it can take nobody", () => {
    expect(confirm(0).after.allocatable.value).toBe(0);
  });

  it("refuses a count above the ward's bed count, naming both numbers", () => {
    const { before, after, state } = confirm(21);
    expect(state.rejections).toHaveLength(1);
    expect(state.rejections[0].attempted).toBe("CONFIRM_CAPACITY");
    expect(state.rejections[0].reason).toContain("21");
    expect(state.rejections[0].reason).toContain("20");
    // Nothing was written: not the value, not the stamp.
    expect(after.allocatable.value).toBe(before.allocatable.value);
    expect(after.allocatable.confirmedAt).toBe(before.allocatable.confirmedAt);
  });

  it("refuses a negative count", () => {
    const { before, after, state } = confirm(-1);
    expect(state.rejections).toHaveLength(1);
    expect(after.allocatable.value).toBe(before.allocatable.value);
  });

  it("refuses a fractional count, because a bed is not divisible", () => {
    const { before, after, state } = confirm(2.5);
    expect(state.rejections).toHaveLength(1);
    expect(after.allocatable.value).toBe(before.allocatable.value);
  });

  it("bounds each unit by its OWN bed count, not by the network's largest", () => {
    // rph-older-adult has 14 beds. 20 is legal on rph-adult-secure and must not be legal here.
    const { state, before } = confirm(20, "rph-older-adult");
    expect(before.beds).toBe(14);
    expect(state.rejections).toHaveLength(1);
    expect(state.rejections[0].reason).toContain("14");
  });

  it("leaves the existing over-empty restatement the arrival floor test depends on", () => {
    // The bound is the ward's beds, never its empty count. rph-adult-secure seeds empty 2,
    // allocatable 1; restating 5 is a legitimate ward correction and must still be accepted.
    const { after } = confirm(5);
    expect(after.allocatable.value).toBe(5);
    expect(after.empty.value).toBe(2);
  });
});
