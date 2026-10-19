import { afterEach, describe, expect, it, vi } from "vitest";

import { clk } from "../src/components/wf/format";
import {
  MINUTES_PER_DAY,
  absoluteWallClockMinutes,
  demoDayZero,
  formatInstant,
  minuteOfDay,
  perthCalendarDay,
  wallClockNow,
} from "../src/components/ward-management/ward-clock";

/**
 * F-22 (19 Oct 2026): the demo clock reads Perth wall time, not the device's zone. These moments sit
 * where Perth, Sydney and UTC disagree about the day, so the file proves the fix only when it passes
 * under more than one zone: run it with TZ=Australia/Sydney, TZ=UTC and TZ=Australia/Perth.
 */
describe("the demo clock reads Perth time whatever the device's zone", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads 00:30 Perth just after Perth midnight, when Sydney reads 03:30 and UTC the day before", () => {
    vi.useFakeTimers();
    // 00:30 AWST on Monday 19 October 2026 = 16:30 UTC on 18 October = 03:30 AEDT on 19 October.
    const moment = new Date("2026-10-18T16:30:00Z");
    vi.setSystemTime(moment);

    expect(wallClockNow()).toBe(30);
    expect(formatInstant(wallClockNow())).toBe("00:30");
    expect(minuteOfDay(absoluteWallClockMinutes())).toBe(30);
    expect(clk(moment)).toBe("00:30");
    expect(clk(moment.getTime())).toBe("00:30");

    // The absolute clock's day is the Perth calendar day, the same day day 0 is anchored to.
    const day = Math.floor(absoluteWallClockMinutes() / MINUTES_PER_DAY);
    expect(day * MINUTES_PER_DAY * 60_000).toBe(Date.UTC(2026, 9, 19));
    expect(perthCalendarDay(moment)).toMatchObject({ year: 2026, monthIndex: 9, day: 19 });
    expect(demoDayZero(moment).toISOString()).toBe("2026-10-18T16:00:00.000Z");
  });

  it("measures elapsed demo time from day 0 consistently with the absolute clock", () => {
    vi.useFakeTimers();
    // 23:50 AWST on 19 October 2026: late enough that a Sydney or UTC reading lands on another day.
    const moment = new Date("2026-10-19T15:50:00Z");
    vi.setSystemTime(moment);

    const sinceDayZero = (moment.getTime() - demoDayZero(moment).getTime()) / 60_000;
    expect(sinceDayZero).toBe(23 * 60 + 50);
    expect(minuteOfDay(absoluteWallClockMinutes())).toBe(sinceDayZero);
    expect(wallClockNow()).toBe(sinceDayZero);
    expect(clk(moment)).toBe("23:50");
  });
});
