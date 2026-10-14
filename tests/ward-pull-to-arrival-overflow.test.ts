import { describe, expect, it } from "vitest";
import { pullToArrival } from "@/components/ward-management/statistics/statistics-derivations";
import type { Admission } from "@/components/ward-management/ward-admissions";

function admission(pulledAt: number, arrivedAt: number): Admission {
  return { id: `a-${pulledAt}`, unitId: "u1", state: "occupied", pulledAt, arrivedAt } as unknown as Admission;
}

describe("pull-to-arrival gap overflow", () => {
  it("does not count two finite instants whose difference overflows as a measured gap", () => {
    const result = pullToArrival([admission(-Number.MAX_VALUE, Number.MAX_VALUE), admission(0, 60)]);
    expect(result.measuredCount).toBe(1);
    expect(Number.isFinite(result.averageMinutes ?? Number.NaN)).toBe(true);
    expect(result.averageMinutes).toBe(60);
  });
});
