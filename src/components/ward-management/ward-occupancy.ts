import type { Admission } from "@/components/ward-management/ward-admissions";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import type { BedRelease, HealthService, Site, Unit } from "@/components/ward-management/ward-model";
import { wardSites } from "@/components/ward-management/ward-sites";

/**
 * **ONE OCCUPANCY FIGURE — device audit, 11 October 2026 (Recommended, top recommendation 1).**
 *
 * Before this, the same "occupancy" label read 79.6% on Home and Capacity, 85.2% on All wards,
 * 85.9% in the rail, and per service North Metro read 83.1% on Network and Places but 86.2% in the
 * rail. Two counts were in play: the board's Occupied box alone (`bedStates().occupied`), and the
 * capacity model's occupied figure, which already held a seeded pulled patient.
 *
 * **The one count: a bed is in use when it is Occupied or Pulled** — a patient is in it or has been
 * pulled into it. Ready and Closed beds are not in use. The denominator is every bed on the ward
 * (`unit.beds`), the same denominator every screen already used. This matches the Statistics
 * capacity chart's own "(occupied + pulled) / beds" and, on the seed, the rail's figures, so the
 * rail's bed-alert line (which the audit asked to keep) does not move.
 *
 * Every screen that prints an occupancy percentage reads it from here or from
 * `deriveServiceBedAlerts` (`shell/ward-service-bed-alerts.ts`), which sums this same per-ward
 * count. `tests/ward-occupancy.test.ts` pins that the two agree statewide, per service and for Metro.
 *
 * ⚠️ Pass the admissions. Without them a live pull (which leaves its bed physically empty) is not
 * counted; with an empty list this reduces exactly to the capacity model's occupied figure.
 */
export function wardBedsInUse(
  unit: Unit,
  admissions: readonly Admission[],
  bedReleases: readonly BedRelease[],
): number {
  const states = bedStates(unit, admissions, [...bedReleases], []);
  return states.occupied + states.pulled;
}

export type OccupancyFigure = {
  /** Beds Occupied or Pulled. */
  inUse: number;
  /** Every bed on the wards counted. */
  beds: number;
  /** In-use share of beds, one decimal place; `null` when there are no beds. */
  percent: number | null;
};

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/** The occupancy of a set of wards, one decimal place. */
export function wardOccupancy(
  units: readonly Unit[],
  admissions: readonly Admission[],
  bedReleases: readonly BedRelease[],
): OccupancyFigure {
  let inUse = 0;
  let beds = 0;
  for (const unit of units) {
    inUse += wardBedsInUse(unit, admissions, bedReleases);
    beds += unit.beds;
  }
  return { inUse, beds, percent: beds > 0 ? roundOneDecimal((inUse / beds) * 100) : null };
}

/** The wards that belong to one health service, by their site. */
export function unitsInService(
  units: readonly Unit[],
  service: HealthService,
  sites: readonly Site[] = wardSites,
): Unit[] {
  const codes = new Set(sites.filter((site) => site.service === service).map((site) => site.code));
  return units.filter((unit) => codes.has(unit.siteCode));
}

/** Occupancy as printed: "85.2%", or `fallback` when there are no beds. */
export function formatWardOccupancy(figure: OccupancyFigure, fallback = "Not recorded"): string {
  return figure.percent === null ? fallback : `${figure.percent.toFixed(1)}%`;
}
