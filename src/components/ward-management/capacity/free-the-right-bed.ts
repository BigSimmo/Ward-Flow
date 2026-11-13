/**
 * Free the right bed (Josh, 8 Nov 2026, signed off with its wording): for a bed type that is short,
 * today's planned discharges that would free a bed of that type, in expected time order and nothing
 * else. It only joins records Ward Flow already holds. It suggests a phone call; it never ranks a
 * discharge, never names a patient and never pairs anyone with the bed. Only the ward decides when a
 * patient leaves. Synthetic data only.
 */
import type { Instant } from "@/components/ward-management/ward-clock";
import { isFreeingToday } from "@/components/ward-management/ward-shared-figures";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { bedKindOfBed } from "@/components/ward-management/forecast/forecast-by-kind";

import type { BedKindId } from "./capacity-derivations";

/** The signed-off heading: "Planned discharges that could free a locked adult bed today". */
export const FREE_THE_RIGHT_BED_NOTE =
  "Expected times are the ward's own. Only the ward decides when a patient leaves.";

export type FreeingDischarge = {
  releaseId: string;
  unit: Unit;
  expectedAt: Instant;
  /** The ward has confirmed the discharge (still not a decision this screen makes). */
  confirmed: boolean;
  /** Held up: the recorded blocker, shown as recorded. */
  heldUp: string | null;
  /** What an expected discharge is waiting on, when something is outstanding. */
  waitingOn: string | null;
  /** When the ward last reported this discharge. */
  reportedAt: Instant;
};

export function dischargesThatFree(
  kind: BedKindId,
  releases: readonly BedRelease[] | undefined,
  units: readonly Unit[],
  admissions: readonly Admission[],
  now: Instant,
): FreeingDischarge[] {
  const wardsById = new Map(units.map((unit) => [unit.id, unit]));
  const admissionById = new Map(admissions.map((admission) => [admission.id, admission]));
  const rows: FreeingDischarge[] = [];
  for (const release of releases ?? []) {
    // A discharged bed is already free and already counted as ready; a time already passed is
    // overdue, not freeing (A16-05): the shared rule Capacity's "Beds freeing today" counts.
    if (!isFreeingToday(release, now)) continue;
    const unit = wardsById.get(release.unitId);
    if (!unit || bedKindOfBed(unit, admissionById.get(release.admissionId)) !== kind) continue;
    rows.push({
      releaseId: release.id,
      unit,
      expectedAt: release.expectedAt,
      confirmed: release.state === "confirmed",
      heldUp: release.blocker,
      waitingOn: release.waitingOn !== null && release.waitingOn !== "Nothing outstanding" ? release.waitingOn : null,
      reportedAt: release.confirmedAt,
    });
  }
  // Expected time order only: nothing else changes it.
  return rows.sort((a, b) => a.expectedAt - b.expectedAt || a.unit.name.localeCompare(b.unit.name));
}

/** "Planned discharges that could free a locked adult bed today". */
export function freeTheRightBedTitle(kindLabel: string): string {
  return `Planned discharges that could free ${/^[aeiou]/iu.test(kindLabel) ? "an" : "a"} ${kindLabel.toLowerCase()} bed today`;
}
