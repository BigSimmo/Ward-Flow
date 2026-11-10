import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { clk } from "../src/components/wf/format";
import { currentShift, shiftEndInstant } from "../src/components/ward-management/ward-board-time-features";
import {
  MINUTES_PER_DAY,
  absoluteWallClockMinutes,
  demoDayZero,
  formatInstant,
  perthCalendarDay,
  perthClockTime,
  perthDateTimeLocal,
  perthIsoDay,
  wallClockNow,
} from "../src/components/ward-management/ward-clock";
import { onDeviceClock, sharedBoardNow } from "../src/components/ward-management/ward-shared-clock";
import { checkReviewTime, reviewTimeStamp } from "../src/components/ward-management/triage/triage-risk-text";

/**
 * M18 (master audit list, 10 Nov 2026): Perth time and clocks.
 *
 * Perth (AWST) is UTC+8 all year. The risks are a device clock that is wrong, a device set to another
 * zone (Sydney, on its two daylight-saving changeover nights), Perth midnight and the shift edges.
 * `tests/ward-clock-perth-zone.test.ts` already proves the demo clock under TZ=Sydney/UTC/Perth when
 * the suite is run in each zone. This file sets the zone itself, so it proves the Sydney case in any
 * run, and adds the device clock 10 minutes fast and slow.
 *
 * "Ordered by the server's clock" is the backend's job (every save is stamped by the server); the
 * device side is only `sharedBoardNow` and `onDeviceClock`, tested here.
 */

const MINUTE_MS = 60_000;
const SKEWS = [
  { label: "10 minutes fast", ms: 10 * MINUTE_MS },
  { label: "10 minutes slow", ms: -10 * MINUTE_MS },
];

/** Perth "HH:MM" worked out independently of the code under test, through Intl. */
const PERTH_HM = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Australia/Perth",
});

describe("M18: a device clock 10 minutes fast or slow (shared mode)", () => {
  const serverNowMs = Date.UTC(2026, 10, 10, 2, 0); // 10:00 AWST
  const snapshotMinute = 600;

  for (const skew of SKEWS) {
    it(`keeps the board minute on the server's clock when the device is ${skew.label}`, () => {
      // The answer is received at the server's 10:00; the device reads its own clock throughout.
      const receivedAtDevice = serverNowMs + skew.ms;
      for (const elapsed of [0, 1, 7, 59, 61, 600]) {
        const deviceNow = receivedAtDevice + elapsed * MINUTE_MS;
        expect(sharedBoardNow(snapshotMinute, receivedAtDevice, deviceNow)).toBe(snapshotMinute + elapsed);
      }
    });

    it(`ends shared access at the server's deadline when the device is ${skew.label}`, () => {
      const accessUntil = serverNowMs + 30 * MINUTE_MS;
      const deviceNow = serverNowMs + skew.ms;
      const answer = onDeviceClock({ serverTime: serverNowMs, accessUntil, snapshot: { accessUntil } }, deviceNow);
      // Time left on the device's clock equals time left on the server's: 30 minutes, not 20 or 40.
      expect(answer.accessUntil - deviceNow).toBe(30 * MINUTE_MS);
      expect(answer.snapshot.accessUntil - deviceNow).toBe(30 * MINUTE_MS);
    });
  }

  it("would show the skew if the anchor were dropped (anti-vacuity)", () => {
    // Without serverTime the deadline is used as sent, so a fast device loses 10 minutes.
    const accessUntil = serverNowMs + 30 * MINUTE_MS;
    const deviceNow = serverNowMs + 10 * MINUTE_MS;
    expect(onDeviceClock({ accessUntil }, deviceNow).accessUntil - deviceNow).toBe(20 * MINUTE_MS);
  });
});

describe("M18: a Sydney-zone device on both changeover nights", () => {
  const originalTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "Australia/Sydney";
  });
  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is really running in Sydney time (anti-vacuity)", () => {
    // AEDT (+11) in January, AEST (+10) in July: the device zone took effect.
    expect(new Date(Date.UTC(2026, 0, 15)).getTimezoneOffset()).toBe(-660);
    expect(new Date(Date.UTC(2026, 6, 15)).getTimezoneOffset()).toBe(-600);
  });

  // 5 Apr 2026 03:00 AEDT -> 02:00 AEST (16:00 UTC on 4 Apr); 4 Oct 2026 02:00 AEST -> 03:00 AEDT (16:00 UTC on 3 Oct).
  const NIGHTS = [
    { label: "daylight saving ends, 5 April 2026", changeUtc: Date.UTC(2026, 3, 4, 16, 0) },
    { label: "daylight saving starts, 4 October 2026", changeUtc: Date.UTC(2026, 9, 3, 16, 0) },
  ];

  for (const night of NIGHTS) {
    it(`reads Perth time minute by minute across the change (${night.label})`, () => {
      vi.useFakeTimers();
      // Two hours either side, every minute: Sydney repeats or skips an hour, Perth must not.
      const start = night.changeUtc - 120 * MINUTE_MS;
      let previous: number | undefined;
      const perthDay = perthCalendarDay(new Date(night.changeUtc));
      for (let step = 0; step <= 240; step += 1) {
        const moment = new Date(start + step * MINUTE_MS);
        vi.setSystemTime(moment);
        const absolute = absoluteWallClockMinutes();
        if (previous !== undefined) expect(absolute - previous, moment.toISOString()).toBe(1);
        previous = absolute;
        const expected = PERTH_HM.format(moment);
        expect(formatInstant(wallClockNow()), moment.toISOString()).toBe(expected);
        expect(clk(moment)).toBe(expected);
        expect(perthClockTime(moment)).toBe(expected);
        // The change is at 00:00 Perth, so the Perth day flips exactly at the change, not an hour off.
        const day = perthCalendarDay(moment);
        if (moment.getTime() < night.changeUtc) expect(day.day).toBe(perthDay.day - 1);
        else expect(day).toEqual(perthDay);
        expect(demoDayZero(moment).getTime()).toBe(
          moment.getTime() < night.changeUtc ? night.changeUtc - MINUTES_PER_DAY * MINUTE_MS : night.changeUtc,
        );
      }
    });

    it(`reads a typed Perth date and time as Perth, even in Sydney's missing or repeated hour (${night.label})`, () => {
      const perthDate = perthIsoDay(new Date(night.changeUtc));
      for (const clock of ["00:00", "00:30", "00:59", "01:00", "01:30"]) {
        const typed = perthDateTimeLocal(`${perthDate}T${clock}`);
        expect(typed, clock).toBeDefined();
        const [hours, minutes] = clock.split(":").map(Number);
        expect(typed!.getTime()).toBe(night.changeUtc + (hours * 60 + minutes) * MINUTE_MS);
        expect(perthClockTime(typed!)).toBe(clock);
      }
    });
  }

  it("turns the Perth day over at Perth midnight, not Sydney's", () => {
    vi.useFakeTimers();
    const perthMidnightUtc = Date.UTC(2026, 10, 10, 16, 0); // 00:00 AWST 11 Nov = 03:00 AEDT
    vi.setSystemTime(new Date(perthMidnightUtc - MINUTE_MS));
    const before = absoluteWallClockMinutes();
    expect(formatInstant(wallClockNow())).toBe("23:59");
    vi.setSystemTime(new Date(perthMidnightUtc));
    const after = absoluteWallClockMinutes();
    expect(formatInstant(wallClockNow())).toBe("00:00");
    expect(Math.floor(after / MINUTES_PER_DAY) - Math.floor(before / MINUTES_PER_DAY)).toBe(1);
    expect(perthIsoDay(new Date(perthMidnightUtc))).toBe("2026-11-11");
  });

  it("changes shift at 07:00, 15:00 and 23:00 Perth on a Sydney device", () => {
    vi.useFakeTimers();
    const perthDayStartUtc = Date.UTC(2026, 10, 9, 16, 0); // 00:00 AWST 10 Nov
    const at = (hh: number, mm: number) => {
      vi.setSystemTime(new Date(perthDayStartUtc + (hh * 60 + mm) * MINUTE_MS));
      return wallClockNow();
    };
    expect(currentShift(at(6, 59)).name).toBe("Night Shift");
    expect(currentShift(at(7, 0)).name).toBe("Day Shift");
    expect(currentShift(at(14, 59)).name).toBe("Day Shift");
    expect(currentShift(at(15, 0)).name).toBe("Evening Shift");
    expect(currentShift(at(22, 59)).name).toBe("Evening Shift");
    expect(currentShift(at(23, 0)).name).toBe("Night Shift");
    expect(formatInstant(shiftEndInstant(at(10, 42)))).toBe("15:00");
    expect(formatInstant(shiftEndInstant(at(23, 30)))).toBe("07:00");
  });

  // Fixed 10 Nov 2026 (M18, D-125): the triage "Reviewed time" Now button and its future check read
  // the Perth clock, so a Sydney device stamps and checks Perth wall time.
  it("stamps and checks the triage reviewed time on the Perth clock on a Sydney device", () => {
    // 09:42 AWST on 6 Nov 2026 = 12:42 AEDT.
    const moment = new Date(Date.UTC(2026, 10, 6, 1, 42));
    expect(reviewTimeStamp(moment)).toBe("06/11/2026 09:42");
    expect(checkReviewTime(reviewTimeStamp(moment), moment.getTime()).ok).toBe(true);
    // A Perth reviewed time 2 hours in the future is refused.
    const future = checkReviewTime("06/11/2026 11:42", moment.getTime());
    expect(future.ok).toBe(false);
    expect(future.future).toBe(true);
    // A minute's grace still holds; the Perth day boundary is Perth midnight.
    expect(checkReviewTime("06/11/2026 09:43", moment.getTime()).ok).toBe(true);
    expect(checkReviewTime("06/11/2026 09:44", moment.getTime()).ok).toBe(false);
    const perthMidnightUtc = Date.UTC(2026, 10, 9, 16, 0); // 00:00 AWST 10 Nov = 03:00 AEDT
    expect(reviewTimeStamp(new Date(perthMidnightUtc))).toBe("10/11/2026 00:00");
    expect(reviewTimeStamp(new Date(perthMidnightUtc - MINUTE_MS))).toBe("09/11/2026 23:59");
    // Impossible dates are still refused.
    expect(checkReviewTime("31/02/2026 09:00", moment.getTime()).ok).toBe(false);
    expect(checkReviewTime("06/11/2026 24:00", moment.getTime()).ok).toBe(false);
  });
});
