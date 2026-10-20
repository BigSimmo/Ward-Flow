import { describe, expect, it } from "vitest";

import {
  type CountedFigure,
  nextUnchangedShifts,
  shiftConfirmations,
  unchangedConfirmations,
} from "@/components/ward-management/capacity/shift-confirmations";
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

describe("confirmed with no changes, shift after shift (overall review, 20 Oct 2026)", () => {
  const [a, b, c] = seedWardFlowState().units;
  // 10:00 on a day: the day shift began at 07:00.
  const now = Math.floor(NOW_ANCHOR / 1440) * 1440 + 600;
  const since = currentShiftStartInstant(now);
  const figure = (value: number, confirmedAt: number, unchangedShifts?: number, source: "ward" | "feed" = "ward") => ({
    ...a!.allocatable,
    value,
    source,
    confirmedAt,
    ...(unchangedShifts === undefined ? {} : { unchangedShifts }),
  });

  it("adds one per shift for the same number, holds within a shift, and resets on any change", () => {
    expect(nextUnchangedShifts(figure(3, since - 60, 2), 3, now)).toBe(3);
    expect(nextUnchangedShifts(figure(3, since - 60), 3, now)).toBe(1);
    expect(nextUnchangedShifts(figure(3, since + 10, 2), 3, now)).toBe(2);
    expect(nextUnchangedShifts(figure(3, since - 60, 5), 2, now)).toBe(0);
    expect(nextUnchangedShifts(figure(3, since - 60, 5, "feed"), 3, now)).toBe(0);
  });

  it("lists the wards at three shifts or more, by name, with the count only", () => {
    const withCount = (unit: Unit, unchangedShifts: number): Unit => {
      const allocatable: CountedFigure = { ...unit.allocatable, unchangedShifts };
      return { ...unit, allocatable };
    };
    const listed = unchangedConfirmations([withCount(a!, 7), withCount(b!, 2), withCount(c!, 3)]);
    expect(listed.map((entry) => entry.unit.id)).toEqual(
      [a!, c!].sort((left, right) => left.name.localeCompare(right.name)).map((unit) => unit.id),
    );
    expect(listed.find((entry) => entry.unit.id === a!.id)?.shifts).toBe(7);
    expect(unchangedConfirmations([a!, b!])).toEqual([]);
  });
});
