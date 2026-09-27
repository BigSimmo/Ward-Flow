import type { Admission } from "../ward-admissions";
import { cannotBeFormed, measured, type StatisticsFigure } from "./statistics-absence";
import { blockedDischargesByReason, type BlockedDischargeReasonTally } from "./statistics-derivations";

/**
 * 🔴 **"CLINICALLY READY, NOT YET GONE" — ONE POPULATION, ONE PASS, THREE FIGURES.**
 *
 * **What was already here, and why a heading was not the missing piece.** The ward statistics screen
 * renders both halves of this section today, three headings apart: `readyToLeaveCannot`
 * (`ward-statistics.ts`) as a bare count under *"Ready to leave, and blocked"*, and
 * `blockedDischargesByReason` (`statistics-derivations.ts`) as the per-reason table under *"Blocked
 * discharges, by blocker"*. **A reader sees a number, then a table that should sum to it.**
 *
 * ⚠️ **THE TWO FIGURES COME FROM TWO INDEPENDENTLY MAINTAINED FILTERS, AND NOTHING TIES THEM.**
 * `readyToLeaveCannot` counts over `admissionsForUnit`, whose exclusion is `state !== "departed"`.
 * `blockedDischargesByReason` excludes `admissionStagePosition(admission) === "ended"`. Today those
 * two expressions select exactly the same records, because `"ended"` is returned for `"departed"`
 * and for nothing else — **so they agree by a coincidence, not by construction.**
 *
 * 🔴 **And the change that breaks it is already written down as expected.** The claims register in
 * this folder pins *"a fifth admission state arrives"* as a falsifying edit. Map such a state to
 * `"ended"` and the headline counts it while the table does not: a number sitting above a table that
 * sums to something else, with every gate in this repository green. **This is the two-place pattern
 * the provenance brief is about, in arithmetic rather than in prose.**
 *
 * ✅ **So the headline, the denominator and the rows here are all read off ONE call over ONE
 * filtered array.** They cannot disagree, because there is only one of them.
 *
 * 🔴 **WHAT IS NOT BUILT HERE, DELIBERATELY.** The approved drawing's example data names three
 * reasons, and its largest — *"Funding or plan decision pending"* — is a concept
 * `BED_RELEASE_BLOCKERS` refuses on a recorded decision: *"Guardianship and financial arrangements
 * stay excluded ... Adding any further entry remains a recorded product decision, never an
 * implementer's convenience."* **This module reports the eight blockers the model holds. Widening
 * the vocabulary to match a drawing is precisely the convenience that comment forbids, and it is a
 * hand-back to the owner rather than a build decision.**
 */
export type ReadyNotYetGone = {
  /** One row per member of `BED_RELEASE_BLOCKERS`, in the vocabulary's own order, noughts included. */
  readonly tallies: readonly BlockedDischargeReasonTally[];
  /** The headline: patients on this ward, not departed, carrying a recorded blocker. Sums the rows exactly. */
  readonly total: number;
  /** The denominator: everyone on this ward who has not departed, blocked or not. */
  readonly population: number;
  /** How many blockers the vocabulary holds, measured from the list rather than typed. */
  readonly vocabularySize: number;
  /**
   * `total` as a percentage of `population`.
   *
   * ⚠️ **An empty ward has no denominator, and that is an absence rather than a nought** — `0 of 0`
   * is undefined. A ward with patients and no blockers DOES have a share and it is a true nought.
   * **Collapsing those two would destroy the distinction this family exists to keep**, which is why
   * the return is a `StatisticsFigure` and not a `number | null`.
   */
  readonly shareOfWard: StatisticsFigure;
};

/**
 * ⚠️ **ONE DECIMAL PLACE, AND THE REASON IS A DEFECT RATHER THAN A PREFERENCE.** Rounded to whole
 * percent, a single blocked discharge on a large enough ward renders as `0` — **a measured nought
 * standing for a real patient**, which is the exact failure this family was built to prevent. One
 * decimal moves that threshold past two thousand beds; the largest unit in this prototype is a small
 * fraction of that, and the test suite pins the bound rather than trusting the sentence.
 *
 * Written locally rather than exported from `ward-statistics.ts`, where the equivalent helper is
 * module-private: widening another lane's shared file to save four lines is not a trade worth making.
 */
function toOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The section, for one ward.
 *
 * ⚠️ **Filtering by unit happens HERE and once**, then the whole result is derived from that single
 * array — the same scoping discipline `wardStatistics` applies, rather than asking the shared
 * derivation to learn about units.
 */
export function readyNotYetGone(admissions: readonly Admission[], unitId: string): ReadyNotYetGone {
  const onThisWard = admissions.filter((admission) => admission.unitId === unitId);
  const blocked = blockedDischargesByReason(onThisWard);

  return {
    tallies: blocked.tallies,
    total: blocked.totalCount,
    population: blocked.admissionCount,
    vocabularySize: blocked.vocabularySize,
    shareOfWard:
      blocked.admissionCount === 0
        ? cannotBeFormed("no patients on this ward to divide by")
        : measured(toOneDecimal((blocked.totalCount * 100) / blocked.admissionCount)),
  };
}
