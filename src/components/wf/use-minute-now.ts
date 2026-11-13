"use client";

import { useEffect, useState } from "react";

/**
 * v6 rule 9: lists update once a minute. Returns the current time, refreshed on each minute
 * boundary, or every second while `fast` is true (values under 10 minutes show seconds).
 * `paused` freezes the value, for the Live chip's pause control.
 */
export function useMinuteNow({ fast = false, paused = false }: { fast?: boolean; paused?: boolean } = {}): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (paused) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      clearTimeout(timer);
      timer = undefined;
      // No ticks (and no re-renders) while the tab is hidden; showing it again refreshes at once.
      if (document.visibilityState !== "visible") return;
      const t = Date.now();
      setNow(t);
      timer = setTimeout(tick, fast ? 1000 - (t % 1000) : 60_000 - (t % 60_000));
    };
    // Refresh straight away so Resume never shows the frozen time until the next boundary.
    tick();
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [fast, paused]);
  return now;
}
