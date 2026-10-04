import { describe, expect, it } from "vitest";
import { statisticsChartScale } from "@/components/ward-management/statistics/statistics-chart-scale";

describe("statistics zero-based scale", () => {
  it.each([0, 1, 7, 22, 304])("uses whole-number ticks and encloses count %s", (value) => {
    const { maximum, ticks } = statisticsChartScale(value);
    expect(ticks[0]).toBe(0);
    expect(ticks.at(-1)).toBe(maximum);
    expect(maximum).toBeGreaterThanOrEqual(value);
    expect(ticks.length).toBeLessThanOrEqual(5);
    expect(ticks.every(Number.isInteger)).toBe(true);
  });
  it("retains fractional duration precision without a truncated domain", () => {
    expect(statisticsChartScale(0.07, false)).toEqual({ maximum: 0.08, ticks: [0, 0.02, 0.04, 0.06, 0.08] });
    expect(statisticsChartScale(25.1, false)).toEqual({ maximum: 30, ticks: [0, 10, 20, 30] });
  });
});
