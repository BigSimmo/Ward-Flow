"use client";

import { useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "./button";
import { cx } from "./cx";
import { clk, dur } from "./format";
import { SrOnly } from "./primitives";
import { StatusGlyph } from "./status-glyph";
import { useMinuteNow } from "./use-minute-now";
import styles from "./live.module.css";

export type LiveState = "live" | "paused" | "syncing" | "stale" | "offline";

export type LiveChipProps = {
  state: LiveState;
  /** Live: age of the last sync, shown small after the word ("1s", "synced 1s ago"). */
  age?: ReactNode;
  /** Stale: the last good sync. Shown as "as at HH:MM". */
  asAt?: Date | number;
  onHero?: boolean;
  /** Renders the pause control beside the chip. */
  onTogglePause?: () => void;
  className?: string;
};

const WORD: Record<LiveState, string> = {
  live: "Live",
  paused: "Paused",
  syncing: "Syncing",
  stale: "Stale",
  offline: "Offline",
};

/**
 * Live chip (rule 9: live and honest). Live pulses (the pulse stops under reduced motion),
 * Paused shows a ring, Syncing a small spinner, Stale an amber circle with "as at HH:MM", and
 * Offline a triangle. A `role="status"` line announces state changes only, never the ticking age.
 */
export function LiveChip({ state, age, asAt, onHero = false, onTogglePause, className }: LiveChipProps) {
  const word = WORD[state];
  const asAtText = state === "stale" && asAt != null ? `as at ${clk(asAt)}` : null;
  const paused = state === "paused";
  return (
    <span className={cx(styles.group, className)}>
      <span className={cx(styles.lv, onHero && styles.onHero)} aria-hidden="true">
        {state === "live" ? <span className={styles.pulse} /> : null}
        {state === "paused" ? <span className={styles.ring} /> : null}
        {state === "syncing" ? <span className={styles.spin} /> : null}
        {state === "stale" ? <StatusGlyph tone="warning" size={9} /> : null}
        {state === "offline" ? <StatusGlyph tone="danger" size={9} /> : null}
        {word}
        {state === "live" && age != null ? <span className={styles.u}>{age}</span> : null}
        {asAtText ? <span className={styles.u}>{asAtText}</span> : null}
      </span>
      <SrOnly role="status">{asAtText ? `${word}, ${asAtText}` : word}</SrOnly>
      {onTogglePause ? (
        <Button
          variant={onHero ? "onHero" : "sec"}
          size="sm"
          iconOnly
          icon={paused ? Play : Pause}
          aria-label={paused ? "Resume live updates" : "Pause live updates"}
          aria-pressed={paused}
          className={styles.pause}
          onClick={onTogglePause}
        />
      ) : null}
    </span>
  );
}

/** Direction words. Every duration carries one. */
export type TimerDirection = "waiting" | "in" | "left" | "overdue" | "ago" | "away" | "travelling" | "open";

const COUNTDOWN: TimerDirection[] = ["in", "left"];
const MINUTE = 60_000;

export type TimerProps = {
  /** Epoch ms. Counting up from it (`waiting`, `ago`) or down to it (`in`, `left`). */
  at: number;
  direction: TimerDirection;
  /**
   * Thresholds in ms. Counting up: "Due soon" from `dueSoon`, "Overdue" from `overdue`.
   * Counting down: "Due soon" when `dueSoon` or less is left, "Overdue" once it passes.
   */
  thresholds?: { dueSoon?: number; overdue?: number };
  /** Shared clock from a parent list, so one timer drives every row. */
  now?: number;
  /** Freezes the value (Live chip paused). */
  paused?: boolean;
  /** Offline: marks the value as an estimate. */
  estimate?: boolean;
  /** Chip look (hairline box), as in card heads and lists. */
  chip?: boolean;
  /** Hide the threshold word (when a column already shows it). The glyph stays. */
  hideFlagWord?: boolean;
  /**
   * Hide the direction word visually when the column header already says it ("WAITING"). It stays
   * for screen readers.
   */
  hideDirection?: boolean;
  className?: string;
};

/**
 * Duration with a direction word, from the shared `dur` formatter. Updates once a minute and
 * ticks seconds only under 10 minutes. `role="timer"` with no `aria-live`. Thresholds add a glyph
 * and a word ("Due soon", "Overdue"); the value itself stays ink-1.
 */
export function Timer({
  at,
  direction,
  thresholds,
  now: nowProp,
  paused = false,
  estimate = false,
  chip = false,
  hideFlagWord = false,
  hideDirection = false,
  className,
}: TimerProps) {
  const [fast, setFast] = useState(false);
  const clock = useMinuteNow({ fast: nowProp == null && fast, paused: paused || nowProp != null });
  const now = nowProp ?? clock;
  const countdown = COUNTDOWN.includes(direction);
  const ms = countdown ? at - now : now - at;
  const shouldTickSeconds = Math.abs(ms) < 10 * MINUTE;
  if (nowProp == null && shouldTickSeconds !== fast) setFast(shouldTickSeconds);

  let level: "soon" | "over" | null = null;
  if (countdown) {
    if (ms < 0) level = "over";
    else if (thresholds?.dueSoon != null && ms <= thresholds.dueSoon) level = "soon";
  } else {
    if (thresholds?.overdue != null && ms >= thresholds.overdue) level = "over";
    else if (thresholds?.dueSoon != null && ms >= thresholds.dueSoon) level = "soon";
  }

  const shownDirection: TimerDirection = countdown && ms < 0 ? "overdue" : direction;
  const wordFirst = shownDirection === "in";
  const word = hideDirection ? (
    <SrOnly>{shownDirection}</SrOnly>
  ) : (
    <span className={styles.word}>{shownDirection}</span>
  );

  return (
    <span className={cx(styles.timer, className)}>
      {level ? (
        <span className={cx(styles.flag, level === "soon" ? styles.soon : styles.over)}>
          <StatusGlyph tone={level === "soon" ? "warning" : "danger"} size={9} />
          {hideFlagWord ? (
            <SrOnly>{level === "soon" ? "Due soon" : "Overdue"}</SrOnly>
          ) : level === "soon" ? (
            "Due soon"
          ) : (
            "Overdue"
          )}
        </span>
      ) : null}
      <span role="timer" className={cx(styles.value, chip && styles.chip)}>
        {wordFirst ? word : null}
        <span className={styles.digits}>{dur(ms)}</span>
        {wordFirst ? null : word}
        {estimate ? <span className={styles.word}>est.</span> : null}
      </span>
    </span>
  );
}
