"use client";

import { createContext, createElement, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";

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
 * A1-17 (audit 13 Oct 2026, slow signal): the server's guess that this request comes from a phone,
 * read from the request (`guessPhoneFromRequest`). Without it the server always drew the desktop
 * tree, so on a slow phone the first paint was a different layout for many seconds until the
 * page's code loaded. The guess is only the first-paint and hydration value of the phone query;
 * the browser's own media query takes over as soon as the page is running.
 */
const WfServerPhoneContext = createContext(false);
const WfServerTabletContext = createContext(false);

export function WfServerPhoneProvider({
  phone,
  tablet = false,
  children,
}: {
  phone: boolean;
  tablet?: boolean;
  children: ReactNode;
}) {
  return createElement(
    WfServerPhoneContext.Provider,
    { value: phone },
    createElement(WfServerTabletContext.Provider, { value: tablet }, children),
  );
}

/**
 * Whether a CSS media query matches, kept live. On the server and on first paint the phone query
 * reads the server's guess (`WfServerPhoneProvider`, false when none is given), the tablet portrait
 * query reads the optional `tablet` server guess, and every other query reads false, so the tree
 * drawn by the server is the tree hydrated. Pass a constant query string.
 */
export function useMediaQuery(query: string): boolean {
  const serverPhone = useContext(WfServerPhoneContext);
  const serverTablet = useContext(WfServerTabletContext);
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
  const serverSnapshot = useCallback(
    () => (query === WF_PHONE_QUERY && serverPhone) || (query === WF_TABLET_PORTRAIT_QUERY && serverTablet),
    [query, serverPhone, serverTablet],
  );
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
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
