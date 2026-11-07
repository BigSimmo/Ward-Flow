/**
 * One read at a time. Failed reads back off; a successful foreground read restores the cadence. A read
 * the client skipped (a save in flight, audit SD-04) is neither: it keeps the current delay.
 */
export function startWardPolling(options: { refresh: () => Promise<boolean | "skipped">; visible: () => boolean }) {
  const delays = [3_000, 15_000, 60_000];
  let failures = 0;
  let stopped = false;
  let reading = false;
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    clearTimeout(timer);
    if (!stopped) timer = setTimeout(() => void tick(), delays[Math.min(failures, 2)]);
  };
  const tick = async () => {
    if (stopped) return;
    if (!options.visible()) return schedule();
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
    },
  };
}
