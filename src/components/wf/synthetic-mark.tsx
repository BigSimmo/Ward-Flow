import { cx } from "./cx";
import styles from "./synthetic-mark.module.css";

/** What the mark says in full, on hover and to a screen reader. */
const SYNTHETIC_MARK_FULL = "Synthetic data, not a medical record";

/**
 * Shared design parts item 7 (Josh, 13 Nov 2026; F-39): the one synthetic-data tag for every
 * full-screen or enlarged view, the loading placeholder and anywhere else the page footer cannot be
 * seen. "Synthetic data" on screen, the full words on hover and for screen readers. No hooks, so a
 * server-drawn placeholder can use it without adding client code.
 */
export function SyntheticMark({ className }: { className?: string }) {
  return (
    <span className={cx(styles.mark, className)} title={SYNTHETIC_MARK_FULL} data-wf-synthetic-mark="">
      <span aria-hidden="true">Synthetic data</span>
      <span className={styles.srOnly}>{SYNTHETIC_MARK_FULL}</span>
    </span>
  );
}
