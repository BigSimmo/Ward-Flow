"use client";

import type { ReactNode } from "react";
import { cx } from "./cx";
import { SrOnly } from "./primitives";
import { StatusGlyph, type WfTone } from "./status-glyph";
import styles from "./v10-pass2.module.css";

/*
 * Design system v10 shared parts, pass 2 (10 Oct 2026): the parts page agents built locally in
 * pass 1 and asked to share. Tone stays in glyphs and edges, words stay neutral ink, 12px floor,
 * a dimmed part uses data-dim, never opacity or filter.
 */

/* ── HeroChip / HeroChips ─────────────────────────────────────────────────────────────────── */

export type HeroChipProps = {
  /** The figure, mono ("12", "2/7", "08:30"). */
  value: ReactNode;
  /** Neutral words after the figure. */
  label: ReactNode;
  /** Glyph between figure and words. Red only when the chip names something to act on now. */
  tone?: WfTone;
  /** A small signed change beside the figure ("+2"). */
  twin?: ReactNode;
  /** Words for the twin, read by screen readers ("2 more since the last pack"). */
  twinLabel?: string;
  /** Makes the chip a button that jumps or toggles. */
  onPress?: () => void;
  /** With `onPress`, a pressed highlight chip (`aria-pressed`). */
  pressed?: boolean;
  testId?: string;
  className?: string;
};

/**
 * A count chip on the hero band (v10 hero chips, 15px figure): edged pill, mono figure, then its
 * words. With `onPress` it is a button; without, a plain chip. At most five per hero.
 */
export function HeroChip({ value, label, tone, twin, twinLabel, onPress, pressed, testId, className }: HeroChipProps) {
  const body = (
    <>
      <span className={styles.chipValue}>{value}</span>
      {twin !== undefined ? (
        <span className={styles.chipTwin} aria-hidden={twinLabel ? true : undefined}>
          {twin}
        </span>
      ) : null}
      {tone ? <StatusGlyph tone={tone} size={9} /> : null}
      <span className={styles.chipLabel}>{label}</span>
      {twinLabel ? <SrOnly>, {twinLabel}</SrOnly> : null}
    </>
  );
  if (!onPress) {
    return (
      <span className={cx(styles.chip, className)} data-testid={testId}>
        {body}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={cx(styles.chip, styles.chipButton, className)}
      aria-pressed={pressed}
      onClick={onPress}
      data-testid={testId}
    >
      {body}
    </button>
  );
}

/** The row of hero chips: one line; it scrolls sideways rather than wrapping. */
export function HeroChips({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx(styles.chips, className)} role="group" aria-label={label}>
      {children}
    </div>
  );
}

/* ── FactGrid ─────────────────────────────────────────────────────────────────────────────── */

export type Fact = { id: string; label: ReactNode; value: ReactNode };

/** Two-by-two facts for a phone sheet or a side panel: label over value, one line each. */
export function FactGrid({ facts, className }: { facts: Fact[]; className?: string }) {
  return (
    <dl className={cx(styles.factGrid, className)}>
      {facts.map((fact) => (
        <div key={fact.id} className={styles.fact}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ── StatusPill ───────────────────────────────────────────────────────────────────────────── */

/**
 * A status as a round pill (v10 review and state pills): the words stay neutral ink, the glyph
 * carries the tone. Never a tinted fill and never red or amber words.
 */
export function StatusPill({
  tone,
  children,
  size = "md",
  className,
  title,
}: {
  tone?: WfTone;
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={cx(styles.pill, size === "sm" && styles.pillSm, className)}
      data-testid="wf-status-pill"
      title={title}
    >
      {tone ? <StatusGlyph tone={tone} size={9} /> : null}
      <span className={styles.pillText}>{children}</span>
    </span>
  );
}

/* ── rowDim ───────────────────────────────────────────────────────────────────────────────── */

/**
 * Props that dim a legacy `<tr>` (or any element) by colour when a highlight does not match it:
 * `<tr {...rowDim(!matches)}>`. The global rule in ward-flow-v9-tokens.css reaches the row's
 * cells and their inline text, so a page needs no local copy. Rows stay in place and focusable.
 */
export function rowDim(dim: boolean): { "data-dim"?: "true" } {
  return dim ? { "data-dim": "true" } : {};
}

/* ── TimeRail ─────────────────────────────────────────────────────────────────────────────── */

export type TimeRailMark = {
  id: string;
  /** When it falls, in the caller's minute clock (an `Instant`). */
  at: number;
  /** Short code on the mark ("1A", "T2"). */
  code: ReactNode;
  /** Words for the accessible name ("Form 1A"). */
  name: string;
  /** Dot tone: danger and warning fill the dot; anything else is an outline. */
  tone?: WfTone;
  onSelect?: () => void;
};

export type TimeRailProps = {
  marks: TimeRailMark[];
  /** The current minute, on the same clock as `at`. */
  now: number;
  /** Clock text for a minute ("14:00", "14:00 tomorrow"). */
  formatTime: (at: number) => string;
  /** Minutes the rail covers from now. Defaults to twelve hours. */
  spanMinutes?: number;
  /** Minutes between ticks. Defaults to four hours. */
  tickMinutes?: number;
  /** Marks closer than this share one button, so labels never overlap. Defaults to 150. */
  clusterMinutes?: number;
  /** Label of the last tick. Defaults to "12h" style from `spanMinutes`. */
  endLabel?: string;
  /** Bay title for marks already past. Defaults to "Passed". */
  passedLabel?: string;
  /** Verbs for accessible names. Default "passed" / "due". */
  verbs?: { passed: string; upcoming: string };
  /** Foot words for marks beyond the rail. */
  laterText?: (count: number) => string;
  testId?: string;
  className?: string;
};

/**
 * Times on one line (v10 TimeRail, from the Legal forms clock rail): a Passed bay above, then each
 * mark in the next span. Close marks share one button; each mark is a button named by its name
 * and time. Page surface, not hero.
 */
export function TimeRail({
  marks,
  now,
  formatTime,
  spanMinutes = 12 * 60,
  tickMinutes = 4 * 60,
  clusterMinutes = 150,
  endLabel,
  passedLabel = "Passed",
  verbs = { passed: "passed", upcoming: "due" },
  laterText = (count) => (count > 0 ? `${count} more after the rail` : "Nothing beyond the rail"),
  testId = "wf-time-rail",
  className,
}: TimeRailProps) {
  const passed = marks.filter((mark) => mark.at <= now).sort((a, b) => a.at - b.at);
  const upcoming = marks.filter((mark) => mark.at > now && mark.at - now <= spanMinutes).sort((a, b) => a.at - b.at);
  const later = marks.length - passed.length - upcoming.length;
  const clusters: TimeRailMark[][] = [];
  for (const mark of upcoming) {
    const last = clusters.at(-1);
    if (last && mark.at - last[0]!.at < clusterMinutes) last.push(mark);
    else clusters.push([mark]);
  }
  const ticks: number[] = [];
  for (let minutes = 0; minutes <= spanMinutes; minutes += tickMinutes) ticks.push(now + minutes);
  const x = (at: number) => `${((at - now) / spanMinutes) * 100}%`;
  const end = endLabel ?? `${Math.round(spanMinutes / 60)}h`;
  return (
    <div className={cx(styles.rail, className)} data-testid={testId}>
      <div className={styles.railBay} data-on={passed.length > 0 ? "true" : undefined}>
        <span className={styles.railBayValue}>
          <span>{passedLabel}</span>
          <span className={styles.mono}>{passed.length}</span>
        </span>
        {passed.slice(0, 3).map((mark) => {
          const at = formatTime(mark.at);
          return (
            <button
              key={mark.id}
              type="button"
              className={styles.railBayMark}
              onClick={mark.onSelect}
              aria-label={`${mark.name} ${verbs.passed} ${at}, open`}
            >
              <StatusGlyph tone="danger" size={9} />
              <span className={styles.railCode}>{mark.code}</span>
              <span className={styles.mono}>{at}</span>
            </button>
          );
        })}
        {passed.length > 3 ? <span className={styles.railMore}>+{passed.length - 3}</span> : null}
      </div>
      <div className={styles.railPlot}>
        <span className={styles.railLine} aria-hidden="true" />
        {clusters.map((cluster, index) => {
          const mark = cluster[0]!;
          const at = formatTime(mark.at);
          const more = cluster.length - 1;
          return (
            <button
              key={mark.id}
              type="button"
              className={styles.railMark}
              data-lane={index % 2}
              style={{ left: x(mark.at) }}
              onClick={mark.onSelect}
              aria-label={`${mark.name} ${verbs.upcoming} ${at}${more > 0 ? ` and ${more} more close after` : ""}, open`}
            >
              <span className={styles.railLabel}>
                <span className={styles.railCode}>{mark.code}</span>
                {at}
                {more > 0 ? <span className={styles.railMore}>+{more}</span> : null}
              </span>
              <span className={styles.railDot} data-tone={mark.tone} />
            </button>
          );
        })}
        {ticks.map((tick, index) => (
          <span
            key={tick}
            className={styles.railTick}
            data-first={index === 0 ? "true" : undefined}
            data-last={index === ticks.length - 1 ? "true" : undefined}
            style={{ left: x(tick) }}
            aria-hidden="true"
          >
            {index === 0 ? "Now" : index === ticks.length - 1 ? end : formatTime(tick)}
          </span>
        ))}
      </div>
      <p className={styles.railFoot}>{laterText(later)}</p>
    </div>
  );
}

/* ── JourneyStrip ─────────────────────────────────────────────────────────────────────────── */

export type JourneyStage = {
  id: string;
  /** Stage name ("ED triage", "Waiting for a bed"). */
  label: string;
  /** Minutes spent in the stage. Sizes the stage. */
  minutes: number;
  /** A waiting stage: hatched, not solid. */
  quiet?: boolean;
  /** The stage under way now: info edge and marker. At most one. */
  now?: boolean;
};

/**
 * One person's path with real durations (v10 JourneyRibbon): each stage's width is its share of
 * the time. Short stages drop their words on screen (they stay in the accessible name and the
 * optional note). Works on the hero (`surface="hero"`) and on a page card.
 */
export function JourneyStrip({
  stages,
  formatDuration,
  label = "Journey",
  surface = "page",
  note = true,
  className,
}: {
  stages: JourneyStage[];
  /** Duration text ("2h 10m"). */
  formatDuration: (minutes: number) => string;
  /** Leads the accessible name ("Journey since ED arrival"). */
  label?: string;
  surface?: "hero" | "page";
  /** Show the "Now … · Short stages …" line under the strip. */
  note?: boolean;
  className?: string;
}) {
  const total = Math.max(
    1,
    stages.reduce((sum, stage) => sum + Math.max(0, stage.minutes), 0),
  );
  const short = stages.filter((stage) => !stage.now && stage.minutes / total < 0.1);
  const current = stages.find((stage) => stage.now);
  const summary = `${label}: ${stages.map((stage) => `${stage.label} ${formatDuration(stage.minutes)}`).join(", ")}${current ? `. Now ${current.label.toLowerCase()}.` : "."}`;
  return (
    <div className={cx(styles.journey, surface === "hero" && styles.journeyHero, className)} data-testid="wf-journey">
      <div className={styles.journeyBar} role="img" aria-label={summary}>
        {stages.map((stage) => {
          const share = Math.max(0, stage.minutes) / total;
          return (
            <div
              key={stage.id}
              className={styles.journeySeg}
              data-quiet={stage.quiet ? "true" : undefined}
              data-now={stage.now ? "true" : undefined}
              style={{ flexGrow: Math.max(0, stage.minutes), flexShrink: 1, flexBasis: 0 }}
              title={`${stage.label}, ${formatDuration(stage.minutes)}`}
            >
              {share >= 0.06 || stage.now ? formatDuration(stage.minutes) : ""}
            </div>
          );
        })}
      </div>
      <div className={styles.journeyLabels} aria-hidden="true">
        {stages.map((stage) => (
          <span key={stage.id} style={{ flexGrow: Math.max(0, stage.minutes), flexShrink: 1, flexBasis: 0 }}>
            {Math.max(0, stage.minutes) / total >= 0.09 ? stage.label : ""}
          </span>
        ))}
      </div>
      {note && (current || short.length > 0) ? (
        <span className={styles.journeyNote} aria-hidden="true">
          {current ? `Now: ${current.label} ${formatDuration(current.minutes)}` : ""}
          {current && short.length > 0 ? " · " : ""}
          {short.length > 0
            ? `Short stages: ${short.map((stage) => `${stage.label} ${formatDuration(stage.minutes)}`).join(", ")}`
            : ""}
        </span>
      ) : null}
    </div>
  );
}
