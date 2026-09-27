/**
 * WARD WALLBOARD STORE — Auto-refresh interval preference store.
 *
 * Persists the wallboard auto-refresh timer interval to localStorage under
 * `ward_flow_wallboard_refresh`. Gracefully handles SSR and environments without localStorage.
 */

export const WALLBOARD_REFRESH_STORAGE_KEY = "ward_flow_wallboard_refresh";
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
    }
  } catch {
    // Graceful fallback for restricted environments
  }
}
