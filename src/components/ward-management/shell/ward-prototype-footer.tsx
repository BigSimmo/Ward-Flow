"use client";

import type { CSSProperties, ReactNode } from "react";
import { useWardSharedSave } from "./ward-shared-save-context";
import styles from "./ward-prototype-footer.module.css";

export interface WardPrototypeFooterProps {
  testId?: string;
  note?: ReactNode;
  extra?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

const PROTOTYPE_BADGE = (
  <span
    className={styles.prototypeBadge}
    data-ward-type-floor="badge"
    title="Synthetic clinical demonstration prototype · Not connected to live EHR"
  >
    <span className={styles.pulseDot} aria-hidden="true" />
    Synthetic prototype
  </span>
);
/**
 * The clock the board runs on, from the mode (root-cause fix 2.3, approved by Josh 13 Nov 2026). The
 * public demo runs a scripted board clock; the signed-in site runs on real Perth time (D-150). The
 * footer used to say "Demo board clock · scenario set on 15 Aug 2026" everywhere, from a fixed label,
 * so it named a date the board no longer shows and claimed a demo clock on the signed-in site too.
 * The signed-in site is the one that provides the shared save context.
 */
function footerClockWords(signedIn: boolean): string {
  return signedIn ? "Real Perth time" : "Demo board clock";
}

const phoneTail = (clock: string) => (
  <span className={styles.phoneTail}>
    <span>{clock} ·</span> <span>invented records ·</span> <span>not for clinical use</span>
  </span>
);
export function WardPrototypeFooter({ testId, note, extra, style, className }: WardPrototypeFooterProps) {
  const clock = footerClockWords(useWardSharedSave() !== null);
  return (
    <footer
      className={`${styles.footer}${className ? ` ${className}` : ""}`}
      data-testid={testId ?? "ward-prototype-footer"}
      aria-label="Prototype disclosure"
      style={style}
    >
      <div className={styles.leftGroup}>
        {PROTOTYPE_BADGE}
        {/* Phone (v10): the footer is one quiet line, the badge then this tail; the note below is
            kept for screen readers. Hidden above phone. */}
        {phoneTail(clock)}
        {/* Audit three #49 (Josh, 28 Nov 2026): one visible synthetic-data statement (D-218), not a
            chip and a pill; the clock it runs on balances it at the right end. */}
        <span className={styles.footerNote} data-ward-type-floor="banner">
          {note ?? "Synthetic data only · Not approved for clinical use"}
        </span>
      </div>
      <div className={styles.rightGroup}>
        {extra}
        <span className={styles.footerClock}>{clock}</span>
      </div>
    </footer>
  );
}
