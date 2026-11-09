// Feature 42 (Josh, 9 Nov 2026): bed days lost to delayed discharge, ward by day. Hand-built stays
// so each rule is reached on its own: past the expected date, a recorded hold-up, the two overlapping,
// a hold-up with no recorded end, and the grid's totals.
import { describe, expect, it } from "vitest";

import { delaySegments, delayedDischargeHeatmap, heatStep } from "@/components/ward-management/reports/delay-heatmap";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY as DAY } from "@/components/ward-management/ward-clock";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";

const NOW = 12 * 60; // midday on day 0
const START = -6 * DAY; // the seven days -6 to 0
const units = [
  { id: "u-a", name: "Alpha" },
  { id: "u-b", name: "Bravo" },
  { id: "u-c", name: "Charlie" },
] as Unit[];

function stay(overrides: Partial<Admission>): Admission {
  return {
    id: "AD-H",
    unitId: "u-a",
    state: "occupied",
    arrivedAt: -10 * DAY,
    leftAt: null,
    expectedDischargeAt: null,
    dischargeDateSetAt: null,
    blockReason: null,
    ...overrides,
  } as Admission;
}

describe("delaySegments", () => {
  it("counts past the expected date from when it was set, to now", () => {
    const segments = delaySegments(stay({ expectedDischargeAt: -3 * DAY, dischargeDateSetAt: -5 * DAY }), [], NOW);
    expect(segments).toEqual([{ from: -3 * DAY, to: NOW, reason: { kind: "past-expected" } }]);
  });

  it("counts a recorded hold-up until it was cleared, and each minute once where the two overlap", () => {
    const admission = stay({
      expectedDischargeAt: -3 * DAY,
      dischargeDateSetAt: -5 * DAY,
      stayBlockRecords: [{ at: -2 * DAY, by: "ward", blocker: "Awaiting transport" }],
      stayBlockClearances: [{ at: -1 * DAY, by: "ward", blocker: "Awaiting transport" }],
    } as Partial<Admission>);
    expect(delaySegments(admission, [], NOW)).toEqual([
      { from: -3 * DAY, to: -2 * DAY, reason: { kind: "past-expected" } },
      { from: -2 * DAY, to: -1 * DAY, reason: { kind: "held-up", blocker: "Awaiting transport" } },
      { from: -1 * DAY, to: NOW, reason: { kind: "past-expected" } },
    ]);
  });

  it("ends a hold-up at the linked release's clearance, runs a current one to now, and skips one with no end", () => {
    const cleared = stay({
      expectedDischargeAt: 5 * DAY,
      stayBlockRecords: [{ at: -2 * DAY, by: "ward", blocker: "Awaiting transport" }],
    } as Partial<Admission>);
    const release = {
      admissionId: "AD-H",
      clearedBlockHistory: [{ at: -2 * DAY + 600, by: "ward" }],
    } as unknown as BedRelease;
    expect(delaySegments(cleared, [release], NOW).map((s) => s.to - s.from)).toEqual([600]);
    expect(delaySegments({ ...cleared, blockReason: "Awaiting transport" }, [], NOW).map((s) => s.to)).toEqual([NOW]);
    expect(delaySegments(cleared, [], NOW)).toEqual([]);
  });

  it("stops at departure and ignores a stay that never arrived", () => {
    const left = stay({ state: "departed", leftAt: -2 * DAY, expectedDischargeAt: -4 * DAY });
    expect(delaySegments(left, [], NOW)).toEqual([{ from: -4 * DAY, to: -2 * DAY, reason: { kind: "past-expected" } }]);
    expect(delaySegments(stay({ arrivedAt: null, expectedDischargeAt: -4 * DAY }), [], NOW)).toEqual([]);
  });
});

describe("delayedDischargeHeatmap", () => {
  it("lays bed days out by ward and day, with row, column and grand totals", () => {
    const admissions = [
      stay({ id: "a1", expectedDischargeAt: -3 * DAY }),
      stay({ id: "a2", unitId: "u-b", expectedDischargeAt: -1 * DAY - 720 }),
      stay({ id: "a3", unitId: "u-b", expectedDischargeAt: -1 * DAY }),
      stay({ id: "a4", unitId: "elsewhere", expectedDischargeAt: -6 * DAY }),
    ];
    const map = delayedDischargeHeatmap(units, admissions, [], START, NOW);
    expect(map.dayStarts).toEqual([-6, -5, -4, -3, -2, -1, 0].map((d) => d * DAY));
    expect(map.rows.map((row) => row.name)).toEqual(["Alpha", "Bravo"]);
    expect(map.rows[0]!.days).toEqual([0, 0, 0, 1, 1, 1, 0.5]);
    expect(map.rows[0]!.total).toBe(3.5);
    expect(map.rows[1]!.days).toEqual([0, 0, 0, 0, 0.5, 2, 1]);
    expect(map.dayTotals).toEqual([0, 0, 0, 1, 1.5, 3, 1.5]);
    expect(map.total).toBe(7);
    expect(map.max).toBe(2);
    expect(map.wardsWithNone).toBe(1);
  });

  it("is empty with nothing past its date", () => {
    const map = delayedDischargeHeatmap(units, [stay({ expectedDischargeAt: 3 * DAY })], [], START, NOW);
    expect(map.rows).toEqual([]);
    expect(map.total).toBe(0);
    expect(map.wardsWithNone).toBe(3);
  });
});

describe("heatStep", () => {
  it("puts none at 0 and the largest cell at 4", () => {
    expect([0, 0.1, 1, 1.5, 2].map((value) => heatStep(value, 2))).toEqual([0, 1, 2, 3, 4]);
    expect(heatStep(1, 0)).toBe(0);
  });
});
