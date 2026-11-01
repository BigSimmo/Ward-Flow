"use client";

import { useSyncExternalStore } from "react";

import type { Instant } from "@/components/ward-management/ward-clock";

/**
 * One Activity panel everywhere (Josh, Q99, 1 Nov 2026, "image 1 version"): the app bar draws the
 * one panel (Changes, Recent activity and Notices) on every page, and Home's "N changes since 07:00 ·
 * Review" button asks the bar to open it here instead of drawing a copy of its own. Kept tiny: the
 * bar and Home both load it on first paint.
 */
export type ActivityPanelTab = "changes" | "recent" | "notices";

export type ActivityPanelRequest = {
  /** The tab it opens on; by default Changes when any wait for review, otherwise Recent activity. */
  tab?: ActivityPanelTab;
  /** Home's paused clock, while Home is paused; otherwise the panel reads the live demo clock. */
  now?: Instant;
  /** Where focus goes back to when the panel closes. */
  opener?: HTMLElement | null;
};

const requestListeners = new Set<(request: ActivityPanelRequest) => void>();
const openListeners = new Set<() => void>();
let panelOpen = false;

/** Opens the bar's Activity panel. Does nothing when no bar is on the page. */
export function openActivityPanel(request: ActivityPanelRequest = {}) {
  for (const listener of requestListeners) listener(request);
}

/** The bar's side: answers `openActivityPanel`. */
export function subscribeActivityPanelRequest(listener: (request: ActivityPanelRequest) => void) {
  requestListeners.add(listener);
  return () => {
    requestListeners.delete(listener);
  };
}

/** The bar says whether the panel is open, so an opener elsewhere can set its `aria-expanded`. */
export function publishActivityPanelOpen(open: boolean) {
  if (panelOpen === open) return;
  panelOpen = open;
  for (const listener of openListeners) listener();
}

function subscribeOpen(listener: () => void) {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
}

export function useActivityPanelOpen(): boolean {
  return useSyncExternalStore(
    subscribeOpen,
    () => panelOpen,
    () => false,
  );
}
