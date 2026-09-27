import { describe, expect, it } from "vitest";

import { MINUTES_PER_DAY } from "../src/components/ward-management/ward-clock";
import {
  RELEASE_DAYS,
  parseReleaseDayInstant,
  releaseTimeAlreadyPassed,
} from "../src/components/ward-management/ward/release-day";

/**
 * Task F1 (owner answer 32, build plan §4). The catcher this file exists to be:
 * `ward-screen.tsx`'s old `parseTimeInputToInstant` always parsed a typed `HH:MM` to 0-1439, a
 * minute of demo DAY ZERO — never the clock's own current day. Flag a release "at 14:00" after
 * the demo clock has rolled past midnight once, and the stamped instant reads as 14:00 on the
 * OPENING day: already hours in the past, so the bed shows "due now" instead of later today.
 *
 * `parseReleaseDayInstant` fixes this by resolving "Today" against `dayOf(now)` — the clock's own
 * current day — rather than a fixed day zero, and "Tomorrow" one calendar day past that.
 */
describe("parseReleaseDayInstant", () => {
  // The task brief's own worked example: the demo clock on day 1 at 10:00.
  const NOW_DAY_1_AT_10 = 1 * MINUTES_PER_DAY + 10 * 60;

  it("resolves Today against the clock's OWN current day, not day zero — the defect this file exists to catch", () => {
    // Naive day-zero parsing would give 840 (0 * 1440 + 840). The clock is on day 1, so a
    // same-day pick must land on day 1.
    expect(parseReleaseDayInstant(NOW_DAY_1_AT_10, "today", "14:00")).toBe(1 * MINUTES_PER_DAY + 840);
  });

  it("resolves Tomorrow to the calendar day after the clock's own day", () => {
    expect(parseReleaseDayInstant(NOW_DAY_1_AT_10, "tomorrow", "09:00")).toBe(2 * MINUTES_PER_DAY + 540);
  });

  it("on the opening day (day zero), Today still resolves the same way it always did", () => {
    // dayOf(now) === 0 on the opening day, so this is unchanged from the old bare-minute parse —
    // proving the fix is a generalisation, not a behaviour change on the day everything used to
    // work on.
    const now = 9 * 60; // day 0, 09:00
    expect(parseReleaseDayInstant(now, "today", "16:30")).toBe(16 * 60 + 30);
  });

  it("a Tomorrow pick the moment after midnight still lands one full calendar day out, not zero", () => {
    const now = 1 * MINUTES_PER_DAY; // day 1, 00:00 exactly
    expect(parseReleaseDayInstant(now, "tomorrow", "00:00")).toBe(2 * MINUTES_PER_DAY);
  });

  it("refuses malformed or empty input rather than guessing a value", () => {
    expect(parseReleaseDayInstant(NOW_DAY_1_AT_10, "today", "")).toBeUndefined();
    expect(parseReleaseDayInstant(NOW_DAY_1_AT_10, "today", "9:00")).toBeUndefined();
    expect(parseReleaseDayInstant(NOW_DAY_1_AT_10, "today", "24:00")).toBeUndefined();
    expect(parseReleaseDayInstant(NOW_DAY_1_AT_10, "today", "10:60")).toBeUndefined();
  });

  it("offers exactly the two fixed options, in the order the chooser renders them", () => {
    expect(RELEASE_DAYS).toEqual(["today", "tomorrow"]);
  });
});

describe("releaseTimeAlreadyPassed", () => {
  const NOW_DAY_1_AT_10 = 1 * MINUTES_PER_DAY + 10 * 60; // day 1, 10:00

  it("is true for a Today pick earlier than the clock's own time of day", () => {
    expect(releaseTimeAlreadyPassed(NOW_DAY_1_AT_10, "today", "09:00")).toBe(true);
  });

  it("is false for a Today pick later than the clock's own time of day", () => {
    expect(releaseTimeAlreadyPassed(NOW_DAY_1_AT_10, "today", "14:00")).toBe(false);
  });

  it("is false for a Today pick exactly at the clock's own time — that is now, not already passed", () => {
    expect(releaseTimeAlreadyPassed(NOW_DAY_1_AT_10, "today", "10:00")).toBe(false);
  });

  it("is never true for Tomorrow — the earliest tomorrow instant is always later than now", () => {
    expect(releaseTimeAlreadyPassed(NOW_DAY_1_AT_10, "tomorrow", "00:00")).toBe(false);
    expect(releaseTimeAlreadyPassed(NOW_DAY_1_AT_10, "tomorrow", "09:00")).toBe(false);
  });

  it("is false for malformed input — nothing resolved, so nothing to warn about", () => {
    expect(releaseTimeAlreadyPassed(NOW_DAY_1_AT_10, "today", "")).toBe(false);
  });
});
