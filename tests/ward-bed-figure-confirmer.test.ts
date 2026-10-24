import { describe, expect, it } from "vitest";

import { capacityConfirmer } from "@/components/ward-management/capacity/capacity-confirmer";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** As a save stores it. */
const stored = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

/** A confirmed bed figure names the desk that confirmed it, not always the ward (D-80, Codex on #607). */
describe("who confirmed a ward's bed figure", () => {
  const seed = seedWardFlowState();
  const unit = seed.units[0]!;
  const confirmAs = (role: "ward" | "bed_manager" | "coordinator") =>
    wardFlowReducer(seed, {
      type: "CONFIRM_CAPACITY",
      role,
      now: NOW_ANCHOR,
      unitId: unit.id,
      actingUnitId: unit.id,
      value: 1,
      expectedRevision: unit.allocatable.revision ?? 0,
    });

  it.each([
    ["ward", `NUM ${unit.name}`],
    ["bed_manager", "Bed manager"],
    ["coordinator", "Flow coordinator"],
  ] as const)("a figure confirmed as %s reads as %s", (role, label) => {
    const next = confirmAs(role);
    expect(next.rejections).toHaveLength(seed.rejections.length);
    const confirmed = next.units.find((candidate) => candidate.id === unit.id)!;
    expect(confirmed.allocatable.confirmedBy).toBe(role);
    expect(capacityConfirmer(confirmed)).toBe(label);
    expect(isValidStoredWardFlowState(stored(next))).toBe(true);
  });

  it("reads an older figure with no confirmer as the ward's own, and a feed figure as nobody's", () => {
    expect(
      capacityConfirmer({ ...unit, allocatable: { ...unit.allocatable, source: "ward", confirmedBy: undefined } }),
    ).toBe(`NUM ${unit.name}`);
    expect(capacityConfirmer({ ...unit, allocatable: { ...unit.allocatable, source: "feed" } })).toBeUndefined();
  });

  it("refuses a stored figure naming any other confirmer", () => {
    const forged = {
      ...seed,
      units: seed.units.map((candidate, index) =>
        index === 0 ? { ...candidate, allocatable: { ...candidate.allocatable, confirmedBy: "executive" } } : candidate,
      ),
    };
    expect(isValidStoredWardFlowState(stored(seed))).toBe(true);
    expect(isValidStoredWardFlowState(stored(forged))).toBe(false);
  });
});
