import { afterEach, describe, expect, it, vi } from "vitest";

import { ExecutiveCountRelease } from "@/components/ward-management/statistics/executive-statistics-release";
import { projectExecutiveReportingFoundation } from "@/components/ward-management/statistics/executive-statistics-projector";
import { isDueWithinDays, isPastDate } from "@/components/ward-management/statistics/statistics-dates";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Time audit T2 (13 Nov 2026): Statistics counts discharge dates by Perth calendar day. A stay due
 * earlier today is neither "past date" (that is an earlier day) nor dropped from "due": it lands in
 * exactly one bucket, today. The 7-day window is today plus six calendar days on every page.
 */
const dayStart = Math.floor(NOW_ANCHOR / MINUTES_PER_DAY) * MINUTES_PER_DAY;
const earlierToday = dayStart + 8 * 60;

afterEach(() => vi.restoreAllMocks());

describe("due and past-date buckets by calendar day (T2)", () => {
  it("puts a date earlier today in exactly one bucket", () => {
    expect(earlierToday).toBeLessThan(NOW_ANCHOR);
    expect(isPastDate(earlierToday, NOW_ANCHOR)).toBe(false);
    expect(isDueWithinDays(earlierToday, NOW_ANCHOR, 7)).toBe(true);
    const yesterday = earlierToday - MINUTES_PER_DAY;
    expect(isPastDate(yesterday, NOW_ANCHOR)).toBe(true);
    expect(isDueWithinDays(yesterday, NOW_ANCHOR, 7)).toBe(false);
  });

  it("ends the 7-day window at the end of the sixth day on, not at this time next week", () => {
    expect(isDueWithinDays(dayStart + 6 * MINUTES_PER_DAY + 23 * 60, NOW_ANCHOR, 7)).toBe(true);
    expect(isDueWithinDays(dayStart + 7 * MINUTES_PER_DAY + 30, NOW_ANCHOR, 7)).toBe(false);
    expect(isDueWithinDays(dayStart + 7 * MINUTES_PER_DAY + 30, NOW_ANCHOR, 1)).toBe(false);
    expect(isDueWithinDays(dayStart + 23 * 60, NOW_ANCHOR, 1)).toBe(true);
  });

  it("counts a stay due earlier today as due today in the executive ward, site and journey figures", () => {
    const state = seedWardFlowState();
    const target = state.admissions.find(
      (row) => row.state !== "departed" && row.state !== "pulled" && row.expectedDischargeAt === null,
    );
    if (!target) throw new Error("The seed needs a stay with no discharge date.");
    const project = (expectedDischargeAt: number | null) => {
      const values = new Map<string, number>();
      const original = ExecutiveCountRelease.prototype.count;
      vi.spyOn(ExecutiveCountRelease.prototype, "count").mockImplementation(function (
        this: ExecutiveCountRelease,
        key: string,
        value: number,
        priority?: number,
      ) {
        values.set(key, value);
        return original.call(this, key, value, priority);
      });
      projectExecutiveReportingFoundation(
        {
          ...state,
          admissions: state.admissions.map((row) => (row.id === target.id ? { ...row, expectedDischargeAt } : row)),
        },
        { role: "executive", scope: { kind: "statewide" } },
        {
          now: NOW_ANCHOR,
          dayZero: "2026-10-24T00:00:00.000Z",
          startedAt: "2026-10-24T00:00:00.000Z",
          places: wardPlaceLookup(state.units),
        },
      );
      vi.restoreAllMocks();
      return values;
    };
    const before = project(null);
    const after = project(earlierToday);
    const ward = `ward:${target.unitId}`;
    expect(after.get(`${ward}:due:0`)).toBe((before.get(`${ward}:due:0`) ?? 0) + 1);
    expect(after.get(`${ward}:due:week`)).toBe((before.get(`${ward}:due:week`) ?? 0) + 1);
    const changed = [...after].filter(([key, value]) => key.includes("dueToday") && value !== before.get(key));
    expect(changed.length).toBeGreaterThan(0);
    for (const [key, value] of changed) expect(value).toBe((before.get(key) ?? 0) + 1);
  });
});
