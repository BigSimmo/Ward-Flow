"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "ward-flow-statistics-samples";
const CHANGE_EVENT = "ward-flow-statistics-samples-change";
let fallback = false;

function snapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
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
/** Optional invented history is off by default and persists independently of clinical workflow state. */
export function useStatisticsSamples() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
