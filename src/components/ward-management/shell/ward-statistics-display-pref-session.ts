/**
 * WF-31 helpers for statistics routes: snapshot + enter a display-pref scope, restore on leave.
 */
import { enterDisplayPrefScope, type DisplayPrefBaseline } from "@/lib/display-pref-scope";
import {
  readStoredGlarePreference,
  readStoredThemePreference,
  setGlarePreference,
  setThemePreference,
} from "@/lib/theme-client";
import { RAIL_OPEN_STORAGE_KEY } from "./ward-rail-early";
import { setRailOpenPreference } from "./ward-rail-preferences";

function readRailOpen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(RAIL_OPEN_STORAGE_KEY) !== "closed";
  } catch {
    return true;
  }
}

function snapshotDisplayPrefs(): DisplayPrefBaseline {
  return {
    theme: readStoredThemePreference(),
    glare: readStoredGlarePreference(),
    railOpen: readRailOpen(),
  };
}

function restoreDisplayPrefs(snap: DisplayPrefBaseline) {
  setThemePreference(snap.theme);
  setGlarePreference(snap.glare);
  setRailOpenPreference(snap.railOpen);
}

/** Enter scope with the current stored prefs; disposer restores them when the last scope exits. */
export function enterStatisticsDisplayPrefScope(): () => void {
  if (typeof window === "undefined") return () => undefined;
  const leave = enterDisplayPrefScope(snapshotDisplayPrefs());
  return () => {
    const snap = leave();
    if (snap) restoreDisplayPrefs(snap);
  };
}

export { resetDisplayPrefScopeModuleForTests as resetStatisticsDisplayPrefScopeForTests } from "@/lib/display-pref-scope";
