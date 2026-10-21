import { describe, expect, it } from "vitest";

import {
  currentShiftStartInstant,
  DAY_SHIFT_END_MINUTE,
  shiftEndInstant,
  openWorkBeforeShiftEnd,
  openWorkBeforeShiftEndLabel,
  pullHoldRemainingLabel,
  transportEtaRemainingLabel,
} from "../src/components/ward-management/ward-board-time-features";
import { dayOf, MINUTES_PER_DAY } from "../src/components/ward-management/ward-clock";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import type { Movement } from "../src/components/ward-management/ward-model";
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

  it("openWorkBeforeShiftEnd lists only open pull holds and typed form times before the shift end", () => {
    const shiftEnd = shiftEndInstant(NOW_ANCHOR);
    const base = seedWardFlowState().movements[0]!;

    const beforePull: Movement = {
      ...base,
      id: "WF-TEST-PULL-BEFORE",
      stage: "pulled",
      pullExpiresAt: shiftEnd - 30,
      legalForm: undefined,
      closure: undefined,
    };
    const afterPull: Movement = {
      ...base,
      id: "WF-TEST-PULL-AFTER",
      stage: "pulled",
      pullExpiresAt: shiftEnd + 30,
      legalForm: undefined,
      closure: undefined,
    };
    const beforeForm: Movement = {
      ...base,
      id: "WF-TEST-FORM-BEFORE",
      stage: "accepted_awaiting_bed",
      pullExpiresAt: undefined,
      legalForm: { code: "1A", dueAt: shiftEnd - 60 },
      closure: undefined,
    };
    const closedBefore: Movement = {
      ...beforePull,
      id: "WF-TEST-CLOSED",
      closure: { outcome: "arrived", at: NOW_ANCHOR, reason: "arrived" },
    };

    const items = openWorkBeforeShiftEnd([beforePull, afterPull, beforeForm, closedBefore], NOW_ANCHOR);
    expect(items.map((item) => `${item.kind}:${item.movement.id}`)).toEqual([
      "typed_form:WF-TEST-FORM-BEFORE",
      "pull_hold:WF-TEST-PULL-BEFORE",
    ]);
    expect(openWorkBeforeShiftEndLabel(items[0]!, NOW_ANCHOR)).toContain("Form 1A");
    expect(openWorkBeforeShiftEndLabel(items[1]!, NOW_ANCHOR)).toContain("Bed pull");
  });

  it("seed fixture has open work before the shift end that the helper can surface", () => {
    const { movements } = seedWardFlowState();
    const items = openWorkBeforeShiftEnd(movements, NOW_ANCHOR);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.at).toBeLessThan(shiftEndInstant(NOW_ANCHOR));
    }
  });
});
