import type { Admission } from "@/components/ward-management/ward-admissions";
import { releaseBand } from "@/components/ward-management/ward-bed-availability";
import { bedStates, type BedStateCounts } from "@/components/ward-management/ward-bed-states";
import { dayOf, type Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease, LeaveBed, Unit } from "@/components/ward-management/ward-model";

/**
 * One source for every bed figure on the polished ward screens (mockup, 5 October 2026).
 *
 * Occupancy (Josh): beds with a patient in them, people on leave included, over all beds. A bed
 * given to someone who has not arrived is "Pulled" and is not occupied.
 *
 * Past date (Josh, decision card): an open discharge dated on an earlier day that has not happened,
 * confirmed or not, is never counted as leaving today or free by midnight. It is listed apart as
 * past its date.
 */
export type PolishedBeds = BedStateCounts & { beds: number; occupancy: number };

export function polishedBeds(
  unit: Unit,
  admissions: readonly Admission[],
  bedReleases: BedRelease[],
  leaveBeds: readonly LeaveBed[],
): PolishedBeds {
  const states = bedStates(unit, admissions, bedReleases, leaveBeds);
  return { ...states, beds: unit.beds, occupancy: unit.beds > 0 ? states.occupied / unit.beds : 0 };
}

export function sumBeds(rows: readonly PolishedBeds[]): PolishedBeds {
  const total = rows.reduce(
    (sum, row) => ({
      beds: sum.beds + row.beds,
      ready: sum.ready + row.ready,
      pulled: sum.pulled + row.pulled,
      closed: sum.closed + row.closed,
      occupied: sum.occupied + row.occupied,
      beingMadeReady: sum.beingMadeReady + row.beingMadeReady,
      onLeave: sum.onLeave + row.onLeave,
      occupancy: 0,
    }),
    { beds: 0, ready: 0, pulled: 0, closed: 0, occupied: 0, beingMadeReady: 0, onLeave: 0, occupancy: 0 },
  );
  return { ...total, occupancy: total.beds > 0 ? total.occupied / total.beds : 0 };
}

const TODAY_BANDS = new Set(["now", "by-midday", "by-1600", "tonight"]);

/** An open discharge whose date is an earlier day than today. */
export function isPastDate(release: BedRelease, now: Instant): boolean {
  return release.state !== "discharged" && dayOf(release.expectedAt) < dayOf(now);
}

/** Open discharges for one ward: leaving today (confirmed or expected), tomorrow, and past their date. */
export function leavingFor(unitId: string, bedReleases: readonly BedRelease[], now: Instant) {
  const open = bedReleases.filter((release) => release.unitId === unitId && release.state !== "discharged");
  const pastDate = open.filter((release) => isPastDate(release, now));
  const current = open.filter((release) => !isPastDate(release, now));
  const today = current.filter((release) => TODAY_BANDS.has(releaseBand(release, now)));
  const tomorrow = current.filter((release) => releaseBand(release, now) === "tomorrow");
  return {
    today,
    confirmedToday: today.filter((release) => release.state === "confirmed"),
    tomorrow,
    pastDate,
  };
}

export function percent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}
