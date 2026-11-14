import { describe, expect, it } from "vitest";

import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { withInboxStreamADefaults } from "@/components/ward-management/ward-flow-stored-state-migration";
import { isValidSharedWardFlowState } from "@/components/ward-management/ward-shared-state-validation";
import { workedExamplesShown } from "@/components/ward-management/ward-rulings-demo";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * M12 (mechanics and clock audit, 14 Nov 2026): whether the worked examples are on was read off the
 * example records, which a scoped desk is not sent, so its Tools panel showed them as off and its
 * Reset demo dropped them. The world now holds the flag: `SET_SCENARIO` sets it, `RESET_SCENARIO`
 * keeps it, every desk is sent it, and an older save derives it once from its records.
 * Offline, synthetic seed.
 */
const examplesOn = (): WardFlowState =>
  wardFlowReducer(seedWardFlowState(), {
    type: "SET_SCENARIO",
    role: "demo",
    now: NOW_ANCHOR,
    scenario: "standard",
    workedExamples: true,
  });

/** A ward desk whose copy holds none of the example records. */
function wardDeskWithoutExamples(world: WardFlowState): { access: WardAccess; copy: WardFlowState } {
  const places = wardPlaceLookup(world.units);
  for (const unit of world.units) {
    const access: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [unit.id] } };
    const copy = scopeWardFlowState(world, access, { now: NOW_ANCHOR, places }).state;
    if (!workedExamplesShown(copy)) return { access, copy };
  }
  throw new Error("every ward desk holds an example record");
}

describe("M12: the worked examples are a setting of the world", () => {
  it("SET_SCENARIO sets the flag and the seed leaves it off", () => {
    expect(seedWardFlowState().workedExamples).toBe(false);
    expect(examplesOn().workedExamples).toBe(true);
    expect(seedWardFlowState("standard", { workedExamples: true }).workedExamples).toBe(true);
  });

  it("a scoped desk is sent the flag, though not the example records", () => {
    const { copy } = wardDeskWithoutExamples(examplesOn());
    expect(workedExamplesShown(copy)).toBe(false);
    expect(copy.workedExamples).toBe(true);
  });

  it("Reset demo keeps the examples on, even from a scoped copy", () => {
    const world = examplesOn();
    const { copy } = wardDeskWithoutExamples(world);
    for (const from of [world, copy]) {
      const reset = wardFlowReducer(from, { type: "RESET_SCENARIO", role: "demo", now: NOW_ANCHOR });
      expect(reset.workedExamples).toBe(true);
      expect(workedExamplesShown(reset)).toBe(true);
    }
    const off = wardFlowReducer(seedWardFlowState(), { type: "RESET_SCENARIO", role: "demo", now: NOW_ANCHOR });
    expect(off.workedExamples).toBe(false);
    expect(workedExamplesShown(off)).toBe(false);
  });

  it("a save made before the flag derives it once from its records", () => {
    for (const world of [examplesOn(), seedWardFlowState()]) {
      const old = JSON.parse(JSON.stringify(world)) as Partial<WardFlowState>;
      delete old.workedExamples;
      expect(isValidStoredWardFlowState(old)).toBe(true);
      expect(withInboxStreamADefaults(old as WardFlowState).workedExamples).toBe(world.workedExamples);
      const shared = JSON.parse(JSON.stringify(old)) as Partial<WardFlowState>;
      expect(isValidSharedWardFlowState(shared)).toBe(true);
      expect(shared.workedExamples).toBe(world.workedExamples);
    }
  });

  it("a save that holds the flag keeps it, and a non-boolean flag is refused", () => {
    const world = examplesOn();
    expect(withInboxStreamADefaults(world).workedExamples).toBe(true);
    expect(isValidStoredWardFlowState({ ...world, workedExamples: "yes" })).toBe(false);
  });
});
