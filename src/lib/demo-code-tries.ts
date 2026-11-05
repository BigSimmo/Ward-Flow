/**
 * The demo code's brute-force guard for `POST /api/session` (Q371, 3 November 2026). In memory, per
 * server process.
 */

/**
 * A few wrong tries per address, then a pause, so a demo code cannot be guessed by brute force. The
 * address is the one Railway's edge saw (`X-Real-IP`), not the first `X-Forwarded-For` entry, which
 * the caller writes. A cap across all addresses stops a guesser who rotates addresses, and a full
 * table refuses new addresses instead of forgetting everyone's count.
 */
const WRONG_TRY_LIMIT = 10;
const WRONG_TRY_WINDOW_MS = 10 * 60_000;
const ALL_WRONG_TRY_LIMIT = 200;
const ADDRESS_TABLE_LIMIT = 5_000;
const wrongTries = new Map<string, { count: number; since: number }>();
let allWrongTries = { count: 0, since: 0 };

/** The caller's address as the edge saw it: `X-Real-IP`, else the last `X-Forwarded-For` hop. */
export function edgeAddress(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const hops = headers.get("x-forwarded-for")?.split(",") ?? [];
  return hops.at(-1)?.trim().slice(0, 64) || "unknown";
}

function pruneWrongTries(now: number) {
  for (const [address, entry] of wrongTries) if (now - entry.since > WRONG_TRY_WINDOW_MS) wrongTries.delete(address);
}
export function tooManyTries(address: string, now: number): boolean {
  if (now - allWrongTries.since <= WRONG_TRY_WINDOW_MS && allWrongTries.count >= ALL_WRONG_TRY_LIMIT) return true;
  const entry = wrongTries.get(address);
  if (!entry || now - entry.since > WRONG_TRY_WINDOW_MS) {
    if (wrongTries.size < ADDRESS_TABLE_LIMIT) return false;
    pruneWrongTries(now);
    return wrongTries.size >= ADDRESS_TABLE_LIMIT;
  }
  return entry.count >= WRONG_TRY_LIMIT;
}
export function countWrongTry(address: string, now: number) {
  if (now - allWrongTries.since > WRONG_TRY_WINDOW_MS) allWrongTries = { count: 1, since: now };
  else allWrongTries.count += 1;
  const entry = wrongTries.get(address);
  if (!entry || now - entry.since > WRONG_TRY_WINDOW_MS) {
    if (wrongTries.size >= ADDRESS_TABLE_LIMIT) pruneWrongTries(now);
    if (wrongTries.size < ADDRESS_TABLE_LIMIT) wrongTries.set(address, { count: 1, since: now });
  } else entry.count += 1;
}

/** Test hook: forget every wrong try. */
export function resetWrongTriesForTests() {
  wrongTries.clear();
  allWrongTries = { count: 0, since: 0 };
}

/** Reserve before awaiting verification; only a confirmed correct code releases the slot. */
export function reserveDemoTry(address: string, now: number): (() => void) | null {
  if (tooManyTries(address, now)) return null;
  countWrongTry(address, now);
  const entry = wrongTries.get(address);
  const total = allWrongTries;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (entry && wrongTries.get(address) === entry) entry.count = Math.max(0, entry.count - 1);
    if (allWrongTries === total) total.count = Math.max(0, total.count - 1);
  };
}
