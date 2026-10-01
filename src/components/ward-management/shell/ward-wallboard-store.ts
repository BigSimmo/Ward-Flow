/**
 * WARD WALLBOARD STORE — Auto-refresh interval preference store.
 *
 * Persists the wallboard auto-refresh timer interval to localStorage under
 * `ward_flow_wallboard_refresh`. Gracefully handles SSR and environments without localStorage.
 */

import { useCallback } from "react";
import { createBrowserStore } from "@/lib/client-store-factory";

export const WALLBOARD_REFRESH_STORAGE_KEY = "ward_flow_wallboard_refresh";
export const WALLBOARD_REFRESH_CHANGE_EVENT = "ward_flow_wallboard_refresh_change";
export type WallboardRefreshInterval = "off" | 15 | 30 | 60;

let wallboardRefreshInMemoryFallback: WallboardRefreshInterval | undefined;

export function getWallboardRefreshPreference(): WallboardRefreshInterval {
  if (wallboardRefreshInMemoryFallback !== undefined) {
    return wallboardRefreshInMemoryFallback;
  }
  try {
    if (typeof window === "undefined" || !window.localStorage) return "off";
    const stored = window.localStorage.getItem(WALLBOARD_REFRESH_STORAGE_KEY);
    if (stored === "15" || stored === "30" || stored === "60") {
      return Number(stored) as 15 | 30 | 60;
    }
    return "off";
  } catch {
    return "off";
  }
}

export function setWallboardRefreshPreference(interval: WallboardRefreshInterval): void {
  wallboardRefreshInMemoryFallback = interval;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(WALLBOARD_REFRESH_STORAGE_KEY, String(interval));
      window.dispatchEvent(new Event(WALLBOARD_REFRESH_CHANGE_EVENT));
    }
  } catch {
    // Graceful fallback for restricted environments
  }
}

function subscribeWallboard(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(WALLBOARD_REFRESH_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(WALLBOARD_REFRESH_CHANGE_EVENT, onChange);
  };
}

const useWallboardRefreshStore = createBrowserStore(subscribeWallboard, getWallboardRefreshPreference, "off");

export function useWallboardRefreshPreference(): [
  WallboardRefreshInterval,
  (interval: WallboardRefreshInterval) => void,
] {
  const interval = useWallboardRefreshStore();
  const setInterval = useCallback((next: WallboardRefreshInterval) => {
    setWallboardRefreshPreference(next);
  }, []);
  return [interval, setInterval];
}
