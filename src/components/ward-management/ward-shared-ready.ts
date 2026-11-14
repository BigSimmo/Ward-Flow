import type { Admission } from "@/components/ward-management/ward-admissions";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import type { BedRelease, Movement, Unit } from "@/components/ward-management/ward-model";
import {
  numberedReservationBeds,
  type ReservationReferral as BaseReservationReferral,
} from "@/components/ward-management/ward-movement-bed-hold";
import { pulledBedAvailability } from "@/components/ward-management/ward-ready-beds";

/**
 * H7 (mechanics and clock audit, 14 Nov 2026; D-MCA (Josh, 14 Nov 2026)): THE ONE READY COUNT.
 *
 * Capacity, Home, the nav and the pull gate already shared one Ready: the ward's own figures, less
 * pulls made since the last count, named holds and beds still being made ready. The fit check
 * (`referralEligibility`) kept a private figure, `min(allocatable, empty)` alone, so the Place tab
 * read "Fits, bed ready" while Capacity showed 0 Ready and the pull was refused. This module holds
 * the partition `bedStates` prints, in a file that imports nothing from the derivations or the
 * reducer, so the engine, the bed boxes and every fit list read the same arithmetic.
 *
 * Matching itself never imports this file (spec D15: no code reachable from `ward-eligibility.ts`
 * or `ward-referrals.ts` reads the release model). A caller builds a lookup here and hands matching
 * a plain number per ward (`ReadyBedsLookup`).
 */

/** A named hold as the bed counts read it: a journey, a referral, or one ward's inbox entry. */
export type ReadyHold = BaseReservationReferral | Movement;

export type ReadyPartition = {
  /** Ready: offered, empty, not pulled, not named for anyone, not being made ready. */
  ready: number;
  /** Runtime pulls taken out of the ward's raw unoffered remainder. */
  pulledFromEmpty: number;
  /** Runtime pulls taken out of the offered figure. */
  pulledFromAvailable: number;
  /** Seeded pulled stays (no journey link): they sit in occupancy. */
  seededPulled: number;
  /** Named holds, and how many of them came off the offered figure. */
  named: number;
  namedFromReady: number;
  /** Released beds still being made ready, taken off what was left (D-179 item 8). */
  beingMadeReady: number;
};

/** What `except` leaves out: the journey or referral about to use its own hold. */
export type ReadyExcept = { movementId?: string; referralId?: string };

/**
 * The Ready partition for one ward. `bedStates` builds its five boxes from this, and
 * `sharedReadyLookup` hands its `ready` to the fit checks, so the two can never disagree.
 */
export function readyPartition(
  unit: Unit,
  admissions: readonly Admission[],
  bedReleases: readonly BedRelease[],
  holds: readonly ReadyHold[],
  except: ReadyExcept = {},
): ReadyPartition {
  let livePulled = 0;
  let seededPulled = 0;
  for (const admission of admissions) {
    if (admission.unitId !== unit.id || admission.state !== "pulled") continue;
    if (admission.movementId === null) seededPulled += 1;
    else livePulled += 1;
  }
  const { ready, pulledFromEmpty, pulledFromAvailable } = pulledBedAvailability(unit, livePulled);
  const movements = holds.filter((row): row is Movement => "stage" in row);
  const others = holds.filter((row): row is BaseReservationReferral => !("stage" in row));
  const named = numberedReservationBeds(unit, admissions, movements, others, except).size;
  const namedFromReady = Math.min(named, ready);
  // D-179 item 8: a bed still being made ready is not Ready. Named holds and pulls are taken off
  // the clean beds first, so a bed already pulled is never also counted as being made ready.
  const offered = ready - namedFromReady;
  const beingMadeReady = Math.min(bedsPendingPreparation(unit.id, [...bedReleases]), offered);
  return {
    ready: offered - beingMadeReady,
    pulledFromEmpty,
    pulledFromAvailable,
    seededPulled,
    named,
    namedFromReady,
    beingMadeReady,
  };
}

/** The records the shared Ready reads, as the provider and the engine state both hold them. */
export type ReadyBedsSource = {
  readonly admissions: readonly Admission[];
  readonly bedReleases: readonly BedRelease[];
  readonly movements: readonly Movement[];
  readonly referrals: readonly BaseReservationReferral[];
};

/**
 * H7: the shared Ready per ward, for the fit checks. Every journey and referral counts as a named
 * hold (`networkNamedHolds`), except the one `except` names, so a referral being accepted again is
 * never counted against its own held bed.
 */
export function sharedReadyLookup(source: ReadyBedsSource, except: ReadyExcept = {}): (unit: Unit) => number {
  const holds: ReadyHold[] = [...source.movements, ...source.referrals];
  return (unit: Unit) => readyPartition(unit, source.admissions, source.bedReleases, holds, except).ready;
}
