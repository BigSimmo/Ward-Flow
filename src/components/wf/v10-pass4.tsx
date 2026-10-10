import { cx } from "./cx";
import styles from "./v10-pass4.module.css";

/*
 * Design system v10 shared parts, pass 4 (10 Oct 2026): RowSpark and DeltaTwin, moved here from
 * the All EDs and Out of area pages. Neutral ink, mono tabular figures, 12px floor, dim by colour.
 */

/* ── RowSpark / RowTrend ──────────────────────────────────────────────────────────────────── */

/**
 * RowSpark: a short trend line with the series' own mean dashed and a dot on the latest point.
 * Values come from the record (the caller derives them), never an invented series. `name` and
 * `window` build the accessible name: "{name}, {window}: 1, 2, 3, up 2".
 */
export function RowSpark({
  values,
  name,
  window = "waiting over 12 hours",
  big = false,
  className,
  testId = "wf-row-spark",
}: {
  values: readonly number[];
  /** What the series belongs to, for the accessible name. */
  name: string;
  /** What the series measures, for the accessible name. */
  window?: string;
  big?: boolean;
  className?: string;
  testId?: string;
}) {
  if (values.length < 2) return null;
  const width = big ? 160 : 56;
  const height = 20;
  const max = Math.max(4, ...values);
  const y = (value: number) => 18 - (value / max) * 16;
  const x = (index: number) => 2 + (index * (width - 6)) / (values.length - 1);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const last = values.length - 1;
  return (
    <svg
      className={cx(styles.spark, big && styles.big, className)}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`${name}, ${window}: ${values.join(", ")}, ${trendWords(values)}`}
      focusable="false"
      data-testid={testId}
    >
      <line className={styles.mean} x1={0} x2={width} y1={y(mean).toFixed(1)} y2={y(mean).toFixed(1)} />
      <polyline
        className={styles.line}
        points={values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ")}
      />
      <circle className={styles.dot} cx={x(last).toFixed(1)} cy={y(values[last]).toFixed(1)} r={2.5} />
    </svg>
  );
}

/** "+4", "−2" or "±0": the change from the first value to the last. */
export function trendDelta(values: readonly number[]): string {
  if (values.length < 2) return "±0";
  const change = values[values.length - 1] - values[0];
  return change === 0 ? "±0" : change > 0 ? `+${change}` : `−${-change}`;
}

function trendWords(values: readonly number[]): string {
  const change = values[values.length - 1] - values[0];
  return change === 0 ? "level" : change > 0 ? `up ${change}` : `down ${-change}`;
}

/** The spark and its change figure, as one unit for cards and table rows. */
export function RowTrend({
  values,
  name,
  window,
  testId,
}: {
  values: readonly number[];
  name: string;
  window?: string;
  testId?: string;
}) {
  return (
    <span className={styles.trend}>
      <RowSpark values={values} name={name} window={window} testId={testId} />
      <span className={styles.delta} aria-hidden="true">
        {trendDelta(values)}
      </span>
    </span>
  );
}

/* ── DeltaTwin ────────────────────────────────────────────────────────────────────────────── */

/**
 * DeltaTwin (v10): two small bars, then and now, and the signed change ("+1", "no change"). The
 * caller writes the full reading in `label` ("4 at the 08:30 bed meeting, 5 now"). `surface="hero"`
 * draws it in hero ink for the deep band.
 */
export function DeltaTwin({
  was,
  now,
  label,
  surface = "page",
  className,
  testId = "wf-delta-twin",
}: {
  was: number;
  now: number;
  /** The whole reading for screen readers. */
  label: string;
  surface?: "page" | "hero";
  className?: string;
  testId?: string;
}) {
  const most = Math.max(was, now, 1);
  const height = (value: number) => Math.max(2, (value / most) * 12);
  const change = now - was;
  return (
    <span
      className={cx(styles.twin, className)}
      data-surface={surface}
      data-wf-twin=""
      role="img"
      aria-label={label}
      data-testid={testId}
    >
      <svg viewBox="0 0 10 12" aria-hidden="true">
        <rect x="0" y={12 - height(was)} width="4" height={height(was)} rx="1" />
        <rect data-now="true" x="6" y={12 - height(now)} width="4" height={height(now)} rx="1" />
      </svg>
      {change === 0 ? (
        <span className={styles.twinWord}>no change</span>
      ) : (
        `${change > 0 ? "+" : "−"}${Math.abs(change)}`
      )}
    </span>
  );
}
