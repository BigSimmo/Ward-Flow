"use client";

import type { ReactNode } from "react";

import styles from "./show-more-row.module.css";

/**
 * The kit's one "Show more" control (Josh, 30 October 2026: one size per control): a full-width row
 * at a list's foot, centred 600 text with a line above, 40px (on a phone a cover below adds the 48px tap area). The words stay the
 * caller's ("Show 6 more", "Show all (70)", "Show fewer"); `expanded` is the list's open state when
 * the row toggles it, and `controls` names the list it opens.
 */
export function ShowMoreRow({
  onClick,
  expanded,
  controls,
  children,
}: {
  onClick: () => void;
  expanded?: boolean;
  controls?: string;
  children: ReactNode;
}) {
  return (
    <button type="button" className={styles.row} onClick={onClick} aria-expanded={expanded} aria-controls={controls}>
      {children}
    </button>
  );
}
