import { describe, expect, it } from "vitest";

import {
  DAY_SHIFT_END_MINUTE,
  dayShiftEndInstant,
  openWorkBeforeShiftEnd,
  openWorkBeforeShiftEndLabel,
  pullHoldRemainingLabel,
  transportEtaRemainingLabel,
} from "../src/components/ward-management/ward-board-time-features";
import { dayOf, minuteOfDay, MINUTES_PER_DAY } from "../src/components/ward-management/ward-clock";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import type { Movement } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

describe("ward board-time features", () => {
  it("dayShiftEndInstant is 15:00 on the same demonstration day as now", () => {
    const end = dayShiftEndInstant(NOW_ANCHOR);
    expect(dayOf(end)).toBe(dayOf(NOW_ANCHOR));
    expect(minuteOfDay(end)).toBe(DAY_SHIFT_END_MINUTE);
    expect(end).toBe(dayOf(NOW_ANCHOR) * MINUTES_PER_DAY + DAY_SHIFT_END_MINUTE);
  });

  it("pullHoldRemainingLabel uses formatRemaining against pullExpiresAt only", () => {
    expect(pullHoldRemainingLabel(NOW_ANCHOR + 45, NOW_ANCHOR)).toBe("45m left");
    expect(pullHoldRemainingLabel(NOW_ANCHOR - 20, NOW_ANCHOR)).toBe("20m overdue");
  });

  it("transportEtaRemainingLabel reports left or overdue against typed estimatedAt", () => {
    expect(transportEtaRemainingLabel(NOW_ANCHOR + 90, NOW_ANCHOR)).toBe("1h 30m left");
    expect(transportEtaRemainingLabel(NOW_ANCHOR - 15, NOW_ANCHOR)).toBe("15m overdue");
  });

  it("openWorkBeforeShiftEnd lists only open pull holds and typed form times before 15:00", () => {
    const shiftEnd = dayShiftEndInstant(NOW_ANCHOR);
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

  it("seed fixture has open work before 15:00 that the helper can surface", () => {
    const { movements } = seedWardFlowState();
    const items = openWorkBeforeShiftEnd(movements, NOW_ANCHOR);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.at).toBeLessThan(dayShiftEndInstant(NOW_ANCHOR));
    }
  });
});
