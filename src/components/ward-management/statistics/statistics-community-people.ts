import { belowMinimum, type StatisticsFigure } from "./statistics-absence";

/**
 * 🔴 **O-14 — THE PER-PERSON HOSPITAL-BED LIST IS SUPPRESSED ON D-38's OWN THRESHOLD, AND REPLACED
 * RATHER THAN SHORTENED.**
 *
 * **D-38 ruled on a COUNT:** a team with four open cases showing "1" names that person to anyone who
 * knows the caseload, so below a threshold the figure is withheld and the screen says so.
 * **The drawing does not show a count. It shows a per-person list** — four rows, each carrying a
 * ward, a site and a day count.
 *
 * ⚠️ **A list of four is strictly more identifying than the number 4:** it adds which ward, which
 * site, and how long. **If a count of one identifies, a row certainly does.**
 *
 * 🔴 **And the obvious implementation is the wrong one. A list that SHORTENS as the team gets
 * smaller identifies HARDEST exactly where D-38 says the risk is greatest** — a one-row list on a
 * four-patient team names that person completely. **So below the threshold the list is REPLACED,
 * never truncated, never paginated, never a "top 3".**
 *
 * **How this file enforces that, and why it is a type rather than a guard.** ⚠️ **A guard asserting
 * "the list is absent below the threshold" can be satisfied by a caller that slices the array before
 * handing it over — the guard sees a short list and a true predicate.** ✅ **The suppressed arm below
 * carries NO `rows` property at all, so a shortened list is not a constructible state.** **The same
 * shape as `statistics-absence.ts`, where only the measured arm carries a value: the defect is made
 * unspellable rather than tested against.**
 */

/** One person in a bed, as the drawing shows them: a reference standing for a person, never a record number. */
export type PersonInBed = {
  readonly reference: string;
  readonly ward: string;
  readonly site: string;
  readonly days: number;
};

/**
 * 🔴 **THE SUPPRESSED ARM HAS NO `rows`. That absence is the whole mechanism.**
 * There is nothing to slice, nothing to paginate, and no "first three" to take.
 */
export type PeopleInBeds =
  | { readonly kind: "shown"; readonly rows: readonly PersonInBed[] }
  | { readonly kind: "suppressed"; readonly figure: StatisticsFigure };

/**
 * ⚠️ **A NAMED CONSTANT BESIDE ITS CITATION, NEVER A LITERAL AT THE CALL SITE.**
 *
 * **Owner, 2026-09-11, D-38 and O-14: the threshold is five** — the same number already set for
 * `MINIMUM_EFFECTIVENESS_SAMPLE` (`ward-derivations.ts:1658`), which is why the question was put to
 * him as "set a second number of the same kind" rather than as a fresh policy.
 *
 * 🔴 **A privacy threshold hard-coded where it is used is a number nobody can find when it needs
 * changing.**
 */
export const MINIMUM_PUBLISHABLE_SAMPLE = 5;

/**
 * ⚠️ **The denominator travels with the suppression**, exactly as D-38 requires of the count:
 * `ward-management-modes.tsx:235` renders *"from 1 of 27"* beside its own, *"which is what makes the
 * absence informative rather than merely blank"*. 🔴 **Without it a team cannot tell a WITHHELD list
 * from a BROKEN one.**
 *
 * ⚠️ **An EMPTY list is suppressed too, and that is deliberate rather than an accident of the
 * comparison.** *"Nobody from this team is in a bed"* is itself a disclosure about a small team, and
 * the suppression sentence — the figure is too thin to publish — is as true of nought as of one.
 */
export function peopleInBeds(rows: readonly PersonInBed[], teamCaseload: number): PeopleInBeds {
  if (rows.length < MINIMUM_PUBLISHABLE_SAMPLE) {
    return {
      kind: "suppressed",
      figure: belowMinimum("Not enough data to compute", `from ${rows.length} of ${teamCaseload}`),
    };
  }
  return { kind: "shown", rows };
}
