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
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { bedIsOccupied, type Admission, type PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { dayOf, MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { BedRelease, Movement, MovementStage, Unit } from "@/components/ward-management/ward-model";
import { bedsForecastSources, type BedsForecastSources } from "./beds-forecast-sources";
import { plannedAdmissionsStillNeedingABed } from "./planned-admissions-reducer";
import { forecastReleaseAt } from "../forecast/forecast-release-date";

/**
 * Tomorrow and the day after, as rolling windows from now (24 and 48 hours). Written in days so the
 * figures cannot be mistaken for the bed-release threshold or any Mental Health Act period.
 */
const BEDS_FORECAST_HORIZON_DAYS = [1, 2] as const;

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

type BedsForecastHorizon = {
  /** The window's length in hours, from `BEDS_FORECAST_HORIZON_DAYS`. */
  hours: number;
  /** The end of the window, `now + hours`. Releases due at or before it count, overdue ones included. */
  until: Instant;
  /** Beds ready now across the network, using the table/map partition of observations and reservations. */
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
  /** People waiting for a bed now (open journeys not yet pulled into one; pulled movements excluded). */
  waitingForBed: number;
  /**
   * Planned admissions (stream D) still booked whose expected arrival falls at or before the end of
   * the window, overdue ones included: each will occupy a bed when it arrives. A linked patient
   * already counted in `waitingForBed` through an open movement is not counted again.
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
  /** Where the next 24 hours' discharges come from, ward by ward, as each ward recorded them. */
  sources: BedsForecastSources;
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
  // Clinical owner ruling, 14 Oct 2026: main's capacity rule stands, and a closed unit counts as
  // zero capacity, now or projected.
  const openUnits = units.filter((unit) => !unit.isClosed);
  const readyNow = openUnits.reduce((sum, unit) => sum + bedStates(unit, admissions, [], []).ready, 0);
  const openUnitIds = new Set(openUnits.map((unit) => unit.id));
  const unitIds = new Set(units.map((unit) => unit.id));
  const admissionsById = new Map(admissions.map((admission) => [admission.id, admission]));
  const expectedAt = (release: BedRelease) => forecastReleaseAt(release, admissionsById.get(release.admissionId));
  const pending = releases.filter((release) => release.state !== "discharged" && openUnitIds.has(release.unitId));
  const flaggedAdmissionIds = new Set(pending.map((release) => release.admissionId));
  const waitingMovements = movements.filter(
    (movement) => isOpen(movement) && STAGES_STILL_NEEDING_A_BED.includes(movement.stage),
  );
  // Clinical owner ruling, 14 Oct 2026: a movement already pulled into a bed (an admission or an
  // allocated bed) is left out of the bed-wait count, and so out of `bedsNeeded` too.
  const waitingForBed = waitingMovements.filter(
    (movement) => movement.admissionId === undefined && movement.allocatedBed === undefined,
  ).length;

  const horizons = BEDS_FORECAST_HORIZON_DAYS.map((days): BedsForecastHorizon => {
    const until = now + days * MINUTES_PER_DAY;
    const hours = (days * MINUTES_PER_DAY) / 60;
    const due = pending.filter((release) => expectedAt(release) <= until);
    const clear = due.filter((release) => release.blocker === null);
    const onTime = clear.filter((release) => dayOf(expectedAt(release)) >= dayOf(now));
    const confirmed = onTime.filter((release) => release.state === "confirmed").length;
    const expected = onTime.filter((release) => release.state === "expected").length;
    const heldUp = due.length - clear.length;
    const overdue = clear.length - onTime.length;
    const plannedNotFlagged = plannedDatesNotFlagged(admissions, openUnitIds, flaggedAdmissionIds, until).length;
    const planned = plannedAdmissionsStillNeedingABed(
      plannedAdmissions,
      unitIds,
      until,
      waitingMovements,
      admissions,
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

  return { now, horizons, sources: bedsForecastSources(units, releases, admissions, now, plannedAdmissions) };
}

/**
 * Occupied stays whose planned discharge date falls by `until` but whose ward has not flagged a bed
 * release: the forecast's "planned date not flagged" part. One rule for the network figure and the
 * ward board's own line (`wardForecastShare`), so the two can never count differently.
 */
function plannedDatesNotFlagged(
  admissions: readonly Admission[],
  openUnitIds: ReadonlySet<string>,
  flaggedAdmissionIds: ReadonlySet<string>,
  until: Instant,
): Admission[] {
  return admissions.filter(
    (admission) =>
      openUnitIds.has(admission.unitId) &&
      bedIsOccupied(admission) &&
      admission.expectedDischargeAt !== null &&
      admission.expectedDischargeAt <= until &&
      !flaggedAdmissionIds.has(admission.id),
  );
}

/**
 * One ward's part in tomorrow's network forecast (forecast integration, Josh, 27 Oct 2026): the
 * ward's own discharges the 24 hour figure counts, and the stays whose planned date the ward has not
 * flagged yet. The counts are `bedsForecast` run on this ward alone, so they add up to the network
 * figure's parts. Nothing new is estimated. A closed ward counts as zero, so it has no share.
 */
export type WardForecastShare = {
  confirmed: number;
  expected: number;
  heldUp: number;
  overdue: number;
  notFlagged: readonly Admission[];
};

export function wardForecastShare(
  unit: Unit,
  releases: readonly BedRelease[],
  admissions: readonly Admission[],
  now: Instant,
): WardForecastShare | null {
  if (unit.isClosed) return null;
  const ownReleases = releases.filter((release) => release.unitId === unit.id);
  const ownAdmissions = admissions.filter((admission) => admission.unitId === unit.id);
  const tomorrow = bedsForecast([unit], ownReleases, ownAdmissions, [], now).horizons[0]!;
  const flagged = new Set(
    ownReleases.filter((release) => release.state !== "discharged").map((release) => release.admissionId),
  );
  return {
    confirmed: tomorrow.confirmed,
    expected: tomorrow.expected,
    heldUp: tomorrow.heldUp,
    overdue: tomorrow.overdue,
    notFlagged: plannedDatesNotFlagged(ownAdmissions, new Set([unit.id]), flagged, tomorrow.until),
  };
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
