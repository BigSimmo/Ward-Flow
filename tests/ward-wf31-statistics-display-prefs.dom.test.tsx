/**
 * WF-31: theme / rail / glare changes while on statistics restore on leave so they do not stick.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readStoredThemePreference, resetThemePreferenceForTests, setThemePreference } from "@/lib/theme-client";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { RAIL_OPEN_STORAGE_KEY } from "@/components/ward-management/shell/ward-rail-early";
import { setRailOpenPreference } from "@/components/ward-management/shell/ward-rail-preferences";
import {
  enterStatisticsDisplayPrefScope,
  resetStatisticsDisplayPrefScopeForTests,
} from "@/components/ward-management/shell/ward-statistics-display-pref-session";

describe("WF-31 statistics display prefs restore on leave", () => {
  beforeEach(() => {
    resetThemePreferenceForTests();
    resetStatisticsDisplayPrefScopeForTests();
    window.localStorage.clear();
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    window.localStorage.setItem(RAIL_OPEN_STORAGE_KEY, "open");
    setThemePreference("light");
  });

  afterEach(() => {
    resetThemePreferenceForTests();
    resetStatisticsDisplayPrefScopeForTests();
    window.localStorage.clear();
  });

  it("restores theme and rail when the statistics scope leaves", () => {
    const leave = enterStatisticsDisplayPrefScope();
    setThemePreference("dark");
    setRailOpenPreference(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    leave();
    expect(readStoredThemePreference()).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(window.localStorage.getItem(RAIL_OPEN_STORAGE_KEY)).toBe("open");
  });
});
