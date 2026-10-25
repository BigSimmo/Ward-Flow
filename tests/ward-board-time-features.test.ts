import { describe, expect, it } from "vitest";

import {
  currentShiftStartInstant,
  DAY_SHIFT_END_MINUTE,
  shiftEndInstant,
  pullHoldRemainingLabel,
  transportEtaRemainingLabel,
} from "../src/components/ward-management/ward-board-time-features";
import { dayOf, MINUTES_PER_DAY } from "../src/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

describe("ward board-time features", () => {
  it("currentShiftStartInstant finds the start of the day, evening and overnight shifts", () => {
    const day = dayOf(NOW_ANCHOR) * MINUTES_PER_DAY;
    expect(currentShiftStartInstant(day + 10 * 60)).toBe(day + 7 * 60);
    expect(currentShiftStartInstant(day + 15 * 60)).toBe(day + 15 * 60);
    expect(currentShiftStartInstant(day + 23 * 60 + 30)).toBe(day + 23 * 60);
    // 02:00 belongs to the night shift that began at 23:00 the day before.
    expect(currentShiftStartInstant(day + 2 * 60)).toBe(day - 60);
  });

  it("shiftEndInstant is the end of the shift now falls in, never a time already past", () => {
    const day = dayOf(NOW_ANCHOR) * MINUTES_PER_DAY;
    expect(shiftEndInstant(day + 10 * 60)).toBe(day + DAY_SHIFT_END_MINUTE);
    // Audit 2 E-14: in the evening and overnight the end is 23:00, then 07:00 the next morning.
    expect(shiftEndInstant(day + 20 * 60)).toBe(day + 23 * 60);
    expect(shiftEndInstant(day + 23 * 60 + 30)).toBe(day + MINUTES_PER_DAY + 7 * 60);
    expect(shiftEndInstant(day + 2 * 60)).toBe(day + 7 * 60);
    for (const minute of [0, 6 * 60 + 59, 7 * 60, 14 * 60 + 59, 15 * 60, 22 * 60 + 59, 23 * 60]) {
      expect(shiftEndInstant(day + minute)).toBeGreaterThan(day + minute);
    }
  });

  it("pullHoldRemainingLabel uses formatRemaining against pullExpiresAt only", () => {
    expect(pullHoldRemainingLabel(NOW_ANCHOR + 45, NOW_ANCHOR)).toBe("45m left");
    expect(pullHoldRemainingLabel(NOW_ANCHOR - 20, NOW_ANCHOR)).toBe("20m overdue");
  });

  it("transportEtaRemainingLabel reports left or overdue against typed estimatedAt", () => {
    expect(transportEtaRemainingLabel(NOW_ANCHOR + 90, NOW_ANCHOR)).toBe("1h 30m left");
    expect(transportEtaRemainingLabel(NOW_ANCHOR - 15, NOW_ANCHOR)).toBe("15m overdue");
  });
});
