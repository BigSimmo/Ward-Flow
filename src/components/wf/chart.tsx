"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cx } from "./cx";
import { SrOnly } from "./primitives";
import type { WfFill } from "./stat";
import { StatusGlyph, type WfTone } from "./status-glyph";
import styles from "./chart.module.css";

/** CSS colour for a fill role. Status tones and data roles only. */
export function fillVar(fill: WfFill = "data-1"): string {
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
  fill?: WfFill;
  /** Glyph before the value when it crosses a threshold. */
  flag?: WfTone;
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
}: BarListProps) {
  const ticks = axis ? niceTicks(maxProp ?? Math.max(1, ...rows.map((r) => r.value)), 4, maxProp) : [];
  const max = maxProp ?? (axis ? ticks[ticks.length - 1]! : Math.max(1, ...rows.map((r) => r.value)));
  const showTop = axis || mean != null;
  const firstRow = showTop ? 2 : 1;
  const style = labelWidth ? ({ "--wf-bar-label": labelWidth } as CSSProperties) : undefined;

  return (
    <figure className={cx(styles.chart, className)} style={{ margin: 0 }}>
      <div className={styles.barGrid} style={style} aria-hidden="true">
        {showTop ? (
          <div className={styles.axisRow} style={{ gridRow: 1 }}>
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
        <div className={styles.overlay} style={{ gridRow: `${firstRow} / ${firstRow + rows.length}` }}>
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
          return (
            <div key={row.id} style={{ display: "contents" }}>
              <span className={styles.barLabel} style={{ gridRow }}>
                <span>{row.label}</span>
                {row.sub ? <span className={styles.barSub}>{row.sub}</span> : null}
              </span>
              <span className={styles.barCell} style={{ gridRow }}>
                {track ? <span className={styles.barTrack} /> : null}
                {row.value > 0 ? (
                  <span
                    className={styles.bar}
                    style={{ width: `${pct(row.value, max)}%`, background: fillVar(row.fill) }}
                  />
                ) : null}
              </span>
              <span className={cx(styles.barValue, row.value === 0 && styles.none)} style={{ gridRow }}>
                {row.flag ? <StatusGlyph tone={row.flag} size={9} /> : null}
                {row.display ?? (row.value === 0 ? "none" : row.value)}
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
          {rows.map((row) => (
            <li key={row.id}>
              {row.labelText ?? (typeof row.label === "string" ? row.label : row.id)}: {row.value}
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

export type ColumnDatum = { id: string; label: string; value: number; display?: ReactNode; fill?: WfFill };

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
    <figure className={cx(styles.chart, className)} style={{ margin: 0 }}>
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
              <span className={styles.colValue}>{c.display ?? c.value}</span>
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
              {c.label}: {c.value}
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

function linePath(points: Array<[number, number]>, step: boolean): string {
  return points
    .map(([x, y], i) => {
      if (i === 0) return `M${x},${y}`;
      if (!step) return `L${x},${y}`;
      const [, py] = points[i - 1]!;
      return `L${x},${py} L${x},${y}`;
    })
    .join(" ");
}

export type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  /** Stroke colour role. Defaults to the current text colour (hero ink on the hero band). */
  fill?: WfFill;
  /** Accessible name. Omit when the value beside it already says it. */
  label?: string;
  className?: string;
};

/** Tiny trend line with an end dot. Decorative unless labelled. */
export function Sparkline({ values, width = 56, height = 16, fill, label, className }: SparklineProps) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const pts: Array<[number, number]> = values.map((v, i) => [
    pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2),
    pad + (1 - (v - min) / span) * (height - pad * 2),
  ]);
  const last = pts[pts.length - 1]!;
  const stroke = fill ? fillVar(fill) : "currentColor";
  return (
    <svg
      className={cx(styles.svg, className)}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path
        d={linePath(pts, false)}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2} fill={stroke} />
    </svg>
  );
}

function useWidth<T extends HTMLElement>(initial: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(80, Math.round(entry.contentRect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

export type LinePoint = { id: string; label: string; value: number };

export type LineChartProps = {
  points: LinePoint[];
  /** Y range. Defaults to the data range with a little room. */
  min?: number;
  max?: number;
  /** Y tick values, at most four. */
  yTicks?: number[];
  /** Format for tick and end labels ("80%"). */
  format?: (value: number) => string;
  /** One dashed target line ("85% line"). */
  target?: { value: number; label: string };
  /** Step line for counts that change at points in time. */
  step?: boolean;
  /** Label the last value directly. */
  labelLast?: boolean;
  height?: number;
  fill?: WfFill;
  label: string;
  className?: string;
};

/** Line chart with direct labels: x labels under, at most four y ticks, one dashed target. */
export function LineChart({
  points,
  min: minProp,
  max: maxProp,
  yTicks,
  format = (v) => String(v),
  target,
  step = false,
  labelLast = true,
  height = 120,
  fill = "data-1",
  label,
  className,
}: LineChartProps) {
  const { ref, width } = useWidth<HTMLDivElement>(320);
  const values = points.map((p) => p.value).concat(target ? [target.value] : []);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const room = (dataMax - dataMin || 1) * 0.15;
  const min = minProp ?? dataMin - room;
  const max = maxProp ?? dataMax + room;
  const left = yTicks && yTicks.length ? 32 : 4;
  const right = labelLast ? 44 : 8;
  const top = target ? 16 : 8;
  const bottom = 20;
  const plotW = Math.max(10, width - left - right);
  const plotH = Math.max(10, height - top - bottom);
  const x = (i: number) => left + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => top + (1 - (v - min) / (max - min || 1)) * plotH;
  const pts: Array<[number, number]> = points.map((p, i) => [x(i), y(p.value)]);
  const stroke = fillVar(fill);
  const last = points[points.length - 1];

  return (
    <figure className={cx(styles.chart, className)} style={{ margin: 0 }}>
      <div ref={ref}>
        <svg
          className={styles.svg}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden="true"
          focusable="false"
        >
          {(yTicks ?? []).slice(0, 4).map((t) => (
            <g key={t}>
              <line className={styles.svgGrid} x1={left} x2={left + plotW} y1={y(t)} y2={y(t)} />
              <text className={styles.svgText} x={left - 6} y={y(t) + 4} textAnchor="end">
                {format(t)}
              </text>
            </g>
          ))}
          {target ? (
            <g>
              <line
                className={styles.svgTarget}
                x1={left}
                x2={left + plotW}
                y1={y(target.value)}
                y2={y(target.value)}
              />
              <text className={styles.svgText} x={left} y={y(target.value) - 5}>
                {target.label}
              </text>
            </g>
          ) : null}
          <path
            d={linePath(pts, step)}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {pts.map(([px, py], i) => (
            <circle key={points[i]!.id} className={styles.svgDot} cx={px} cy={py} r={3} stroke={stroke} />
          ))}
          {points.map((p, i) => (
            <text key={p.id} className={styles.svgText} x={x(i)} y={height - 4} textAnchor="middle">
              {p.label}
            </text>
          ))}
          {labelLast && last ? (
            <text className={styles.svgValue} x={x(points.length - 1) + 8} y={y(last.value) + 4}>
              {format(last.value)}
            </text>
          ) : null}
        </svg>
      </div>
      <figcaption>
        <SrOnly>{label}</SrOnly>
      </figcaption>
      <SrOnly>
        <ul>
          {points.map((p) => (
            <li key={p.id}>
              {p.label}: {format(p.value)}
            </li>
          ))}
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
  const v = Math.min(1, Math.max(0, value));
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
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={fillVar(fill)}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className={styles.donutValue} aria-hidden="true">
        {shown}
      </span>
    </span>
  );
}
