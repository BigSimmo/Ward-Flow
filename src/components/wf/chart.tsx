"use client";

import { type CSSProperties, type ReactNode } from "react";
import { cx } from "./cx";
import { SrOnly } from "./primitives";
import type { WfFill } from "./stat";
import { StatusGlyph, type WfTone } from "./status-glyph";
import styles from "./chart.module.css";

/** CSS colour for a fill role. Status tones and data roles only. */
function fillVar(fill: WfFill = "data-1"): string {
  switch (fill) {
    case "ready":
      return "var(--wf-data-ready)";
    case "closed":
      return "var(--wf-data-closed)";
    case "track":
      return "var(--wf-track)";
    default:
      return `var(--wf-${fill})`;
  }
}

const pct = (value: number, max: number) => (max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0);

/**
 * Zero plus at most four ticks on a round step. The last tick reaches or passes `max`, so an
 * auto-scaled axis never ends below the largest value (which would draw it at full width, level
 * with a smaller one). A fixed scale passes `cap` to drop ticks beyond it.
 */
function niceTicks(max: number, count = 4, cap?: number): number[] {
  if (max <= 0) return [0];
  const rough = max / count;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? rough;
  const ticks: number[] = [];
  for (let index = 0; index <= count; index += 1) {
    const tick = Number((index * step).toFixed(6));
    if (cap != null && tick > cap + 1e-9) break;
    ticks.push(tick);
    if (tick >= max - 1e-9) break;
  }
  return ticks;
}

export type BarListRow = {
  id: string;
  label: ReactNode;
  /** Plain text for the accessible list, when `label` is not a string. */
  labelText?: string;
  sub?: ReactNode;
  value: number;
  /** Shown instead of the number ("12 fit"). Zero shows "none". */
  display?: ReactNode;
  /** Read and shown instead of the number when the number is withheld ("fewer than 5"). */
  valueText?: string;
  fill?: WfFill;
  /** Glyph before the value when it crosses a threshold. */
  flag?: WfTone;
  /** With `onPick`, the test id of this row's button. */
  testId?: string;
};

export type BarListProps = {
  rows: BarListRow[];
  /** Scale maximum. Defaults to the largest value. */
  max?: number;
  /** Dashed mean line with a "Mean 1.4" label. */
  mean?: number;
  meanLabel?: string;
  /** Show the tick scale on top with faint gridlines (at most four). */
  axis?: boolean;
  /** Grey track behind each bar. */
  track?: boolean;
  /** Accessible name ("Blocked discharges by reason"). */
  label: string;
  /** Width of the label column, a CSS grid track size. */
  labelWidth?: string;
  className?: string;
  /**
   * Makes each row a button that highlights it (a filter that highlights and dims, never hides).
   * The rows then form a group named by `label`, each button read as "Label: value".
   */
  onPick?: (id: string) => void;
  /** With `onPick`, the highlighted row (`aria-pressed`); the others dim by colour. */
  picked?: string | null;
};

/** Horizontal labelled bars with direct values, rounded ends and an optional dashed mean. */
export function BarList({
  rows,
  max: maxProp,
  mean,
  meanLabel = "Mean",
  axis = false,
  track = false,
  label,
  labelWidth,
  className,
  onPick,
  picked = null,
}: BarListProps) {
  const ticks = axis ? niceTicks(maxProp ?? Math.max(1, ...rows.map((r) => r.value)), 4, maxProp) : [];
  const max = maxProp ?? (axis ? ticks[ticks.length - 1]! : Math.max(1, ...rows.map((r) => r.value)));
  const showTop = axis || mean != null;
  const firstRow = showTop ? 2 : 1;
  const style = labelWidth ? ({ "--wf-bar-label": labelWidth } as CSSProperties) : undefined;

  return (
    <figure className={cx(styles.chart, styles.chartFlush, className)}>
      <div
        className={styles.barGrid}
        style={style}
        {...(onPick ? { role: "group", "aria-label": label } : { "aria-hidden": true })}
      >
        {showTop ? (
          <div
            aria-hidden="true"
            className={cx(styles.axisRow, styles.axisRowTop)}
            data-two-lines={ticks.length > 0 && mean != null ? "true" : undefined}
          >
            {ticks.map((t) => (
              <span key={t} className={styles.tickLabel} style={{ left: `${pct(t, max)}%` }}>
                {t}
              </span>
            ))}
            {mean != null ? (
              <span className={styles.meanLabel} style={{ left: `${pct(mean, max)}%` }}>
                {meanLabel} <b>{Number(mean.toFixed(1))}</b>
              </span>
            ) : null}
          </div>
        ) : null}
        <div
          aria-hidden="true"
          className={styles.overlay}
          style={{ gridRow: `${firstRow} / ${firstRow + rows.length}` }}
        >
          {/* Zero is the bars' own baseline, so at most four faint gridlines are drawn. */}
          {ticks
            .filter((t) => t > 0)
            .map((t) => (
              <span key={t} className={styles.grid} style={{ left: `${pct(t, max)}%` }} />
            ))}
          {mean != null ? <span className={styles.meanLine} style={{ left: `${pct(mean, max)}%` }} /> : null}
        </div>
        {rows.map((row, index) => {
          const gridRow = firstRow + index;
          // A pick highlights one row and dims the rest by colour (v10 dim rule); nothing is hidden.
          const dim = onPick && picked != null && picked !== row.id ? "true" : undefined;
          const text = row.labelText ?? (typeof row.label === "string" ? row.label : row.id);
          return (
            <div key={row.id} className={styles.rowContents}>
              {onPick ? (
                <button
                  type="button"
                  className={styles.barPick}
                  style={{ gridRow }}
                  aria-pressed={picked === row.id}
                  aria-label={`${text}: ${row.valueText ?? row.value}`}
                  onClick={() => onPick(row.id)}
                  data-testid={row.testId}
                  data-dim={dim}
                />
              ) : null}
              <span
                className={styles.barLabel}
                style={{ gridRow }}
                data-dim={dim}
                aria-hidden={onPick ? true : undefined}
              >
                <span>{row.label}</span>
                {row.sub ? <span className={styles.barSub}>{row.sub}</span> : null}
              </span>
              <span
                className={styles.barCell}
                style={{ gridRow }}
                data-dim={dim}
                aria-hidden={onPick ? true : undefined}
              >
                {track ? <span className={styles.barTrack} /> : null}
                {row.value > 0 ? (
                  <span
                    className={styles.bar}
                    style={{
                      width: `${pct(row.value, max)}%`,
                      background: dim ? "var(--wf-glyph-dim)" : fillVar(row.fill),
                    }}
                  />
                ) : null}
              </span>
              <span
                className={cx(styles.barValue, row.value === 0 && styles.none)}
                style={{ gridRow }}
                data-dim={dim}
                aria-hidden={onPick ? true : undefined}
              >
                {row.flag ? <StatusGlyph tone={row.flag} size={9} /> : null}
                {row.display ?? row.valueText ?? (row.value === 0 ? "none" : row.value)}
              </span>
            </div>
          );
        })}
      </div>
      <figcaption>
        <SrOnly>{label}</SrOnly>
      </figcaption>
      <SrOnly>
        <ul>
          {/* With `onPick` each row is already a named button, so the list keeps only the mean. */}
          {onPick
            ? null
            : rows.map((row) => (
                <li key={row.id}>
                  {row.labelText ?? (typeof row.label === "string" ? row.label : row.id)}: {row.valueText ?? row.value}
                </li>
              ))}
          {mean != null ? (
            <li>
              {meanLabel}: {Number(mean.toFixed(1))}
            </li>
          ) : null}
        </ul>
      </SrOnly>
    </figure>
  );
}

type ColumnDatum = {
  id: string;
  label: string;
  value: number;
  display?: ReactNode;
  /** Read and shown instead of the number when the number is withheld ("fewer than 5"). */
  valueText?: string;
  fill?: WfFill;
};

export type ColumnChartProps = {
  columns: ColumnDatum[];
  max?: number;
  /** One dashed target or mean line. */
  target?: { value: number; label: string };
  /** Faint horizontal gridlines (at most four). */
  gridlines?: boolean;
  /** Plot height in px, excluding labels. */
  height?: number;
  /** Accessible name. */
  label: string;
  className?: string;
};

/** Vertical columns with direct value labels, category labels under, an optional dashed target. */
export function ColumnChart({
  columns,
  max: maxProp,
  target,
  gridlines = false,
  height = 120,
  label,
  className,
}: ColumnChartProps) {
  const dataMax = Math.max(1, ...columns.map((c) => c.value), target?.value ?? 0);
  const ticks = gridlines ? niceTicks(maxProp ?? dataMax, 4, maxProp) : [];
  const max = maxProp ?? (gridlines ? ticks[ticks.length - 1]! : dataMax * 1.12);
  return (
    <figure className={cx(styles.chart, styles.chartFlush, className)}>
      <div aria-hidden="true">
        <div className={styles.columns} style={{ height }}>
          {ticks
            .filter((t) => t > 0)
            .map((t) => (
              <span key={t} className={styles.hGrid} style={{ bottom: `${pct(t, max)}%` }} />
            ))}
          {target ? (
            <span className={styles.target} style={{ bottom: `${pct(target.value, max)}%` }}>
              <span className={styles.targetLabel}>{target.label}</span>
            </span>
          ) : null}
          {columns.map((c) => (
            <div key={c.id} className={styles.col}>
              <span className={styles.colValue}>{c.display ?? c.valueText ?? c.value}</span>
              <span
                className={styles.colBar}
                style={{ height: `${(pct(c.value, max) / 100) * (height - 20)}px`, background: fillVar(c.fill) }}
              />
            </div>
          ))}
        </div>
        <div className={styles.colLabels}>
          {columns.map((c) => (
            <span key={c.id} className={styles.colLabel}>
              {c.label}
            </span>
          ))}
        </div>
      </div>
      <figcaption>
        <SrOnly>{label}</SrOnly>
      </figcaption>
      <SrOnly>
        <ul>
          {columns.map((c) => (
            <li key={c.id}>
              {c.label}: {c.valueText ?? c.value}
            </li>
          ))}
          {target ? (
            <li>
              {target.label}: {target.value}
            </li>
          ) : null}
        </ul>
      </SrOnly>
    </figure>
  );
}

export type DonutProps = {
  /** 0 to 1. */
  value: number;
  size?: number;
  thickness?: number;
  fill?: WfFill;
  /** Centre text. Defaults to a whole percentage. */
  text?: ReactNode;
  /** Accessible name ("North Metro occupancy"). */
  label: string;
  className?: string;
};

/** Ring gauge with the value in the middle (occupancy by service). One colour plus the track. */
export function Donut({ value, size = 56, thickness = 6, fill = "data-1", text, label, className }: DonutProps) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const v = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  // Butt caps: the arc ends exactly at its value. Round caps drew a dot at 0% and closed the gap
  // from about 96%, and trimming them still misread small values. 0% draws no arc at all.
  const dash = c * v;
  const shown = text ?? `${Math.round(v * 100)}%`;
  return (
    <span
      className={cx(styles.donutWrap, className)}
      role="img"
      aria-label={`${label}, ${Math.round(v * 100)}%`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={fillVar("track")} strokeWidth={thickness} />
        {v > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={fillVar(fill)}
            strokeWidth={thickness}
            strokeLinecap="butt"
            strokeDasharray={`${dash} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </svg>
      <span className={styles.donutValue} aria-hidden="true">
        {shown}
      </span>
    </span>
  );
}
