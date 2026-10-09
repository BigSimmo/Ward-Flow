import { describe, expect, it } from "vitest";

import {
  edWaitEnd,
  reportWeek,
  weeklyOperationsReport,
  type WeeklyReportInput,
} from "@/components/ward-management/reports/weekly-report";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { OUT_OF_AREA_BANDS, travelBand } from "@/components/ward-management/ward-distance";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { HOME_REGIONS, type Movement } from "@/components/ward-management/ward-model";
import { occupiedBeds } from "@/components/ward-management/statistics/statistics-occupancy";

const DAY = MINUTES_PER_DAY;
// Wednesday 7 October 2026: day 0. The last full week is Mon 28 Sep (day -9) to Sun 4 Oct (day -3).
const WEDNESDAY = new Date(2026, 9, 7);
const NOW = 10 * 60;

describe("reportWeek", () => {
  it("defaults to the last full Monday-to-Sunday week", () => {
    expect(reportWeek(0, NOW, WEDNESDAY)).toEqual({ offset: 0, start: -9 * DAY, end: -2 * DAY, countedEnd: -2 * DAY });
  });

  it("counts this week only up to now, and steps back whole weeks", () => {
    expect(reportWeek(-1, NOW, WEDNESDAY)).toEqual({ offset: -1, start: -2 * DAY, end: 5 * DAY, countedEnd: NOW });
    expect(reportWeek(2, NOW, WEDNESDAY).start).toBe(-23 * DAY);
  });

  it("treats a Monday as the first day of this week", () => {
    const monday = new Date(2026, 9, 5);
    expect(reportWeek(-1, NOW, monday).start).toBe(0);
    expect(reportWeek(0, NOW, monday).start).toBe(-7 * DAY);
  });
});

function fixture() {
  const state = seedWardFlowState();
  const unit = state.units[0]!;
  const base = state.movements[0]!;
  const admissionBase = state.admissions[0]!;
  const movement = (id: string, patch: Partial<Movement>): Movement => ({
    ...base,
    id: id as Movement["id"],
    stageChanges: [],
    declines: [],
    overrides: [],
    closure: undefined,
    leftDepartmentAt: undefined,
    stage: "placement_requested",
    ...patch,
  });
  const admission = (id: string, patch: Partial<Admission>): Admission => ({
    ...admissionBase,
    id,
    unitId: unit.id,
    state: "occupied",
    leftAt: null,
    expectedDischargeAt: null,
    homeRegion: "Perth Metropolitan",
    ...patch,
  });
  const farRegion = HOME_REGIONS.find((region) => {
    const band = travelBand(region, unit.siteCode);
    return band !== undefined && OUT_OF_AREA_BANDS.includes(band);
  });
  const nearRegion = HOME_REGIONS.find((region) => {
    const band = travelBand(region, unit.siteCode);
    return band !== undefined && !OUT_OF_AREA_BANDS.includes(band);
  });
  return { state, unit, movement, admission, farRegion, nearRegion };
}

function inputOf(f: ReturnType<typeof fixture>, patch: Partial<WeeklyReportInput>): WeeklyReportInput {
  return {
    movements: [],
    referrals: [],
    admissions: [],
    units: [f.unit],
    bedReleases: [],
    leaveBeds: [],
    edAccessTargetMinutes: DAY,
    now: NOW,
    ...patch,
  };
}

describe("weeklyOperationsReport", () => {
  const week = reportWeek(0, NOW, WEDNESDAY);

  it("counts ED waits that passed the target inside the week, and only those", () => {
    const f = fixture();
    const crossedInWeek = f.movement("WF-A", { openedAt: week.start - 6 * 60, leftDepartmentAt: week.start + DAY });
    const stillWaiting = f.movement("WF-B", { openedAt: week.end - 2 * DAY });
    const leftBeforeTarget = f.movement("WF-C", {
      openedAt: week.start + DAY,
      leftDepartmentAt: week.start + DAY + 60,
    });
    const crossesAfterWeek = f.movement("WF-D", { openedAt: week.end - 60 });
    const report = weeklyOperationsReport(
      inputOf(f, { movements: [crossedInWeek, stillWaiting, leftBeforeTarget, crossesAfterWeek] }),
      week,
    );
    expect(report.edWaits.rows.map((row) => row.movement.id)).toEqual(["WF-B", "WF-A"]);
    expect(report.edWaits.count).toBe(2);
    // WF-B is still waiting: counted to the end of the week, not to now.
    expect(report.edWaits.longestMinutes).toBe(2 * DAY);
    expect(report.edWaits.rows[0]?.stillWaiting).toBe(true);
  });

  it("ends an ED wait at the first move or arrival when no departure time was recorded", () => {
    const f = fixture();
    const moved = f.movement("WF-E", {
      openedAt: 0,
      stageChanges: [{ at: 300, from: "pulled", to: "moving", by: "coordinator" }],
    });
    expect(edWaitEnd(moved, NOW)).toBe(300);
    expect(edWaitEnd(f.movement("WF-F", { openedAt: 0 }), NOW)).toBe(NOW);
  });

  it("adds out-of-area and delayed discharge bed days from stays overlapping the week", () => {
    const f = fixture();
    expect(f.farRegion).toBeDefined();
    const far = f.admission("AD-FAR", { homeRegion: f.farRegion!, arrivedAt: week.start - 10 * DAY });
    const near = f.admission("AD-NEAR", {
      homeRegion: f.nearRegion ?? "Perth Metropolitan",
      arrivedAt: week.start + 2 * DAY,
      expectedDischargeAt: week.start + 4 * DAY,
      leftAt: week.start + 5 * DAY + DAY / 2,
      state: "departed",
    });
    const report = weeklyOperationsReport(inputOf(f, { admissions: [far, near] }), week);
    expect(report.outOfArea).toEqual({ bedDays: 7, people: 1 });
    expect(report.delayedDischarge).toEqual({ bedDays: 1.5, people: 1 });
    expect(report.occupancy.occupiedBedDays).toBe(7 + 3.5);
    expect(report.occupancy.averagePercent).toBe(Math.round(((7 + 3.5) / (f.unit.beds * 7)) * 100));
    expect(report.occupancy.now).toEqual(occupiedBeds([f.unit], [far, near], [], []));
  });

  it("counts declines and overrides by reason inside the week only", () => {
    const f = fixture();
    const reason = "Clinical urgency outweighs the mismatch" as const;
    const movement = f.movement("WF-G", {
      openedAt: week.start,
      declines: [
        { unitId: f.unit.id, at: week.start + 60, reason: "no_bed" },
        { unitId: f.unit.id, at: week.start + 120, reason: "no_bed" },
        { unitId: f.unit.id, at: week.end + 60, reason: "sex_mix" },
      ],
      overrides: [
        { at: week.start + 30, by: "coordinator", reason, unitIds: [f.unit.id] },
        { at: week.start - 30, by: "coordinator", reason, unitIds: [f.unit.id] },
      ],
    });
    const report = weeklyOperationsReport(inputOf(f, { movements: [movement] }), week);
    expect(report.declines.placement).toBe(2);
    expect(report.declines.byReason).toEqual([{ reason: "No bed available", count: 2 }]);
    expect(report.overrides).toEqual({ placement: 1, referral: 0, byReason: [{ reason, count: 1 }] });
  });

  it("runs over the whole seeded world without throwing, with no negative figure", () => {
    const state = seedWardFlowState();
    const report = weeklyOperationsReport(
      {
        movements: state.movements,
        referrals: state.referrals,
        admissions: state.admissions,
        units: state.units,
        bedReleases: state.bedReleases,
        leaveBeds: state.leaveBeds,
        edAccessTargetMinutes: state.configuration.edAccessTargetMinutes,
        now: NOW,
      },
      reportWeek(-1, NOW, WEDNESDAY),
    );
    for (const value of [
      report.edWaits.count,
      report.outOfArea.bedDays,
      report.delayedDischarge.bedDays,
      report.declines.placement,
      report.occupancy.occupiedBedDays,
    ]) {
      expect(value).toBeGreaterThanOrEqual(0);
    }
    expect(report.occupancy.averagePercent).not.toBeNull();
  });
});
