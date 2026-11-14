import type { Instant } from "@/components/ward-management/ward-clock";

/**
 * The shared workspace's board clock between poll answers (TC-05, audits 24 and 26 Oct 2026,
 * H-0218 and H-0774). The server's answer carries its own board minute (`snapshot.now`), and the
 * board used to show exactly that until the next answer arrived, so a slow or failed poll held every
 * due, overdue and "since" label still. This advances the last answer's minute by the whole minutes
 * elapsed on this device since it was received, so a legal due time still turns overdue while polls
 * are failing. Each answer re-anchors it, so a device clock that is wrong by hours never moves the
 * board by more than the minutes since the last answer; a device clock set back reads as no time
 * passed, never as the board running backwards. The server keeps its own clock for every save; a
 * save also sends the minute this board showed when it was pressed (`actedAt`), which the server
 * keeps, within bounds, only for a save that waited (H1, `ward-offline-entry.ts`).
 */
export function sharedBoardNow(
  snapshotNow: Instant,
  receivedAtMs: number,
  deviceNowMs = Date.now(),
  msIntoMinute = 0,
): Instant {
  if (!Number.isFinite(receivedAtMs) || receivedAtMs <= 0 || !Number.isFinite(deviceNowMs)) return snapshotNow;
  const into = Number.isFinite(msIntoMinute) && msIntoMinute > 0 ? msIntoMinute : 0;
  return snapshotNow + Math.floor((into + Math.max(0, deviceNowMs - receivedAtMs)) / 60_000);
}

/**
 * L1 (mechanics and clock audit, 14 Nov 2026): where the shared board clock counts from. `minute`
 * is the board minute at `at` (this device's time the answer arrived) and `ms` how far into that
 * minute the server was, so the board turns the minute when the server does, not up to a minute
 * later. `generation` is the world it belongs to: within one world the board never shows a minute
 * earlier than it already showed, even when a slow answer after an outage is sampled earlier.
 */
export type SharedBoardAnchor = { minute: Instant; at: number; ms: number; generation: number };

type AnchoredSnapshot = {
  now: Instant;
  payload: { dayZero?: string; state: { clockOffsetMinutes: number; worldGeneration: number } };
};

const phaseAt = (anchor: SharedBoardAnchor, at: number) =>
  (((anchor.ms + Math.max(0, at - anchor.at)) % 60_000) + 60_000) % 60_000;

/** The anchor for an answer received at `receivedAtMs`. `serverTimeMs` is the answer's `serverTime`, when sent. */
export function anchorSharedBoard(
  previous: SharedBoardAnchor | undefined,
  snapshot: AnchoredSnapshot,
  receivedAtMs: number,
  serverTimeMs?: number,
): SharedBoardAnchor {
  const generation = snapshot.payload.state.worldGeneration;
  const same = previous !== undefined && previous.generation === generation;
  const dayZeroMs = typeof snapshot.payload.dayZero === "string" ? Date.parse(snapshot.payload.dayZero) : Number.NaN;
  // The server's board minute is whole minutes since its day 0 plus the demo offset, so the
  // milliseconds past that minute come from its own time in the same answer.
  const fromServer =
    typeof serverTimeMs === "number" && Number.isFinite(serverTimeMs) && Number.isFinite(dayZeroMs)
      ? serverTimeMs - dayZeroMs - (snapshot.now - snapshot.payload.state.clockOffsetMinutes) * 60_000
      : Number.NaN;
  // An answer without the server's time (a save's reply, an older server) keeps the last phase.
  const ms =
    Number.isFinite(fromServer) && fromServer >= 0 && fromServer < 120_000
      ? fromServer
      : same
        ? phaseAt(previous, receivedAtMs)
        : 0;
  if (same) {
    const shown = sharedBoardNow(previous.minute, previous.at, receivedAtMs, previous.ms);
    if (snapshot.now + Math.floor(ms / 60_000) < shown)
      return { minute: shown, at: receivedAtMs, ms: phaseAt(previous, receivedAtMs), generation };
  }
  return { minute: snapshot.now, at: receivedAtMs, ms, generation };
}

/** The board minute an anchor reads at this device's `deviceNowMs`. */
export function anchoredBoardNow(anchor: SharedBoardAnchor, deviceNowMs: number): Instant {
  return sharedBoardNow(anchor.minute, anchor.at, deviceNowMs, anchor.ms);
}

/** This device's time, read where the provider's render reads the clock (beside `absoluteWallClockMinutes`). */
export function deviceClockMs(): number {
  return Date.now();
}

/**
 * A "not modified" poll answer as a view update. The receipt time always moves (the board clock and
 * the staleness checks read it), but the snapshot keeps its identity unless the server's minute moved,
 * so the provider and every reader of the board do not re-render on each three-second poll.
 */
export function notModifiedUpdate<S extends { now: Instant }>(
  snapshot: S,
  serverNow: Instant,
  receivedAt: number,
): { snapshot?: S; receivedAt: number } {
  return serverNow === snapshot.now ? { receivedAt } : { snapshot: { ...snapshot, now: serverNow }, receivedAt };
}

/**
 * TC2-05 (audit 26 Oct 2026, H-0764): the server's access deadline, moved onto this device's clock.
 * The server sends `accessUntil` as a moment on its own clock and, from this change, its own time
 * (`serverTime`) in the same answer. Every check here compares the deadline with `Date.now()`, so a
 * device N minutes slow kept showing records N minutes past the server's end, and one fast by more
 * than the time left refused the workspace at once; the "signed out at" warning was early or late
 * by the same amount. Shifting the deadline by the offset seen in this answer makes those checks
 * read the time left on the server's clock. The answer's travel time can only make it a little
 * later here, never earlier, and the server still refuses every read and save past its own end. An
 * older server sends no `serverTime`, and its deadline is used as before. Mutates and returns the parsed answer.
 */
export function onDeviceClock<T>(value: T, deviceNowMs: number): T {
  const offset = serverClockLead(value, deviceNowMs);
  if (offset === undefined) return value;
  const answer = value as { accessUntil?: unknown; snapshot?: { accessUntil?: unknown } };
  if (typeof answer.accessUntil === "number" && Number.isFinite(answer.accessUntil)) answer.accessUntil -= offset;
  const snapshot = answer.snapshot;
  if (
    snapshot &&
    typeof snapshot === "object" &&
    typeof snapshot.accessUntil === "number" &&
    Number.isFinite(snapshot.accessUntil)
  )
    snapshot.accessUntil -= offset;
  return value;
}

/**
 * How far the server's clock is ahead of this device's in this answer (negative when behind), or
 * `undefined` when the answer carries no `serverTime` (an older server). `onDeviceClock` moves the
 * access deadline by it; time audit C2 (13 Nov 2026) moves the session limit by the same amount.
 */
export function serverClockLead(value: unknown, deviceNowMs: number): number | undefined {
  if (!value || typeof value !== "object") return undefined;
  const serverTime = (value as { serverTime?: unknown }).serverTime;
  return typeof serverTime === "number" && Number.isFinite(serverTime) && Number.isFinite(deviceNowMs)
    ? serverTime - deviceNowMs
    : undefined;
}
