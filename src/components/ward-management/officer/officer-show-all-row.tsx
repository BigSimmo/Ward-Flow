"use client";

import type { ReactNode } from "react";

import styles from "./officer.module.css";

/**
 * KIT STAND-IN for the one "Show more" row at a list's foot (Josh, 30 October 2026: one size per
 * control). Replace with the kit's `ShowMoreRow` from `@/components/wf` once it is exported, then
 * delete this file and `.showAllRow` in `officer.module.css`. The words stay the caller's.
 */
export function OfficerShowAllRow({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={styles.showAllRow} onClick={onClick} data-testid="ward-officer-show-all">
      {children}
    </button>
  );
}
