import { cx } from "@/components/wf";

import styles from "./ed-row-spark.module.css";

/**
 * RowSpark (v10, All EDs): how many people were waiting at one department over the last 12 hours,
 * one point every 2 hours, with the department's own 12 hour mean dashed. The values come from
 * `edWaitingSeries` (opened and closed times on the record), never from an invented series.
 *
 * Page-local for now; it should move to `@/components/wf` as a shared RowSpark (the shared
 * `Sparkline` has no mean line and no change word).
 */
export function RowSpark({
  values,
  name,
  big = false,
  className,
}: {
  values: readonly number[];
  /** The department, for the accessible name. */
  name: string;
  big?: boolean;
  className?: string;
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
      aria-label={`${name}, waiting over 12 hours: ${values.join(", ")}, ${trendWords(values)}`}
      focusable="false"
      data-testid="ed-row-spark"
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

/** "+4", "-2" or "±0": the change across the 12 hours, mono beside the spark. */
export function trendDelta(values: readonly number[]): string {
  if (values.length < 2) return "±0";
  const change = values[values.length - 1] - values[0];
  return change === 0 ? "±0" : change > 0 ? `+${change}` : `−${-change}`;
}

function trendWords(values: readonly number[]): string {
  const change = values[values.length - 1] - values[0];
  return change === 0 ? "level" : change > 0 ? `up ${change}` : `down ${-change}`;
}

/** The spark and its change word, as one unit for cards and table rows. */
export function RowTrend({ values, name }: { values: readonly number[]; name: string }) {
  return (
    <span className={styles.trend}>
      <RowSpark values={values} name={name} />
      <span className={styles.delta} aria-hidden="true">
        {trendDelta(values)}
      </span>
    </span>
  );
}
