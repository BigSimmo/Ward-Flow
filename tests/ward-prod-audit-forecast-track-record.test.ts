import { describe, expect, it, vi } from "vitest";

// Synthetic outcomes per ward: B holds worst, C best, D has no recorded planned date.
const outcomes: Record<string, { met: number; consideredCount: number }> = {
  a: { met: 3, consideredCount: 4 },
  b: { met: 1, consideredCount: 4 },
  c: { met: 4, consideredCount: 4 },
  d: { met: 0, consideredCount: 0 },
};
vi.mock("@/components/ward-management/ward-statistics", () => ({
  wardStatistics: (unitId: string) => ({ dischargeDateOutcomes: outcomes[unitId] }),
}));

const { dischargeDatesHeldByWard } = await import("../src/components/ward-management/forecast/forecast-track-record");

describe("discharge dates that held, by ward", () => {
  it("keeps every ward with a recorded date, in the wards' own order, with no worst-first ranking", () => {
    const units = ["a", "b", "c", "d"].map((id) => ({ id, name: `Ward ${id.toUpperCase()}` }));
    const rows = dischargeDatesHeldByWard(units as never, [], 0);
    expect(rows.map((row) => row.name)).toEqual(["Ward A", "Ward B", "Ward C"]);
  });

  it("does not cut the list to six wards", () => {
    const many = Array.from({ length: 8 }, (_, index) => ({ id: "a", name: `Ward ${index + 1}` }));
    expect(dischargeDatesHeldByWard(many as never, [], 0)).toHaveLength(8);
  });
});
