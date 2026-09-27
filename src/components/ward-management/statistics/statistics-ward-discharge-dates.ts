import type { Admission } from "../ward-admissions";
import { cannotBeFormed, measured, type StatisticsFigure } from "./statistics-absence";

/**
 * 🔴 **HOW MANY PATIENTS ON THIS WARD HAVE A DISCHARGE DATE WRITTEN DOWN — the buildable half of the
 * drawing's Discharge planning panel.**
 *
 * **What is NOT here, and why it is a hand-back rather than a gap.** The drawing's other half is a
 * table of **this month's** discharges against their recorded dates. The prototype persists no
 * history and the whole network holds five departed admissions, the oldest about 43 hours old, so a
 * month-scoped table would be true by construction and almost entirely nought. **That is D-4, it is
 * with the owner, and the codebase's own author already handed back the identical gap for the
 * occupancy chart.**
 *
 * ⚠️ **THE DRAWING'S FOURTH FACT IS DELIBERATELY ABSENT: *"Where a discharge went — not tracked
 * here"*.** That line was measured FALSE — `Admission.leavingDestination` is declared, carries eight
 * members including `discharged-to-the-community`, and the seed populates it on every departure.
 * 🔴 **Ruled: not reproduced, and not silently corrected either.** The drawing holds it as a defect;
 * the omission is recorded under §7.0(2).
 *
 * 🔴 **THE PARTITION IS THE PROPERTY THAT MATTERS, AND THIS FAMILY HAS THE OPPOSITE CASE NEXT DOOR.**
 * `dischargeDateOutcomes` (`ward-statistics.ts`) carries a doc comment warning that its three figures
 * are **not** a partition and must never be summed — met, missed and moved overlap. **These two ARE a
 * partition**: every admission counted is in exactly one bucket, they sum to the population, and a
 * test asserts it rather than a reader having to know which of the two neighbours they are looking at.
 */
export type DischargeDateCoverage = {
  /** Patients on this ward, not departed, carrying a readable expected discharge date. */
  readonly recorded: number;
  /** The rest of them. `recorded + notRecorded === population`, exactly. */
  readonly notRecorded: number;
  /** Everyone on this ward who has not departed, dated or not. */
  readonly population: number;
  /**
   * `recorded` as a percentage of `population`.
   *
   * ⚠️ **An empty ward has no denominator and that is an absence, not a nought** — `0 of 0` is
   * undefined. A ward with patients and no dates DOES have a share and it is a true nought. Same
   * distinction, same vocabulary and same one-decimal reasoning as the ready section's share; kept
   * by calling the same constructors rather than by a second rule that could drift.
   */
  readonly shareRecorded: StatisticsFigure;
};

/**
 * ⚠️ **`Number.isFinite`, NOT `!== null`, AND THE DIFFERENCE IS A PATIENT.** `NaN` is not `null`, so
 * the obvious predicate counts an unreadable date as a date written down — **reporting somebody as
 * planned for on the screen a coordinator opens to find who is not.** `wardStatistics` already guards
 * this exact field the same way; this matches it rather than inventing a second rule for one field.
 */
function hasReadableDate(admission: Admission): boolean {
  const expected = admission.expectedDischargeAt;
  return expected !== null && Number.isFinite(expected);
}

/** One decimal, for the reason given on `readyNotYetGone`'s own rounding helper: a whole percent
 *  renders a real patient as `0` once the ward is large enough. */
function toOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function dischargeDateCoverage(admissions: readonly Admission[], unitId: string): DischargeDateCoverage {
  // ⚠️ ONE FILTERED ARRAY, then both buckets counted from it — so the two cannot be taken over
  // different populations, which is the defect the ready section was repaired for.
  const onThisWard = admissions.filter((admission) => admission.unitId === unitId && admission.state !== "departed");
  const recorded = onThisWard.filter(hasReadableDate).length;
  const population = onThisWard.length;

  return {
    recorded,
    notRecorded: population - recorded,
    population,
    shareRecorded:
      population === 0
        ? cannotBeFormed("no patients on this ward to divide by")
        : measured(toOneDecimal((recorded * 100) / population)),
  };
}
