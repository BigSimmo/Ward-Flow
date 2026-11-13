import type { Admission } from "@/components/ward-management/ward-admissions";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";

/**
 * WF-16 printed nouns. "Occupied" / "On the ward" mean a patient is in the bed (leave included).
 * "In use" means Occupied + Pulled — the one occupancy percentage every screen prints.
 */
export const OCCUPIED_NOUN = "Occupied";
export const OCCUPIED_CAPTION = "In a bed, leave included";
export const IN_USE_NOUN = "In use";
export const IN_USE_CAPTION = "Occupied or pulled";
export const ON_THE_WARD_NOUN = "On the ward";

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
 *
 * Named holds are left out here on purpose (the explicit `[]` to `bedStates`): this is the beds
 * taken by a stay, as every occupancy percentage reads it. Ready is never read from here.
 */
export function wardBedsInUse(
  unit: Unit,
  admissions: readonly Admission[],
  bedReleases: readonly BedRelease[],
): number {
  const states = bedStates(unit, admissions, [...bedReleases], [], []);
  return states.occupied + states.pulled;
}

/**
 * Occupied / On the ward count from the same `bedStates` box every screen reads (WF-16).
 * Leave is a marker inside Occupied, never a separate bed.
 */
export function wardOccupiedBeds(
  unit: Unit,
  admissions: readonly Admission[],
  bedReleases: readonly BedRelease[],
): number {
  return bedStates(unit, admissions, [...bedReleases], [], []).occupied;
}

/** Occupied, Pulled and In use from one `bedStates` call so the three figures cannot drift (WF-16). */
export function wardBedUseFigures(
  unit: Unit,
  admissions: readonly Admission[],
  bedReleases: readonly BedRelease[],
): { occupied: number; pulled: number; inUse: number } {
  const states = bedStates(unit, admissions, [...bedReleases], [], []);
  return {
    occupied: states.occupied,
    pulled: states.pulled,
    inUse: states.occupied + states.pulled,
  };
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

/** Occupancy as printed: "85%" (whole percent, CL-9), or `fallback` when there are no beds. */
export function formatWardOccupancy(figure: OccupancyFigure, fallback = "Not recorded"): string {
  return figure.percent === null ? fallback : `${Math.round(figure.percent)}%`;
}
