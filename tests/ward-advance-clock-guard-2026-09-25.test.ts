import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function added(before: WardFlowState, after: WardFlowState) {
  return after.rejections.slice(before.rejections.length).map((rejection) => rejection.reason);
}

function advance(state: WardFlowState, minutes: number) {
  return wardFlowReducer(state, { type: "ADVANCE_CLOCK", role: "demo", now: NOW, minutes });
}

describe("ADVANCE_CLOCK refuses a non-finite or negative amount (audit follow-up 2026-09-25)", () => {
  it("refuses NaN minutes instead of adding it unchecked to the offset", () => {
    const seeded = seedWardFlowState();
    const next = advance(seeded, Number.NaN);
    expect(next.clockOffsetMinutes).toBe(seeded.clockOffsetMinutes);
    expect(added(seeded, next)).toHaveLength(1);
  });

  it("refuses Infinity minutes", () => {
    const seeded = seedWardFlowState();
    const next = advance(seeded, Number.POSITIVE_INFINITY);
    expect(next.clockOffsetMinutes).toBe(seeded.clockOffsetMinutes);
    expect(added(seeded, next)).toHaveLength(1);
  });

  it("refuses a negative amount", () => {
    const seeded = seedWardFlowState();
    const next = advance(seeded, -15);
    expect(next.clockOffsetMinutes).toBe(seeded.clockOffsetMinutes);
    expect(added(seeded, next)).toHaveLength(1);
  });

  it("still accepts a genuine positive advance", () => {
    const seeded = seedWardFlowState();
    const next = advance(seeded, 15);
    expect(next.clockOffsetMinutes).toBe(seeded.clockOffsetMinutes + 15);
    expect(added(seeded, next)).toHaveLength(0);
  });

  it("still accepts zero minutes (a no-op advance is not an invalid one)", () => {
    const seeded = seedWardFlowState();
    const next = advance(seeded, 0);
    expect(next.clockOffsetMinutes).toBe(seeded.clockOffsetMinutes);
    expect(added(seeded, next)).toHaveLength(0);
  });
});
