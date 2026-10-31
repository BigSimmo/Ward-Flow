import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createHash } from "node:crypto";
import { isExecutiveNetworkAggregate } from "../src/components/ward-management/statistics/executive-statistics-contract";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { occupiedBeds } from "../src/components/ward-management/statistics/statistics-occupancy";
import { readyBedsNow, totalReadyBedsNow } from "../src/components/ward-management/ward-bed-states";
import { lockedBedsFree, openBedsFree } from "../src/components/ward-management/ward-bed-designation";
import { waitingInEds } from "../src/components/ward-management/ward-shared-figures";
import { projectExecutiveNetworkStatistics } from "../src/components/ward-management/statistics/executive-statistics-projector";
import type { WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { DECLINE_REASONS, type HealthService, type Movement } from "../src/components/ward-management/ward-model";
import { seedWorld, validWorld } from "../backend/ward-flow/engine";
import { projectExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-projector";
import { isExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-contract";
import { wardStatistics } from "../src/components/ward-management/ward-statistics";
import {
  edJourneyWaitFigures as edWaitFigures,
  edJourneyWaitBands,
  ED_WAIT_BANDS,
} from "../src/components/ward-management/statistics/statistics-ed-waits";
import { allEmergencyDepartments } from "../src/components/ward-management/ward-sites";
import {
  ExecutiveStatisticsLivePreviewProvider,
  selectExecutiveLivePreview,
  useExecutiveStatistics,
  useExecutiveStatisticsControl,
  selectExecutiveReportingSnapshot,
} from "../src/components/ward-management/statistics/executive-statistics-context";
import { reportWeek, weeklyOperationsReport } from "../src/components/ward-management/reports/weekly-report";
import { pilotMeasures } from "../src/components/ward-management/reports/pilot-measures";
import { journeyStages } from "../src/components/ward-management/statistics/statistics-journey-view";
import { siteFigures } from "../src/components/ward-management/statistics/statistics-map-view";
import {
  COMMUNITY_TEAM_PAGES,
  communityHubLists,
  communityMembershipResolution,
} from "../src/components/ward-management/community/community-derivations";
import { executiveCommunityService } from "../src/components/ward-management/statistics/executive-statistics-derivations";
import { HEALTH_SERVICES } from "../src/components/ward-management/ward-model";
import { ExecutiveCountRelease } from "../src/components/ward-management/statistics/executive-statistics-release";
import { scopeWardFlowState } from "../src/components/ward-management/ward-access-state";
import { openEdJourneys } from "../src/components/ward-management/ward-shared-figures";
import { unitCapacity } from "../src/components/ward-management/ward-derivations";
import { ExecutiveStatisticsProvider } from "../src/components/ward-management/statistics/executive-statistics-context";
import { executiveSessionTrends } from "../src/components/ward-management/statistics/executive-statistics-derivations";
import { sessionTrends } from "../src/components/ward-management/statistics/statistics-session-trends";
import { bedsPendingPreparation, openBedsNow } from "../src/components/ward-management/ward-bed-availability";
import { bedsBeingPrepared } from "../src/components/ward-management/statistics/statistics-derivations";
import type { EventLogEntry } from "../src/components/ward-management/ward-event-log";
import { bedMapCells } from "../src/components/ward-management/statistics/statistics-bed-map";
import { wardReferralTally } from "../src/components/ward-management/statistics/statistics-ward-referrals";
import { edJourneySummaries } from "../src/components/ward-management/ed/ed-home-derivations";
import { isClockBreached } from "../src/components/ward-management/ward-clock";

function reporting(state = seedWardFlowState(), service?: HealthService) {
  return projectExecutiveReportingFoundation(
    state,
    { role: "executive", scope: service ? { kind: "service", service } : { kind: "statewide" } },
    {
      now: NOW_ANCHOR,
      dayZero: "2026-10-24T00:00:00.000Z",
      startedAt: "2026-10-24T00:00:00.000Z",
      places: wardPlaceLookup(state.units),
    },
  );
}

/** Previous complete-pass traversal retained solely as an optimisation-equivalence reference.
 * Independent privacy assertions remain the brute-force tag/matrix tests in the companion file. */
function previousReportingRanges(
  this: ExecutiveCountRelease,
  exact: ReadonlySet<string>,
  withheld: ReadonlySet<string>,
): Set<string> {
  const cells = Reflect.get(this, "cells") as Map<
    string,
    { value: number; shown: boolean; minimum: number; maximum: number }
  >;
  const equations = Reflect.get(this, "equations") as Map<string, number>[];
  const ranges = new Map<string, [number, number]>();
  for (const [key, cell] of cells) {
    const small = cell.value > 0 && cell.value < this.threshold;
    const range: [number, number] = exact.has(key)
      ? [cell.value, cell.value]
      : cell.shown
        ? [cell.value === 0 ? 0 : 1, small && !withheld.has(key) ? this.threshold - 1 : Infinity]
        : [0, Infinity];
    ranges.set(key, [Math.max(range[0], cell.minimum), Math.min(range[1], cell.maximum)]);
  }
  for (let pass = 0; pass < cells.size * 2 + 1; pass++) {
    let changed = false;
    for (const equation of equations)
      for (const [key, coefficient] of equation) {
        let low = 0;
        let high = 0;
        for (const [other, factor] of equation) {
          if (other === key) continue;
          const [minimum, maximum] = ranges.get(other)!;
          low += factor > 0 ? factor * minimum : factor * maximum;
          high += factor > 0 ? factor * maximum : factor * minimum;
        }
        const old = ranges.get(key)!;
        const proposedLow = coefficient > 0 ? -high / coefficient : -low / coefficient;
        const proposedHigh = coefficient > 0 ? -low / coefficient : -high / coefficient;
        const next: [number, number] = [
          Math.max(old[0], Math.ceil(proposedLow - 1e-8)),
          Math.min(old[1], Math.floor(proposedHigh + 1e-8)),
        ];
        if (next[0] !== old[0] || next[1] !== old[1]) {
          ranges.set(key, next);
          changed = true;
        }
      }
    const exposed = new Set<string>();
    for (const [key, cell] of cells)
      if (cell.value > 0 && cell.value < this.threshold && ranges.get(key)![0] === ranges.get(key)![1])
        exposed.add(key);
    if (exposed.size) return exposed;
    if (!changed) break;
  }
  return new Set();
}

/** Equation-certificate reference before memoisation; keeps the same current tag/bound checks. */
function previousReportingWitness(
  this: ExecutiveCountRelease,
  delta: Map<string, number>,
  exact: ReadonlySet<string>,
  withheld: ReadonlySet<string>,
): boolean {
  const cells = Reflect.get(this, "cells") as Map<
    string,
    { value: number; shown: boolean; minimum: number; maximum: number }
  >;
  const equations = Reflect.get(this, "equations") as Map<string, number>[];
  for (const [key, change] of delta) {
    if (!Number.isSafeInteger(change)) return false;
    const cell = cells.get(key)!;
    const alternative = cell.value + change;
    if (
      !Number.isSafeInteger(alternative) ||
      alternative < cell.minimum ||
      alternative > cell.maximum ||
      (exact.has(key) && change !== 0)
    )
      return false;
    if (cell.shown && !exact.has(key)) {
      if (alternative < 1) return false;
      if (cell.value < this.threshold && !withheld.has(key) && alternative >= this.threshold) return false;
    }
  }
  for (const key of exact) if ((delta.get(key) ?? 0) !== 0) return false;
  for (const equation of equations) {
    let changed = 0n;
    for (const [key, coefficient] of equation)
      if ((delta.get(key) ?? 0) !== 0) changed += BigInt(coefficient) * BigInt(delta.get(key)!);
    if (changed !== 0n) return false;
  }
  return true;
}
describe("the inactive full reporting bundle", () => {
  it("accepts only the transport's positive revision and lowercase context-hash shape", () => {
    const binding = { actorId: "synthetic-actor", accessContext: "a".repeat(64), epoch: 0, revision: 1 };
    const dto = reporting();
    const snapshot = { binding, receivedAt: 100, expiresAt: 200, data: dto };
    expect(selectExecutiveReportingSnapshot(binding, snapshot, 150)).toBe(dto);
    for (const invalid of [
      { ...binding, accessContext: "synthetic-context" },
      { ...binding, accessContext: "A".repeat(64) },
      { ...binding, revision: 0 },
      { ...binding, revision: 1.5 },
      { ...binding, epoch: -1 },
      { ...binding, epoch: Infinity },
    ])
      expect(selectExecutiveReportingSnapshot(invalid, { ...snapshot, binding: invalid }, 150)).toBeNull();
  });

  it("validates a positive bundle with every route family and no operational fallback", () => {
    const dto = reporting();
    expect(isExecutiveReportingFoundation(dto)).toBe(true);
    expect(dto.coverage).toBe("private-bundle");
    expect(dto).not.toHaveProperty("omittedFamilies");
    expect(dto.services.length).toBeGreaterThan(0);
    expect(dto.teams.length).toBeGreaterThan(0);
    expect(dto.journey).toHaveLength(7);
    const exactPositive: number[] = [];
    const inspect = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      if (
        "kind" in value &&
        value.kind === "exact" &&
        "value" in value &&
        typeof value.value === "number" &&
        value.value > 0
      )
        exactPositive.push(value.value);
      Object.values(value).forEach(inspect);
    };
    inspect(dto);
    expect(exactPositive.length).toBeGreaterThan(0);
    expect(dto).not.toHaveProperty("complete");
    expect(dto).not.toHaveProperty("state");
  });

  it("releases only the current twelve public configuration values", () => {
    const state = seedWardFlowState();
    state.configuration.parallelReferralCap = Math.max(1, state.configuration.parallelReferralCap - 1);
    Object.assign(state.configuration, { privateNote: "synthetic-private-marker" });
    const dto = reporting(state);
    const expected = { ...state.configuration } as Record<string, unknown>;
    delete expected.privateNote;
    expect(dto.publicConfiguration).toEqual(expected);
    expect(Object.keys(dto.publicConfiguration)).toHaveLength(12);
    expect(isExecutiveReportingFoundation(dto)).toBe(true);
    expect(isExecutiveReportingFoundation({ ...dto, publicConfiguration: state.configuration })).toBe(false);
    expect(
      isExecutiveReportingFoundation({ ...dto, publicConfiguration: { ...expected, parallelReferralCap: -1 } }),
    ).toBe(false);
    const incomplete = { ...expected };
    delete incomplete.forecastWorseBeds;
    expect(isExecutiveReportingFoundation({ ...dto, publicConfiguration: incomplete })).toBe(false);
  });

  it("uses the genuine ward and ED selectors without exporting their records", () => {
    const state = seedWardFlowState();
    state.configuration.parallelReferralCap = Math.max(1, state.configuration.parallelReferralCap - 1);
    const before = JSON.stringify(state);
    const dto = reporting(state);
    const ward = dto.wards[0]!;
    const stats = wardStatistics(ward.id, state.admissions, NOW_ANCHOR);
    expect(ward.statistics.averageLengthOfStayDays).toBe(stats.averageLengthOfStayDays);
    expect(ward.statistics.averageEmptyBedMinutes).toBe(stats.averageEmptyBedMinutes);
    expect(ward.beds).toEqual(project(state).wards.find((item) => item.id === ward.id)!.beds);
    expect(dto.settings.parallelReferralCap).toBe(state.configuration.parallelReferralCap);
    const sourceWard = state.units.find((unit) => unit.id === ward.id)!;
    // These are public ward inventory facts already used by the permitted bed finder.
    // Never infer free locked/open capacity from the physical designation split.
    const finderReady = readyBedsNow(sourceWard, state.admissions, state.bedReleases);
    expect(ward).toMatchObject({
      isClosed: sourceWard.isClosed === true,
      sexDesignation: sourceWard.sexDesignation,
      confirmedAt: sourceWard.allocatable.confirmedAt,
      lockedReady: Math.min(lockedBedsFree(sourceWard), finderReady),
      openReady: Math.min(openBedsFree(sourceWard), finderReady),
    });
    const sourceMap = bedMapCells(sourceWard, state.admissions, state.bedReleases, state.leaveBeds, NOW_ANCHOR);
    expect(ward.bedMapCounts).toEqual(sourceMap.counts);
    if (ward.unplacedBedMapRecords.kind === "exact")
      expect(ward.unplacedBedMapRecords.value).toBe(sourceMap.unplacedRecords);
    const sourceReferrals = wardReferralTally(state.movements, ward.id);
    for (const key of ["askedAndWaiting", "everAccepted", "everDeclined"] as const) {
      const shown = ward.referrals[key];
      if (shown.kind === "exact") expect(shown.value).toBe(sourceReferrals[key]);
    }
    expect(dto.capacity).toEqual({
      ready: state.units.reduce((sum, unit) => sum + unitCapacity(unit, state.bedReleases).available, 0),
      empty: state.units.reduce((sum, unit) => sum + unit.empty.value, 0),
      allocatable: state.units.reduce((sum, unit) => sum + unit.allocatable.value, 0),
      openNow: state.units.reduce((sum, unit) => sum + openBedsNow(unit, state.bedReleases), 0),
      pendingPreparation: state.units.reduce(
        (sum, unit) => sum + bedsPendingPreparation(unit.id, state.bedReleases),
        0,
      ),
      preparingCount: bedsBeingPrepared(state.bedReleases),
    });
    const ed = dto.emergencyDepartments[0]!;
    const waits = edWaitFigures(state.movements, ed.id, NOW_ANCHOR);
    expect(ed.longestWaitMinutes).toBe(waits.longestWait?.waitMinutes ?? null);
    expect(ed.onTheList.kind === "exact" ? ed.onTheList.value === waits.onTheList : waits.onTheList > 0).toBe(true);
    const sourceJourney = edJourneySummaries(state.movements, NOW_ANCHOR).find((entry) => entry.ed.id === ed.id)!;
    for (const key of ["stillInEd", "inTransit"] as const) {
      const shown = ed[key];
      if (shown.kind === "exact") expect(shown.value).toBe(sourceJourney[key]);
    }
    if (ed.legalClockBreachedCount.kind === "exact")
      expect(ed.legalClockBreachedCount.value).toBe(
        waits.departmentMovements.filter(
          (movement) =>
            movement.legalForm?.dueAt !== undefined && isClockBreached(movement.legalForm.dueAt, NOW_ANCHOR),
        ).length,
      );
    dto.edIndex.bands.forEach((band, index) => {
      expect(band.label).toBe(ED_WAIT_BANDS[index]!.label);
      if (band.count.kind === "exact")
        expect(band.count.value).toBe(
          allEmergencyDepartments().reduce(
            (sum, each) => sum + edJourneyWaitBands(state.movements, each.id, NOW_ANCHOR)[index]!.count,
            0,
          ),
        );
    });
    expect(dto.emergencyDepartments).toHaveLength(allEmergencyDepartments().length);
    expect(JSON.stringify(state)).toBe(before);
    for (const key of ["patientId", "movementId", "admissionId", "referralId", "waitingMovements", "stageChanges"])
      expect(JSON.stringify(dto)).not.toContain(`"${key}"`);
  });

  it("keeps all nine report weeks, genuine missing durations, and protected coverage counts", () => {
    const dto = reporting();
    expect(dto.weeks.map((week) => week.week.offset)).toEqual([-1, 0, 1, 2, 3, 4, 5, 6, 7]);
    expect(dto.weeks[0]!.pilot.steps.map((step) => step.id)).toEqual(["ask", "answer", "hold", "leave", "travel"]);
    expect(dto.weeks[0]!.report.delayedDischarge).toHaveProperty("recordedFrom");
    expect(dto.weeks[0]!.report.delayedDischarge).toHaveProperty("unmeasuredStays");
    expect(dto.weeks.at(-1)!.pilot.requestToBedHeld.median).toBeNull();
  });

  it("preserves current weekly and pilot duration/bed facts and released reason/sample totals", () => {
    const state = seedWardFlowState();
    const dto = reporting(state);
    const week = reportWeek(-1, NOW_ANCHOR, new Date("2026-10-24T00:00:00.000Z"));
    const report = weeklyOperationsReport(
      { ...state, now: NOW_ANCHOR, edAccessTargetMinutes: state.configuration.edAccessTargetMinutes },
      week,
    );
    const pilot = pilotMeasures(
      {
        ...state,
        now: NOW_ANCHOR,
        pullHoldMinutes: state.configuration.pullHoldMinutes,
        morningRollupDeadlineMinutes: state.configuration.morningRollupDeadlineMinutes,
      },
      week,
    );
    const shown = dto.weeks[0]!;
    expect(shown.week).toEqual(week);
    expect(shown.report.occupancy).toEqual(report.occupancy);
    expect(shown.report.edWaits.longestMinutes).toBe(report.edWaits.longestMinutes);
    expect(shown.report.outOfArea.bedDays).toBe(report.outOfArea.bedDays);
    expect(shown.report.delayedDischarge.recordedFrom).toBe(report.delayedDischarge.recordedFrom);
    expect(shown.pilot.requestToBedHeld.median).toBe(pilot.requestToBedHeld.median ?? null);
    expect(shown.pilot.requestToBedHeld.p90).toBe(pilot.requestToBedHeld.p90 ?? null);
    expect(shown.report.edWaits).not.toHaveProperty("rows");
    expect(shown.report.overrides.byReason.length).toBeGreaterThan(0);
    expect(shown.report.declines.byReason.length).toBeGreaterThan(0);
    expect(shown.pilot.requestToArrival.median).toBe(pilot.requestToArrival.median ?? null);
    expect(shown.pilot.bedFigures).toEqual(pilot.bedFigures);
    expect(typeof shown.pilot.requestToBedHeld.sampleSize).toBe("object");
    expect(typeof shown.pilot.requestToBedHeld.population).toBe("object");
  });

  it("protects a small stage without releasing both its exact parent and exact complement", () => {
    const dto = reporting(validAdmissionSource(1, 7));
    expect(dto.network.admissionStages["no-bed-yet"].kind).not.toBe("exact");
    expect(
      dto.network.people.admissionsRecorded.kind === "exact" &&
        dto.network.admissionStages["in-the-bed"].kind === "exact",
    ).toBe(false);
    expect(dto.network.admissionStages.ended).toEqual({ kind: "exact", value: 0 });
  });

  it("retains authorised-origin public summaries and keeps service-only wards and ED navigation separate", () => {
    const state = seedWardFlowState();
    const service = wardPlaceLookup(state.units).unitService(state.units[0]!.id)!;
    const dto = reporting(state, service);
    expect(dto.wards.length).toBeGreaterThan(0);
    expect(dto.wards.every((ward) => ward.service === service)).toBe(true);
    expect(dto.emergencyDepartments).toHaveLength(allEmergencyDepartments().length);
    expect(
      dto.openableEmergencyDepartmentIds.every(
        (id) => dto.emergencyDepartments.find((ed) => ed.id === id)!.service === service,
      ),
    ).toBe(true);
    expect(
      dto.emergencyDepartments
        .filter((ed) => ed.service !== service)
        .every((ed) => !dto.openableEmergencyDepartmentIds.includes(ed.id)),
    ).toBe(true);
    expect(dto.teams).toHaveLength(COMMUNITY_TEAM_PAGES.length);
    expect(
      dto.teams
        .filter((team) => team.service !== service)
        .every((team) => !dto.openableCommunityTeamIds.includes(team.id)),
    ).toBe(true);
  });

  it.each(["patientId", "narrative", "rawCount", "rows"])("rejects an added %s at any reporting boundary", (key) => {
    const dto = reporting();
    expect(isExecutiveReportingFoundation({ ...dto, [key]: "synthetic private marker" })).toBe(false);
    expect(isExecutiveReportingFoundation({ ...dto, wards: [{ ...dto.wards[0], [key]: "private" }] })).toBe(false);
  });

  it("rejects a positive exact reporting count below the existing small-number floor", () => {
    const dto = reporting();
    Object.assign(dto.weeks[0]!.pilot.requests, { raised: { kind: "exact", value: 4 } });
    expect(isExecutiveReportingFoundation(dto)).toBe(false);
  });

  it("rejects invented band labels and a report period that differs from the actual calendar selector", () => {
    const dto = reporting();
    const changedLabel = structuredClone(dto);
    changedLabel.emergencyDepartments[0]!.bands[0]!.label = "Synthetic private narrative";
    expect(isExecutiveReportingFoundation(changedLabel)).toBe(false);
    const changedPeriod = structuredClone(dto);
    changedPeriod.weeks[0]!.week.start += 1;
    expect(isExecutiveReportingFoundation(changedPeriod)).toBe(false);
  });

  it("preserves current Map and Journey figures before their shared release decision", () => {
    const state = seedWardFlowState();
    const input = { ...state, now: NOW_ANCHOR };
    const dto = reporting(state);
    const rawJourney = journeyStages(input);
    for (const stage of dto.journey) {
      const source = rawJourney.find((entry) => entry.id === stage.id)!;
      expect(stage.label).toBe(source.label);
      expect(stage.caption).toBe(source.caption);
      if (stage.figure.kind === "bed") expect(stage.figure.value).toBe(source.count);
      else if (stage.figure.kind === "count" && stage.figure.count.kind === "exact")
        expect(stage.figure.count.value).toBe(source.count);
      else expect(source.count).toBeGreaterThan(0);
      expect(stage.breakdown.map((entry) => entry.label)).toEqual(source.breakdown.map((entry) => entry.label));
    }
    const rawSites = siteFigures(input);
    for (const site of dto.sites) {
      const source = rawSites.find((entry) => entry.code === site.code)!;
      expect(site.beds.total).toBe(source.beds);
      expect(site.beds.inUse).toBe(source.occupied);
      expect(site.meanStay).toBe(source.meanStay);
      expect(site.edLongest).toBe(source.edLongest);
      for (const key of [
        "dischargedToday",
        "dueToday",
        "blocked",
        "longStays",
        "edWaiting",
        "edOver24",
        "edOver48",
      ] as const) {
        const figure = site[key];
        if (figure.kind === "exact") expect(figure.value).toBe(source[key]);
        else expect(source[key]).toBeGreaterThan(0);
      }
    }
  });

  it("uses current team membership and clinic service mapping without serialising subject lists", () => {
    const state = seedWardFlowState();
    const dto = reporting(state);
    // Pin the reviewed prototype vocabulary independently of the UI module's export layout.
    const clinicsByService = {
      SMHS: [
        "Alma Street",
        "Alma Street (Central)",
        "Alma Street (Cockburn)",
        "Alma Street (Fremantle)",
        "Alma Street (Melville)",
        "Kwinana",
        "Peel",
        "Rockingham",
      ],
      EMHS: [
        "Armadale",
        "Armadale (Mead Centre)",
        "Armadale (Mead)",
        "Bentley",
        "Eudoria Street (Gosnells)",
        "Eudoria Street (Thornlie)",
        "ICC",
        "Inner City",
        "Inner City (central)",
        "Inner City Clinic",
        "Mead Centre (Armadale)",
        "Mead Centre (Kelmscott)",
        "Meade Centre (Armadale)",
        "Midland",
        "Mills Street",
        "Swan",
      ],
      NMHS: ["Clarkson", "Joondalup", "Mirrabooka", "Osborne", "Osborne Park", "Subiaco"],
      WACHS: [
        "Albany",
        "Bunbury",
        "Central Great Southern",
        "Central Wheatbelt",
        "Central Wheatbelt H.S.",
        "East Wheatbelt",
        "East Wheatbelt HS",
        "Gascoyne",
        "Gascoyne H.S.",
        "Gascoyne HS",
        "Geraldton HS",
        "Great South",
        "Great Southern",
        "Kimberley",
        "Kimberley HS",
        "Lower Great Southern",
        "Merredin",
        "Midwest H.S.",
        "Murchison HS",
        "Narrogin",
        "North West",
        "North. Goldfield H.S.",
        "Northam",
        "Nth Goldfield H.S.",
        "Nth Goldfield HS",
        "Pilbara",
        "South East Coastal",
        "Southern Coastal HS",
        "Upper Great Southern",
        "West Pilbara",
        "Western H.S.",
        "Western HS",
        "Wheat Belt",
        "Wheatbelt HS",
      ],
    };
    const expectedServices = Object.fromEntries(
      Object.entries(clinicsByService).flatMap(([service, clinics]) => clinics.map((clinic) => [clinic, service])),
    );
    expect(COMMUNITY_TEAM_PAGES.map((team) => team.name).sort()).toEqual(Object.keys(expectedServices).sort());
    for (const team of COMMUNITY_TEAM_PAGES) {
      const mapped = executiveCommunityService(team.name);
      expect(mapped.code).toBe(expectedServices[team.name]);
      const shown = dto.teams.find((entry) => entry.id === team.id)!;
      const lists = communityHubLists(state.admissions, team, state.referrals);
      const resolution = communityMembershipResolution(state.admissions, team, state.referrals);
      expect(shown.membership).toBe(resolution.state);
      expect(shown.service).toBe(mapped.service);
      if (shown.figures.admitted.kind === "measured" && shown.figures.admitted.count.kind === "exact")
        expect(shown.figures.admitted.count.value).toBe(lists.currentlyAdmitted.length);
      if (resolution.state === "not-computable")
        expect(shown.figures.admitted).toEqual({ kind: "unlinkable", words: "not linked to this team" });
    }
  });

  it("provides fixed matrix coordinates and matching service-detail decisions", () => {
    const dto = reporting();
    expect(dto.referralMatrix).toHaveLength(HEALTH_SERVICES.length ** 2);
    for (const service of dto.services)
      for (const destination of service.referrals.placedElsewhereByService) {
        expect(destination.count).toEqual(
          dto.referralMatrix.find((cell) => cell.from === service.service && cell.to === destination.service)!.count,
        );
      }
  });

  it("does not reconstruct a small ED band from the cross-route eight-hour total", () => {
    const world = seedWorld(new Date("2026-10-24T00:00:00.000Z"));
    world.state = validMovementSource(12, 0, 0);
    const ed = allEmergencyDepartments()[0]!;
    const waits = [60, 70, 80, 90, 100, 540, 550, 560, 570, 580, 900, 1000];
    world.state.movements = world.state.movements.map((movement, index) => ({
      ...movement,
      originEdId: ed.id,
      openedAt: NOW_ANCHOR - waits[index]!,
    }));
    expect(validWorld(world)).toBe(true);
    const dto = reporting(world.state);
    const shown = dto.emergencyDepartments.find((entry) => entry.id === ed.id)!;
    expect(edJourneyWaitBands(world.state.movements, ed.id, NOW_ANCHOR).map((band) => band.count)).toEqual([
      5, 0, 5, 2, 0,
    ]);
    expect(
      shown.over8h.kind === "exact" && shown.bands[2]!.count.kind === "exact" && shown.over24h.kind === "exact",
    ).toBe(false);
  });

  it("retains authorised incoming origins without granting their foreign ED detail routes", () => {
    const state = seedWardFlowState();
    const places = wardPlaceLookup(state.units);
    const service = places.unitService(state.units[0]!.id)!;
    const access = { role: "executive" as const, scope: { kind: "service" as const, service } };
    const scoped = scopeWardFlowState(state, access, { now: NOW_ANCHOR, places }).state;
    const memberIds = new Set(scoped.movements.map((row) => row.id));
    const movements = state.movements.filter((row) => memberIds.has(row.id));
    const measured = new Map<string, number>();
    const original = ExecutiveCountRelease.prototype.count;
    const observe = vi.spyOn(ExecutiveCountRelease.prototype, "count").mockImplementation(function (
      this: ExecutiveCountRelease,
      key,
      value,
      priority,
    ) {
      measured.set(key, value);
      return original.call(this, key, value, priority);
    });
    try {
      const dto = reporting(state, service);
      expect(measured.get("movements:edJourneys")).toBe(openEdJourneys(movements, NOW_ANCHOR).total);
      const listed = dto.emergencyDepartments.reduce(
        (sum, ed) => sum + edWaitFigures(movements, ed.id, NOW_ANCHOR).onTheList,
        0,
      );
      expect(measured.get("movements:listedEdJourneys")).toBe(listed);
      expect(measured.get("movements:edJourneys")!).toBe(listed);
      expect(
        dto.emergencyDepartments
          .filter((ed) => ed.service !== service)
          .every((ed) => !dto.openableEmergencyDepartmentIds.includes(ed.id)),
      ).toBe(true);
      const weekly = weeklyOperationsReport(
        {
          ...state,
          ...scoped,
          movements,
          now: NOW_ANCHOR,
          edAccessTargetMinutes: state.configuration.edAccessTargetMinutes,
        },
        reportWeek(-1, NOW_ANCHOR, new Date("2026-10-24T00:00:00.000Z")),
      );
      expect(measured.get("week:-1:edWaits")).toBe(weekly.edWaits.count);
    } finally {
      observe.mockRestore();
    }
  });

  it("takes role, pause and missing-data state from the current host without a row fallback", () => {
    const binding = { actorId: "synthetic-report-actor", accessContext: "a".repeat(64), epoch: 0, revision: 1 };
    const snapshot = { binding, receivedAt: 100, expiresAt: 200, data: reporting() };
    const togglePause = vi.fn();
    function Probe() {
      const data = useExecutiveStatistics();
      const controls = useExecutiveStatisticsControl();
      return createElement(
        "output",
        null,
        JSON.stringify({ kind: data?.kind ?? null, ...controls, togglePause: controls.togglePause === togglePause }),
      );
    }
    const render = (executive: boolean, present = true) => {
      const markup = renderToStaticMarkup(
        createElement(
          ExecutiveStatisticsProvider,
          {
            binding,
            snapshot: present ? snapshot : null,
            now: 150,
            controls: { executive, paused: true, togglePause },
          },
          createElement(Probe),
        ),
      );
      return JSON.parse(markup.slice("<output>".length, -"</output>".length).replaceAll("&quot;", '"'));
    };
    expect(render(true)).toEqual({
      kind: "executive-reporting",
      executive: true,
      ready: true,
      loading: false,
      paused: true,
      togglePause: true,
    });
    expect(render(false)).toEqual({
      kind: null,
      executive: false,
      ready: false,
      loading: false,
      paused: true,
      togglePause: true,
    });
    expect(render(true, false)).toEqual({
      kind: null,
      executive: true,
      ready: false,
      loading: false,
      paused: true,
      togglePause: true,
    });
  });

  it("distinguishes missing session history and releases the real overlapping three/four-hour windows", () => {
    expect(executiveSessionTrends(undefined, NOW_ANCHOR, new ExecutiveCountRelease())).toEqual({
      state: "unavailable",
    });
    const log: EventLogEntry[] = Array.from({ length: 12 }, (_, sequence) => ({
      sequence,
      type: "PATIENT_ARRIVED",
      role: "officer",
      accepted: true,
      now: NOW_ANCHOR - (sequence < 6 ? 10 : 150),
      movementId: `synthetic-private-${sequence}`,
    }));
    const release = new ExecutiveCountRelease();
    const shown = release.resolve(executiveSessionTrends(log, NOW_ANCHOR, release)) as {
      state: "available";
      windows: {
        hourCount: number;
        hours: number[];
        rows: {
          id: string;
          counts: import("../src/components/ward-management/statistics/executive-statistics-contract").ReleasedCount[];
        }[];
      }[];
    };
    expect(shown.windows.map((window) => window.hourCount)).toEqual([3, 4]);
    expect(JSON.stringify(shown)).not.toContain("synthetic-private");
    for (const window of shown.windows) {
      const source = sessionTrends(log, NOW_ANCHOR, window.hourCount);
      expect(window.hours).toEqual(source.hours);
      const arrivals = window.rows.find((row) => row.id === "arrivals")!;
      arrivals.counts.forEach((count, index) => {
        if (count.kind === "exact")
          expect(count.value).toBe(source.rows.find((row) => row.id === "arrivals")!.counts[index]);
      });
    }
    const phone = shown.windows[0]!;
    const desktop = shown.windows[1]!;
    expect(phone.rows.find((row) => row.id === "arrivals")!.counts).toEqual(
      desktop.rows.find((row) => row.id === "arrivals")!.counts.slice(-3),
    );
  });

  it.runIf(process.env.WF_EXECUTIVE_MEASURE === "1")(
    "records bounded current-seed projection timings without imposing a machine-dependent budget",
    () => {
      const state = seedWardFlowState();
      reporting(state); // One warm call, then exactly three measured calls.
      const milliseconds = Array.from({ length: 3 }, () => {
        const start = performance.now();
        const result = reporting(state);
        expect(isExecutiveReportingFoundation(result)).toBe(true);
        return Math.round((performance.now() - start) * 10) / 10;
      });
      // The calling measurement harness supplies provenance; this test does not read application source.
      const sourceRevision = process.env.WF_EXECUTIVE_SOURCE_REVISION ?? null;
      process.stdout.write(
        `${JSON.stringify({ measurement: "executive-current-seed-projection", warmCalls: 1, measuredCalls: 3, milliseconds, sourceRevision, fixtureHash: createHash("sha256").update(JSON.stringify(state)).digest("hex"), wards: state.units.length, movements: state.movements.length, admissions: state.admissions.length, node: process.version })}\n`,
      );
    },
  );

  it.runIf(process.env.WF_EXECUTIVE_PROFILE === "1")(
    "profiles current-seed release traversal with metadata only",
    () => {
      // Test-only observation of the unchanged implementation, not a production diagnostics API.
      const prototype = ExecutiveCountRelease.prototype as unknown as {
        rangesExposeSmall: (exact: ReadonlySet<string>, withheld: ReadonlySet<string>) => Set<string>;
        finish: ExecutiveCountRelease["finish"];
        alternateWitnesses: (...args: unknown[]) => unknown;
        validWitness: (...args: unknown[]) => boolean;
      };
      const ranges = prototype.rangesExposeSmall;
      const finish = prototype.finish;
      const alternate = prototype.alternateWitnesses;
      const validate = prototype.validWitness;
      const metadata = {
        cells: 0,
        protectedCells: 0,
        equations: 0,
        partitions: 0,
        candidatesBeforeComplementaryProtection: 0,
        exactPositiveReleased: 0,
        rangeCalls: 0,
        equationVisits: 0,
        rangeMs: 0,
        witnessSearchCalls: 0,
        witnessSearchMs: 0,
        witnessChecks: 0,
        validWitnesses: 0,
        witnessValidationMs: 0,
        finishMs: 0,
        projectionMs: 0,
      };
      const observeRanges = vi.spyOn(prototype, "rangesExposeSmall").mockImplementation(function (
        this: ExecutiveCountRelease,
        exact,
        withheld,
      ) {
        metadata.rangeCalls++;
        const equations = Reflect.get(this, "equations") as Map<string, number>[];
        const observed = new Proxy(equations, {
          get(target, key, receiver) {
            if (typeof key === "string" && /^\d+$/u.test(key)) metadata.equationVisits++;
            return Reflect.get(target, key, receiver);
          },
        });
        Reflect.set(this, "equations", observed);
        const start = performance.now();
        try {
          return ranges.call(this, exact, withheld);
        } finally {
          metadata.rangeMs += performance.now() - start;
          Reflect.set(this, "equations", equations);
        }
      });
      const observeSearch = vi.spyOn(prototype, "alternateWitnesses").mockImplementation(function (
        this: ExecutiveCountRelease,
        ...args
      ) {
        metadata.witnessSearchCalls++;
        const start = performance.now();
        try {
          return alternate.apply(this, args);
        } finally {
          metadata.witnessSearchMs += performance.now() - start;
        }
      });
      const observeValidation = vi.spyOn(prototype, "validWitness").mockImplementation(function (
        this: ExecutiveCountRelease,
        ...args
      ) {
        metadata.witnessChecks++;
        const start = performance.now();
        try {
          const valid = validate.apply(this, args);
          if (valid) metadata.validWitnesses++;
          return valid;
        } finally {
          metadata.witnessValidationMs += performance.now() - start;
        }
      });
      const observeFinish = vi.spyOn(prototype, "finish").mockImplementation(function (this: ExecutiveCountRelease) {
        const cells = Reflect.get(this, "cells") as Map<string, { shown: boolean; value: number }>;
        metadata.cells = cells.size;
        metadata.protectedCells = [...cells.values()].filter(
          (cell) => cell.value > 0 && cell.value < this.threshold,
        ).length;
        metadata.equations = (Reflect.get(this, "equations") as unknown[]).length;
        metadata.partitions = (Reflect.get(this, "partitions") as unknown[]).length;
        metadata.candidatesBeforeComplementaryProtection = [...cells.values()].filter(
          (cell) => cell.shown && cell.value >= this.threshold,
        ).length;
        const start = performance.now();
        try {
          const result = finish.call(this);
          metadata.exactPositiveReleased = [...result.values()].filter(
            (count) => count.kind === "exact" && count.value > 0,
          ).length;
          return result;
        } finally {
          metadata.finishMs += performance.now() - start;
        }
      });
      try {
        const start = performance.now();
        const dto = reporting();
        metadata.projectionMs = performance.now() - start;
        expect(isExecutiveReportingFoundation(dto)).toBe(true);
        process.stdout.write(
          `${JSON.stringify({ measurement: "executive-release-profile", ...Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, Math.round(value * 10) / 10])) })}\n`,
        );
      } finally {
        observeFinish.mockRestore();
        observeValidation.mockRestore();
        observeSearch.mockRestore();
        observeRanges.mockRestore();
      }
    },
  );

  it.each(["statewide-seed", "service-seed", "small-stage", "mixed-stages"] as const)(
    "preserves the entire released bundle after the propagation traversal optimisation: %s",
    (fixture) => {
      const state =
        fixture === "small-stage"
          ? validAdmissionSource(1, 7)
          : fixture === "mixed-stages"
            ? validAdmissionSource(4, 6, 2)
            : seedWardFlowState();
      const service =
        fixture === "service-seed" ? wardPlaceLookup(state.units).unitService(state.units[0]!.id)! : undefined;
      const prototype = ExecutiveCountRelease.prototype as unknown as {
        rangesExposeSmall: (exact: ReadonlySet<string>, withheld: ReadonlySet<string>) => Set<string>;
        validWitness: (
          delta: Map<string, number>,
          exact: ReadonlySet<string>,
          withheld: ReadonlySet<string>,
        ) => boolean;
      };
      const previous = vi.spyOn(prototype, "rangesExposeSmall").mockImplementation(previousReportingRanges);
      const previousWitness = vi.spyOn(prototype, "validWitness").mockImplementation(previousReportingWitness);
      let expected: ReturnType<typeof reporting>;
      try {
        expected = reporting(state, service);
      } finally {
        previousWitness.mockRestore();
        previous.mockRestore();
      }
      expect(reporting(state, service)).toEqual(expected);
    },
  );
});

function validAdmissionSource(waitlisted = 1, occupied = 7, departed = 0, arrivedEarlier = 0) {
  let world = seedWorld(new Date("2026-10-24T00:00:00Z"));
  const { units, patients, admissions } = world.state;
  for (const [key, value] of Object.entries(world.state))
    if (Array.isArray(value)) Object.assign(world.state, { [key]: [] });
  world.state.units = units.map((unit) => ({
    ...unit,
    restrictivePractice: { ...unit.restrictivePractice, episodes: [], incidents: [] },
  }));
  world.state.patients = patients;
  const size = waitlisted + occupied + departed;
  world.state.admissions = admissions.slice(0, size).map((admission, index) => ({
    ...admission,
    state: index < waitlisted ? "waitlisted" : index < waitlisted + occupied ? "occupied" : "departed",
    arrivedAt: index < waitlisted ? null : index >= size - arrivedEarlier ? NOW_ANCHOR - 1441 : NOW_ANCHOR - 1,
    pulledAt: index < waitlisted ? null : index >= size - arrivedEarlier ? NOW_ANCHOR - 1442 : NOW_ANCHOR - 2,
    leftAt: index >= waitlisted + occupied ? NOW_ANCHOR : null,
    movementId: null,
    referralId: null,
  }));
  for (const admission of world.state.admissions) delete admission.bedNumber;
  world = JSON.parse(JSON.stringify(world));
  expect(validWorld(world), "the synthetic reproduction must pass the actual world validator").toBe(true);
  return world.state;
}

function validMovementSource(size: number, refused: number, escalated: number, leftEd = 0) {
  let world = seedWorld(new Date("2026-10-24T00:00:00Z"));
  const { units, patients, movements } = world.state;
  const template = movements.find((movement) => movement.originEdId !== undefined)!;
  for (const [key, value] of Object.entries(world.state))
    if (Array.isArray(value)) Object.assign(world.state, { [key]: [] });
  world.state.units = units.map((unit) => ({
    ...unit,
    restrictivePractice: { ...unit.restrictivePractice, episodes: [], incidents: [] },
  }));
  world.state.patients = patients;
  const required = [
    "originEdId",
    "openedAt",
    "flaggedUrgent",
    "urgency",
    "cohort",
    "security",
    "sex",
    "observation",
    "highAcuity",
    "legalStatus",
    "owner",
    "blocker",
  ] as const;
  const common = Object.fromEntries(required.map((key) => [key, template[key]])) as Pick<
    Movement,
    (typeof required)[number]
  >;
  world.state.movements = movements.slice(0, size).map((source, index) => ({
    ...common,
    id: source.id,
    patientId: source.patientId,
    stage: "destination_review",
    openedAt: NOW_ANCHOR - 10,
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    referredUnitIds: [],
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    declines: index < refused ? [{ unitId: units[0]!.id, at: NOW_ANCHOR - 1, reason: DECLINE_REASONS[0] }] : [],
    ...(index >= refused && index < refused + escalated
      ? { escalation: { at: NOW_ANCHOR - 1, triedUnitIds: [units[0]!.id], contact: "Synthetic coordination" } }
      : {}),
    ...(index < leftEd ? { leftDepartmentAt: NOW_ANCHOR - 1 } : {}),
  }));
  world = JSON.parse(JSON.stringify(world));
  expect(validWorld(world), "the synthetic movement source must pass the actual world validator").toBe(true);
  return world.state;
}

function project(state: WardFlowState, service?: HealthService) {
  return projectExecutiveNetworkStatistics(
    state,
    { role: "executive", scope: service ? { kind: "service", service } : { kind: "statewide" } },
    {
      now: NOW_ANCHOR,
      dayZero: "2026-10-24T00:00:00.000Z",
      startedAt: "2026-10-24T00:00:00.000Z",
      places: wardPlaceLookup(state.units),
    },
  );
}

const emptyAggregate = {
  kind: "executive-statistics",
  version: 1,
  coverage: "network-foundation",
  threshold: 5,
  scope: { kind: "statewide" },
  asAt: { now: 0, dayZero: "2026-10-24T00:00:00.000Z", startedAt: "2026-10-24T00:00:00.000Z" },
  wards: [],
  beds: { total: 0, ready: 0, pulled: 0, closed: 0, occupied: 0, inUse: 0, beingMadeReady: 0, onLeave: 0 },
  people: {
    waitingInEd: { kind: "exact", value: 0 },
    stillOpen: { kind: "exact", value: 0 },
    admissionsArrivedToday: { kind: "exact", value: 0 },
    admissionsEndedToday: { kind: "exact", value: 0 },
    admissionsRecorded: { kind: "exact", value: 0 },
    refused: { kind: "exact", value: 0 },
    escalated: { kind: "exact", value: 0 },
  },
  admissionStages: {
    "no-bed-yet": { kind: "exact", value: 0 },
    "bed-given-not-arrived": { kind: "exact", value: 0 },
    "in-the-bed": { kind: "exact", value: 0 },
    ended: { kind: "exact", value: 0 },
  },
};

describe("the executive Network aggregate boundary", () => {
  it("accepts an honestly measured empty aggregate without operational records", () => {
    expect(isExecutiveNetworkAggregate(emptyAggregate)).toBe(true);
  });

  it("rejects an exact small patient count even when the rest of the payload is valid", () => {
    expect(
      isExecutiveNetworkAggregate({
        ...emptyAggregate,
        people: { ...emptyAggregate.people, admissionsEndedToday: { kind: "exact", value: 2 } },
      }),
    ).toBe(false);
  });

  it("projects actual Network figures with no operational rows and without changing the source", async () => {
    const { projectExecutiveNetworkStatistics } =
      await import("../src/components/ward-management/statistics/executive-statistics-projector");
    const state = seedWardFlowState();
    const before = JSON.stringify(state);
    const projected = projectExecutiveNetworkStatistics(
      state,
      { role: "executive", scope: { kind: "statewide" } },
      {
        now: NOW_ANCHOR,
        dayZero: emptyAggregate.asAt.dayZero,
        startedAt: emptyAggregate.asAt.startedAt,
        places: wardPlaceLookup(state.units),
      },
    );
    const occupancy = occupiedBeds(state.units, state.admissions, state.bedReleases, state.leaveBeds);
    expect(projected.beds).toMatchObject({
      total: occupancy.beds,
      occupied: occupancy.occupied,
      pulled: occupancy.pulled,
      inUse: occupancy.inUse,
    });
    expect(projected.beds.ready).toBe(totalReadyBedsNow(state.units, state.admissions, state.bedReleases));
    // The seed's linked movement family has protected information. Its large waiting figure
    // must no longer remain exact beside that family; unsuppressed source parity is checked below.
    expect(waitingInEds(state.movements, NOW_ANCHOR).total).toBeGreaterThan(0);
    expect(projected.people.waitingInEd).toEqual({ kind: "withheld" });
    expect(projected.coverage).toBe("network-foundation");
    expect(isExecutiveNetworkAggregate(JSON.parse(JSON.stringify(projected)))).toBe(true);
    for (const record of [...state.patients, ...state.movements, ...state.admissions, ...state.referrals]) {
      expect(JSON.stringify(projected)).not.toContain(JSON.stringify(record.id));
    }
    expect(JSON.stringify(state)).toBe(before);
  });

  it("rejects a supplied lower threshold rather than accepting exact patient counts under the real policy", () => {
    expect(
      isExecutiveNetworkAggregate({
        ...emptyAggregate,
        threshold: 2,
        people: { ...emptyAggregate.people, admissionsEndedToday: { kind: "exact", value: 2 } },
      }),
    ).toBe(false);
  });

  it("rejects a breakdown that reconstructs its sole hidden count from an exact total", () => {
    expect(
      isExecutiveNetworkAggregate({
        ...emptyAggregate,
        people: { ...emptyAggregate.people, admissionsRecorded: { kind: "exact", value: 8 } },
        admissionStages: {
          ...emptyAggregate.admissionStages,
          "no-bed-yet": { kind: "small" },
          "in-the-bed": { kind: "exact", value: 6 },
        },
      }),
    ).toBe(false);
  });

  it("withholds nonzero admission-family counters beside protected stages in an actual valid source", () => {
    const state = validAdmissionSource();
    const before = JSON.stringify(state);
    const result = project(state);
    expect(result.admissionStages["no-bed-yet"]).toEqual({ kind: "small" });
    expect(result.admissionStages["in-the-bed"]).toEqual({ kind: "withheld" });
    expect(result.people.admissionsRecorded).toEqual({ kind: "withheld" });
    expect(result.people.admissionsArrivedToday).toEqual({ kind: "withheld" });
    expect(result.people.admissionsEndedToday).toEqual({ kind: "exact", value: 0 });
    expect(isExecutiveNetworkAggregate(result)).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });

  it.each([1, 9])(
    "protects a small daily count or daily complement with exact stages (arrived today=%i)",
    (arrivedToday) => {
      const result = project(validAdmissionSource(0, 5, 5, 10 - arrivedToday));
      expect(Object.values(result.admissionStages).every((figure) => figure.kind === "exact")).toBe(true);
      expect(result.people.admissionsRecorded).toEqual({ kind: "withheld" });
      expect(result.people.admissionsArrivedToday).toEqual({ kind: "withheld" });
      expect(result.people.admissionsEndedToday).toEqual({ kind: "withheld" });
    },
  );

  it("rejects exact admission counters that expose a small daily complement", () => {
    expect(
      isExecutiveNetworkAggregate({
        ...emptyAggregate,
        admissionStages: {
          ...emptyAggregate.admissionStages,
          "in-the-bed": { kind: "exact", value: 5 },
          ended: { kind: "exact", value: 5 },
        },
        people: {
          ...emptyAggregate.people,
          admissionsRecorded: { kind: "exact", value: 10 },
          admissionsArrivedToday: { kind: "exact", value: 9 },
          admissionsEndedToday: { kind: "exact", value: 5 },
        },
      }),
    ).toBe(false);
  });

  it.each(["admissionsRecorded", "admissionsArrivedToday", "admissionsEndedToday"] as const)(
    "rejects exact-positive or small %s whenever any admission stage is protected",
    (field) => {
      for (const stage of [{ kind: "small" }, { kind: "withheld" }]) {
        const aggregate = {
          ...emptyAggregate,
          admissionStages: {
            ...emptyAggregate.admissionStages,
            "no-bed-yet": stage,
            "in-the-bed": { kind: "withheld" },
          },
          people: {
            ...emptyAggregate.people,
            admissionsRecorded: { kind: "withheld" },
            admissionsArrivedToday: { kind: "withheld" },
            admissionsEndedToday: { kind: "exact", value: 0 },
          },
        };
        expect(isExecutiveNetworkAggregate(aggregate)).toBe(true);
        for (const exposed of [{ kind: "exact", value: 6 }, { kind: "small" }])
          expect(isExecutiveNetworkAggregate({ ...aggregate, people: { ...aggregate.people, [field]: exposed } })).toBe(
            false,
          );
      }
    },
  );

  it.each(["waitingInEd", "stillOpen", "refused", "escalated"] as const)(
    "rejects exact-positive or small %s beside a protected movement-family counter",
    (field) => {
      const aggregate = {
        ...emptyAggregate,
        people: {
          ...emptyAggregate.people,
          waitingInEd: { kind: "withheld" },
          stillOpen: { kind: "withheld" },
          refused: { kind: "withheld" },
          escalated: { kind: "withheld" },
        },
      };
      expect(isExecutiveNetworkAggregate(aggregate)).toBe(true);
      for (const exposed of [{ kind: "exact", value: 6 }, { kind: "small" }])
        expect(isExecutiveNetworkAggregate({ ...aggregate, people: { ...aggregate.people, [field]: exposed } })).toBe(
          false,
        );
    },
  );

  it("preserves authorised source escalation figures when no movement-family value needs protection", () => {
    const state = validMovementSource(10, 5, 5);
    const before = JSON.stringify(state);
    const result = project(state);
    expect(result.people.refused).toEqual({ kind: "exact", value: 5 });
    expect(result.people.escalated).toEqual({ kind: "exact", value: 5 });
    expect(result.people.stillOpen).toEqual({ kind: "exact", value: 10 });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("protects the small difference between exact waiting and open figures from a valid source", () => {
    const result = project(validMovementSource(6, 0, 0, 1));
    expect(result.people.waitingInEd).toEqual({ kind: "withheld" });
    expect(result.people.stillOpen).toEqual({ kind: "withheld" });
    expect(result.people.refused).toEqual({ kind: "exact", value: 0 });
    expect(result.people.escalated).toEqual({ kind: "exact", value: 0 });
  });

  it.each([
    [6, 1, 5],
    [11, 5, 5],
  ] as const)(
    "protects small refusal cells or the open/refused/escalated residual (%i,%i,%i)",
    (size, refused, escalated) => {
      const result = project(validMovementSource(size, refused, escalated));
      for (const field of ["waitingInEd", "stillOpen", "refused", "escalated"] as const)
        expect(result.people[field]).toEqual({ kind: "withheld" });
      expect(isExecutiveNetworkAggregate(result)).toBe(true);
    },
  );

  it("rejects an exact movement-family payload exposing a small unshown complement", () => {
    expect(
      isExecutiveNetworkAggregate({
        ...emptyAggregate,
        people: {
          ...emptyAggregate.people,
          waitingInEd: { kind: "exact", value: 5 },
          stillOpen: { kind: "exact", value: 6 },
        },
      }),
    ).toBe(false);
  });

  it("rejects negative or small residuals in either exact movement relationship", () => {
    for (const [waiting, open, refused, escalated] of [
      [10, 5, 0, 0],
      [0, 5, 5, 5],
      [0, 11, 5, 5],
    ])
      expect(
        isExecutiveNetworkAggregate({
          ...emptyAggregate,
          people: {
            ...emptyAggregate.people,
            waitingInEd: { kind: "exact", value: waiting },
            stillOpen: { kind: "exact", value: open },
            refused: { kind: "exact", value: refused },
            escalated: { kind: "exact", value: escalated },
          },
        }),
      ).toBe(false);
  });

  it("keeps service ward and bed aggregates within the requested service", () => {
    const state = seedWardFlowState();
    const places = wardPlaceLookup(state.units);
    const service = places.unitService(state.units[0]!.id)!;
    const own = state.units.filter((unit) => places.unitService(unit.id) === service);
    expect(own.length).toBeGreaterThan(0);
    expect(own.length).toBeLessThan(state.units.length);
    const result = project(state, service);
    expect(result.scope).toEqual({ kind: "service", service });
    expect(result.wards.map((ward) => ward.id)).toEqual(own.map((ward) => ward.id));
    expect(result.wards.every((ward) => ward.service === service)).toBe(true);
    expect(result.beds.total).toBe(own.reduce((sum, unit) => sum + unit.beds, 0));
    expect(result.beds.total).toBeLessThan(project(state).beds.total);
  });

  it.each([
    [0, { kind: "exact", value: 0 }],
    [1, { kind: "withheld" }],
    [4, { kind: "withheld" }],
    [5, { kind: "exact", value: 5 }],
  ] as const)("releases %i ended admissions using the existing patient-count policy", (size, expected) => {
    const state = seedWardFlowState();
    const ended = state.admissions.slice(0, size).map((admission) => ({
      ...admission,
      state: "departed" as const,
      arrivedAt: NOW_ANCHOR - 100,
      leftAt: NOW_ANCHOR,
    }));
    const result = project({ ...state, admissions: ended });
    expect(result.people.admissionsEndedToday).toEqual(expected);
    expect(result.people.admissionsRecorded).toEqual(expected);
    expect(isExecutiveNetworkAggregate(result)).toBe(true);
  });

  it("withholds the complementary stage and linked total beside a protected admission stage", () => {
    const state = seedWardFlowState();
    const admissions = state.admissions.slice(0, 8).map((admission, index) => ({
      ...admission,
      state: index < 2 ? ("waitlisted" as const) : ("occupied" as const),
      arrivedAt: index < 2 ? null : NOW_ANCHOR - 100,
      leftAt: null,
    }));
    const result = project({ ...state, admissions });
    // Keeping this total exact was unsafe once same-bundle daily subset counts were included.
    expect(result.people.admissionsRecorded).toEqual({ kind: "withheld" });
    expect(result.admissionStages).toEqual({
      "no-bed-yet": { kind: "small" },
      "bed-given-not-arrived": { kind: "exact", value: 0 },
      "in-the-bed": { kind: "withheld" },
      ended: { kind: "exact", value: 0 },
    });
    expect(isExecutiveNetworkAggregate(result)).toBe(true);
  });

  it("permits exact small bed counts while rejecting protected-count values and operational extras", () => {
    expect(
      isExecutiveNetworkAggregate({ ...emptyAggregate, beds: { ...emptyAggregate.beds, total: 2, ready: 2 } }),
    ).toBe(true);
    const invalid = [
      { ...emptyAggregate, state: seedWardFlowState() },
      { ...emptyAggregate, patients: [] },
      { ...emptyAggregate, coverage: "all-statistics" },
      { ...emptyAggregate, people: { ...emptyAggregate.people, admissionsEndedToday: { kind: "small", value: 2 } } },
      {
        ...emptyAggregate,
        admissionStages: { ...emptyAggregate.admissionStages, ended: { kind: "withheld", raw: 6 } },
      },
      { ...emptyAggregate, asAt: { ...emptyAggregate.asAt, patientId: "PT-SYNTHETIC" } },
    ];
    for (const candidate of invalid) expect(isExecutiveNetworkAggregate(candidate)).toBe(false);
  });

  it("rejects non-executive roles instead of borrowing coordinator reporting authority", () => {
    const state = seedWardFlowState();
    expect(() =>
      projectExecutiveNetworkStatistics(
        state,
        { role: "coordinator", scope: { kind: "statewide" } },
        {
          ...emptyAggregate.asAt,
          places: wardPlaceLookup(state.units),
        },
      ),
    ).toThrow("requires an executive reporting scope");
  });

  it("rejects foreign or duplicate public ward rows inside a service-scoped aggregate", () => {
    const state = seedWardFlowState();
    const result = project(state, wardPlaceLookup(state.units).unitService(state.units[0]!.id)!);
    const foreign = project(state).wards.find((ward) => ward.service !== result.wards[0]!.service)!;
    expect(foreign).toBeDefined();
    expect(isExecutiveNetworkAggregate({ ...result, wards: [...result.wards, foreign] })).toBe(false);
    expect(isExecutiveNetworkAggregate({ ...result, wards: [...result.wards, result.wards[0]] })).toBe(false);
  });

  it("does not let another service's admission change the service's released figures", () => {
    const state = seedWardFlowState();
    const places = wardPlaceLookup(state.units);
    const service = places.unitService(state.units[0]!.id)!;
    const foreign = state.admissions.find((admission) => places.unitService(admission.unitId) !== service)!;
    expect(foreign).toBeDefined();
    const before = project(state, service);
    const altered = {
      ...state,
      admissions: state.admissions.map((admission) =>
        admission.id === foreign.id
          ? { ...admission, state: "departed" as const, arrivedAt: NOW_ANCHOR - 20, leftAt: NOW_ANCHOR }
          : admission,
      ),
    };
    expect(project(altered, service)).toEqual(before);
  });

  it("never carries narrative or identity through the public projection seam", () => {
    const state = seedWardFlowState();
    const marker = "SYNTHETIC-PRIVATE-NARRATIVE";
    state.patients[0] = { ...state.patients[0]!, givenName: marker, familyName: marker };
    state.movements[0] = { ...state.movements[0]!, blocker: marker, owner: marker };
    state.referrals[0] = { ...state.referrals[0]!, history: marker };
    const result = project(state);
    expect(JSON.stringify(result)).not.toContain(marker);
    expect(isExecutiveNetworkAggregate(JSON.parse(JSON.stringify(result)))).toBe(true);
  });
});

describe("live preview report context", () => {
  it("accepts only the exact current controlled source identity without transport credentials", () => {
    const identity = { source: "synthetic-authorised-source" };
    // The holder does not validate a DTO a second time; its input is the host's completed release.
    const data = {
      kind: "executive-reporting",
    } as import("../src/components/ward-management/statistics/executive-statistics-contract").ExecutiveReportingFoundation;
    const projection = { identity, data };
    expect(selectExecutiveLivePreview(true, identity, projection)).toBe(data);
    expect(selectExecutiveLivePreview(false, identity, projection)).toBeNull();
    expect(selectExecutiveLivePreview(true, { ...identity }, projection)).toBeNull();
    expect(selectExecutiveLivePreview(true, null, projection)).toBeNull();
    expect(selectExecutiveLivePreview(true, identity, null)).toBeNull();
  });
  it("publishes unavailable while a replacement source is still awaiting its projection", () => {
    const previous = { generation: 1 },
      current = { generation: 2 };
    const data = {
      kind: "executive-reporting",
    } as import("../src/components/ward-management/statistics/executive-statistics-contract").ExecutiveReportingFoundation;
    const projection = { identity: previous, data };
    const tree = renderToStaticMarkup(
      createElement(
        ExecutiveStatisticsLivePreviewProvider,
        {
          enabled: true,
          identity: current,
          projection,
        },
        createElement(LivePreviewProbe),
      ),
    );
    expect(tree).toContain("unavailable");
    expect(tree).toContain("executive");
    expect(tree).not.toContain("ready");
  });
});
function LivePreviewProbe() {
  const data = useExecutiveStatistics(),
    control = useExecutiveStatisticsControl();
  return createElement(
    "span",
    null,
    (data ? "ready" : "unavailable") + ":" + (control.executive ? "executive" : "operational"),
  );
}
