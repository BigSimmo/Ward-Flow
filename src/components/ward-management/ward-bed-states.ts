import type { Admission } from "@/components/ward-management/ward-admissions";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { readyPartition } from "@/components/ward-management/ward-shared-ready";
import type { BedRelease, LeaveBed, Movement, Unit } from "@/components/ward-management/ward-model";
import { type ReservationReferral as BaseReservationReferral } from "@/components/ward-management/ward-movement-bed-hold";

/**
 * The ward's bed states, as ruled (R-B-05, 2026-09-04, "option 2"; R-B-09 "Ready, everywhere";
 * 2026-09-01 ruling 5 "the box currently called Held becomes Closed").
 *
 * Five boxes that add up to the ward's beds — **Ready · Being made ready · Pulled · Closed ·
 * Occupied** — and one marker shown beside them that is beds ALREADY COUNTED inside Occupied:
 *
 * - `beingMadeReady` (Josh, 13 Nov 2026, D-179 item 8 and D-181 item 5): Ready no longer includes a
 *   bed still being made ready. It comes off Ready and is counted and shown on its own ("1 ready,
 *   1 being made ready"). This replaces the 5 September 2026 ruling that such a bed stays offered
 *   and counted in Ready. Only beds the ward is offering come off Ready: a released bed the ward
 *   has since stopped offering already sits in Closed and is not counted twice. Such a bed may
 *   still be pulled (`PULL_PATIENT` reads `pulledBedAvailability`, not this Ready).
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
  /**
   * Released beds still being made ready, taken off Ready (D-179 item 8): a box of its own, so
   * `ready + beingMadeReady + pulled + closed + occupied === unit.beds`.
   */
  beingMadeReady: number;
  /** Inside `occupied`: beds held for a patient who is on leave. */
  onLeave: number;
};

export type ReservationReferral = BaseReservationReferral | Movement;

/**
 * `referrals` is REQUIRED (A16-25, root-cause 3.4, 13 Nov 2026): it used to default to `[]`, so All
 * wards, Statistics, the hub, the ward page, the downtime pack and the leave tracker left it out and
 * counted a bed named for an incoming patient as Ready while Capacity held it. Pass
 * `networkNamedHolds(movements, referrals)`; pass `[]` only for a deliberate "before named holds"
 * comparison, never for a figure printed as Ready.
 */
export function bedStates(
  unit: Unit,
  admissions: readonly Admission[],
  bedReleases: BedRelease[],
  leaveBeds: readonly LeaveBed[],
  referrals: readonly ReservationReferral[],
): BedStateCounts {
  const capacity = unitCapacity(unit, bedReleases);
  // H7 (D-210 (Josh, 14 Nov 2026)): the Ready arithmetic lives in `readyPartition`, which the fit
  // checks and the engine read too, so the box and the fit check can never count Ready apart.
  const { ready, pulledFromEmpty, pulledFromAvailable, seededPulled, named, namedFromReady, beingMadeReady } =
    readyPartition(unit, admissions, bedReleases, referrals);
  const namedFromClosed = Math.min(named - namedFromReady, capacity.held - pulledFromEmpty);
  const pulledFromOccupied = Math.min(seededPulled, capacity.occupied);
  const occupied = capacity.occupied - pulledFromOccupied;
  return {
    ready,
    pulled: pulledFromEmpty + pulledFromAvailable + pulledFromOccupied + namedFromReady + namedFromClosed,
    closed: capacity.held - pulledFromEmpty - namedFromClosed + capacity.blocked,
    occupied,
    beingMadeReady,
    onLeave: Math.min(leaveBeds.filter((bed) => bed.unitId === unit.id).length, occupied),
  };
}

/**
 * **BEDS READY NOW: the one figure every screen prints** (Audit 6, Josh 20 Oct 2026). Ready from
 * `bedStates`, so a bed pulled for an incoming patient is never offered twice: the rail, Home, the
 * bed board, Handover and Statistics read this, and the bed flow, Capacity and the TV read the same
 * box through `bedStates`. New pulls use the same reservation partition through
 * `pulledBedAvailability`; physical arrivals keep their separate recording rules.
 *
 * `referrals` is required (D-115 item 3): the named holds, open journeys and accepted referrals
 * (`[...movements, ...referrals]`), so a bed named for an incoming patient is off Ready on every
 * screen. Pass `[]` only where the caller truly holds no named reservation.
 */
export function readyBedsNow(
  unit: Unit,
  admissions: readonly Admission[],
  bedReleases: readonly BedRelease[],
  referrals: readonly ReservationReferral[],
): number {
  return bedStates(unit, admissions, [...bedReleases], [], referrals).ready;
}

/**
 * Item 5 (count breakdown): the wards holding a ready bed now, each with its `readyBedsNow`, in the
 * order given. `totalReadyBedsNow` is their sum, so a list of these wards always adds up to the figure.
 */
export function readyBedsByWard(
  units: readonly Unit[],
  admissions: readonly Admission[],
  bedReleases: readonly BedRelease[],
  referrals: readonly ReservationReferral[],
): { unit: Unit; ready: number }[] {
  return units
    .map((unit) => ({ unit, ready: readyBedsNow(unit, admissions, bedReleases, referrals) }))
    .filter((ward) => ward.ready > 0);
}

/** `readyBedsNow` summed over a set of wards. */
export function totalReadyBedsNow(
  units: readonly Unit[],
  admissions: readonly Admission[],
  bedReleases: readonly BedRelease[],
  referrals: readonly ReservationReferral[],
): number {
  return readyBedsByWard(units, admissions, bedReleases, referrals).reduce((sum, ward) => sum + ward.ready, 0);
}

/**
 * THE NAMED-HOLD LIST every network figure reads (WF-FIG-017, D-115): every journey and every
 * referral, unfiltered. Capacity, Home, the meeting sheet and the TV already pass this list; every
 * other screen takes it from here so a bed named for an incoming patient is held on all of them.
 */
export function networkNamedHolds(
  movements: readonly Movement[],
  referrals: readonly BaseReservationReferral[],
): ReservationReferral[] {
  return [...movements, ...referrals];
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
  beingMadeReady:
    "Released and still being made ready: not counted as Ready, but a patient can still be pulled into it",
  onLeave: "Already counted in Occupied: held for a patient on leave",
} as const;

/**
 * H7 (D-210 (Josh, 14 Nov 2026)): the shared Ready for the fit checks, re-exported beside
 * `readyBedsNow` so a screen reaches both from one place.
 */
export { sharedReadyLookup } from "@/components/ward-management/ward-shared-ready";
