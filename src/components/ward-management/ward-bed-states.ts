import type { Admission } from "@/components/ward-management/ward-admissions";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import type { BedRelease, LeaveBed, Unit } from "@/components/ward-management/ward-model";

/**
 * The ward's bed states, as ruled (R-B-05, 2026-09-04, "option 2"; R-B-09 "Ready, everywhere";
 * 2026-09-01 ruling 5 "the box currently called Held becomes Closed").
 *
 * Four boxes that add up to the ward's beds — **Ready · Pulled · Closed · Occupied** — and two
 * markers shown beside them that are beds ALREADY COUNTED inside the four, never a fifth box:
 *
 * - `beingMadeReady` is inside Ready. Nothing is subtracted from Ready for it (2026-09-01: the
 *   ward's figure must not lurch as cleaning starts and stops; only the pull is refused).
 * - `onLeave` is inside Occupied. A leave bed is a note, not a bed, and adding it would count the
 *   same bed twice. "Held" is the word for this one ("a patient is ON LEAVE, their bed is HELD").
 *
 * ⚠️ **WHERE A PULLED BED SITS TODAY, AND WHY THIS FUNCTION READS `movementId`.** R-B-05 recorded
 * that a pulled bed has two homes in the model: a pull made while the app runs lowers the ward's
 * allocatable figure and leaves it physically empty (so `unitCapacity` puts it in `held`), while a
 * seeded pulled admission is already outside the empty count (so it sits in `occupied`). An
 * admission's `movementId` tells the two apart: PULL_PATIENT always writes one, and `null` is the
 * documented mark of seeded occupancy (`Admission.movementId`). Each is taken out of the box it
 * actually sits in, so the four still add up to `unit.beds` and Closed is left meaning only what
 * the owner defined it as: physically empty, and the ward is not offering it.
 */
export type BedStateCounts = {
  ready: number;
  pulled: number;
  closed: number;
  occupied: number;
  /** Inside `ready`: released beds still being made ready. */
  beingMadeReady: number;
  /** Inside `occupied`: beds held for a patient who is on leave. */
  onLeave: number;
};

export function bedStates(
  unit: Unit,
  admissions: readonly Admission[],
  bedReleases: BedRelease[],
  leaveBeds: readonly LeaveBed[],
): BedStateCounts {
  const capacity = unitCapacity(unit, bedReleases);
  let livePulled = 0;
  let seededPulled = 0;
  for (const admission of admissions) {
    if (admission.unitId !== unit.id || admission.state !== "pulled") continue;
    if (admission.movementId === null) seededPulled += 1;
    else livePulled += 1;
  }
  // Clamped to the box each one sits in, so a malformed fixture can never push a box negative or
  // the four past the ward's beds.
  const pulledFromEmpty = Math.min(livePulled, capacity.held);
  const pulledFromOccupied = Math.min(seededPulled, capacity.occupied);
  const occupied = capacity.occupied - pulledFromOccupied;
  return {
    ready: capacity.available,
    pulled: pulledFromEmpty + pulledFromOccupied,
    closed: capacity.held - pulledFromEmpty + capacity.blocked,
    occupied,
    beingMadeReady: Math.min(bedsPendingPreparation(unit.id, bedReleases), capacity.available),
    onLeave: Math.min(leaveBeds.filter((bed) => bed.unitId === unit.id).length, occupied),
  };
}

/** The ruled words, spelled once. */
export const BED_STATE_LABELS = {
  ready: "Ready",
  pulled: "Pulled",
  closed: "Closed",
  occupied: "Occupied",
  beingMadeReady: "Being made ready",
  onLeave: "On leave",
} as const;

/** One line of explanation per box, for legends and titles. */
export const BED_STATE_DETAILS = {
  ready: "Empty and offered: a patient can be pulled into it",
  pulled: "Allocated to a named patient who has not arrived yet",
  closed: "Physically empty, but the ward is not offering it",
  occupied: "Someone is in it",
  beingMadeReady: "Already counted in Ready: released and still being made ready",
  onLeave: "Already counted in Occupied: held for a patient on leave",
} as const;
