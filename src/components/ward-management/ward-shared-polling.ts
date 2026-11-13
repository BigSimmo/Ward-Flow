/**
 * One read at a time. Failed reads back off; a successful foreground read restores the cadence. A read
 * the client skipped (a save in flight, audit SD-04) is neither: it keeps the current delay.
 *
 * M69 (master audit list, 10 Nov 2026): a backed-off delay is spread by up to a quarter either way,
 * so devices that lost the backend together (an outage at shift change) do not all retry in the same
 * second. The three-second cadence of a healthy board is not spread.
 */
const BACKOFF_SPREAD = 0.25;
export function startWardPolling(options: {
  refresh: () => Promise<boolean | "skipped">;
  visible: () => boolean;
  /** A number in [0, 1); tests pass a fixed value. */
  random?: () => number;
  /**
   * Calls back when the tab may have become visible; returns its unsubscribe. Defaults to the
   * document's `visibilitychange`. Without one (no document), a hidden tab re-checks on the cadence.
   */
  onVisible?: (listener: () => void) => () => void;
}) {
  const delays = [3_000, 15_000, 60_000];
  const random = options.random ?? Math.random;
  const delay = () => {
    const base = delays[Math.min(failures, 2)];
    return failures ? Math.round(base * (1 - BACKOFF_SPREAD + 2 * BACKOFF_SPREAD * random())) : base;
  };
  let failures = 0;
  let stopped = false;
  let reading = false;
  let timer: ReturnType<typeof setTimeout>;
  // A hidden tab parks the poller rather than waking every few seconds to re-check visibility.
  const watchVisible =
    options.onVisible ??
    (typeof document === "undefined"
      ? undefined
      : (listener: () => void) => {
          document.addEventListener("visibilitychange", listener);
          return () => document.removeEventListener("visibilitychange", listener);
        });
  let unpark: (() => void) | null = null;
  const resume = () => {
    if (stopped || !options.visible()) return;
    unpark?.();
    unpark = null;
    schedule();
  };
  const schedule = () => {
    clearTimeout(timer);
    if (!stopped) timer = setTimeout(() => void tick(), delay());
  };
  const tick = async () => {
    if (stopped) return;
    if (!options.visible()) {
      if (!watchVisible) return schedule();
      // The page's own visibility handler reads at once on return; this only restarts the cadence.
      unpark ??= watchVisible(resume);
      return;
    }
    reading = true;
    try {
      const read = await options.refresh();
      if (read !== "skipped") failures = read ? 0 : Math.min(failures + 1, 2);
    } catch {
      failures = Math.min(failures + 1, 2);
    } finally {
      reading = false;
      schedule();
    }
  };
  schedule();
  return {
    refreshed() {
      failures = 0;
      if (!reading) schedule();
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      unpark?.();
      unpark = null;
    },
  };
}
