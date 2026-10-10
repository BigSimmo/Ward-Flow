import { ChevronDown, Copy } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "./button";
import { CardHead } from "./card";
import { cx } from "./cx";
import { SrOnly } from "./primitives";
import { StackBar, type StackSegment } from "./stat";
import { StatusGlyph, type WfTone } from "./status-glyph";
import styles from "./v10-parts.module.css";

/*
 * Design system v10 shared parts (10 Oct 2026). Each answers one rule in v10 sections 8 to 14.
 * Tone lives in glyphs and edges, words stay neutral ink, the 12px floor holds, and a dimmed part
 * uses data-dim (see ward-flow-v9-tokens.css), never opacity or filter.
 */

/* ── CheckingFoot ─────────────────────────────────────────────────────────────────────────── */

export type CheckingItem = {
  id: string;
  /** What was checked ("Overdue", "Bed counts older than 1h"). Neutral words. */
  label: ReactNode;
  /** The count found. 0 shows 0, never blank. */
  value: number | string;
  /** Glyph before the label. Red only when the finding needs action now. */
  tone?: WfTone;
};

export type CheckingFootProps = {
  /** What this page checked, each with its count. */
  items: CheckingItem[];
  /** What it could not check, each shown as "Not checked: …" with the closed glyph. */
  notChecked?: ReactNode[];
  /** `hero` inside a Hero foot (the default), `page` on a card or strip. */
  surface?: "hero" | "page";
  className?: string;
};

/**
 * The hero foot that says what the page checked and what it could not (v10 section 8.1). It lists
 * counts, never a verdict: it never says "All clear", even when every count is 0.
 */
export function CheckingFoot({ items, notChecked = [], surface = "hero", className }: CheckingFootProps) {
  return (
    <div
      className={cx(styles.checking, surface === "page" && styles.checkingPage, className)}
      role="group"
      aria-label="What this page checks"
      data-testid="wf-checking-foot"
    >
      <span className={styles.checkingEyebrow}>Checking</span>
      {items.map((item) => {
        const zero = item.value === 0 || item.value === "0";
        return (
          <span key={item.id} className={styles.check} data-zero={zero ? "true" : undefined}>
            {item.tone ? <StatusGlyph tone={item.tone} /> : null}
            <span className={styles.checkLabel}>{item.label}</span>
            <b className={styles.checkValue}>{item.value}</b>
          </span>
        );
      })}
      {notChecked.map((what, index) => (
        <span key={`not-${index}`} className={styles.check}>
          <StatusGlyph tone="closed" />
          <span className={styles.checkLabel}>Not checked: {what}</span>
        </span>
      ))}
    </div>
  );
}

/* ── Frac ─────────────────────────────────────────────────────────────────────────────────── */

/**
 * Progress past five gates as a mono fraction pill ("7/9"). Under five gates use pips; for legs
 * of a trip use `StepsDots`. A ring is for a hero only.
 */
export function Frac({
  done,
  total,
  label,
  tone,
  className,
}: {
  done: number;
  total: number;
  /** What is counted ("checks done"). Read as "7 of 9 checks done". */
  label: string;
  tone?: WfTone;
  className?: string;
}) {
  return (
    <span className={cx(styles.frac, className)} data-testid="wf-frac">
      {tone ? <StatusGlyph tone={tone} /> : null}
      <span aria-hidden="true">
        {done}/{total}
      </span>
      <SrOnly>
        {done} of {total} {label}
      </SrOnly>
    </span>
  );
}

/* ── StepsDots ────────────────────────────────────────────────────────────────────────────── */

export type StepState = "done" | "now" | "todo";

/** Legs of a trip, any length: 7px dots. Done steps are filled ticks of colour, never dashed. */
export function StepsDots({ steps, label, className }: { steps: StepState[]; label: string; className?: string }) {
  const done = steps.filter((step) => step === "done").length;
  const now = steps.indexOf("now");
  const summary = `${label}: ${done} of ${steps.length} done${now >= 0 ? `, step ${now + 1} under way` : ""}`;
  return (
    <span className={cx(styles.steps, className)} role="img" aria-label={summary} data-testid="wf-steps-dots">
      {steps.map((step, index) => (
        <i key={index} data-state={step} />
      ))}
    </span>
  );
}

/* ── OccupancyRing ────────────────────────────────────────────────────────────────────────── */

export type OccupancyRingProps = {
  /** Occupied share of open beds, 0 to 100. Null when not recorded. */
  percent: number | null;
  /** The alert line on the same scale (85 or 90, whichever the page uses). */
  alertAt: number;
  /** Whose beds ("Statewide", "East Metro"). */
  scope: string;
  /** Override the glyph and word under the figure. Words stay neutral. */
  status?: { tone: WfTone; word: string };
  className?: string;
};

function ringStatus(percent: number, alertAt: number): { tone: WfTone; word: string } {
  return percent >= alertAt
    ? { tone: "warning", word: `At risk, over ${alertAt}%` }
    : { tone: "success", word: `Under the ${alertAt}% line` };
}

/**
 * The one occupancy gauge on a page, and only in its hero (v10 section 10, "A ring appears only in
 * a hero"). A neutral half ring with the dashed alert line; the glyph and word carry the tone.
 */
export function OccupancyRing({ percent, alertAt, scope, status, className }: OccupancyRingProps) {
  const known = percent !== null && Number.isFinite(percent);
  const value = known ? Math.min(100, Math.max(0, percent)) : 0;
  const shown = known ? (status ?? ringStatus(value, alertAt)) : { tone: "neutral" as WfTone, word: "Not recorded" };
  const theta = Math.PI - Math.PI * (Math.min(100, Math.max(0, alertAt)) / 100);
  const point = (r: number) => [74 + r * Math.cos(theta), 76 - r * Math.sin(theta)].map((n) => n.toFixed(1));
  const [ax, ay] = point(54);
  const [bx, by] = point(74);
  const figure = known ? `${value.toFixed(1)}%` : "Not recorded";
  return (
    <div
      className={cx(styles.ring, className)}
      role="img"
      aria-label={`${scope} ${known ? `${figure} of open beds occupied` : "occupancy not recorded"}. Alert line ${alertAt}%. ${shown.word}.`}
      data-testid="wf-occupancy-ring"
    >
      <svg viewBox="0 0 148 82" aria-hidden="true" focusable="false">
        <path className={styles.ringTrack} data-known={known ? "true" : "false"} d="M10 76a64 64 0 0 1 128 0" />
        {known ? (
          <path
            className={styles.ringValue}
            d="M10 76a64 64 0 0 1 128 0"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={(100 - value).toFixed(1)}
          />
        ) : null}
        <line className={styles.ringRef} x1={ax} y1={ay} x2={bx} y2={by} />
      </svg>
      <b className={styles.ringFigure} aria-hidden="true">
        {known ? (
          <>
            {value.toFixed(1)}
            <span className={styles.ringUnit}>%</span>
          </>
        ) : (
          "—"
        )}
      </b>
      <span className={styles.ringWord} aria-hidden="true">
        <StatusGlyph tone={shown.tone} />
        {shown.word}
      </span>
    </div>
  );
}

/* ── WardCapacityRow ──────────────────────────────────────────────────────────────────────── */

export type WardCapacityRowProps = {
  /** Ward or service name. */
  name: ReactNode;
  /** A short second line (site, service dot and name). */
  meta?: ReactNode;
  /** Bed states across the bar: occupied, ready, held, closed. Slate data, never status colour. */
  segments: StackSegment[];
  /** Occupancy, 0 to 100. Null shows "Not recorded". */
  percent: number | null;
  /** The movable alert line, same scale. Drawn as one dashed line through the bar. */
  alertAt: number;
  /** Glyph after the figure. Defaults to the amber circle at or over the alert line. */
  tone?: WfTone;
  /** A free or fit place: the one allowed tint. */
  fit?: boolean;
  /** Recede by colour when a highlight does not match it. The row stays. */
  dim?: boolean;
  selected?: boolean;
  /** The row opens something (a ward page, the capacity panel). */
  onSelect?: () => void;
  /** Accessible name for the row button ("Open Dabakarn"). Required with `onSelect`. */
  actionLabel?: string;
  className?: string;
};

/**
 * One ward or service as a capacity row, shared by Capacity and Wards (v10 Places pattern): name,
 * stacked bed bar with the dashed alert line, the percentage and its glyph.
 */
export function WardCapacityRow({
  name,
  meta,
  segments,
  percent,
  alertAt,
  tone,
  fit = false,
  dim = false,
  selected = false,
  onSelect,
  actionLabel,
  className,
}: WardCapacityRowProps) {
  const known = percent !== null && Number.isFinite(percent);
  const glyph: WfTone | undefined = tone ?? (known && percent >= alertAt ? "warning" : undefined);
  const body = (
    <>
      <span className={styles.capName}>
        <span className={styles.capNameText}>{name}</span>
        {meta ? <span className={styles.capMeta}>{meta}</span> : null}
      </span>
      <span
        className={styles.capBar}
        style={{ "--wf-cap-alert": `${Math.min(100, Math.max(0, alertAt))}%` } as CSSProperties}
      >
        <StackBar segments={segments} label="Beds" thin />
      </span>
      <span className={styles.capPct}>{known ? `${percent.toFixed(1)}%` : "Not recorded"}</span>
      <span className={styles.capGlyph}>{glyph ? <StatusGlyph tone={glyph} /> : null}</span>
    </>
  );
  const shared = {
    className: cx(styles.capRow, className),
    "data-fit": fit ? "true" : undefined,
    "data-dim": dim ? "true" : undefined,
    "data-selected": selected ? "true" : undefined,
    "data-testid": "wf-ward-capacity-row",
  };
  return onSelect ? (
    <button type="button" {...shared} onClick={onSelect} aria-label={actionLabel} aria-pressed={selected}>
      {body}
    </button>
  ) : (
    <div {...shared}>{body}</div>
  );
}

/** The bordered list that holds `WardCapacityRow`s. */
export function WardCapacityRows({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div className={cx(styles.capRows, className)} role="group" aria-label={label}>
      {children}
    </div>
  );
}

/* ── GroupHead ────────────────────────────────────────────────────────────────────────────── */

export type GroupHeadProps = {
  /** Group name ("Waiting on a bed") or one letter ("A") for an A to Z list. */
  title: ReactNode;
  /** Rows in the group. 0 shows 0. */
  count?: number;
  /** Owner or a short note, in ink-3 ("Bed manager"). */
  meta?: ReactNode;
  /** Right side: a figure or one quiet action. */
  aside?: ReactNode;
  tone?: WfTone;
  /** `group` for a grouped table, `letter` for an A to Z or section divider. */
  variant?: "group" | "letter";
  /** Makes the head a fold button. */
  onToggle?: () => void;
  expanded?: boolean;
  controls?: string;
  className?: string;
};

/** The head row of a group in a grouped table, or a letter or section divider in a long list. */
export function GroupHead({
  title,
  count,
  meta,
  aside,
  tone,
  variant = "group",
  onToggle,
  expanded,
  controls,
  className,
}: GroupHeadProps) {
  const inner = (
    <>
      <span className={styles.groupName}>
        {tone ? <StatusGlyph tone={tone} /> : null}
        <span className={styles.groupTitle}>{title}</span>
        {count !== undefined ? <span className={styles.groupCount}>{count}</span> : null}
        {meta ? <span className={styles.groupMeta}>{meta}</span> : null}
      </span>
      {aside ? <span className={styles.groupAside}>{aside}</span> : null}
      {onToggle ? <ChevronDown className={styles.groupChevron} size={14} aria-hidden="true" /> : null}
    </>
  );
  const cls = cx(styles.groupHead, variant === "letter" && styles.groupLetter, className);
  return onToggle ? (
    <button
      type="button"
      className={cls}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onToggle}
      data-testid="wf-group-head"
    >
      {inner}
    </button>
  ) : (
    <div className={cls} data-testid="wf-group-head">
      {inner}
    </div>
  );
}

/* ── SinceYouLooked ───────────────────────────────────────────────────────────────────────── */

export type SinceItem = {
  id: string;
  value: number;
  /** Neutral noun phrase after the figure ("admitted", "beds freed"). */
  word: string;
  /** One line of detail ("2 Dabakarn, 1 Moodjar"). */
  detail?: ReactNode;
  tone?: WfTone;
};

/**
 * The shift change digest (Elevate, adopted 10 Oct 2026): what changed since the person last
 * looked, as up to five figures with one line each, and Copy as handover text.
 */
export function SinceYouLooked({
  since,
  items,
  onCopy,
  id,
  className,
}: {
  /** The clock time they last looked ("07:12"). */
  since: string;
  items: SinceItem[];
  /** Copies the digest as handover text. Omit to hide the action. */
  onCopy?: () => void;
  id?: string;
  className?: string;
}) {
  return (
    <section id={id} className={cx(styles.since, className)} aria-label={`Since you looked at ${since}`}>
      <CardHead
        title="Since you looked"
        meta={
          <>
            at <b className={styles.sinceClock}>{since}</b>
          </>
        }
        level={3}
        action={
          onCopy ? (
            <Button variant="ghost" size="sm" icon={Copy} onClick={onCopy}>
              Copy as handover text
            </Button>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <p className={styles.sinceEmpty}>Nothing has changed since {since}.</p>
      ) : (
        <ul className={styles.digest}>
          {items.map((item) => (
            <li key={item.id}>
              <span className={styles.digestFigure}>
                {item.tone ? <StatusGlyph tone={item.tone} size={12} /> : null}
                {item.value}
              </span>
              <span className={styles.digestWord}>{item.word}</span>
              {item.detail ? <span className={styles.digestDetail}>{item.detail}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
