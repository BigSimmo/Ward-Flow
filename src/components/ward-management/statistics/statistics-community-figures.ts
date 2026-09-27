import type { CommunityMembershipResolution } from "../community/community-derivations";
import type { Admission } from "../ward-admissions";

import { measured, unlinkable, type StatisticsFigure } from "./statistics-absence";

/**
 * 🔴 **WHEN THE JOIN CANNOT RUN, THESE FOUR FIGURES ARE NOT NOUGHTS.**
 *
 * The screen used to render `{lists.currentlyAdmitted.length}` in a cell with no gate on the
 * resolution state, while the paragraph four lines below called a zero there *"a confident answer
 * over a question that was never asked"*.
 *
 * **The zero was provable rather than possible.** `communityMembershipResolution` returns `members`
 * early when the team has any, so `not-computable` implies the team's set is empty — and all four
 * figures are that set or a subset of it. **Whenever the refusal rendered, all four cells read `0`.**
 *
 * ⚠️ **And the paragraph could not save them.** It sits below the table in reading order and is
 * attached to nothing: a screen reader stepping cell by cell, a table scan, or a copied row meets
 * the figure and never reaches the sentence. **The refusal named the figure it distrusted and the
 * figure rendered anyway.**
 *
 * ✅ **The paragraph is kept.** It carries the COUNT of unresolvable records and the reason, which a
 * cell cannot. It stops being the only place the state is stated; it does not stop being useful.
 */

/** The four figures of *This team, in figures*, each carrying its own state. */
export type CommunityFigures = {
  readonly admitted: StatisticsFigure;
  readonly expected: StatisticsFigure;
  readonly discharged: StatisticsFigure;
  readonly other: StatisticsFigure;
};

/**
 * ⚠️ **The wording names what was looked for, rather than reporting an amount.**
 *
 * O-13.1 rules that a checked-empty screen says what it searched — *"No teams found in this area"*
 * rather than a bare *"none"* — because **a sentence that names what was looked for cannot be
 * mistaken for a count somebody reported**. The same reasoning binds harder here: this is not even a
 * checked-empty, it is a search that could not be run.
 */
const NOT_LINKED = "not linked to this team";

/**
 * ⚠️ **All four move together, and that is a property of the data rather than a convenience.**
 * `not-computable` is reached only when the team's set is empty, and every figure below is that set
 * or a subset of it — so there is no state in which one of them is measurable and another is not.
 * **Returning three noughts and one absence would be inventing a distinction the model cannot make.**
 */
/**
 * ⚠️ **The lists are taken as READONLY arrays rather than as `Pick<CommunityHubLists, …>`, and that
 * is a correctness choice rather than a convenience.**
 *
 * `CommunityHubLists` declares mutable `Admission[]`, so a `Pick` of it **rejects a readonly array**
 * — which is what a test builds when it writes its fixture `as const`. 🔴 **The first version of this
 * signature did exactly that, and the failure surfaced only in `tsc`: vitest does not typecheck, so
 * a green suite said nothing about it.** **This function reads four lengths and mutates nothing, so
 * demanding mutable arrays was asking callers for a guarantee it never needed.**
 */
type ReadonlyCommunityLists = {
  readonly currentlyAdmitted: readonly Admission[];
  readonly expectedBack: readonly Admission[];
  readonly dischargedIntoTheArea: readonly Admission[];
  readonly otherDepartures: readonly Admission[];
};

export function communityFigures(
  lists: ReadonlyCommunityLists,
  resolution: CommunityMembershipResolution,
): CommunityFigures {
  if (resolution.state === "not-computable") {
    return {
      admitted: unlinkable(NOT_LINKED),
      expected: unlinkable(NOT_LINKED),
      discharged: unlinkable(NOT_LINKED),
      other: unlinkable(NOT_LINKED),
    };
  }

  return {
    admitted: measured(lists.currentlyAdmitted.length),
    expected: measured(lists.expectedBack.length),
    discharged: measured(lists.dischargedIntoTheArea.length),
    other: measured(lists.otherDepartures.length),
  };
}
