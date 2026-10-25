import { describe, expect, it } from "vitest";
import { nextNonWorkingClosure } from "@/components/ward-management/discharges/discharge-service-hours";
import { horizonDays } from "@/components/ward-management/forecast/forecast-horizon";
import { WA_PUBLIC_HOLIDAYS } from "@/components/ward-management/wa-public-holidays";
import { MINUTES_PER_DAY, perthMidnight } from "@/components/ward-management/ward-clock";

const dates = WA_PUBLIC_HOLIDAYS.map((holiday) => holiday.date);
const lastYear = Number(dates.at(-1)!.slice(0, 4));

describe("WA public holidays", () => {
  it("is one sorted list of real calendar dates, each named once a day", () => {
    expect(dates).toEqual([...dates].sort());
    expect(new Set(dates).size).toBe(dates.length);
    for (const date of dates) expect(new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(date);
  });

  it("runs at least to the end of next year from September of its last year (limits audit, 25 Oct 2026)", () => {
    // Before this list was shared, the discharges board's copy stopped at 1 January 2027, so every
    // later holiday read as an ordinary working day. Failing here first gives four months to add the
    // next year from wa.gov.au before the board's seven-day look-ahead reaches it.
    const now = new Date();
    const due = new Date(Date.UTC(lastYear, 8, 1));
    expect(now < due, `Add WA public holidays for ${lastYear + 1} to wa-public-holidays.ts`).toBe(true);
  });

  it("closes services over Australia Day 2027 on the discharges board", () => {
    // Monday 25 January 2027, 10:00 Perth: pharmacy is open today and shut on Tuesday 26 January.
    const dayZero = perthMidnight(2027, 0, 25);
    const closure = nextNonWorkingClosure("pharmacy", 10 * 60, dayZero);
    expect(closure?.closedFor).toEqual(["Australia Day"]);
    expect(closure?.reopensAt).toBe(2 * MINUTES_PER_DAY + 8 * 60 + 30);
  });

  it("marks weekday holidays only in the forecast's seven days", () => {
    // Wednesday 22 December 2027: Christmas and Boxing Day fall on the weekend, the additional days after.
    const days = horizonDays(10 * 60, perthMidnight(2027, 11, 22));
    expect(days.filter((day) => day.holiday).map((day) => day.label)).toEqual(["Mon 27", "Tue 28"]);
  });
});
