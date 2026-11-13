// src/components/ward-management/forecast/forecast-by-kind.ts
//
// Tomorrow and the day after for each bed type (forecasting build, Josh, 23 Oct 2026, screen 2).
// The same buckets as `bedsForecast`, counted per bed type so a coordinator can see which kind of
// bed will still be short, not only the network total. The total's low, likely and high add each
// type's shortfall (D-191 item 6), and `bedsForecast` reads them from here.
//
// ⚠️ **COUNTED FROM RECORDS ONLY.** Beds ready now and people waiting come from `bedKindGaps`, the
// mismatch table's own function, so "now" here is the table's figure. Releases are sorted into a
// bed type by the ward's cohort and, on an adult ward, by the admission's recorded `bedKind`. A
// planned admission is sorted by its booked age band and, for an adult, by its legal status:
// detained under the Act needs a locked bed, anything else an open one. Nothing is predicted.
import {
  bedKindGaps,
  combinedKindGap,
  type BedKindId,
} from "@/components/ward-management/capacity/capacity-derivations";
import {
  patientsHoldingANamedBed,
  plannedAdmissionsStillNeedingABed,
} from "@/components/ward-management/capacity/planned-admissions-reducer";
import { isDetainedUnderTheAct } from "@/components/ward-management/ed/ed-home-derivations";
import { bedIsOccupied, type Admission, type PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { dayOf, MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { numberedBedKind, unitHasOpenBeds } from "@/components/ward-management/ward-bed-designation";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { BedRelease, Movement, Unit } from "@/components/ward-management/ward-model";
import { forecastReleaseAt } from "./forecast-release-date";

export type KindForecast = {
  id: BedKindId;
  /** The mismatch table's gap now: beds that fit minus people waiting. */
  now: number;
  /** The mismatch table's two halves of `now`. */
  waiting: number;
  bedsThatFit: number;
  /**
   * Beds of this type still being made ready now (D-179 item 8): left out of `now` and
   * `bedsThatFit`, but each will be ready within the window, so `low` counts it, as the network
   * forecast's `beingMadeReady` does (`bedsForecast`). Older caller-built figures may omit this.
   */
  beingMadeReady?: number;
  low: number;
  likely: number;
  high: number;
  confirmed: number;
  expected: number;
  heldUp: number;
  overdue: number;
  plannedNotFlagged: number;
  /** Unflagged occupied stays whose current date and lack of blocker let confirmation lift likely.
   * Older caller-built figures may omit this; absence never implies eligibility. */
  confirmationEligible?: number;
  plannedAdmissions: number;
};

export type ForecastByKind = { hours: number; until: Instant; kinds: KindForecast[]; total: Omit<KindForecast, "id"> };

/** A bed type in a sentence: "Open adult beds are short tomorrow". */
export const BED_KIND_LABEL: Record<BedKindId, string> = {
  locked_adult: "Locked adult",
  open_adult: "Open adult",
  older_adult: "Older adult",
  youth: "Youth",
};

const KIND_ORDER: readonly BedKindId[] = ["locked_adult", "open_adult", "older_adult", "youth"];

/**
 * The bed type a ward's bed belongs to: its cohort, and for an adult ward the bed's designation.
 * Seeded and older admissions carry no `bedKind`, so the bed number decides next, then the ward:
 * an adult ward with no open beds can only free a locked one.
 */
export function bedKindOfBed(unit: Unit, admission: Admission | undefined): BedKindId {
  if (unit.cohort === "Older adult") return "older_adult";
  if (unit.cohort === "Youth") return "youth";
  const kind =
    admission?.bedKind ??
    (admission?.bedNumber === undefined ? undefined : numberedBedKind(unit, admission.bedNumber)) ??
    (unitHasOpenBeds(unit) ? "open" : "locked");
  return kind === "locked" ? "locked_adult" : "open_adult";
}

/**
 * The bed type a person waiting needs: the same rule as the mismatch table's private
 * `bedKindOfMovement` (capacity-derivations.ts). `tests/ward-forecast-ed-access-risk.test.ts` checks
 * the two agree on the seed, so a change to one fails the build until the other follows.
 */
export function bedKindOfNeed(movement: Pick<Movement, "cohort" | "security">): BedKindId {
  if (movement.cohort === "Older adult") return "older_adult";
  if (movement.cohort === "Youth") return "youth";
  return movement.security === "Secure" ? "locked_adult" : "open_adult";
}

export function bedKindOfPlannedAdmission(booking: PlannedAdmission): BedKindId {
  if (booking.ageBand === "Older adult") return "older_adult";
  if (booking.ageBand === "Youth") return "youth";
  return isDetainedUnderTheAct(booking.legalStatus) ? "locked_adult" : "open_adult";
}

const WAITING_STAGES: readonly Movement["stage"][] = [
  "placement_requested",
  "destination_review",
  "accepted_awaiting_bed",
];

/** People waiting for a bed, exactly as the mismatch table counts them. */
export function isWaitingForBed(movement: Movement): boolean {
  return (
    isOpen(movement) &&
    movement.admissionId === undefined &&
    movement.allocatedBed === undefined &&
    WAITING_STAGES.includes(movement.stage)
  );
}

export type ForecastGapTables = {
  gaps: ReturnType<typeof bedKindGaps>;
  gapsWithPreparing: ReturnType<typeof bedKindGaps>;
};

/**
 * The two gap tables a by-type forecast starts from. They do not depend on the horizon, so a caller
 * forecasting several days works them out once (the cross-mode audit replays every event).
 */
function forecastGapTables(
  units: readonly Unit[],
  releases: readonly BedRelease[],
  admissions: readonly Admission[],
  movements: readonly Movement[],
  now: Instant,
  referrals: Parameters<typeof bedKindGaps>[4] = [],
): ForecastGapTables {
  return {
    gaps: bedKindGaps([...movements], [...units], now, admissions, referrals, releases),
    // The same table before beds still being made ready come off (D-179 item 8): the difference per
    // type is that type's being-made-ready beds, so the ranges below add up to `bedsForecast`'s.
    gapsWithPreparing: bedKindGaps([...movements], [...units], now, admissions, referrals),
  };
}

export function forecastByKind(
  units: readonly Unit[],
  releases: readonly BedRelease[],
  admissions: readonly Admission[],
  movements: readonly Movement[],
  now: Instant,
  days: number,
  plannedAdmissions: readonly PlannedAdmission[] = [],
  /** Referrals holding a named bed (WF-FIG-017); journeys' holds come from `movements`. */
  referrals: Parameters<typeof bedKindGaps>[4] = [],
  /** The gap tables from `forecastGapTables` for the same inputs, when a caller asks for several horizons. */
  tables: ForecastGapTables = forecastGapTables(units, releases, admissions, movements, now, referrals),
): ForecastByKind {
  const until = now + days * MINUTES_PER_DAY;
  const { gaps, gapsWithPreparing } = tables;
  const openUnits = new Map(units.filter((unit) => !unit.isClosed).map((unit) => [unit.id, unit]));
  const admissionById = new Map(admissions.map((admission) => [admission.id, admission]));
  const expectedAt = (release: BedRelease) => forecastReleaseAt(release, admissionById.get(release.admissionId));
  const pending = releases.filter((release) => release.state !== "discharged" && openUnits.has(release.unitId));
  const flagged = new Set(pending.map((release) => release.admissionId));
  const waitingMovements = movements.filter((movement) => isOpen(movement) && WAITING_STAGES.includes(movement.stage));
  const planned = plannedAdmissionsStillNeedingABed(
    plannedAdmissions,
    new Set(units.map((unit) => unit.id)),
    until,
    waitingMovements,
    admissions,
    patientsHoldingANamedBed([...openUnits.values()], admissions, [...movements, ...referrals]),
  );

  const kinds = KIND_ORDER.map((id): KindForecast => {
    const gap = gaps.find((row) => row.id === id)!;
    const ofKind = (release: BedRelease) =>
      bedKindOfBed(openUnits.get(release.unitId)!, admissionById.get(release.admissionId)) === id;
    const due = pending.filter((release) => expectedAt(release) <= until && ofKind(release));
    const clear = due.filter((release) => release.blocker === null);
    const onTime = clear.filter((release) => dayOf(expectedAt(release)) >= dayOf(now));
    const confirmed = onTime.filter((release) => release.state === "confirmed").length;
    const expected = onTime.filter((release) => release.state === "expected").length;
    const unflaggedPlans = admissions.filter((admission) => {
      const unit = openUnits.get(admission.unitId);
      return (
        unit !== undefined &&
        bedIsOccupied(admission) &&
        admission.expectedDischargeAt !== null &&
        admission.expectedDischargeAt <= until &&
        !flagged.has(admission.id) &&
        bedKindOfBed(unit, admission) === id
      );
    });
    const plannedNotFlagged = unflaggedPlans.length;
    const confirmationEligible = unflaggedPlans.filter(
      (admission) =>
        admission.state === "occupied" &&
        admission.blockReason === null &&
        dayOf(admission.expectedDischargeAt!) >= dayOf(now),
    ).length;
    const plannedAdmissionsOfKind = planned.filter((booking) => bedKindOfPlannedAdmission(booking) === id).length;
    const heldUp = due.length - clear.length;
    const overdue = clear.length - onTime.length;
    const beingMadeReady = gapsWithPreparing.find((row) => row.id === id)!.bedsThatFit - gap.bedsThatFit;
    const low = gap.gap + beingMadeReady + confirmed - plannedAdmissionsOfKind;
    const likely = low + expected;
    return {
      id,
      now: gap.gap,
      waiting: gap.waiting,
      bedsThatFit: gap.bedsThatFit,
      beingMadeReady,
      low,
      likely,
      high: likely + heldUp + overdue + plannedNotFlagged,
      confirmed,
      expected,
      heldUp,
      overdue,
      plannedNotFlagged,
      confirmationEligible,
      plannedAdmissions: plannedAdmissionsOfKind,
    };
  });

  const total = kinds.reduce(
    (sum, kind) => {
      const { id, ...figures } = kind;
      void id;
      for (const key of Object.keys(figures) as (keyof typeof figures)[]) sum[key] += figures[key] ?? 0;
      return sum;
    },
    {
      now: 0,
      waiting: 0,
      bedsThatFit: 0,
      beingMadeReady: 0,
      low: 0,
      likely: 0,
      high: 0,
      confirmed: 0,
      expected: 0,
      heldUp: 0,
      overdue: 0,
      plannedNotFlagged: 0,
      confirmationEligible: 0,
      plannedAdmissions: 0,
    },
  );
  // D-191 item 6 (Josh, 13 Nov 2026): "short" adds each bed type's shortfall and never subtracts a
  // spare bed of another type. Now, low, likely and high all follow it (`combinedKindGap`), so the
  // headline equals the sum of the per-type shortfalls printed beside it whenever any type is short.
  // The network forecast (`bedsForecast`) takes its low, likely and high from here, so Capacity's
  // Tomorrow, Home's beds gap card and this total stay one number (fixes thread, under D-196).
  // Every other figure is a plain count and still sums the types.
  total.now = combinedKindGap(kinds.map((kind) => kind.now));
  total.low = combinedKindGap(kinds.map((kind) => kind.low));
  total.likely = combinedKindGap(kinds.map((kind) => kind.likely));
  total.high = combinedKindGap(kinds.map((kind) => kind.high));
  return { hours: days * 24, until, kinds, total };
}

/**
 * The network range for each horizon, per bed type and combined by `combinedKindGap` (D-191 item 6),
 * for `bedsForecast`'s `byKind`. The gap tables are worked out once for every horizon.
 */
export function forecastTotalsByKind(
  units: readonly Unit[],
  releases: readonly BedRelease[],
  admissions: readonly Admission[],
  movements: readonly Movement[],
  now: Instant,
  plannedAdmissions: readonly PlannedAdmission[] = [],
  referrals: Parameters<typeof bedKindGaps>[4] = [],
): (days: number) => { low: number; likely: number; high: number } {
  const tables = forecastGapTables(units, releases, admissions, movements, now, referrals);
  return (days) =>
    forecastByKind(units, releases, admissions, movements, now, days, plannedAdmissions, referrals, tables).total;
}

/** "4 short", "3 spare that fit" or "even": one end of a range, in the mismatch table's words (WF-16). */
export function kindRangeWord(value: number): string {
  if (value < 0) return `${-value} short`;
  if (value > 0) return `${value} spare that fit`;
  return "even";
}
