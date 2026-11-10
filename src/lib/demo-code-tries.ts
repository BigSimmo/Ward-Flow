/**
 * The demo code's brute-force guard for `POST /api/session` (Q371, 3 November 2026). In memory, per
 * server process.
 */

/**
 * A few wrong tries per address, then a pause, so a demo code cannot be guessed by brute force. The
 * address is the one Railway's edge saw (`X-Real-IP`), not the first `X-Forwarded-For` entry, which
 * the caller writes. A cap across all addresses slows a guesser who rotates addresses: once it is
 * reached, a wrong code is refused with a pause, but the right code still opens the door, so one
 * caller cannot lock every presenter out (SEC-1, 5 November 2026). A full table refuses new
 * addresses instead of forgetting everyone's count.
 */
const WRONG_TRY_LIMIT = 10;
const WRONG_TRY_WINDOW_MS = 10 * 60_000;
const ALL_WRONG_TRY_LIMIT = 200;
const ADDRESS_TABLE_LIMIT = 5_000;
const wrongTries = new Map<string, { count: number; since: number }>();
let allWrongTries = { count: 0, since: 0 };

/**
 * The caller's address as the edge saw it: `X-Real-IP`, else the last `X-Forwarded-For` hop.
 * Not yet confirmed: that Railway's edge overwrites a caller-sent `X-Real-IP`. Confirm on Railway;
 * if it does not, a caller can rotate this header to dodge the per-address limit.
 */
export function edgeAddress(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const hops = headers.get("x-forwarded-for")?.split(",") ?? [];
  return hops.at(-1)?.trim().slice(0, 64) || "unknown";
}

function pruneWrongTries(now: number) {
  for (const [address, entry] of wrongTries) if (now - entry.since > WRONG_TRY_WINDOW_MS) wrongTries.delete(address);
}
function overAllAddressCap(now: number): boolean {
  return now - allWrongTries.since <= WRONG_TRY_WINDOW_MS && allWrongTries.count >= ALL_WRONG_TRY_LIMIT;
}
/** "limited": this address has had too many wrong tries. "full": a new address, and no room to count it. */
function tryLimit(address: string, now: number): "limited" | "full" | null {
  const entry = wrongTries.get(address);
  if (!entry || now - entry.since > WRONG_TRY_WINDOW_MS) {
    if (wrongTries.size < ADDRESS_TABLE_LIMIT) return null;
    pruneWrongTries(now);
    return wrongTries.size >= ADDRESS_TABLE_LIMIT ? "full" : null;
  }
  return entry.count >= WRONG_TRY_LIMIT ? "limited" : null;
}
function countWrongTry(address: string, now: number) {
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

/**
 * A reserved try. `overCap`: refuse a wrong code with a pause, because wrong tries across all
 * addresses hit the cap, or the address table is full so this new address cannot be counted.
 */
export type DemoTry = { release: () => void; overCap: boolean };

/**
 * Reserve before awaiting verification; only a confirmed correct code releases the slot. Null when
 * this address has had too many wrong tries. Neither the cap across all addresses nor a full address
 * table refuses here (M53, 10 November 2026): the caller still checks the code, so the right code
 * from a new address opens the door, and a wrong one is refused with a pause.
 */
export function reserveDemoTry(address: string, now: number): DemoTry | null {
  const limit = tryLimit(address, now);
  if (limit === "limited") return null;
  const overCap = limit === "full" || overAllAddressCap(now);
  countWrongTry(address, now);
  const entry = wrongTries.get(address);
  const total = allWrongTries;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    // A released slot holds no attempt, so drop an emptied entry and reset an emptied window.
    if (entry && wrongTries.get(address) === entry) {
      entry.count = Math.max(0, entry.count - 1);
      if (entry.count === 0) wrongTries.delete(address);
    }
    if (allWrongTries === total) {
      total.count = Math.max(0, total.count - 1);
      if (total.count === 0) allWrongTries = { count: 0, since: 0 };
    }
  };
  return { release, overCap };
}
