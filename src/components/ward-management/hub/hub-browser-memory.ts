"use client";

import { createBrowserStore } from "@/lib/client-store-factory";

/**
 * THE HUB'S TWO PIECES OF PER-VIEWER MEMORY — pinned places, and recently opened ones.
 *
 * Both come from the owner-approved mockup, and both were deliberately NOT built when the screen
 * first shipped, because neither works without somewhere to remember things and nobody had decided
 * where. **A pin that vanishes on reload is a half-feature.** The owner asked for both on
 * 2026-09-07; this module is the answer to "remembered where".
 *
 * 🔴 **THE VALUES STORED ARE WARD, ED AND COMMUNITY-REGION IDS. NOTHING ABOUT A PATIENT IS EVER
 * WRITTEN HERE, AND NOTHING SHOULD BE.** `localStorage` on a shared clinical workstation is
 * readable by anyone who sits down at it and survives the coordinator walking away. A list of which
 * wards somebody looked at is an operational convenience; a list of which PATIENTS somebody looked
 * at is a record of clinical activity, and it would be sitting unencrypted in a browser profile.
 * The distinction is the whole reason this file stores ids of PLACES and the hub does not offer
 * this feature on anything else.
 *
 * ⚠️ **AND IT IS THIS BROWSER ONLY, WHICH IS A CHOICE AND NOT A LIMITATION TO BE FIXED LATER
 * WITHOUT ASKING.** Two coordinators sharing a workstation share these lists; the same coordinator
 * on a different machine has none. Making them follow a person instead would mean an account, a
 * server round trip, and a record of one clinician's attention stored centrally — which is a
 * different product decision with a privacy dimension, not an upgrade. Ask before changing it.
 *
 * The mechanism is `community-index.tsx`'s, deliberately: same `createBrowserStore` +
 * `useSyncExternalStore` shape, same `try`/`catch` on every access, same custom event beside the
 * native `storage` one. A second convention for "remember this in the browser" in one feature area
 * is how the two end up behaving differently under private browsing.
 */

/** How many places each list remembers. Small on purpose: the glance pane is one third of the
 *  screen, and a "recent" list long enough to scroll is a second search box wearing a worse name. */
export const HUB_PIN_LIMIT = 8;
export const HUB_RECENT_LIMIT = 5;

/** Namespaced to this screen rather than shared with the community gateway's own recent list —
 *  they hold different vocabularies (place ids here, team names there) and a collision would
 *  deserialise one as the other. */
const PIN_KEY = "ward-hub-pinned";
const RECENT_KEY = "ward-hub-recent";

/** Fired after a same-tab write. The native `storage` event reaches only OTHER tabs, never the one
 *  that made the write — and both lists have to update in the tab the coordinator just clicked in. */
const CHANGE_EVENT = "ward-hub-memory-change";

/**
 * ⚠️ **EVERY READ AND WRITE IS WRAPPED.** `localStorage` throws outright in a private-browsing
 * context in some browsers, and on a quota-exhausted profile. A screen that crashed on that would
 * be a strictly worse outcome than one that quietly remembers nothing, so a failure degrades to an
 * empty list rather than propagating.
 */
function readIds(key: string, limit: number): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string").slice(0, limit);
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: readonly string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Private browsing or quota exhaustion. The list will not remember this action, and nothing
    // else on the screen depends on the write having succeeded.
  }
  try {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // No `window` — this only ever runs from a click handler, so it should not happen, and nothing
    // depends on the notification having gone out.
  }
}

/**
 * ⚠️ **THE SNAPSHOT IS CACHED AGAINST THE RAW STRING, NOT RECOMPUTED PER CALL.** `getSnapshot` must
 * return a referentially stable value when nothing has changed, or `useSyncExternalStore` treats
 * every render as a change and loops. `JSON.parse` returns a fresh array each time, so the last raw
 * string and its parsed result are cached and only a genuinely changed string produces a new
 * reference. Learned the hard way in `community-index.tsx`, which says the same thing.
 */
const EMPTY: readonly string[] = [];
const cache = new Map<string, { raw: string | null; ids: readonly string[] }>();

function snapshot(key: string, limit: number): readonly string[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    raw = null;
  }
  const cached = cache.get(key);
  if (cached !== undefined && cached.raw === raw) return cached.ids;
  const ids = readIds(key, limit);
  cache.set(key, { raw, ids });
  return ids;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export const usePinnedHubIds = createBrowserStore(subscribe, () => snapshot(PIN_KEY, HUB_PIN_LIMIT), EMPTY);
export const useRecentHubIds = createBrowserStore(subscribe, () => snapshot(RECENT_KEY, HUB_RECENT_LIMIT), EMPTY);

/**
 * Pins or unpins one place. A newly pinned id goes to the FRONT, so the most recent decision is the
 * one at the top of a capped list — pinning a ninth place drops the one pinned longest ago rather
 * than silently refusing, which would look like a broken button.
 */
export function toggleHubPin(id: string): void {
  const current = readIds(PIN_KEY, HUB_PIN_LIMIT);
  const next = current.includes(id)
    ? current.filter((entry) => entry !== id)
    : [id, ...current].slice(0, HUB_PIN_LIMIT);
  writeIds(PIN_KEY, next);
}

/**
 * Records that a place was OPENED.
 *
 * ⚠️ **OPENED, NOT PREVIEWED, AND THE DIFFERENCE IS THE WHOLE VALUE OF THE LIST.** Arrow keys move
 * the preview through the results — holding Down for a second would otherwise stamp five wards into
 * "recently viewed" that the coordinator never chose and never read. So this is called from the
 * button that actually navigates, and from nothing else. A list that fills itself is noise wearing
 * the costume of history.
 */
export function recordHubVisit(id: string): void {
  const current = readIds(RECENT_KEY, HUB_RECENT_LIMIT);
  writeIds(RECENT_KEY, [id, ...current.filter((entry) => entry !== id)].slice(0, HUB_RECENT_LIMIT));
}
