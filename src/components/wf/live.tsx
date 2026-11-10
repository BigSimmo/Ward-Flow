"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { cx } from "./cx";
import { clk, dur } from "./format";
import { SrOnly } from "./primitives";
import { StatusGlyph } from "./status-glyph";
import { useIsPhone } from "./use-is-phone";
import { useMinuteNow } from "./use-minute-now";
import styles from "./live.module.css";
import primitiveStyles from "./primitives.module.css";

type LiveState = "live" | "paused" | "syncing" | "stale" | "offline";

export type LiveChipProps = {
  state: LiveState;
  /**
   * Live, phone only (M8: tablet and desktop chips never show it, the top bar owns time): age of the
   * last sync, shown small after the word ("1s"). The phone chip shows the shared clock instead
   * ("Demo 10:42", v10 phone hero) when the shell publishes one; pass `null` to show the word alone.
   */
  age?: ReactNode;
  /** Stale: the last good sync. Shown as "Not updating since HH:MM" (M8). */
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

const subscribeNever = () => () => {};

/** False in the server's render and while hydrating it, true after. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
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
 * ms), and the chip reads "Not updating since" it once it is older than `staleAfterMs`.
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

/*
 * P167: a hidden tab skips its refreshes, so its last good refresh ages while nobody can see it. The
 * gap is counted from when the tab was last shown, so coming back (or closing a duplicate tab) gives
 * the refresh its normal time before the chip says Stale. 0 means shown since the page opened.
 */
let visibleSince = 0;
const visibleListeners = new Set<() => void>();
function onVisibility() {
  visibleSince = document.visibilityState === "hidden" ? -1 : Date.now();
  for (const listener of visibleListeners) listener();
}
function subscribeVisible(listener: () => void) {
  if (visibleListeners.size === 0) {
    // Unwatched, the last value may be old: start from the page as it is now.
    visibleSince = document.visibilityState === "hidden" ? -1 : 0;
    document.addEventListener("visibilitychange", onVisibility);
  }
  visibleListeners.add(listener);
  return () => {
    visibleListeners.delete(listener);
    if (visibleListeners.size === 0) document.removeEventListener("visibilitychange", onVisibility);
  };
}

/**
 * CS-13: whether the last good shared refresh is older than its limit. Re-checked at that deadline
 * (a few seconds), not on the minute, so a hung refresh turns Stale on time (Codex review of #504).
 * Off when `active` is false or nothing is published (local mode).
 */
export function useSharedRefreshLate(active = true, thresholdMs?: number, visibilityGrace = true): boolean {
  const refresh = useSyncExternalStore(
    subscribeLiveRefresh,
    () => liveRefresh,
    () => undefined,
  );
  const shownSince = useSyncExternalStore(
    subscribeVisible,
    () => visibleSince,
    () => 0,
  );
  const deadline =
    active &&
    (!visibilityGrace || shownSince >= 0) &&
    refresh?.receivedAt !== undefined &&
    (thresholdMs ?? refresh.staleAfterMs) !== undefined
      ? Math.max(refresh.receivedAt, visibilityGrace ? shownSince : 0) + (thresholdMs ?? refresh.staleAfterMs)!
      : undefined;
  const [lateAt, setLateAt] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (deadline === undefined) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      const wait = deadline - Date.now();
      if (wait < 0) setLateAt(deadline);
      else timer = setTimeout(check, wait + 1);
    };
    check();
    return () => clearTimeout(timer);
  }, [deadline]);
  return deadline !== undefined && lateAt === deadline;
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
 * Paused shows a ring, Syncing a small spinner, Stale an amber circle with "Not updating since HH:MM", and
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

/**
 * M8 (Josh, 3 Nov 2026): "One clock in the top bar. Stale is said in words, and phones and TVs keep
 * a freshness line." The shared board's freshness for the top bar's clock and the Live chip alike:
 * live, stale (with the last good refresh, epoch ms, when known) or offline. Offline follows the
 * browser's connection flag (A1-18); stale follows the refresh the shell publishes (CS-13, P167).
 * `active` false skips the refresh deadline (a chip asked to read paused, say).
 */
export function useLiveFreshness(active = true): { state: "live" | "stale" | "offline"; since?: number } {
  const online = useBrowserOnline();
  const refresh = useSyncExternalStore(
    subscribeLiveRefresh,
    () => liveRefresh,
    () => undefined,
  );
  const late = useSharedRefreshLate(active);
  if (!online) return { state: "offline" };
  // P167: one failed or slow refresh is not a gap by itself; a publisher with a limit turns stale
  // only when that limit passes.
  if (late || (refresh?.unavailable && refresh.staleAfterMs === undefined))
    return { state: "stale", since: refresh?.receivedAt };
  return { state: "live" };
}

/** M8: a stale board in words, "Not updating since 10:42" ("Not updating" with no known time). */
export function notUpdatingWords(since: Date | number | undefined): string {
  return since == null ? "Not updating" : `Not updating since ${clk(since)}`;
}

export function LiveChip({ state: requested, age, asAt, onHero = false, onTogglePause, className }: LiveChipProps) {
  // A1-18 (audit 13 Oct 2026): a chip asked to read live says Offline while the browser has no
  // connection, so no page shows a live dot over a session that is not updating. CS-13: and Stale
  // once the last good refresh is too old.
  const freshness = useLiveFreshness(requested === "live");
  const state: LiveState = requested !== "live" ? requested : freshness.state;
  // M8: Stale is said in words ("Not updating since 10:42"), replacing "Stale as at 10:42".
  const word = state === "stale" ? notUpdatingWords(asAt ?? freshness.since) : WORD[state];
  const paused = state === "paused";
  const isPhone = useIsPhone();
  const clock = useLiveClock();
  // M8: one clock, in the top bar. A phone has no bar clock, so its chip keeps the freshness line:
  // "Demo 10:42" from the shared clock (v10 phone hero), or its own age when none is published.
  // Tablet and desktop chips never show an age or a clock.
  const phoneClock = isPhone && age !== null && clock ? clock : undefined;
  const shownAge = isPhone ? (phoneClock ?? age) : null;
  // Phone load audit (10 Nov 2026): the shell's clock arrives only after hydration, so the server's
  // pill read "Demo" and grew leftwards into "Demo 10:42". An empty slot the clock's width holds
  // its place until then; it has no text, so nothing extra is read or matched.
  const hydrated = useHydrated();
  const clockPending = isPhone && age !== null && !hydrated && clock === undefined && shownAge == null;
  // M8: on tablet and desktop a plain Live chip would only repeat the top bar, so no pill shows.
  // The same status line stays mounted in every state, so a later Stale or Offline updates its
  // text and is announced, rather than arriving in a new region a screen reader can miss (#1375).
  const hidden = !isPhone && state === "live" && !onTogglePause;
  // The pill's own words for the toggle's name: the state, and the phone's clock or age when text.
  const spokenAge =
    state === "live" && (typeof shownAge === "string" || typeof shownAge === "number") ? shownAge : null;
  const toggleWords = [word, spokenAge].filter((part) => part != null).join(" ");
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
      ) : state === "live" && clockPending ? (
        <span className={cx(styles.u, styles.clk, styles.clkPending)} />
      ) : null}
      {onTogglePause ? (
        <span className={styles.toggleGlyph}>
          {paused ? <Play strokeWidth={2} aria-hidden="true" /> : <Pause strokeWidth={2} aria-hidden="true" />}
        </span>
      ) : null}
    </span>
  );
  return (
    <span className={cx(hidden ? primitiveStyles.srOnly : styles.group, className)} data-wf-live="">
      {/* Device audit (11 Oct 2026): the pause is folded into the Live pill — one control, not a pill
          and a separate 32 x 48 tile. The whole pill is the button; its glyph shows pause or play. */}
      {hidden ? null : onTogglePause ? (
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
      <SrOnly role="status">{word}</SrOnly>
    </span>
  );
}

/** Direction words. Every duration carries one. */
type TimerDirection = "waiting" | "in" | "left" | "overdue" | "ago" | "away" | "travelling" | "open";

const COUNTDOWN: TimerDirection[] = ["in", "left"];
const MINUTE = 60_000;
const DEFAULT_FLAG_WORDS = { soon: "Due soon", over: "Overdue" };

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
   * Threshold words for a cue that is not a deadline (the Movements row's ED wait reads "Long wait" /
   * "Over target", P099). Defaults to "Due soon" / "Overdue".
   */
  flagWords?: { soon: string; over: string };
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
  flagWords = DEFAULT_FLAG_WORDS,
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
            <SrOnly>{level === "soon" ? flagWords.soon : flagWords.over}</SrOnly>
          ) : level === "soon" ? (
            flagWords.soon
          ) : (
            flagWords.over
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
