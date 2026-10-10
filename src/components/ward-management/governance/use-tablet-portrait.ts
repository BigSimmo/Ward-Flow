"use client";

import { useSyncExternalStore } from "react";

/**
 * Tablet portrait (v10 shell, 769 to 1000px): there is no rail beside the work, so a page that
 * keeps a sticky detail rail on desktop opens the chosen record as a slide-over instead. Group E
 * pages share this until a `useIsTabletPortrait` exists in `@/components/wf`.
 */
export const WF_TABLET_PORTRAIT_QUERY = "(min-width: 48.0625rem) and (max-width: 62.5rem)";

function subscribe(notify: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(WF_TABLET_PORTRAIT_QUERY);
  query.addEventListener?.("change", notify);
  return () => query.removeEventListener?.("change", notify);
}

function snapshot(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(WF_TABLET_PORTRAIT_QUERY).matches;
}

/** False on the server and on first paint, so the desktop tree is the hydration default. */
export function useIsTabletPortrait(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
