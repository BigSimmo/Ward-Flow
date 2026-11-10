/**
 * TAP A NUMBER TO SEE WHO IS IN IT (feature plan item 5, Batch 5).
 *
 * Pure: no React, no browser API. A figure that opens a breakdown hands over the very list its
 * number was counted from (D-115 "one count everywhere"); nothing here filters or recounts it. The
 * panel lists each row and checks that the rows add up to the figure before it shows any of them.
 *
 * Rules kept:
 * - Scope: the rows come from the desk's own workspace (`scopeWorkspace`, applied by the provider),
 *   because they are the figure's own list. Nothing here reaches past what the figure counted.
 * - Small numbers: in an aggregate view (`scope: "aggregate"`: Statistics, the executive Capacity
 *   view) a count of people at or above 1 and under `CLINICAL_VALUES.smallNumberHidden` shows no
 *   list, only "fewer than N", as `smallNumberText` words the figure itself. A desk's own ward,
 *   team or ED (`scope: "own"`) is the desk's own work and always lists. Beds are never people, so
 *   a bed count always lists (as `smallNumberText`'s own note says: beds stay exact).
 * - Not on the wall TV: the TV screens never import this module (guard test).
 */
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";

/** One line in a breakdown: a person, a movement or a ward. */
export type BreakdownRow = {
  id: string;
  /** The person's full name (D-83), or a ward's name. */
  label: string;
  /** One short line under the label: where, or since when. */
  detail?: string;
  /** The record this row opens. Left out when the desk cannot open it. */
  href?: string;
  /** How many of the figure this row holds (a ward's ready beds). One when left out. */
  count?: number;
};

/** What a figure counts, in the panel's words. */
export type BreakdownKind = "people" | "beds";

/** `own`: the desk's own ward, team, ED or network. `aggregate`: a statistics or executive view. */
export type BreakdownScope = "own" | "aggregate";

/** How many of the figure the rows hold together. */
export function breakdownTotal(rows: readonly BreakdownRow[]): number {
  return rows.reduce((sum, row) => sum + (row.count ?? 1), 0);
}

/**
 * True when the list must stay hidden: a count of people under the small number line in an
 * aggregate view. Zero is not hidden (there is nobody to name).
 */
export function breakdownWithheld(kind: BreakdownKind, scope: BreakdownScope, value: number): boolean {
  if (kind !== "people" || scope !== "aggregate") return false;
  return value > 0 && value < CLINICAL_VALUES.smallNumberHidden.value;
}

/** The figure's accessible name as a button: "6 waiting in ED, show who" (beds: "show where"). */
export function breakdownButtonName(value: number, noun: string, kind: BreakdownKind): string {
  return `${value} ${noun}, ${kind === "beds" ? "show where" : "show who"}`;
}

/** The panel's first line: "6 open ED movements. Counted 14:32." */
export function breakdownSentence(value: number, noun: string, countedAt: Instant): string {
  return `${value} ${noun}. Counted ${formatInstant(countedAt)}.`;
}

export type BreakdownView =
  | { state: "list"; rows: readonly BreakdownRow[] }
  | { state: "none" }
  | { state: "withheld"; words: string }
  | { state: "mismatch" };

/**
 * What the panel shows for a figure. A list that does not add up to the figure is never shown: the
 * panel says so instead, so the list and the number can never disagree on screen.
 */
export function breakdownView(input: {
  value: number;
  kind: BreakdownKind;
  scope: BreakdownScope;
  rows: readonly BreakdownRow[];
}): BreakdownView {
  const { value, kind, scope, rows } = input;
  if (breakdownWithheld(kind, scope, value)) {
    return {
      state: "withheld",
      words: `Fewer than ${CLINICAL_VALUES.smallNumberHidden.value}. Names are not listed in this view.`,
    };
  }
  if (breakdownTotal(rows) !== value) return { state: "mismatch" };
  if (value === 0) return { state: "none" };
  return { state: "list", rows };
}
