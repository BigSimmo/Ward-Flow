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
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      timer = setTimeout(tick, fast ? 1000 - (t % 1000) : 60_000 - (t % 60_000));
    };
    timer = setTimeout(tick, fast ? 1000 : 60_000 - (Date.now() % 60_000));
    return () => clearTimeout(timer);
  }, [fast, paused]);
  return now;
}
