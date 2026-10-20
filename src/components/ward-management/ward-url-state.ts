import { useCallback } from "react";

import { createBrowserStore } from "@/lib/client-store-factory";

/**
 * DA-15 (design audit, 19 Oct 2026): a screen's chosen view, filters and order live in the web
 * address, so a reload or a shared link opens the same list. Search text never goes in the address,
 * because it can hold a patient's name.
 *
 * Next.js keeps its router in step with the browser's own `history.replaceState`, which carries no
 * reload and no new Back entry. The browser fires no event for it, so the history methods are
 * wrapped once to announce every change (moved from the Delays screen, which used it first).
 */

const LOCATION_CHANGE_EVENT = "ward-flow:locationchange";
const HISTORY_PATCHED_KEY = "__wardFlowLocationPatched";

function ensureLocationHistoryPatched() {
  if (typeof window === "undefined") return;
  const win = window as Window & { [HISTORY_PATCHED_KEY]?: boolean };
  if (win[HISTORY_PATCHED_KEY]) return;
  win[HISTORY_PATCHED_KEY] = true;
  const origPushState = window.history.pushState.bind(window.history);
  const origReplaceState = window.history.replaceState.bind(window.history);
  window.history.pushState = function patchedPushState(...args) {
    origPushState(...args);
    queueMicrotask(() => window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT)));
  };
  window.history.replaceState = function patchedReplaceState(...args) {
    origReplaceState(...args);
    queueMicrotask(() => window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT)));
  };
}

/** For `useSyncExternalStore`: calls `listener` on Back, Forward and every push or replace. */
export function subscribeToLocation(listener: () => void) {
  ensureLocationHistoryPatched();
  window.addEventListener("popstate", listener);
  window.addEventListener(LOCATION_CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(LOCATION_CHANGE_EVENT, listener);
  };
}

/**
 * Sets (a string) or removes (`null`) each named query parameter in place, keeping every other
 * parameter, the path, the hash and the router's history state. No new Back entry, no reload.
 */
export function replaceSearchParams(updates: Readonly<Record<string, string | null>>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  if (url.href === window.location.href) return;
  window.history.replaceState(window.history.state, "", url.toString());
}

/** The address's query string (`?a=1`), kept current. Empty on the server and during hydration. */
export const useLocationSearch = createBrowserStore(subscribeToLocation, () => window.location.search, "");

/**
 * DA-15 (overall review, 20 Oct 2026): a screen's chosen tab, kept in the web address under `key`,
 * so a reload or a shared link opens the same tab. Only a fixed id from `allowed` is ever written or
 * read, never a name or typed text (D-11). An unknown or missing value reads as `fallback`, and
 * choosing `fallback` removes the key, so the plain address stays plain. Like Waiting's filters, the
 * address is read once the page is running: the first paint shows `fallback`.
 */
export function useAddressTab<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const search = useLocationSearch();
  const value = new URLSearchParams(search).get(key);
  const chosen = value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
  const choose = useCallback(
    (next: T) => {
      replaceSearchParams({ [key]: next === fallback ? null : next });
    },
    [key, fallback],
  );
  return [chosen, choose];
}
