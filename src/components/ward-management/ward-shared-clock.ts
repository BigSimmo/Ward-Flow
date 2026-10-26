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
