/**
 * When the shared client waits before reading or saving again (master audit list, 10 Nov 2026).
 *
 * M69: a read after the network comes back waits a random part of `ONLINE_SPREAD_MS`, like a
 * backed-off poll (ward-shared-polling.ts), so desks whose network returned together (a ward's
 * Wi-Fi) do not all read in the same second.
 *
 * M53: a save the server refused with HTTP 429 was refused before any work, so nothing was saved.
 * The client keeps it and the saves behind it, waits for Retry-After (10 seconds without one, at
 * most two minutes), then sends them again with the same command IDs.
 */
export const ONLINE_SPREAD_MS = 5_000;
const LIMIT_WAIT_DEFAULT_S = 10;
const LIMIT_WAIT_MAX_S = 120;

/** The wait a 429 asks for, in milliseconds: Retry-After in seconds or as a date. */
export function retryAfterMs(response: Response, now = Date.now()): number {
  const header = response.headers.get("retry-after")?.trim() ?? "";
  const seconds = /^\d+$/u.test(header)
    ? Number(header)
    : Number.isFinite(Date.parse(header))
      ? Math.ceil((Date.parse(header) - now) / 1000)
      : LIMIT_WAIT_DEFAULT_S;
  return Math.min(Math.max(seconds, 1), LIMIT_WAIT_MAX_S) * 1000;
}

export class SharedPacing {
  private onlineTimer: ReturnType<typeof setTimeout> | undefined;
  private limitTimer: ReturnType<typeof setTimeout> | undefined;
  private limitedUntil = 0;
  /** `random` gives a number in [0, 1); tests pass a fixed value. */
  constructor(private readonly random: () => number) {}
  /** M69: each time the network returns, run once a random part of the spread later; a burst runs once. */
  onOnline(run: () => void, signal: AbortSignal) {
    globalThis.window?.addEventListener(
      "online",
      () => {
        clearTimeout(this.onlineTimer);
        this.onlineTimer = setTimeout(run, Math.floor(this.random() * ONLINE_SPREAD_MS));
      },
      { signal },
    );
  }
  /** M53: no save goes until the wait a 429 asked for has passed; then `run` sends them. */
  holdFor(response: Response, run: () => void) {
    const waitMs = retryAfterMs(response);
    this.limitedUntil = Date.now() + waitMs;
    clearTimeout(this.limitTimer);
    this.limitTimer = setTimeout(() => {
      this.limitedUntil = 0;
      run();
    }, waitMs);
  }
  get limited() {
    return Date.now() < this.limitedUntil;
  }
  stop() {
    clearTimeout(this.onlineTimer);
    clearTimeout(this.limitTimer);
  }
}
