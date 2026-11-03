"use client";

import { useSyncExternalStore } from "react";

const WIDE = "(min-width: 80rem)";
/** Q311: two panes from 1280 wide. */
export function useToolsTwoPane(isPhone: boolean): boolean {
  const wide = useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia(WIDE);
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
  return wide && !isPhone;
}
