// src/components/ward-management/capacity/beds-forecast.ts
//
// Tomorrow's beds forecast (smart feature 10, Josh, 4 October 2026): "a plain estimate of beds
// likely to be free in 24 and 48 hours, made from confirmed and expected discharges minus likely
// admissions, with its reasoning shown. Bed meetings are really about tomorrow, not now."
//
// ⚠️ **AN ESTIMATE BUILT ONLY FROM RECORDS THE APP ALREADY HOLDS, NEVER A STATISTICAL MODEL.** The
// prototype has no arrival history, so it does not guess how many new people will present over
// the next day. The forecast says so in words (`BEDS_FORECAST_LIMITS`) instead of quietly
// pretending the queue that exists now is the only demand there will be.
//
// Aggregate only, like the rest of the Capacity screen: nothing here ranks a ward for a person.
// A pure function with no React, so the morning bed-meeting sheet can print the same figures.
import { lockedBedsFree, openBedsFree } from "@/components/ward-management/ward-bed-designation";
import { bedIsOccupied, type Admission, type PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { dayOf, MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { BedRelease, Movement, MovementStage, Unit } from "@/components/ward-management/ward-model";

/**
 * Tomorrow and the day after, as rolling windows from now (24 and 48 hours). Written in days so the
 * figures cannot be mistaken for the bed-release threshold or any Mental Health Act period.
 */
export const BEDS_FORECAST_HORIZON_DAYS = [1, 2] as const;

/**
 * Stages at which a person still needs a bed. From `pulled` onwards `PULL_PATIENT` has already
 * taken the bed off the ward's allocatable count, so counting that person again would subtract the
 * same bed twice.
 */
const STAGES_STILL_NEEDING_A_BED: readonly MovementStage[] = [
  "placement_requested",
  "destination_review",
  "accepted_awaiting_bed",
];

export type BedsForecastHorizon = {
  /** The window's length in hours, from `BEDS_FORECAST_HORIZON_DAYS`. */
  hours: number;
  /** The end of the window, `now + hours`. Releases due at or before it count, overdue ones included. */
  until: Instant;
  /** Beds ready now across the network: the same `lockedBedsFree + openBedsFree` the Ready figure uses. */
  readyNow: number;
  /** Confirmed discharges due in the window, from today onwards, that nothing is holding up. */
  confirmed: number;
  /** Expected (not yet confirmed) discharges due in the window, from today onwards, that nothing is holding up. */
  expected: number;
  /** Confirmed or expected discharges due in the window that are held up. Best case only. */
  heldUp: number;
  /**
   * Discharges, not held up, whose expected date fell on an earlier day and which still have not
   * happened. Best case only: a date that has already slipped is weak evidence for the next day.
   */
  overdue: number;
  /**
   * People whose discharge record has a planned date in the window but whose ward has not flagged a
   * bed release for them. Best case only: a date on a record is a plan, not a discharge the ward
   * has said is coming.
   */
  plannedNotFlagged: number;
  /** People waiting for a bed now (open journeys not yet pulled into one). */
  waitingForBed: number;
  /**
   * Planned admissions (stream D) still booked whose expected arrival falls at or before the end of
   * the window, overdue ones included: each will occupy a bed when it arrives.
   */
  plannedAdmissions: number;
  /** `waitingForBed + plannedAdmissions`: beds the window must find for people known now. */
  bedsNeeded: number;
  /** `readyNow + confirmed - bedsNeeded`: only discharges the ward has confirmed. */
  low: number;
  /** `readyNow + confirmed + expected - bedsNeeded`: the headline figure. */
  likely: number;
  /** `likely + heldUp + overdue + plannedNotFlagged`: everything on record goes ahead. */
  high: number;
};

export type BedsForecast = {
  now: Instant;
  horizons: BedsForecastHorizon[];
};

/**
 * What the forecast cannot see, stated beside it every time it is shown.
 */
export const BEDS_FORECAST_LIMITS = [
  "New people arriving at emergency departments are not predicted. The prototype has no arrival history, so only people already waiting and planned admissions already booked are subtracted.",
  "Whole network, all bed kinds together. A free bed may not suit the person waiting; the mismatch table shows that.",
  "Synthetic demonstration data, not live records and not validated decision support.",
] as const;

export function bedsForecast(
  units: Unit[],
  releases: BedRelease[],
  admissions: Admission[],
  movements: Movement[],
  now: Instant,
  plannedAdmissions: readonly PlannedAdmission[] = [],
): BedsForecast {
  const readyNow = units.reduce((sum, unit) => sum + lockedBedsFree(unit) + openBedsFree(unit), 0);
  const unitIds = new Set(units.map((unit) => unit.id));
  const pending = releases.filter((release) => release.state !== "discharged" && unitIds.has(release.unitId));
  const flaggedAdmissionIds = new Set(pending.map((release) => release.admissionId));
  const waitingForBed = movements.filter(
    (movement) => isOpen(movement) && STAGES_STILL_NEEDING_A_BED.includes(movement.stage),
  ).length;

  const horizons = BEDS_FORECAST_HORIZON_DAYS.map((days): BedsForecastHorizon => {
    const until = now + days * MINUTES_PER_DAY;
    const hours = (days * MINUTES_PER_DAY) / 60;
    const due = pending.filter((release) => release.expectedAt <= until);
    const clear = due.filter((release) => release.blocker === null);
    const onTime = clear.filter((release) => dayOf(release.expectedAt) >= dayOf(now));
    const confirmed = onTime.filter((release) => release.state === "confirmed").length;
    const expected = onTime.filter((release) => release.state === "expected").length;
    const heldUp = due.length - clear.length;
    const overdue = clear.length - onTime.length;
    const plannedNotFlagged = admissions.filter(
      (admission) =>
        unitIds.has(admission.unitId) &&
        bedIsOccupied(admission) &&
        admission.expectedDischargeAt !== null &&
        admission.expectedDischargeAt <= until &&
        !flaggedAdmissionIds.has(admission.id),
    ).length;
    const planned = plannedAdmissions.filter(
      (booking) => booking.state === "booked" && unitIds.has(booking.unitId) && booking.expectedArrivalAt <= until,
    ).length;
    const bedsNeeded = waitingForBed + planned;
    const low = readyNow + confirmed - bedsNeeded;
    const likely = low + expected;
    const high = likely + heldUp + overdue + plannedNotFlagged;
    return {
      hours,
      until,
      readyNow,
      confirmed,
      expected,
      heldUp,
      overdue,
      plannedNotFlagged,
      waitingForBed,
      plannedAdmissions: planned,
      bedsNeeded,
      low,
      likely,
      high,
    };
  });

  return { now, horizons };
}

/**
 * How a forecast figure reads. A negative figure is a shortfall and is said as one, never clamped
 * to zero: "short by 3" is the point of the forecast, and "none" would hide it.
 */
export function forecastFigureText(value: number): string {
  if (value < 0) return `short by ${-value}`;
  if (value === 0) return "none";
  return String(value);
}

/** The headline sentence: "6 beds likely free", "Likely short by 3 beds", or "No beds likely free". */
export function forecastHeadline(value: number): string {
  const beds = (count: number) => (count === 1 ? "1 bed" : `${count} beds`);
  if (value < 0) return `Likely short by ${beds(-value)}`;
  if (value === 0) return "No beds likely free";
  return `${beds(value)} likely free`;
}

/** One end of the range: "23 short", "none free" or "30 free". */
export function forecastRangeEnd(value: number): string {
  if (value < 0) return `${-value} short`;
  if (value === 0) return "none free";
  return `${value} free`;
}
