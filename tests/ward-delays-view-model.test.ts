import { describe, expect, it } from "vitest";
import { delayTimelineScale, delayTimelineSegments } from "@/components/ward-management/delays/delays-view-model";
import type { Movement } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const arrivalOnly: Movement = {
  ...wardMovements[0],
  openedAt: NOW_ANCHOR - 480,
  declines: [],
  withdrawnReferrals: [],
  transport: undefined,
  escalation: undefined,
  referredAt: undefined,
  formedAt: undefined,
  examination: undefined,
  closure: undefined,
  referralAbsence: undefined,
};

describe("delay timeline measurements", () => {
  it("uses a common linear scale that includes waits beyond 24 hours", () => {
    const longWait = { ...arrivalOnly, openedAt: NOW_ANCHOR - 29 * 60 };
    const scale = delayTimelineScale([arrivalOnly, longWait], NOW_ANCHOR);
    expect(scale).toBe(32 * 60);
    expect(delayTimelineSegments(arrivalOnly, NOW_ANCHOR, scale).totalWidth).toBe(25);
    expect(delayTimelineSegments(longWait, NOW_ANCHOR, scale).totalWidth).toBe(90.625);
  });

  it("does not present opening the journey as a subsequent update", () => {
    const segment = delayTimelineSegments(arrivalOnly, NOW_ANCHOR, 720);
    expect(segment.activity).toBeUndefined();
    expect(segment.beforeWidth).toBe(0);
    expect(segment.quiet).toBe(480);
    expect(segment.quietWidth).toBeCloseTo(66.6667);
  });

  it("locates a recorded update on the same scale as the wait end", () => {
    const segment = delayTimelineSegments({ ...arrivalOnly, referredAt: NOW_ANCHOR - 300 }, NOW_ANCHOR, 720);
    expect(segment.activity?.what).toBe("referral raised");
    expect(segment.beforeWidth).toBe(25);
    expect(segment.quiet).toBe(300);
    expect(segment.beforeWidth + segment.quietWidth).toBeCloseTo(segment.totalWidth);
  });

  it("ignores future updates and produces finite values for an empty population or zero wait", () => {
    expect(delayTimelineScale([], NOW_ANCHOR)).toBe(720);
    const future = delayTimelineSegments({ ...arrivalOnly, referredAt: NOW_ANCHOR + 20 }, NOW_ANCHOR, 720);
    expect(future.activity).toBeUndefined();
    const zero = delayTimelineSegments({ ...arrivalOnly, openedAt: NOW_ANCHOR }, NOW_ANCHOR, 720);
    expect(zero.totalWidth).toBe(0);
    expect(zero.quietWidth).toBe(0);
  });
});
