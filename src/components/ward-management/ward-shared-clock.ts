import type { Instant } from "@/components/ward-management/ward-clock";

/**
 * The shared workspace's board clock between poll answers (TC-05, audits 24 and 26 Oct 2026,
 * H-0218 and H-0774). The server's answer carries its own board minute (`snapshot.now`), and the
 * board used to show exactly that until the next answer arrived, so a slow or failed poll held every
 * due, overdue and "since" label still. This advances the last answer's minute by the whole minutes
 * elapsed on this device since it was received, so a legal due time still turns overdue while polls
 * are failing. Each answer re-anchors it, so a device clock that is wrong by hours never moves the
 * board by more than the minutes since the last answer; a device clock set back reads as no time
 * passed, never as the board running backwards. Display time only: the server keeps its own clock
 * for every save.
 */
export function sharedBoardNow(snapshotNow: Instant, receivedAtMs: number, deviceNowMs = Date.now()): Instant {
  if (!Number.isFinite(receivedAtMs) || receivedAtMs <= 0 || !Number.isFinite(deviceNowMs)) return snapshotNow;
  return snapshotNow + Math.max(0, Math.floor((deviceNowMs - receivedAtMs) / 60_000));
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
  if (!value || typeof value !== "object") return value;
  const answer = value as { serverTime?: unknown; accessUntil?: unknown; snapshot?: { accessUntil?: unknown } };
  if (typeof answer.serverTime !== "number" || !Number.isFinite(answer.serverTime)) return value;
  const offset = answer.serverTime - deviceNowMs;
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
