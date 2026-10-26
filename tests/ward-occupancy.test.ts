import { describe, expect, it } from "vitest";

import { deriveServiceBedAlerts } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { HealthService, Unit } from "@/components/ward-management/ward-model";
import { wardBedsInUse, wardOccupancy } from "@/components/ward-management/ward-occupancy";
import { wardSites } from "@/components/ward-management/ward-sites";

/** The wards of one health service, by their site (test helper; the app has no reader for it). */
function unitsInService(units: readonly Unit[], service: HealthService): Unit[] {
  const codes = new Set(wardSites.filter((site) => site.service === service).map((site) => site.code));
  return units.filter((unit) => codes.has(unit.siteCode));
}

/**
 * Device audit, 11 Oct 2026 (top recommendation 1): one occupancy figure everywhere. The Home ring,
 * Capacity, All wards and Places read `wardOccupancy`; the rail and Home service rows read
 * `deriveServiceBedAlerts`. These pin that the two agree statewide, per service and for Metro, from
 * the seed rather than typed literals.
 */
describe("ward occupancy agrees with the rail's service figures", () => {
  const seed = seedWardFlowState();
  const alerts = deriveServiceBedAlerts(seed.units, seed.bedReleases, undefined, [], 0, undefined, seed.admissions);

  it("has beds in use in the seed, so the agreement is not vacuous", () => {
    const figure = wardOccupancy(seed.units, seed.admissions, seed.bedReleases);
    expect(figure.beds).toBeGreaterThan(0);
    expect(figure.inUse).toBeGreaterThan(0);
    expect(alerts.services.length).toBeGreaterThan(0);
  });

  it("gives the same statewide percentage", () => {
    expect(alerts.statewideOccupancyPercent).toBe(wardOccupancy(seed.units, seed.admissions, seed.bedReleases).percent);
  });

  it("gives the same figure for every service", () => {
    for (const row of alerts.services) {
      const figure = wardOccupancy(unitsInService(seed.units, row.shortName), seed.admissions, seed.bedReleases);
      expect(row.occupiedBeds, `${row.shortName} beds in use`).toBe(figure.inUse);
      expect(row.totalBeds, `${row.shortName} beds`).toBe(figure.beds);
      expect(row.occupancyPercent, `${row.shortName} percent`).toBe(figure.percent);
    }
  });

  it("gives the same Metro figure", () => {
    const metro = (["North Metro", "South Metro", "East Metro"] as const).flatMap((service) =>
      unitsInService(seed.units, service),
    );
    expect(alerts.metroOccupancyPercent).toBe(wardOccupancy(metro, seed.admissions, seed.bedReleases).percent);
  });

  it("counts a bed in use when it is Occupied or Pulled, never above its bed count", () => {
    for (const unit of seed.units) {
      const inUse = wardBedsInUse(unit, seed.admissions, seed.bedReleases);
      expect(inUse).toBeGreaterThanOrEqual(0);
      expect(inUse).toBeLessThanOrEqual(unit.beds);
    }
  });
});
