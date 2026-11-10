// @ts-check
/**
 * Audit M53: per-account request limits for routes a signed-in account could call in a loop.
 * A fixed window per key, held in this process only (one replica, see processCacheNotice). The key
 * map is bounded so many accounts cannot grow memory without limit: when full, only a key whose
 * window has ended makes room, so a new key cannot reset a busy one.
 *
 * A limit is checked before any work is done, so a refused request changed nothing and the same
 * request can be sent again after Retry-After.
 */

/** Phone alert sign-ups: a person turns alerts on by hand, so 30 in 10 minutes is far above use. */
export const PUSH_SUBSCRIBE_LIMIT = Object.freeze({ limit: 30, windowMs: 10 * 60_000 });
const MAX_KEYS = 5_000;

/**
 * @param {{ limit: number, windowMs: number, maxKeys?: number, now?: () => number }} options
 * @returns {(key: string) => { allowed: true } | { allowed: false, retryAfterSeconds: number }}
 */
export function createWindowLimiter({ limit, windowMs, maxKeys = MAX_KEYS, now = () => Date.now() }) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("A request limit needs a whole number above 0");
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new Error("A request limit needs a window above 0");
  /** @type {Map<string, { start: number, count: number }>} */
  const windows = new Map();
  return (key) => {
    const at = now();
    let entry = windows.get(key);
    if (entry && at - entry.start >= windowMs) {
      windows.delete(key);
      entry = undefined;
    }
    if (!entry) {
      if (windows.size >= maxKeys) {
        const [oldestKey, oldest] = windows.entries().next().value ?? [];
        if (oldest && at - oldest.start < windowMs)
          return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest.start + windowMs - at) / 1000)) };
        if (oldestKey !== undefined) windows.delete(oldestKey);
      }
      windows.set(key, { start: at, count: 1 });
      return { allowed: true };
    }
    if (entry.count >= limit)
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.start + windowMs - at) / 1000)) };
    entry.count++;
    return { allowed: true };
  };
}
