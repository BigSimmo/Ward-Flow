import { describe, expect, it } from "vitest";

import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { waitlistStands } from "@/components/ward-management/ward-waitlist";

const UNIT = "unit-under-test";

function bareMovement(): Movement {
  const movement = seedWardFlowStateAt(0).movements[0];
  if (!movement) throw new Error("expected a seeded movement");
  return { ...movement, waitlistedUnitIds: [], declines: [], withdrawnReferrals: [] };
}

describe("waitlistStands", () => {
  it("is false when the ward never waitlisted the person", () => {
    expect(waitlistStands(bareMovement(), UNIT)).toBe(false);
  });

  it("holds while the waitlist answer is the latest word from the ward", () => {
    const movement: Movement = {
      ...bareMovement(),
      waitlistedUnitIds: [UNIT],
      declines: [{ unitId: UNIT, at: 1_000, reason: "no_bed" }],
    };
    expect(waitlistStands(movement, UNIT)).toBe(true);
  });

  it("ends when the referral to that ward is withdrawn after the waitlist answer", () => {
    const movement: Movement = {
      ...bareMovement(),
      waitlistedUnitIds: [UNIT],
      declines: [{ unitId: UNIT, at: 1_000, reason: "no_bed" }],
      withdrawnReferrals: [{ unitId: UNIT, at: 2_000, reason: "coordinator_withdrew" }],
    };
    expect(waitlistStands(movement, UNIT)).toBe(false);
  });

  it("holds again when the ward waitlists a later re-referral", () => {
    const movement: Movement = {
      ...bareMovement(),
      waitlistedUnitIds: [UNIT],
      declines: [
        { unitId: UNIT, at: 1_000, reason: "no_bed" },
        { unitId: UNIT, at: 3_000, reason: "bed_pulled_for_earlier_referral" },
      ],
      withdrawnReferrals: [{ unitId: UNIT, at: 2_000, reason: "coordinator_withdrew" }],
    };
    expect(waitlistStands(movement, UNIT)).toBe(true);
  });
});
