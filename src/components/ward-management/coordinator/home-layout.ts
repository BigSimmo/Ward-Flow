"use client";

import { useSyncExternalStore } from "react";

import { WF_PHONE_QUERY } from "@/components/wf";

/**
 * Home's four layouts (v10 Home chapter, Tablet and Phone). The tablet ranges are the shell's own:
 * landscape 1001 to 1200px keeps the icon rail, portrait 769 to 1000px has no rail.
 *
 * - desktop: three equal columns (queue, State bedflow, Placement).
 * - tablet-landscape: two columns, the queue and one panel that switches between Placement and
 *   State bedflow.
 * - tablet-portrait: one column behind a segmented control (Priority queue, State bedflow);
 *   choosing a patient opens Placement as a side sheet over a scrim.
 * - phone: direction A, queue first, with sheets.
 */
export type HomeLayout = "desktop" | "tablet-landscape" | "tablet-portrait" | "phone";

export const HOME_TABLET_PORTRAIT_QUERY = "(min-width: 48.0625rem) and (max-width: 62.5rem)";
export const HOME_TABLET_LANDSCAPE_QUERY = "(min-width: 62.5625rem) and (max-width: 75rem)";

const QUERIES = [WF_PHONE_QUERY, HOME_TABLET_PORTRAIT_QUERY, HOME_TABLET_LANDSCAPE_QUERY];

function canMatch(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

function subscribe(notify: () => void): () => void {
  if (!canMatch()) return () => undefined;
  const lists = QUERIES.map((query) => window.matchMedia(query));
  for (const list of lists) list.addEventListener?.("change", notify);
  return () => {
    for (const list of lists) list.removeEventListener?.("change", notify);
  };
}

function snapshot(): HomeLayout {
  if (!canMatch()) return "desktop";
  if (window.matchMedia(WF_PHONE_QUERY).matches) return "phone";
  if (window.matchMedia(HOME_TABLET_PORTRAIT_QUERY).matches) return "tablet-portrait";
  if (window.matchMedia(HOME_TABLET_LANDSCAPE_QUERY).matches) return "tablet-landscape";
  return "desktop";
}

/** Desktop on the server and on first paint, so the desktop tree is the hydration default. */
export function useHomeLayout(): HomeLayout {
  return useSyncExternalStore(subscribe, snapshot, () => "desktop");
}
