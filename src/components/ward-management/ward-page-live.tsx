"use client";

import { useCallback, useEffect, useState } from "react";

import { LiveChip } from "@/components/wf";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Instant } from "@/components/ward-management/ward-clock";

/**
 * Rule 9 for the wards and capacity pages: every page shows one Live chip with a pause control.
 *
 * `now` is the synthetic ward clock (minutes since midnight) from the provider. While paused it
 * stays at the instant the reader paused, so lists stop moving under them; resuming returns to the
 * provider's clock. The chip's age is the wall time since the provider last ticked.
 */
export function usePageLive(): { now: Instant; paused: boolean; togglePause: () => void } {
  const { now } = useWardFlow();
  const [pausedAt, setPausedAt] = useState<Instant | null>(null);
  const togglePause = useCallback(() => setPausedAt((value) => (value === null ? now : null)), [now]);
  return { now: pausedAt ?? now, paused: pausedAt !== null, togglePause };
}

/** Seconds since mount; remounted (via `key`) each time the provider clock ticks. */
function AgeTicker() {
  const [mountedAt] = useState(() => Date.now());
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - mountedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [mountedAt]);
  return <>{`${seconds}s`}</>;
}

function LiveAge() {
  const { now } = useWardFlow();
  return <AgeTicker key={now} />;
}

/** The page's Live chip and its pause button, on the hero band. */
export function PageLiveChip({ paused, onTogglePause }: { paused: boolean; onTogglePause: () => void }) {
  return <LiveChip state={paused ? "paused" : "live"} age={<LiveAge />} onHero onTogglePause={onTogglePause} />;
}
