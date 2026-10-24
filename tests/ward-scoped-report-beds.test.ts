import { describe, expect, it } from "vitest";

import { downtimePack } from "../src/components/ward-management/reports/downtime-pack";
import { ownUnits } from "../src/components/ward-management/reports/use-own-units";
import { reportWeek, weeklyOperationsReport } from "../src/components/ward-management/reports/weekly-report";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { scopeWorkspace } from "../src/components/ward-management/ward-access-scope";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import {
  STATEWIDE_COORDINATOR,
  unitInScope,
  type WardAccess,
} from "../src/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/** Issue #628: a scoped desk's reports total its own wards, never the whole network's beds. */
describe("report bed figures for a scoped desk", () => {
  const state = seedWardFlowState();
  const places = wardPlaceLookup(state.units);
  const siteCode = state.units[0].siteCode;
  const site: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode } };
  const own = ownUnits(site, state.units);
  const scoped = scopeWorkspace(state, site, { now: NOW_ANCHOR, places });
  const releases = state.bedReleases.filter((release) => own.some((unit) => unit.id === release.unitId));
  const leave = state.leaveBeds.filter((bed) => own.some((unit) => unit.id === bed.unitId));

  it("keeps every ward for a whole-network desk and only the site's wards for a site desk", () => {
    expect(ownUnits(STATEWIDE_COORDINATOR, state.units)).toBe(state.units);
    expect(own.length).toBeGreaterThan(0);
    expect(own.length).toBeLessThan(state.units.length);
    expect(own.every((unit) => unitInScope(site.scope, unit.id, places))).toBe(true);
  });

  it("sets the weekly occupancy against the site's own beds", () => {
    const week = reportWeek(0, NOW_ANCHOR, new Date("2026-10-19T16:00:00Z"));
    const report = weeklyOperationsReport(
      { ...scoped, units: own, bedReleases: releases, leaveBeds: leave, edAccessTargetMinutes: 720, now: NOW_ANCHOR },
      week,
    );
    expect(report.occupancy.beds).toBe(own.reduce((sum, unit) => sum + unit.beds, 0));
  });

  it("gives the site's wards the same bed states in its downtime pack as the coordinator's", () => {
    const input = { now: NOW_ANCHOR, identify: () => "Synthetic person" };
    const whole = downtimePack({ ...input, ...state, units: state.units });
    const desk = downtimePack({ ...input, ...scoped, units: own, bedReleases: releases, leaveBeds: leave });
    expect(desk.wards.map((ward) => ward.unitId).sort()).toEqual(own.map((unit) => unit.id).sort());
    for (const ward of desk.wards)
      expect(ward.counts, ward.name).toEqual(whole.wards.find((candidate) => candidate.unitId === ward.unitId)!.counts);
  });
});
