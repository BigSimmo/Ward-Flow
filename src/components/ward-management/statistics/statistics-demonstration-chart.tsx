"use client";

import { useId } from "react";
import type { DemonstrationSeries } from "./statistics-demonstration";
import { useStatisticsSamples } from "./statistics-samples";
import styles from "./statistics-samples.module.css";

/** Generated history is visible only after the user enables sample statistics. */
export function DemonstrationChart({
  series,
  testId,
  unit = "",
}: {
  readonly series: DemonstrationSeries;
  readonly testId?: string;
  readonly unit?: string;
  readonly variant?: "default" | "overview";
}) {
  const enabled = useStatisticsSamples();
  const titleId = useId();
  if (!enabled || series.points.length === 0) return null;
  const values = series.points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const scale = Math.max(1, high - low);
  const coordinates = values.map((value, index) => [
    12 + (index * 276) / Math.max(1, values.length - 1),
    84 - ((value - low) / scale) * 60,
  ]);
  const points = coordinates.map((point) => point.join(",")).join(" ");
  const last = values.at(-1)!;
  const format = (value: number) =>
    unit === "%" ? value.toFixed(1) + "%" : Math.round(value).toLocaleString() + (unit ? " " + unit : "");
  return (
    <article
      className={styles.chart}
      data-ward-primitive="demonstration-chart"
      data-figure-kind="sample"
      data-testid={testId}
    >
      <div className={styles.chartHeader}>
        <h3 id={titleId}>{series.label}</h3>
        <span className={styles.badge}>Sample</span>
      </div>
      <strong className={styles.value}>{format(last)}</strong>
      <svg viewBox="0 0 300 100" role="img" aria-labelledby={titleId} className={styles.sparkline}>
        <desc>
          Sample data, invented for preview. {values.length} days; range {format(low)} to {format(high)}.
        </desc>
        <path
          d={"M " + coordinates.map((point) => point.join(" ")).join(" L ") + " L 288 94 L 12 94 Z"}
          fill="currentColor"
          opacity="0.08"
        />
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={coordinates.at(-1)![0]} cy={coordinates.at(-1)![1]} r="3" fill="currentColor" />
      </svg>
      <div className={styles.axis}>
        <span>{values.length} days ago</span>
        <span>Today</span>
      </div>
    </article>
  );
}
