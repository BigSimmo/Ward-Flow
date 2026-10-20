"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { cx } from "./cx";
import { clk, dur } from "./format";
import { SrOnly } from "./primitives";
import { StatusGlyph } from "./status-glyph";
import { useIsPhone } from "./use-is-phone";
import { useMinuteNow } from "./use-minute-now";
import styles from "./live.module.css";

type LiveState = "live" | "paused" | "syncing" | "stale" | "offline";

export type LiveChipProps = {
  state: LiveState;
  /**
   * Live: age of the last sync, shown small after the word ("1s", "synced 1s ago"). On a phone the
   * chip shows the shared clock instead ("Live 10:42", v10 phone hero) when the shell publishes one;
   * pass `null` to show the word alone.
   */
  age?: ReactNode;
  /** Stale: the last good sync. Shown as "as at HH:MM". */
  asAt?: Date | number;
  onHero?: boolean;
  /** Renders the pause control beside the chip. */
  onTogglePause?: () => void;
  className?: string;
};

/*
 * The clock the phone Live chip shows ("Live HH:MM"). The app shell publishes its own clock here
 * (`publishLiveClock`), so every page's chip reads the same time without wiring it through. Nothing
 * is published outside the shell, and the chip then keeps its `age`.
 */
let liveClock: string | undefined;
const liveClockListeners = new Set<() => void>();

export function publishLiveClock(value: string | undefined) {
  if (value === liveClock) return;
  liveClock = value;
  for (const listener of liveClockListeners) listener();
}

function subscribeLiveClock(listener: () => void) {
  liveClockListeners.add(listener);
  return () => {
    liveClockListeners.delete(listener);
  };
}

function useLiveClock(): string | undefined {
  return useSyncExternalStore(
    subscribeLiveClock,
    () => liveClock,
    () => undefined,
  );
}

/*
 * Audit 1 (CS-13, Josh 20 Oct): whether the shared board's refresh is failing or late. The app shell
 * publishes it (`publishLiveRefresh`) in shared mode; with nothing published (local mode) a live
 * chip follows the browser's connection flag alone. `receivedAt` is the last good refresh (epoch
 * ms), and the chip reads Stale "as at" it once it is older than `staleAfterMs`.
 */
export type LiveRefresh = { unavailable: boolean; receivedAt?: number; staleAfterMs?: number };
let liveRefresh: LiveRefresh | undefined;
const liveRefreshListeners = new Set<() => void>();

export function publishLiveRefresh(value: LiveRefresh | undefined) {
  if (
    value?.unavailable === liveRefresh?.unavailable &&
    value?.receivedAt === liveRefresh?.receivedAt &&
    value?.staleAfterMs === liveRefresh?.staleAfterMs
  )
    return;
  liveRefresh = value;
  for (const listener of liveRefreshListeners) listener();
}

function subscribeLiveRefresh(listener: () => void) {
  liveRefreshListeners.add(listener);
  return () => {
    liveRefreshListeners.delete(listener);
  };
}

const WORD: Record<LiveState, string> = {
  live: "Demo",
  paused: "Paused",
  syncing: "Syncing",
  stale: "Stale",
  offline: "Offline",
};

/**
 * Live chip (rule 9: live and honest). Live pulses once as it turns live (none under reduced motion),
 * Paused shows a ring, Syncing a small spinner, Stale an amber circle with "as at HH:MM", and
 * Offline a grey dot (a live chip turns Offline by itself while the browser has no connection, and
 * Stale while the shared refresh it is told about is failing or late). A `role="status"` line announces state changes only, never the ticking age.
 */
function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** The browser's own connection flag; online on the server and at hydration. */
function useBrowserOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine !== false,
    () => true,
  );
}

export function LiveChip({ state: requested, age, asAt, onHero = false, onTogglePause, className }: LiveChipProps) {
  // A1-18 (audit 13 Oct 2026): a chip asked to read live says Offline while the browser has no
  // connection, so no page shows a live dot over a session that is not updating.
  const online = useBrowserOnline();
  // CS-13: and Stale while the shared refresh is failing or its last good refresh is too old.
  const refresh = useSyncExternalStore(
    subscribeLiveRefresh,
    () => liveRefresh,
    () => undefined,
  );
  const timed = refresh?.receivedAt !== undefined && refresh.staleAfterMs !== undefined;
  const wallNow = useMinuteNow({ paused: requested !== "live" || !timed });
  const late =
    refresh?.receivedAt !== undefined &&
    refresh.staleAfterMs !== undefined &&
    wallNow - refresh.receivedAt > refresh.staleAfterMs;
  const state: LiveState =
    requested !== "live" ? requested : !online ? "offline" : refresh?.unavailable || late ? "stale" : "live";
  const word = WORD[state];
  const staleAt = asAt ?? refresh?.receivedAt;
  const asAtText = state === "stale" && staleAt != null ? `as at ${clk(staleAt)}` : null;
  const paused = state === "paused";
  const isPhone = useIsPhone();
  const clock = useLiveClock();
  // Phone (v10): the chip reads "Live HH:MM" from the shared clock; desktop keeps its own age.
  const phoneClock = isPhone && age !== null && clock ? clock : undefined;
  const shownAge = phoneClock ?? age;
  // The pill's own words for the toggle's name: the state, the clock or age when it is text.
  const spokenAge =
    state === "live" && (typeof shownAge === "string" || typeof shownAge === "number") ? shownAge : null;
  const toggleWords = [word, spokenAge, asAtText].filter((part) => part != null).join(" ");
  const chip = (
    <span className={cx(styles.lv, onHero && styles.onHero)} aria-hidden="true">
      {state === "live" ? <span className={styles.pulse} /> : null}
      {state === "paused" ? <span className={styles.ring} /> : null}
      {state === "syncing" ? <span className={styles.spin} /> : null}
      {state === "stale" ? <StatusGlyph tone="warning" size={9} /> : null}
      {/* A1-18: offline is not an act-now state, so its dot is neutral grey, not red. */}
      {state === "offline" ? <StatusGlyph tone="neutral" size={9} /> : null}
      {word}
      {/* Collapsed in the flex pill, but keeps "Demo 10:42" two words for label-in-name (F-19). */}{" "}
      {state === "live" && shownAge != null ? (
        <span className={cx(styles.u, phoneClock && styles.clk)}>{shownAge}</span>
      ) : null}
      {asAtText ? <span className={styles.u}>{asAtText}</span> : null}
      {onTogglePause ? (
        <span className={styles.toggleGlyph}>
          {paused ? <Play strokeWidth={2} aria-hidden="true" /> : <Pause strokeWidth={2} aria-hidden="true" />}
        </span>
      ) : null}
    </span>
  );
  return (
    <span className={cx(styles.group, className)} data-wf-live="">
      {/* Device audit (11 Oct 2026): the pause is folded into the Live pill — one control, not a pill
          and a separate 32 x 48 tile. The whole pill is the button; its glyph shows pause or play. */}
      {onTogglePause ? (
        <button
          type="button"
          className={styles.toggle}
          // One name with aria-pressed: swapping the name too reads as "Resume, pressed". F-19 (WCAG
          // 2.5.3): it starts with the words on the pill, so a voice command can say what it sees.
          aria-label={`${toggleWords}, pause demo updates`}
          aria-pressed={paused}
          onClick={onTogglePause}
        >
          {chip}
        </button>
      ) : (
        chip
      )}
      <SrOnly role="status">{asAtText ? `${word}, ${asAtText}` : word}</SrOnly>
    </span>
  );
}

/** Direction words. Every duration carries one. */
type TimerDirection = "waiting" | "in" | "left" | "overdue" | "ago" | "away" | "travelling" | "open";

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
