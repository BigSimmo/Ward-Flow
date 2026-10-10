"use client";

import { useSyncExternalStore } from "react";

/** The phone range (v10): phone rules live under this query, desktop and tablet above it. */
export const WF_PHONE_QUERY = "(max-width: 48rem)";

function subscribe(notify: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(WF_PHONE_QUERY);
  query.addEventListener?.("change", notify);
  return () => query.removeEventListener?.("change", notify);
}

function snapshot(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(WF_PHONE_QUERY).matches;
}

/**
 * Phone is its own layout, not a reflow (v10): a screen that renders a different tree under 48rem
 * reads this. False on the server and on first paint, so the desktop tree is the hydration default.
 */
export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
