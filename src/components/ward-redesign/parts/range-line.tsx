import styles from "./parts.module.css";

/** "6 short" or "3 spare", from a gap where negative is short. */
export function gapWords(gap: number): string {
  if (gap === 0) return "exactly enough";
  return gap < 0 ? `${-gap} short` : `${gap} spare`;
}

/**
 * The likely figure on a number line from `-span` (short) to `+span` (spare), with the low-to-high
 * range as a band and zero marked. Values are gaps: negative is short. Decorative: the caller
 * writes the same range in words beside it, so the drawing itself is hidden from screen readers.
 */
export function RangeLine({ low, likely, high, span }: { low: number; likely: number; high: number; span: number }) {
  const at = (value: number) => `${((Math.max(-span, Math.min(span, value)) + span) / (span * 2)) * 100}%`;
  const from = Math.min(low, high);
  const to = Math.max(low, high);
  return (
    <span className={styles.range} aria-hidden="true">
      <span className={styles.rangeTrack} />
      <span className={styles.rangeBand} style={{ left: at(from), width: `calc(${at(to)} - ${at(from)})` }} />
      <span className={styles.rangeZero} style={{ left: at(0) }} />
      <span className={styles.rangePoint} style={{ left: at(likely) }} />
    </span>
  );
}
