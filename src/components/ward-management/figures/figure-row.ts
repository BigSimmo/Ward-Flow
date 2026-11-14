/**
 * THE FIGURE DICTIONARY — one row per published figure (R-FIGS-9, approved "after the demo"; figures
 * spec 14 Nov 2026, D-220). A row says what the figure is called, the one rule it counts by, its
 * window and where that window starts (`figure-windows.ts`), who it counts, whose figure it is, the
 * one function that works it out, and how it is counted.
 *
 * Wording rule (Josh, 14 Nov 2026: words stay only if they help someone act or prevent an error):
 * a row has no visible note line under its figure. Its `how` lines open only on request, from a
 * small tap-to-open ⓘ (never hover-only) or the existing `HowWorkedOut` fold; its scope is one word
 * beside the figure (`figure-scope-words.ts`).
 *
 * A row REFERENCES the function in its existing home module; it never restates the arithmetic. The
 * rows are grouped by domain (`beds-figures.ts`, `ed-figures.ts`, `discharge-figures.ts`,
 * `alert-figures.ts`) so a route only loads the derivations it already loads. `all-figures.ts`
 * gathers every row for the tests and the doc check only; nothing on a screen imports it.
 *
 * Phase 1 (this file and its rows): the dictionary exists and is tested. No screen reads it yet.
 * Phase 2 wires the screens, the rail counts and the "How this is counted" line to the rows.
 *
 * Pure: types and one identity helper, no derivation imports.
 */
import type { CountWindow } from "@/components/wf/primitives";
import type { WardNavId, WardMode } from "@/components/ward-management/ward-nav";
import type { WardAccessScope } from "@/components/ward-management/ward-role-access";
import type { StatisticsWindowId } from "@/components/ward-management/figures/figure-windows";

/** Every figure the dictionary holds. A new published figure gets an id here and a row. */
type FigureId =
  // Beds
  | "beds-in-use"
  | "occupancy"
  | "at-or-over-line"
  | "ready-now"
  | "ready-on-ward"
  | "need-a-bed"
  | "short"
  | "no-ward-yet"
  // Emergency departments
  | "waiting-in-ed"
  | "ed-journeys-open"
  | "in-transit"
  | "ed-over-8h"
  | "ed-over-24h"
  | "median-ed-wait"
  // Discharges
  | "held-up"
  | "held-up-any-date"
  | "left-today"
  | "expected-to-leave-today"
  | "average-completed-stay"
  | "stay-so-far"
  // Alerts and decisions
  | "act-now"
  | "needs-you"
  | "open-alerts"
  | "referrals-awaiting"
  | "team-referrals-to-answer";

/**
 * Whose figure it is, which decides the scope word beside it (R-FIGS-11, R-BEDS-5;
 * `figure-scope-words.ts`). "desk" follows the signed-in desk's own scope; "network" is always the
 * whole network; "ward", "ed" and "team" name one place; "service" follows the chosen health
 * service; "patient" is about one person and carries no scope word.
 */
export type FigureScopeKind = "network" | "desk" | "ward" | "ed" | "service" | "team" | "patient";

/**
 * How far the row is built.
 * - "built": `compute` is the one function, in its home module, today.
 * - "wraps-pr-a": `compute` exists today; PR A aligns its callers or adds the helper the row will
 *   finally read (the ready hold list, the one occupancy tone). The row wraps PR A's function and
 *   never reimplements it.
 * - "reserved": PR A builds the function (R-FIGS-12, R-FIGS-16). The row holds the name and rule;
 *   `compute` is `null` until PR A lands.
 */
type FigureStatus = "built" | "wraps-pr-a" | "reserved";

/** A rail badge that shows this figure: the badge key, and the desk kind when only one desk shows it. */
type FigureRail = {
  readonly id: WardMode | WardNavId;
  readonly desk?: WardAccessScope["kind"];
};

type AnyCompute = (...args: never[]) => unknown;

export type FigureRow<F extends AnyCompute = AnyCompute> = {
  readonly id: FigureId;
  /** The on-screen label, from `docs/ward-flow/word-list.md`. */
  readonly name: string;
  /** One sentence: the counting rule, for the "How this is counted" fold and the doc. */
  readonly rule: string;
  /** The kit's own window word (`CountWindow`, `wf/primitives.tsx`). */
  readonly window: CountWindow;
  /** The window's row in `figure-windows.ts`: where it starts and ends, on the Perth clock. */
  readonly windowId: StatisticsWindowId;
  /** Who is counted. */
  readonly population: string;
  readonly scope: FigureScopeKind;
  readonly status: FigureStatus;
  /** THE one function, imported from its home module. `null` only on a reserved row. */
  readonly compute: F | null;
  /** Where `compute` lives: "`functionName` (`path from ward-management/`)". */
  readonly home: string;
  /** The lines a tap-to-open ⓘ or the `HowWorkedOut` fold shows; never a visible line of its own. */
  readonly how: readonly string[];
  /** The ruling or finding the rule rests on. */
  readonly basis: string;
  readonly rail?: FigureRail;
};

/** Keeps a row's `compute` type for its callers while checking the row's shape. */
export function defineFigure<F extends AnyCompute>(row: FigureRow<F>): FigureRow<F> {
  return row;
}
