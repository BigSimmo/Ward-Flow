// src/components/ward-management/forecast/forecast-by-kind.ts
//
// Tomorrow and the day after for each bed type (forecasting build, Josh, 23 Oct 2026, screen 2).
// The same buckets as `bedsForecast`, counted per bed type so a coordinator can see which kind of
// bed will still be short, not only the network total.
//
// ⚠️ **COUNTED FROM RECORDS ONLY.** Beds ready now and people waiting come from `bedKindGaps`, the
// mismatch table's own function, so "now" here is the table's figure. Releases are sorted into a
// bed type by the ward's cohort and, on an adult ward, by the admission's recorded `bedKind`. A
// planned admission is sorted by its booked age band and, for an adult, by its legal status:
// detained under the Act needs a locked bed, anything else an open one. Nothing is predicted.
import { bedKindGaps, type BedKindId } from "@/components/ward-management/capacity/capacity-derivations";
import { plannedAdmissionsStillNeedingABed } from "@/components/ward-management/capacity/planned-admissions-reducer";
import { isDetainedUnderTheAct } from "@/components/ward-management/ed/ed-home-derivations";
import { bedIsOccupied, type Admission, type PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { dayOf, MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { BedRelease, Movement, Unit } from "@/components/ward-management/ward-model";

export type KindForecast = {
  id: BedKindId;
  /** The mismatch table's gap now: beds that fit minus people waiting. */
  now: number;
  /** The mismatch table's two halves of `now`. */
  waiting: number;
  bedsThatFit: number;
  low: number;
  likely: number;
  high: number;
  confirmed: number;
  expected: number;
  heldUp: number;
  overdue: number;
  plannedNotFlagged: number;
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

/** The bed type a ward's bed belongs to: its cohort, and for an adult ward the bed's designation. */
export function bedKindOfBed(unit: Unit, admission: Admission | undefined): BedKindId {
  if (unit.cohort === "Older adult") return "older_adult";
  if (unit.cohort === "Youth") return "youth";
  return admission?.bedKind === "locked" ? "locked_adult" : "open_adult";
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

export function forecastByKind(
  units: readonly Unit[],
  releases: readonly BedRelease[],
  admissions: readonly Admission[],
  movements: readonly Movement[],
  now: Instant,
  days: number,
  plannedAdmissions: readonly PlannedAdmission[] = [],
): ForecastByKind {
  const until = now + days * MINUTES_PER_DAY;
  const gaps = bedKindGaps([...movements], [...units], now, admissions);
  const openUnits = new Map(units.filter((unit) => !unit.isClosed).map((unit) => [unit.id, unit]));
  const admissionById = new Map(admissions.map((admission) => [admission.id, admission]));
  const pending = releases.filter((release) => release.state !== "discharged" && openUnits.has(release.unitId));
  const flagged = new Set(pending.map((release) => release.admissionId));
  const waitingMovements = movements.filter((movement) => isOpen(movement) && WAITING_STAGES.includes(movement.stage));
  const planned = plannedAdmissionsStillNeedingABed(
    plannedAdmissions,
    new Set(units.map((unit) => unit.id)),
    until,
    waitingMovements,
  );

  const kinds = KIND_ORDER.map((id): KindForecast => {
    const gap = gaps.find((row) => row.id === id)!;
    const ofKind = (release: BedRelease) =>
      bedKindOfBed(openUnits.get(release.unitId)!, admissionById.get(release.admissionId)) === id;
    const due = pending.filter((release) => release.expectedAt <= until && ofKind(release));
    const clear = due.filter((release) => release.blocker === null);
    const onTime = clear.filter((release) => dayOf(release.expectedAt) >= dayOf(now));
    const confirmed = onTime.filter((release) => release.state === "confirmed").length;
    const expected = onTime.filter((release) => release.state === "expected").length;
    const plannedNotFlagged = admissions.filter((admission) => {
      const unit = openUnits.get(admission.unitId);
      return (
        unit !== undefined &&
        bedIsOccupied(admission) &&
        admission.expectedDischargeAt !== null &&
        admission.expectedDischargeAt <= until &&
        !flagged.has(admission.id) &&
        bedKindOfBed(unit, admission) === id
      );
    }).length;
    const plannedAdmissionsOfKind = planned.filter((booking) => bedKindOfPlannedAdmission(booking) === id).length;
    const heldUp = due.length - clear.length;
    const overdue = clear.length - onTime.length;
    const low = gap.gap + confirmed - plannedAdmissionsOfKind;
    const likely = low + expected;
    return {
      id,
      now: gap.gap,
      waiting: gap.waiting,
      bedsThatFit: gap.bedsThatFit,
      low,
      likely,
      high: likely + heldUp + overdue + plannedNotFlagged,
      confirmed,
      expected,
      heldUp,
      overdue,
      plannedNotFlagged,
      plannedAdmissions: plannedAdmissionsOfKind,
    };
  });

  const total = kinds.reduce(
    (sum, kind) => {
      const { id, ...figures } = kind;
      void id;
      for (const key of Object.keys(figures) as (keyof typeof figures)[]) sum[key] += figures[key];
      return sum;
    },
    {
      now: 0,
      waiting: 0,
      bedsThatFit: 0,
      low: 0,
      likely: 0,
      high: 0,
      confirmed: 0,
      expected: 0,
      heldUp: 0,
      overdue: 0,
      plannedNotFlagged: 0,
      plannedAdmissions: 0,
    },
  );
  return { hours: days * 24, until, kinds, total };
}

/** "4 short", "3 spare" or "even": one end of a range, in the mismatch table's words. */
export function kindRangeWord(value: number): string {
  if (value < 0) return `${-value} short`;
  if (value > 0) return `${value} spare`;
  return "even";
}

export function signedFigure(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}
