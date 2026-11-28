"use client";

import type { ReactNode } from "react";

import styles from "./show-more-row.module.css";

/**
 * The kit's one "Show more" control (Josh, 30 October 2026: one size per control): a full-width row
 * at a list's foot, centred 600 text with a line above, 40px (on a phone a cover below adds the 48px tap area). It builds
 * its own words from `total` ("Show all 12", "Show fewer", audit two #79); `expanded` is the list's open state when
 * the row toggles it, and `controls` names the list it opens.
 */
/** Josh, 31 October 2026 (answer 21): a list folds only when at least two rows would be hidden. */
export const SHOW_MORE_MIN_HIDDEN = 2;

/**
 * How many rows a folded list shows. The row cannot see the list, so a caller passes its total and
 * its usual limit and slices to the answer: when folding would hide fewer than two rows, the whole
 * list shows and no Show more row is drawn, so there is never a "Show 1 more" (a tap to reveal one
 * row). Use it with `foldHidden` to decide whether to draw the row at all.
 */
export function foldLimit(total: number, limit: number): number {
  return total - limit < SHOW_MORE_MIN_HIDDEN ? total : Math.max(0, limit);
}

/** Rows a folded list hides; 0 means draw no Show more row. */
export function foldHidden(total: number, limit: number): number {
  return Math.max(0, total - foldLimit(total, limit));
}

/**
 * Audit two #79 (K41): the fold's own words, so every list says the same thing. Folded: "Show all N"
 * (N is the whole list, `total`); open: "Show fewer". Without a total: "Show more".
 */
function showMoreWords(expanded: boolean | undefined, total?: number): string {
  if (expanded) return "Show fewer";
  return total === undefined ? "Show more" : `Show all ${total}`;
}

export function ShowMoreRow({
  onClick,
  expanded,
  controls,
  total,
  children,
}: {
  onClick: () => void;
  expanded?: boolean;
  controls?: string;
  /** The whole list's length. With no `children` the row builds its words from it (`showMoreWords`). */
  total?: number;
  /** Words of the caller's own; leave out to use the kit's "Show all N" and "Show fewer". */
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      data-wf-show-more=""
      className={styles.row}
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls={controls}
    >
      {children ?? showMoreWords(expanded, total)}
    </button>
  );
}
