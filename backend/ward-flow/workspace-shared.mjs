// @ts-check
// Small helpers the workspace store's modules share (postgres.mjs and its workspace-*.mjs parts).

/**
 * One run of `task` at a time. A call while one is out joins it and asks for one more pass, so
 * work queued during the run is not left behind (H-0289).
 * @template T
 * @param {() => Promise<T>} task
 * @returns {() => Promise<T>}
 */
export function singleFlight(task) {
  /** @type {Promise<T> | null} */
  let running = null;
  let again = false;
  return () => {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      let result;
      do {
        again = false;
        result = await task();
      } while (again);
      return result;
    })().finally(() => {
      running = null;
    });
    return running;
  };
}

/** `value` with object keys sorted at every depth, so equal values serialise the same. */
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}

/** Minutes from `at` to a stored time, so a screen can place it on its own clock. */
export const minutesFrom = (value, at) =>
  value ? Math.round((new Date(value).getTime() - at.getTime()) / 60_000) : null;
