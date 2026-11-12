import { describe, expect, it } from "vitest";

import { trackServiceBedCapacity } from "@/components/ward-management/capacity/service-capacity-tracker";
import { unitReadyBedCount } from "@/components/ward-management/search/ward-smart-search";
import { deriveServiceBedAlerts } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { bedSummaryText } from "@/components/ward-management/tools/ward-bed-summary";
import { DEFAULT_BED_FINDER_FILTERS, findBeds } from "@/components/ward-management/tools/ward-bed-finder";
import { readyBedsNow, totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";
import { lockedBedsFree, openBedsFree } from "@/components/ward-management/ward-bed-designation";
import { heldBedsByKind } from "@/components/ward-management/ward-movement-bed-hold";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { activeWardNetwork, NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

/**
 * D-115 item 3 (Josh, 9 Nov 2026), follow-up review 12 Nov 2026: a bed named for an open journey or
 * an accepted referral is not ready on any screen. The Tools sheet (Key figures, Copy bed summary,
 * Find a bed, Call log), the rail's service alerts, Search and the ward peek used to count it as
 * ready. Synthetic seed data only.
 */
// The ward board's "Place here": RF-005 accepted into rph-older-adult bed 1 (as the one-number test).
const seed = seedWardFlowState();
const state = wardFlowReducer(seed, {
  type: "ACCEPT_REFERRAL",
  role: "ward",
  now: NOW_ANCHOR,
  referralId: "RF-005",
  destinationKind: "psychiatric_ward",
  unitId: "rph-older-adult",
  actingUnitId: "rph-older-adult",
  bedNumber: 1,
} as Parameters<typeof wardFlowReducer>[1]);
const holds = [...state.movements, ...state.referrals];
const named = state.units.filter(
  (unit) =>
    readyBedsNow(unit, state.admissions, state.bedReleases, holds) <
    readyBedsNow(unit, state.admissions, state.bedReleases, []),
);

describe("D-115 item 3: a named bed is not ready on the Tools sheet, rail or Search", () => {
  it("the accepted referral names an otherwise ready bed, so the case is reached", () => {
    expect(state.rejections.length, "the acceptance was taken").toBe(seed.rejections.length);
    expect(named.map((unit) => unit.id)).toContain("rph-older-adult");
  });

  it("Copy bed summary states the ready count with the named holds left out", () => {
    const ready = totalReadyBedsNow(state.units, state.admissions, state.bedReleases, holds);
    expect(ready).toBeLessThan(totalReadyBedsNow(state.units, state.admissions, state.bedReleases, []));
    const text = bedSummaryText({
      units: state.units,
      admissions: state.admissions,
      movements: state.movements,
      referrals: state.referrals,
      bedReleases: state.bedReleases,
      leaveBeds: state.leaveBeds,
      now: NOW_ANCHOR,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
      network: activeWardNetwork(),
    });
    expect(text).toContain(`Ready beds: ${ready} of `);
  });

  it("Find a bed caps each ward at the ready count with the named holds left out", () => {
    for (const unit of named) {
      const filters = { ...DEFAULT_BED_FINDER_FILTERS, cohort: unit.cohort, legalStatus: "voluntary" as const };
      const row = findBeds(state.units, state.admissions, state.bedReleases, filters, holds).find(
        (candidate) => candidate.unit.id === unit.id,
      );
      expect(row?.free, unit.id).toBe(readyBedsNow(unit, state.admissions, state.bedReleases, holds));
    }
  });

  it("Find a bed's Locked and Open filters take a named bed off its own kind (CodeRabbit on #1637)", () => {
    for (const unit of named) {
      const held = heldBedsByKind(unit, state.admissions, holds);
      const ready = readyBedsNow(unit, state.admissions, state.bedReleases, holds);
      for (const bed of ["locked", "open"] as const) {
        const filters = {
          ...DEFAULT_BED_FINDER_FILTERS,
          cohort: unit.cohort,
          bed,
          legalStatus: "voluntary" as const,
        };
        const row = findBeds(state.units, state.admissions, state.bedReleases, filters, holds).find(
          (candidate) => candidate.unit.id === unit.id,
        );
        const kindFree = bed === "locked" ? lockedBedsFree(unit) - held.locked : openBedsFree(unit) - held.open;
        expect(row?.free, `${unit.id} ${bed}`).toBe(Math.min(Math.max(0, kindFree), ready));
      }
      expect(held.locked + held.open, unit.id).toBeGreaterThan(0);
    }
  });

  it("the rail's service alerts and the capacity tracker leave the named beds out of Free", () => {
    const siteCodes = new Set(wardSites.map((site) => site.code));
    const inNetwork = state.units.filter((unit) => siteCodes.has(unit.siteCode));
    const ready = totalReadyBedsNow(inNetwork, state.admissions, state.bedReleases, holds);
    const alerts = deriveServiceBedAlerts(
      state.units,
      state.bedReleases,
      wardSites,
      state.movements,
      NOW_ANCHOR,
      undefined,
      state.admissions,
      state.referrals,
    );
    expect(alerts.totalFreeBeds).toBe(ready);
    const report = trackServiceBedCapacity(
      state.units,
      state.bedReleases,
      state.movements,
      NOW_ANCHOR,
      wardSites,
      undefined,
      state.admissions,
      state.referrals,
    );
    const free = report.services.reduce((sum, service) => sum + service.remainingBeds, 0);
    expect(free).toBe(ready);
  });

  it("Search's ward ready count leaves the named beds out", () => {
    for (const unit of named) {
      expect(unitReadyBedCount(unit, state.admissions, holds), unit.id).toBe(
        readyBedsNow(unit, state.admissions, [], holds),
      );
    }
  });
});
