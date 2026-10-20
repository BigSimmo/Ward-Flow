import { describe, expect, it } from "vitest";

import { shiftConfirmations } from "@/components/ward-management/capacity/shift-confirmations";
import { currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Unit } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const confirmedAt = (unit: Unit, at: number): Unit => ({
  ...unit,
  allocatable: { ...unit.allocatable, confirmedAt: at },
});

describe("shiftConfirmations", () => {
  const [a, b, c] = seedWardFlowState().units;

  it("counts wards confirmed since the shift began and lists the rest, longest unconfirmed first", () => {
    // 10:00 on a day: the day shift began at 07:00.
    const now = Math.floor(NOW_ANCHOR / 1440) * 1440 + 600;
    const since = currentShiftStartInstant(now);
    expect(since).toBe(now - 180);
    const units = [confirmedAt(a!, since), confirmedAt(b!, since - 1), confirmedAt(c!, since - 600)];
    const summary = shiftConfirmations(units, now);
    expect(summary.shift).toBe("Day Shift");
    expect(summary.since).toBe(since);
    expect(summary.confirmed).toBe(1);
    expect(summary.total).toBe(3);
    expect(summary.waiting.map((unit) => unit.id)).toEqual([c!.id, b!.id]);
  });

  it("takes the night shift across midnight", () => {
    // 02:00: the night shift began at 23:00 the day before.
    const now = Math.floor(NOW_ANCHOR / 1440) * 1440 + 120;
    const summary = shiftConfirmations([confirmedAt(a!, now - 200), confirmedAt(b!, now - 170)], now);
    expect(summary.shift).toBe("Night Shift");
    expect(summary.since).toBe(now - 180);
    expect(summary.waiting.map((unit) => unit.id)).toEqual([a!.id]);
  });
});
