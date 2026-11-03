import { useLayoutEffect, useSyncExternalStore } from "react";

import { onWardSessionEnd } from "@/components/ward-management/ward-browser-data";
import type { SearchResultItem } from "./ward-global-search-groups";

/** Split out of `ward-global-search.tsx` (3 Nov 2026) to keep that file under the line cap. Unchanged. */
const RECENT_LIMIT = 4;

/** The lifetime the remembered records belong to; the search checks it before opening anything. */
export function recentsLifetimeNow(): string | null {
  return recentsLifetime;
}

/*
 * ⚠️ RECENT RECORDS LIVE IN THIS MODULE'S MEMORY ONLY, NEVER IN BROWSER STORAGE. They last as long
 * as the current access lifetime does. Only kind and id are retained: every displayed row is
 * rebuilt from the current authorised collections, so a retained row never carries old details.
 */
type RecentRecord = Pick<SearchResultItem, "kind" | "id">;
let sessionRecents: readonly RecentRecord[] = [];
const NO_RECENTS: readonly RecentRecord[] = [];
let recentsLifetime: string | null = null;
const recentsListeners = new Set<() => void>();

/** A small store, so the React Compiler sees the list change as an input rather than a module read. */
function setSessionRecents(next: readonly RecentRecord[]) {
  sessionRecents = next;
  recentsListeners.forEach((listener) => listener());
}

function subscribeRecents(listener: () => void) {
  recentsListeners.add(listener);
  return () => {
    recentsListeners.delete(listener);
  };
}

// Recent records name patients, so a session ending forgets them (Codex review on PR #487).
onWardSessionEnd(clearGlobalSearchRecents);

const serverRecentsSnapshot = () => NO_RECENTS;

export function useSessionRecents(lifetime: string | null) {
  // The getter fails closed on the very first render; an effect alone would paint the old desk.
  const recents = useSyncExternalStore(
    subscribeRecents,
    () => (lifetime !== null && recentsLifetime === lifetime ? sessionRecents : NO_RECENTS),
    serverRecentsSnapshot,
  );
  useLayoutEffect(() => {
    if (recentsLifetime === lifetime) return;
    recentsLifetime = lifetime;
    setSessionRecents(NO_RECENTS);
  }, [lifetime]);
  return recents;
}

/** Kinds that are not records, so they never join Recent. */
const NOT_RECENT = new Set(["action", "help", "contact", "suburb"]);

export function rememberRecent(item: SearchResultItem, lifetime: string | null) {
  if (NOT_RECENT.has(item.kind) || lifetime === null || recentsLifetime !== lifetime) return;
  const { kind, id } = item;
  setSessionRecents(
    [{ kind, id }, ...sessionRecents.filter((recent) => recent.kind !== kind || recent.id !== id)].slice(
      0,
      RECENT_LIMIT,
    ),
  );
}

/** Test seam: recents are module memory, so a suite that asserts the start screen clears them first. */
export function clearGlobalSearchRecents() {
  setSessionRecents(NO_RECENTS);
}
