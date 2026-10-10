import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { LONG_WAIT_MINUTES, VERY_LONG_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * 🔴 **EVERY HEADLINE FIGURE ON THE ED STATISTICS SCREEN WAS COMPUTED INSIDE ITS OWN RENDER, AND
 * THAT IS WHY THIS MODULE EXISTS.** `onTheList`, `urgent`, `unplaced`, the elapsed waits, `over24h`,
 * `over48h` and `longestWait` were inline expressions in `statistics-ed-screen.tsx`. Of every figure
 * on that page, only the decline readout was a call to anything.
 *
 * ⚠️ **MATHS WITH NO MODULE TO CALL CAN ONLY BE TESTED THROUGH A RENDER**, and a render test
 * naturally asserts *"a number appears"* rather than *"the right number"*. 🔴 **The boundary cases in
 * this module's suite — a wait exactly ON twenty-four hours, one minute either side of it, an
 * `openedAt` sitting in the future — cannot be reached from the seed at all**, so before this
 * extraction nothing in the repository could state what happens at them. **That is the whole gain.
 * The arithmetic is unchanged.**
 *
 * 🔴 **AN EXTRACTION, NOT A REDESIGN.** Three things here look questionable and NONE is repaired:
 * the two wait figures overlap rather than partition, `longestWait` has no tie-break, and `unplaced`
 * is scoped to the open population only. **They are recorded and handed on rather than fixed in
 * transit — repairing behaviour inside a move is how a refactor becomes unreviewable.**
 *
 * ⚠️ **TWO POPULATIONS, AND SWAPPING THEM CHANGES CLINICAL FIGURES SILENTLY:**
 *
 *     departmentMovements      OPEN only — `originEdId` matches AND `isOpen`. Every waiting figure
 *                              derives from this. Somebody who has arrived drops out at once.
 *     allDepartmentMovements   EVERY movement ever attributed here, open or closed, with NO
 *                              `isOpen` filter. 🔴 A decline is a historical fact that stays true
 *                              after the movement it was made against reaches a bed — scoping
 *                              decline counts to the open population would erase precisely the
 *                              declines belonging to the movements this department eventually
 *                              placed, which is the opposite of the truth they exist to show.
 *
 * ⚠️ **NO ABSENCE ARM IS USED HERE, AND THAT IS DELIBERATE RATHER THAN AN OMISSION.** Every figure
 * below is a plain count or an elapsed value, and the screen renders each one unconditionally.
 * **Introducing an arm from `statistics-absence.ts` would invent a state the current behaviour does
 * not have.** The one figure that page genuinely withholds is the "not suitable" decline count,
 * which is not derived here.
 */

/** The two wait lines in hours, for labels ("Past 24h"), so no label types the defaults in. */
export const LONG_WAIT_HOURS = LONG_WAIT_MINUTES / 60;
export const VERY_LONG_WAIT_HOURS = VERY_LONG_WAIT_MINUTES / 60;

/** One movement paired with how long it has been open, floored at zero. */
export type EdWaitingEntry = {
  readonly movement: Movement;
  readonly waitMinutes: number;
};

export type EdWaitFigures = {
  /** OPEN population — the base for every waiting figure below. */
  readonly departmentMovements: readonly Movement[];
  /** Everyone with an open movement from this department right now. */
  readonly onTheList: number;
  /** Of the open population, those flagged urgent. */
  readonly urgent: number;
  /** Of the open population, those no ward has accepted yet. */
  readonly unplaced: number;
  /**
   * The open population paired with elapsed waits, longest first. Never a second definition of who
   * is waiting — this is the same list `onTheList` counts.
   */
  readonly waitingMovements: readonly EdWaitingEntry[];
  /**
   * Waiting at least twenty-four hours. ⚠️ **NOT exclusive of `over48h`:** anyone past forty-eight
   * hours is also past twenty-four and is counted in both. **These two do not partition the waiting
   * population and must never be summed.**
   */
  readonly over24h: number;
  /** Waiting at least forty-eight hours — a SUBSET of `over24h`, not a band above it. */
  readonly over48h: number;
  /** The longest-waiting entry, or `undefined` when nobody here has an open movement. */
  readonly longestWait: EdWaitingEntry | undefined;
  /** EVERY movement this department has ever originated, open or closed. See the module comment. */
  readonly allDepartmentMovements: readonly Movement[];
};

/**
 * `now` is a parameter and is never read from the wall clock, which is what keeps this deterministic
 * and lets a test place a movement exactly on a boundary.
 */
export function edWaitFigures(movements: readonly Movement[], edId: string, now: Instant): EdWaitFigures {
  const departmentMovements = movements.filter((movement) => movement.originEdId === edId && isOpen(movement));

  /*
   * `Math.max(..., 0)` reproduces the screen's own guard: a movement whose `openedAt` sits after
   * `now` would otherwise read as a NEGATIVE wait. ⚠️ It is reachable rather than theoretical —
   * ADVANCE_CLOCK can wind the prototype's clock backwards.
   */
  const waitingMovements = departmentMovements
    .map((movement) => ({ movement, waitMinutes: Math.max(now - movement.openedAt, 0) }))
    .sort((a, b) => b.waitMinutes - a.waitMinutes);

  return {
    departmentMovements,
    onTheList: departmentMovements.length,
    urgent: departmentMovements.filter((movement) => movement.flaggedUrgent).length,
    unplaced: departmentMovements.filter((movement) => movement.acceptedUnitId === undefined).length,
    waitingMovements,
    over24h: waitingMovements.filter((entry) => entry.waitMinutes >= LONG_WAIT_MINUTES).length,
    over48h: waitingMovements.filter((entry) => entry.waitMinutes >= VERY_LONG_WAIT_MINUTES).length,
    longestWait: waitingMovements[0],
    // Deliberately unfiltered by `isOpen` — see the module comment above for why.
    allDepartmentMovements: movements.filter((movement) => movement.originEdId === edId),
  };
}

/**
 * 🔴 **THE FIVE WAIT BANDS, AND THEY ARE A PARTITION — WHICH THE TWO FIGURES ABOVE ARE NOT.**
 *
 * `over24h` and `over48h` OVERLAP by construction and must never be summed. **These five do not
 * overlap and their counts DO sum to everyone waiting.** ⚠️ **Two figure sets with opposite
 * arithmetic in one module is exactly the shape that produced *"Of 1 with a date written down, 1
 * met, 0 missed and 11 moved"* on a live ward page**, so the difference is stated here and pinned by
 * a test rather than left for a reader to infer.
 *
 * 🔴 **THE LIST IS FIXED AND EVERY BAND IS RETURNED ON EVERY CALL, INCLUDING THE EMPTY ONES.** The
 * drawing's reasoning, and it is right: *"a band that vanishes when it is empty is a band a reader
 * cannot trust when it is not."* ⚠️ **A table that drops its empty rows teaches a reader that every
 * row shown is a row that matters** — so when a band finally fills, they cannot tell whether it just
 * appeared or had been sitting at nought all along.
 *
 * **Edges are lower-inclusive: a wait of exactly four hours is in *4 to 8 hours*, not *Under 4
 * hours*.** Both sides of all four boundaries are pinned.
 */
export const ED_WAIT_BANDS = [
  { label: "Under 4 hours", fromMinutes: 0 },
  { label: "4 to 8 hours", fromMinutes: 4 * 60 },
  { label: "8 to 12 hours", fromMinutes: 8 * 60 },
  { label: "12 to 24 hours", fromMinutes: 12 * 60 },
  { label: "Over 24 hours", fromMinutes: MINUTES_PER_DAY },
] as const;

export type EdWaitBand = {
  readonly label: string;
  /** How many of this department's open movements have waited at least `fromMinutes` and less than
   *  the next band's floor. A nought here is a measured answer, never a missing figure. */
  readonly count: number;
};

/**
 * Every band, in order, always. ⚠️ **Reads the same `waitingMovements` the headline figures use**
 * rather than re-deriving a second waiting list — a second definition of who is waiting is how two
 * figures on one screen come to disagree.
 */
export function edWaitBands(movements: readonly Movement[], edId: string, now: Instant): readonly EdWaitBand[] {
  const { waitingMovements } = edWaitFigures(movements, edId, now);

  return ED_WAIT_BANDS.map((band, index) => {
    const ceiling = ED_WAIT_BANDS[index + 1]?.fromMinutes ?? Number.POSITIVE_INFINITY;
    return {
      label: band.label,
      count: waitingMovements.filter((entry) => entry.waitMinutes >= band.fromMinutes && entry.waitMinutes < ceiling)
        .length,
    };
  });
}
