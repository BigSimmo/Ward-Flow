/**
 * Review, 8 Nov 2026: a departure from a locked bed gives the bed back, but never past the ward's
 * own locked beds. If the ward re-confirmed its figures while the bed was held, an uncapped +1
 * would leave a count the shared save refuses as invalid.
 */
import { describe, expect, it } from "vitest";

import { departAdmission, seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("locked-bed departure cap", () => {
  it("does not raise free locked beds above the ward's locked beds", () => {
    const seeded = seedWardFlowState();
    const occupied = seeded.admissions.find((row) => row.state === "occupied");
    expect(occupied, "the seed has an occupied bed").toBeDefined();
    const admission = { ...occupied!, bedKind: "locked" as const };
    const seededUnit = seeded.units.find((row) => row.id === admission.unitId)!;
    const lockedBeds = Math.max(1, seededUnit.lockedBeds);
    const full = { ...seededUnit, lockedBeds, allocatableLocked: lockedBeds };
    const state = {
      ...seeded,
      admissions: seeded.admissions.map((row) => (row.id === admission.id ? admission : row)),
      units: seeded.units.map((row) => (row.id === full.id ? full : row)),
    };
    const next = departAdmission(state, admission, full, NOW_ANCHOR + 1, "discharged-to-the-community", "ward");
    expect(next.units.find((row) => row.id === full.id)!.allocatableLocked).toBe(lockedBeds);
  });
});
