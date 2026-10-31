"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** A timed toast with up to this many words keeps the plain six seconds. */
const BASE_TIMED_MS = 6000;
const BASE_WORDS = 12;
/** Each word past the first twelve adds a quarter second, so a long outcome is not cut off mid-read. */
const PER_EXTRA_WORD_MS = 250;
const MAX_TIMED_MS = 12_000;

/**
 * How long a timed toast stays when its caller set no time: six seconds for a short outcome, a
 * little longer for each extra word, never more than twelve seconds.
 */
export function timedToastMs(title: string, body?: string): number {
  const words = `${title} ${body ?? ""}`.trim().split(/\s+/).filter(Boolean).length;
  const extra = Math.max(0, words - BASE_WORDS) * PER_EXTRA_WORD_MS;
  return Math.min(MAX_TIMED_MS, BASE_TIMED_MS + extra);
}

/**
 * The v9 exit time (`--wf-t-exit`, 160ms, or 120ms under reduced motion) read from the page. Zero
 * where no token stylesheet is loaded (a component test), so a closing toast leaves at once there.
 */
export function toastExitMs(): number {
  if (typeof window === "undefined" || typeof document === "undefined") return 0;
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue("--wf-t-exit").trim();
  const match = /^(\d*\.?\d+)(ms|s)$/.exec(raw);
  if (!match) return 0;
  const value = Number(match[1]);
  return Math.round(match[2] === "s" ? value * 1000 : value);
}

function subscribeToVisibility(notify: () => void) {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
}

/** True while the browser tab is hidden (another tab, a minimised window, a locked phone). */
export function useDocumentHidden(): boolean {
  return useSyncExternalStore(
    subscribeToVisibility,
    () => document.visibilityState === "hidden",
    () => false,
  );
}

/**
 * A pausable countdown. `onDone` runs once when `ms` has passed while not paused; pausing keeps
 * the time left. A new `restartKey` starts the full time again. `ms` of zero or less never ends.
 */
export function useCountdown(ms: number, paused: boolean, onDone: () => void, restartKey?: unknown) {
  const onDoneRef = useRef(onDone);
  const [run, setRun] = useState({ key: restartKey, ms });
  const remainingRef = useRef(ms);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // A new key or time restarts the window. Set during render, as React allows for derived state.
  if (run.key !== restartKey || run.ms !== ms) {
    setRun({ key: restartKey, ms });
  }

  useEffect(() => {
    remainingRef.current = run.ms;
  }, [run]);

  useEffect(() => {
    if (run.ms <= 0 || paused) return;
    const startedAt = Date.now();
    const startRemaining = remainingRef.current;
    const timer = window.setTimeout(() => {
      remainingRef.current = 0;
      onDoneRef.current();
    }, startRemaining);
    return () => {
      window.clearTimeout(timer);
      remainingRef.current = Math.max(0, startRemaining - (Date.now() - startedAt));
    };
  }, [run, paused]);
}
