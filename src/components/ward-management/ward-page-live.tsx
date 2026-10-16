"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { LiveChip } from "@/components/wf";
import { useWardFlowClock } from "./ward-flow-provider";
import type { Instant } from "@/components/ward-management/ward-clock";

/**
 * Rule 9 for the wards and capacity pages: every page shows one Live chip with a pause control.
 *
 * `now` is the synthetic ward clock (minutes since midnight) from the provider. While paused it
 * stays at the instant the reader paused, so lists stop moving under them; resuming returns to the
 * provider's clock. The chip's age is the wall time since the provider last ticked.
 */
export function usePageLive(): { now: Instant; paused: boolean; togglePause: () => void } {
  const liveNow = useWardFlowClock();
  const [pausedAt, setPausedAt] = useState<Instant | null>(null);
  const lastUnpausedNowRef = useRef(liveNow);
  useEffect(() => {
    if (pausedAt === null) {
      lastUnpausedNowRef.current = liveNow;
    }
  }, [liveNow, pausedAt]);
  const togglePause = useCallback(
    () => setPausedAt((value) => (value === null ? lastUnpausedNowRef.current : null)),
    [],
  );
  return { now: pausedAt ?? liveNow, paused: pausedAt !== null, togglePause };
}

/** Seconds since mount; remounted (via `key`) each time the provider clock ticks. */
function AgeTicker({ paused }: { paused?: boolean }) {
  const [mountedAt] = useState(() => Date.now());
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - mountedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [mountedAt, paused]);
  return <>{`${seconds}s`}</>;
}

function LiveAge({ paused }: { paused?: boolean }) {
  const liveNow = useWardFlowClock();
  const [heldNow, setHeldNow] = useState<Instant | null>(null);
  const lastUnpausedNowRef = useRef(liveNow);
  useEffect(() => {
    if (!paused) {
      lastUnpausedNowRef.current = liveNow;
    }
  }, [liveNow, paused]);
  useEffect(() => {
    setHeldNow(paused ? lastUnpausedNowRef.current : null);
  }, [paused]);
  return <AgeTicker key={heldNow ?? liveNow} paused={paused} />;
}

/** The page's Live chip and its pause button, on the hero band. */
export function PageLiveChip({ paused, onTogglePause }: { paused: boolean; onTogglePause: () => void }) {
  return (
    <LiveChip
      state={paused ? "paused" : "live"}
      age={<LiveAge paused={paused} />}
      onHero
      onTogglePause={onTogglePause}
    />
  );
}
