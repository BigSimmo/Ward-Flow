import { describe, expect, it } from "vitest";

import { FIGURE_WINDOWS, figureWindow, windowLine } from "@/components/ward-management/figures/figure-windows";
import { reportWeek } from "@/components/ward-management/reports/weekly-report";
import { isDueWithinDays } from "@/components/ward-management/statistics/statistics-dates";
import {
  calendarDateOf,
  MINUTES_PER_DAY,
  perthCalendarDay,
  perthMidnight,
} from "@/components/ward-management/ward-clock";

/**
 * The Statistics windows (R-FIGS-14, owner ruling item 12; figures spec 3.5, D-220). Hand-worked on
 * Saturday 14 Nov 2026 at 10:42 am. `windowLine` prints the real start instant, so a day 0 at Perth
 * midnight reads 12:00 am and a day 0 at UTC midnight reads 8:00 am (the signed-in F2 signal).
 */

const DEMO_DAY_ZERO = perthMidnight(2026, 10, 14);
const UTC_DAY_ZERO = new Date(Date.UTC(2026, 10, 14));
const NOW = 10 * 60 + 42;
const demo = { now: NOW, dayZero: DEMO_DAY_ZERO };

describe("windowLine's clock face (the one am/pm formatter, ward-clock-am-pm.ts)", () => {
  it("writes the Perth clock face with am and pm, whatever the device zone", () => {
    expect(windowLine("now", { ...demo, now: 12 * 60 + 5 })).toBe("As at Sat 14 Nov, 12:05 pm");
    expect(windowLine("now", { ...demo, now: 23 * 60 + 59 })).toBe("As at Sat 14 Nov, 11:59 pm");
  });
});

describe("windowLine", () => {
  it("starts today at 12:00 am on the demo, with no zone words (14 Nov wording rule)", () => {
    expect(windowLine("today", demo)).toBe("Sat 14 Nov, 12:00 am to now");
    expect(windowLine("now", demo)).toBe("As at Sat 14 Nov, 10:42 am");
  });

  it("prints a UTC-midnight day 0 as 8:00 am, the signed-in day's true start until PR B", () => {
    expect(windowLine("today", { now: NOW, dayZero: UTC_DAY_ZERO })).toBe("Sat 14 Nov, 8:00 am to now");
  });

  it("ends by tomorrow at 12:00 am the day after tomorrow, overdue dates included", () => {
    expect(windowLine("by-tomorrow", demo)).toBe("Any earlier date to Mon 16 Nov, 12:00 am");
  });

  it("ends the next 7 days at midnight, as isDueWithinDays counts (time audit T2)", () => {
    expect(windowLine("next-7-days", demo)).toBe("Sat 14 Nov, 12:00 am to Sat 21 Nov, 12:00 am");
    const endOfWindow = 7 * MINUTES_PER_DAY;
    expect(isDueWithinDays(endOfWindow - 1, NOW, 7)).toBe(true);
    expect(isDueWithinDays(endOfWindow, NOW, 7)).toBe(false);
  });

  it("runs a week Monday 12:00 am to the next Monday 12:00 am, and this week so far to now", () => {
    const lastFull = reportWeek(0, NOW, DEMO_DAY_ZERO);
    expect(perthCalendarDay(calendarDateOf(lastFull.start, DEMO_DAY_ZERO)).weekday).toBe(1);
    expect(lastFull.end - lastFull.start).toBe(7 * MINUTES_PER_DAY);
    expect(windowLine("week", { ...demo, week: lastFull })).toBe("Mon 2 Nov, 12:00 am to Mon 9 Nov, 12:00 am");
    expect(windowLine("week", { ...demo, week: reportWeek(-1, NOW, DEMO_DAY_ZERO) })).toBe(
      "Mon 9 Nov, 12:00 am to now",
    );
    expect(windowLine("week", demo)).toBe("Monday 12:00 am to the next Monday 12:00 am; this week so far ends now");
  });

  it("starts the session trend hours on the hour, and the rolling 24 hours a day before now", () => {
    expect(windowLine("hours", demo)).toBe("Sat 14 Nov, 7:00 am to now");
    expect(windowLine("hours", { ...demo, hours: 1 })).toBe("Sat 14 Nov, 10:00 am to now");
    expect(windowLine("discharged-rolling", demo)).toBe("Fri 13 Nov, 10:42 am to now");
  });

  it("counts the frequent-presenter 12 months from the day after today's date a year ago", () => {
    expect(windowLine("frequent-presenter", demo)).toBe("Sat 15 Nov 2025, 12:00 am to Sun 15 Nov 2026, 12:00 am");
    const leapDay = perthMidnight(2028, 1, 29);
    expect(windowLine("frequent-presenter", { now: 0, dayZero: leapDay })).toBe(
      "Mon 1 Mar 2027, 12:00 am to Wed 1 Mar 2028, 12:00 am",
    );
  });

  it("says a window with no clock edge in words", () => {
    expect(windowLine("ed-wait", demo)).toBe("From each journey's start in the ED to now");
    expect(windowLine("readmission", demo)).toBe("28 days before each arrival to the arrival");
    expect(windowLine("any-date", demo)).toBe("Any date");
  });

  it("has one row per window, each complete", () => {
    const ids = FIGURE_WINDOWS.map((window) => window.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const window of FIGURE_WINDOWS) {
      expect(figureWindow(window.id)).toBe(window);
      for (const text of [window.name, window.start, window.end, window.usedBy, window.source]) {
        expect(text.trim()).not.toBe("");
      }
      expect(typeof windowLine(window.id, demo)).toBe("string");
    }
  });
});
