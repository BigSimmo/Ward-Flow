"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { LiveChip } from "@/components/wf";
import { useWardFlowClock } from "./ward-flow-provider";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";

/**
 * Rule 9 for the wards and capacity pages: every page shows one Live chip with a pause control.
 *
 * `now` is the synthetic ward clock (minutes since midnight) from the provider. While paused it
 * stays at the instant the reader paused, so lists stop moving under them; resuming returns to the
 * provider's clock. The chip shows that ward clock time.
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

/*
 * P168 (audit register): the chip showed seconds since the provider's last tick ("Demo 8s", "Demo
 * 25s"), which differed between screens and ticked every second. It now shows the ward clock, as Home,
 * Statistics and the phone chip do ("Demo 14:20"), and holds that time while paused.
 */
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
  // The chip's own current instant (held at the pause), so a bare clock is today by definition.
  const now = heldNow ?? liveNow;
  return <>{formatInstant(now)}</>;
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
