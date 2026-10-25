/**
 * MY WARDS — the wards one person pins on this device, so their own wards are one tap away from any
 * page (fix plan item 14, 21 Oct 2026).
 *
 * **`localStorage`, unlike the per-tab service choice (`ward-service-store.ts`).** A pin is meant to
 * survive a reload and a closed tab. It still ends with the signed-in session: the key sits under
 * the `ward-` prefix, so `clearWardFlowBrowserData` sweeps it at sign-out, and the in-memory copy
 * below registers its own reset, so the next person at the device starts with no pins.
 *
 * **Ward ids only, never typed text (D-11, D-18).** The stored value is a JSON array of ward ids,
 * each checked against `WARD_ID_PATTERN` and capped at `MY_WARDS_LIMIT` on every read. Free text,
 * a stale build's value or tampering reads as "no pins", never as an error. A pinned id that names
 * no ward in today's network is skipped by the reader that renders it, not here, because this store
 * does not load the network.
 */
import { createBrowserStore } from "@/lib/client-store-factory";
import { onWardSessionEnd } from "@/components/ward-management/ward-browser-data";

export const MY_WARDS_STORAGE_KEY = "ward-flow-my-wards";
const myWardsChangeEvent = "ward-flow-my-wards-change";

/** Enough for a coordinator's whole service. A longer list stops being a shortcut. */
export const MY_WARDS_LIMIT = 8;

/** The shape every seeded ward id takes (`alb-adult-open`: lower case letters, digits and hyphens). */
const WARD_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,47}$/;

const NO_PINS: readonly string[] = Object.freeze([]);

let inMemoryFallback: readonly string[] | undefined;
// The snapshot must keep its identity between reads, or `useSyncExternalStore` re-renders forever.
let lastRaw: string | null | undefined;
let lastParsed: readonly string[] = NO_PINS;

onWardSessionEnd((scope) => {
  inMemoryFallback = undefined;
  lastRaw = undefined;
  lastParsed = NO_PINS;
  // Pins live in local storage, which another tab still signed in on this browser shares.
  if (typeof window === "undefined" || scope === "tab") return;
  // Removed here, before subscribers re-read, so a mounted rail cannot read the last person's pins back.
  try {
    window.localStorage.removeItem(MY_WARDS_STORAGE_KEY);
  } catch {
    // Nothing is stored when storage is unreachable.
  }
  window.dispatchEvent(new Event(myWardsChangeEvent));
});

/** Reads a stored value as pinned ward ids: valid ids only, no repeats, at most `MY_WARDS_LIMIT`. */
export function parseMyWards(raw: string | null): readonly string[] {
  if (raw === null) return NO_PINS;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return NO_PINS;
  }
  if (!Array.isArray(value)) return NO_PINS;
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !WARD_ID_PATTERN.test(item) || ids.includes(item)) continue;
    ids.push(item);
    if (ids.length === MY_WARDS_LIMIT) break;
  }
  return ids.length === 0 ? NO_PINS : Object.freeze(ids);
}

function getMyWardsSnapshot(): readonly string[] {
  if (inMemoryFallback !== undefined) return inMemoryFallback;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(MY_WARDS_STORAGE_KEY);
  } catch {
    return NO_PINS;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastParsed = parseMyWards(raw);
  }
  return lastParsed;
}

function subscribeMyWards(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(myWardsChangeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(myWardsChangeEvent, onChange);
  };
}

/** The pinned ward ids, in the order they were pinned. */
export const useMyWards = createBrowserStore(subscribeMyWards, getMyWardsSnapshot, NO_PINS);

function writeMyWards(next: readonly string[]): void {
  const frozen = next.length === 0 ? NO_PINS : Object.freeze([...next]);
  try {
    if (frozen.length === 0) window.localStorage.removeItem(MY_WARDS_STORAGE_KEY);
    else window.localStorage.setItem(MY_WARDS_STORAGE_KEY, JSON.stringify(frozen));
    inMemoryFallback = undefined;
  } catch {
    // Private browsing or a full quota: the pins still work for this tab, until a reload.
    inMemoryFallback = frozen;
  }
  window.dispatchEvent(new Event(myWardsChangeEvent));
}

export type PinOutcome = "pinned" | "unpinned" | "full" | "refused";

/** Pins a ward, or unpins it if already pinned. Refuses an id that is not a ward id. */
export function toggleMyWard(unitId: string): PinOutcome {
  if (!WARD_ID_PATTERN.test(unitId)) return "refused";
  const current = getMyWardsSnapshot();
  if (current.includes(unitId)) {
    writeMyWards(current.filter((id) => id !== unitId));
    return "unpinned";
  }
  if (current.length >= MY_WARDS_LIMIT) return "full";
  writeMyWards([...current, unitId]);
  return "pinned";
}

/** Test-only reset, so one test file's pins never leak into the next. */
export function resetMyWardsForTests(): void {
  try {
    window.localStorage.removeItem(MY_WARDS_STORAGE_KEY);
  } catch {
    // Nothing stored if storage is unreachable.
  }
  inMemoryFallback = undefined;
  lastRaw = undefined;
  lastParsed = NO_PINS;
  window.dispatchEvent(new Event(myWardsChangeEvent));
}
