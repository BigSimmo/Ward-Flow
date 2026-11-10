import type { Admission } from "@/components/ward-management/ward-admissions";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import type { BedRelease, LeaveBed, Unit } from "@/components/ward-management/ward-model";

/**
 * Polished statistics (5 October 2026): occupied means a bed with a patient in it, including a
 * patient on leave. A bed given to someone who has not arrived is "Pulled" and is shown on its own
 * box, never counted as occupied.
 *
 * ⚠️ **THE OCCUPANCY PERCENTAGE IS `inUse`, NOT `occupied`** (L1, site review 12 Oct 2026). The one
 * occupancy figure every other page prints is Occupied + Pulled (`wardBedsInUse`,
 * `ward-occupancy.ts`, device audit 11 Oct 2026); Statistics divided Occupied alone and read 80%
 * where Home read 85.2%. `occupied` and `pulled` stay for the boxes that show them separately;
 * every "% occupancy" reads `inUse` (or `occupancyPercent`).
 */
export function occupiedBeds(
  units: readonly Unit[],
  admissions: readonly Admission[],
  bedReleases: BedRelease[],
  leaveBeds: readonly LeaveBed[],
): { beds: number; occupied: number; pulled: number; inUse: number } {
  // WF-16: Occupied, Pulled and In use come from one bedStates call per ward (same boxes as
  // wardBedUseFigures / wardBedsInUse). Leave is only a marker inside Occupied.
  return units.reduce(
    (sum, unit) => {
      const states = bedStates(unit, admissions, bedReleases, leaveBeds);
      const inUse = states.occupied + states.pulled;
      return {
        beds: sum.beds + unit.beds,
        occupied: sum.occupied + states.occupied,
        pulled: sum.pulled + states.pulled,
        inUse: sum.inUse + inUse,
      };
    },
    { beds: 0, occupied: 0, pulled: 0, inUse: 0 },
  );
}

/** Whole-number occupancy percentage from the one count (Occupied + Pulled); 0 with no beds. */
export function occupancyPercent(figure: { beds: number; inUse: number }): number {
  return figure.beds > 0 ? Math.round((figure.inUse / figure.beds) * 100) : 0;
}

/** What a screen prints for a ward or group with no beds, in place of a percentage (M121, D-125). */
export const NO_BEDS_TEXT = "No beds";

/**
 * The occupancy a screen prints: "85%" from the one count (Occupied + Pulled), or "No beds" when
 * there are none (M121, Josh approved D-125, 10 Nov 2026). A ward with no beds is never "0%".
 */
export function occupancyText(figure: { beds: number; inUse: number }): string {
  return figure.beds > 0 ? `${occupancyPercent(figure)}%` : NO_BEDS_TEXT;
}

/** Whole hours as "13h", or "7d 1h" once a wait passes a day, so long waits read at a glance. */
export function hoursText(hours: number): string {
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
