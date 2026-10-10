import type { ReactNode } from "react";
import { cx } from "./cx";
import { StatusGlyph, type WfTone } from "./status-glyph";
import styles from "./stat.module.css";

/** Fill colour roles for meters, stacked bars, legends and charts. Status tones or data roles. */
export type WfFill =
  "data-1" | "data-2" | "data-3" | "ready" | "closed" | "danger" | "warning" | "success" | "info" | "neutral" | "track";

/** Class for a fill colour role. `hatch` marks pulled, crossing or estimated parts. */
export function fillClass(fill: WfFill = "data-1", hatch = false): string {
  return hatch ? styles.hatch : (styles[`c-${fill}`] ?? styles["c-data-1"]);
}

export type StatProps = {
  value: ReactNode;
  label: ReactNode;
  /** Glyph before the label. */
  tone?: WfTone;
  size?: "sm" | "md" | "lg";
  className?: string;
};

/** Mono value over a short label. Put several in a `StatGroup` for hairline separators. */
export function Stat({ value, label, tone, size = "md", className }: StatProps) {
  return (
    <div className={cx(styles.stat, size === "sm" && styles.sm, size === "lg" && styles.lg, className)}>
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>
        {tone ? <StatusGlyph tone={tone} size={9} /> : null}
        {label}
      </span>
    </div>
  );
}

export function StatGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.group, className)}>{children}</div>;
}

export type MeterProps = {
  /** Current value, 0 to `max`. */
  value: number;
  max?: number;
  /** Threshold tick, same scale as `value` (an 85% line). */
  threshold?: number;
  /** Fill colour. Use a status tone only when the value crosses a threshold. */
  fill?: WfFill;
  /** Accessible name ("Metro occupancy"). */
  label: string;
  /** Visible text value beside the meter. Defaults to a percentage of `max`. Pass null to hide. */
  valueText?: ReactNode | null;
  /** Visible label to the left of the meter. */
  showLabel?: boolean;
  className?: string;
};

/** Meter with an optional threshold tick and a text value beside it (`role="meter"`). */
export function Meter({
  value,
  max = 1,
  threshold,
  fill = "neutral",
  label,
  valueText,
  showLabel = false,
  className,
}: MeterProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const pct = `${(ratio * 100).toFixed(1)}%`;
  const text = valueText === undefined ? pct : valueText;
  return (
    <div className={cx(styles.meterWrap, className)}>
      {showLabel ? <span className={styles.meterLabel}>{label}</span> : null}
      <div
        className={styles.meter}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(max, Math.max(0, value))}
        aria-valuetext={typeof text === "string" ? text : pct}
      >
        <span className={cx(styles.fill, fillClass(fill))} style={{ width: `${ratio * 100}%` }} />
        {threshold != null && max > 0 ? (
          <span className={styles.tick} style={{ left: `${Math.min(100, (threshold / max) * 100)}%` }} />
        ) : null}
      </div>
      {text != null ? (
        <span className={styles.meterValue} aria-hidden="true">
          {text}
        </span>
      ) : null}
    </div>
  );
}

export type StackSegment = { id: string; value: number; fill?: WfFill; hatch?: boolean; label: string };

/**
 * Stacked bar: segments with 2px gaps and rounded outer ends. Exposed as one image with a text
 * summary; show the numbers in a `Legend` beside it.
 */
export function StackBar({
  segments,
  label,
  thin = false,
  className,
}: {
  segments: StackSegment[];
  /** Accessible summary prefix ("Waiting by band"). */
  label: string;
  thin?: boolean;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const summary = `${label}: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`;
  return (
    <div className={cx(styles.stack, thin && styles.thin, className)} role="img" aria-label={summary}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <span
            key={s.id}
            className={fillClass(s.fill, s.hatch)}
            style={{ flexGrow: total > 0 ? s.value / total : 0, flexBasis: 0 }}
          />
        ))}
    </div>
  );
}

export type LegendItem = { id: string; label: ReactNode; fill?: WfFill; hatch?: boolean; value?: ReactNode };

/** Legend with short rounded swatches (never squares), optional mono value after each label. */
export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cx(styles.legend, className)}>
      {items.map((item) => (
        <li key={item.id} className={styles.legendItem}>
          <span className={cx(styles.swatch, fillClass(item.fill, item.hatch))} aria-hidden="true" />
          {item.label}
          {item.value != null ? <span className={styles.legendValue}>{item.value}</span> : null}
        </li>
      ))}
    </ul>
  );
}
