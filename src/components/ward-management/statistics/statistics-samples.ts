"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "ward-flow-statistics-samples";
const CHANGE_EVENT = "ward-flow-statistics-samples-change";
// S6 example data (Josh, 3 Nov 2026): on by default in the demo. A live shared build has none.
const DEFAULT_ON = process.env.NEXT_PUBLIC_WARD_SHARED_ENABLED !== "true";
let fallback = DEFAULT_ON;

function snapshot(): boolean {
  try {
    // A person's own choice, either way, is kept; with none saved the default applies.
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === null ? DEFAULT_ON : saved === "on";
  } catch {
    return fallback;
  }
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}
export function setStatisticsSamples(enabled: boolean) {
  fallback = enabled;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    /* In-memory preference works when storage is unavailable. */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
/** Invented example history: on by default in the demo, off once a person turns it off. Kept apart from clinical workflow state. */
export function useStatisticsSamples() {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_ON);
}
