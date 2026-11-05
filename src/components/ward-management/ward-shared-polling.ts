/** One read at a time. Failed reads back off; a successful foreground read restores the cadence. */
export function startWardPolling(options: { refresh: () => Promise<boolean>; visible: () => boolean }) {
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
      failures = (await options.refresh()) ? 0 : Math.min(failures + 1, 2);
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
