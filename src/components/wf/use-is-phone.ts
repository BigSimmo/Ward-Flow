"use client";

import { useCallback, useSyncExternalStore } from "react";

/** The phone range (v10): phone rules live under this query, desktop and tablet above it. */
export const WF_PHONE_QUERY = "(max-width: 48rem)";
/** Tablet portrait (v10 shell, 769 to 1000px): no rail beside the work. */
export const WF_TABLET_PORTRAIT_QUERY = "(min-width: 48.0625rem) and (max-width: 62.5rem)";
/** Tablet landscape (v10 shell, 1001 to 1200px): the icon rail. */
export const WF_TABLET_LANDSCAPE_QUERY = "(min-width: 62.5625rem) and (max-width: 75rem)";

function canMatch(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

/**
 * Whether a CSS media query matches, kept live. False on the server and on first paint, so the
 * desktop tree is the hydration default. Pass a constant query string.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!canMatch()) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener?.("change", notify);
      return () => list.removeEventListener?.("change", notify);
    },
    [query],
  );
  const snapshot = useCallback(() => canMatch() && window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

/**
 * Phone is its own layout, not a reflow (v10): a screen that renders a different tree under 48rem
 * reads this.
 */
export function useIsPhone(): boolean {
  return useMediaQuery(WF_PHONE_QUERY);
}

/** Tablet portrait: a page with a sticky detail rail on desktop opens the record as a slide-over. */
export function useIsTabletPortrait(): boolean {
  return useMediaQuery(WF_TABLET_PORTRAIT_QUERY);
}

/** Tablet landscape: the icon rail sits beside the work. */
export function useIsTabletLandscape(): boolean {
  return useMediaQuery(WF_TABLET_LANDSCAPE_QUERY);
}
