import { describe, expect, it } from "vitest";

import { mayCarryAdverseExample } from "../src/components/ward-management/ward-demo-adverse-wards";
import {
  oldPackCounts,
  PACK_OLD_AFTER_MINUTES,
  wardsWithOldPack,
} from "../src/components/ward-management/ward-downtime-pack-prints";
import {
  seedWardFlowState,
  seedWardFlowStateAt,
  wardFlowReducer,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * Screen audit 19 Nov 2026 (item 6): a fresh demo starts with most wards' outage packs printed
 * earlier today, and two wards left as the "never printed" example. Synthetic seed data only; the
 * rule that counts old packs is unchanged.
 */
describe("the demo seeds outage pack prints (item 6)", () => {
  it("leaves two wards never printed, on wards that may carry an adverse example, and none over age", () => {
    const seed = seedWardFlowState();
    const unitIds = seed.units.map((unit) => unit.id);
    const old = wardsWithOldPack(seed.downtimePackPrints, unitIds, NOW_ANCHOR);
    expect(oldPackCounts(old)).toEqual({ neverPrinted: 2, overAge: 0 });
    for (const ward of old)
      expect(mayCarryAdverseExample(seed.units.find((unit) => unit.id === ward.unitId)!)).toBe(true);
    for (const record of seed.downtimePackPrints ?? []) {
      expect(record.at).toBeLessThan(NOW_ANCHOR);
      expect(NOW_ANCHOR - record.at).toBeLessThan(PACK_OLD_AFTER_MINUTES / 2);
    }
  });

  it("moves the print times with the demo clock, and Reset demo brings the seeded prints back", () => {
    const offset = 3 * 24 * 60 + 17;
    const moved = seedWardFlowStateAt(offset);
    const unitIds = moved.units.map((unit) => unit.id);
    expect(oldPackCounts(wardsWithOldPack(moved.downtimePackPrints, unitIds, NOW_ANCHOR + offset))).toEqual({
      neverPrinted: 2,
      overAge: 0,
    });
    const printed = wardFlowReducer(moved, {
      type: "RECORD_DOWNTIME_PACK_PRINTED",
      role: "coordinator",
      now: NOW_ANCHOR + offset,
      unitIds,
    });
    expect(oldPackCounts(wardsWithOldPack(printed.downtimePackPrints, unitIds, NOW_ANCHOR + offset)).neverPrinted).toBe(
      0,
    );
    const reset = wardFlowReducer(printed, { type: "RESET_SCENARIO", role: "demo", now: NOW_ANCHOR + offset } as never);
    expect(reset.downtimePackPrints).toEqual(moved.downtimePackPrints);
  });
});
