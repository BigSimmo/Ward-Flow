import type { Admission } from "@/components/ward-management/ward-admissions";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import type { BedRelease, LeaveBed, Unit } from "@/components/ward-management/ward-model";

/**
 * Polished statistics (5 October 2026): the one occupancy rule Josh approved. Occupied means a bed
 * with a patient in it, including a patient on leave. A bed given to someone who has not arrived
 * is "Pulled" and is shown on its own, never counted as occupied. Every polished screen reads its
 * occupancy from here so the same beds give the same figure everywhere.
 */
export function occupiedBeds(
  units: readonly Unit[],
  admissions: readonly Admission[],
  bedReleases: BedRelease[],
  leaveBeds: readonly LeaveBed[],
): { beds: number; occupied: number; pulled: number } {
  return units.reduce(
    (sum, unit) => {
      const states = bedStates(unit, admissions, bedReleases, leaveBeds);
      return {
        beds: sum.beds + unit.beds,
        occupied: sum.occupied + states.occupied,
        pulled: sum.pulled + states.pulled,
      };
    },
    { beds: 0, occupied: 0, pulled: 0 },
  );
}

/** Whole hours as "13h", or "7d 1h" once a wait passes a day, so long waits read at a glance. */
export function hoursText(hours: number): string {
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
