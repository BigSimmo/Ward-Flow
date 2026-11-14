import { useEffect, type Dispatch, type SetStateAction } from "react";

/**
 * The board clock's tick, moved out of `ward-flow-provider.tsx` unchanged (feature 47 made room).
 * Off for a pinned clock and before the mount effect adopts the wall clock (`active` false).
 */
export function useWardMinuteTick(active: boolean, setTick: Dispatch<SetStateAction<number>>, phaseMs = 0) {
  // L1: the device time a board minute starts at, modulo a minute (0 is the device's own minute).
  const phase = Number.isFinite(phaseMs) ? ((Math.round(phaseMs) % 60_000) + 60_000) % 60_000 : 0;
  useEffect(() => {
    if (!active) return;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextTick = () => {
      const nowMs = Date.now();
      const remainder = (((nowMs - phase) % 60_000) + 60_000) % 60_000;
      // P166: the board clock shows whole minutes, so tick once at each top of the minute.
      const delay = remainder === 0 ? 60_000 : 60_000 - remainder;
      timeoutTimer = setTimeout(() => {
        setTick((tick) => tick + 1);
        scheduleNextTick();
      }, delay);
    };

    // A tab opened (or mounted) in the background starts ticking only once it is shown.
    if (document.visibilityState === "visible") scheduleNextTick();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setTick((tick) => tick + 1);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        scheduleNextTick();
      } else if (timeoutTimer) {
        // P166: no ticks (and no re-renders) while the tab is hidden; the visible branch catches up.
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [active, setTick, phase]);
}
