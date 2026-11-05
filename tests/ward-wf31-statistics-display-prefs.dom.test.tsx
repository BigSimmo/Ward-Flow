/**
 * WF-31: theme / rail / glare changes while a statistics display-pref scope is open must not
 * persist; leaving the scope restores the baseline.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  enterDisplayPrefScope,
  resetDisplayPrefScopeForTests,
  displayPrefScopeActive,
} from "@/lib/display-pref-scope";
import {
  readStoredThemePreference,
  resetThemePreferenceForTests,
  setThemePreference,
} from "@/lib/theme-client";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { RAIL_OPEN_STORAGE_KEY } from "@/components/ward-management/shell/ward-rail-early";
import { setRailOpenPreference } from "@/components/ward-management/shell/ward-rail-preferences";
import {
  enterStatisticsDisplayPrefScope,
  resetStatisticsDisplayPrefScopeForTests,
} from "@/components/ward-management/shell/ward-statistics-display-pref-session";

describe("WF-31 statistics display prefs are route-scoped", () => {
  beforeEach(() => {
    resetThemePreferenceForTests();
    resetDisplayPrefScopeForTests();
    resetStatisticsDisplayPrefScopeForTests();
    window.localStorage.clear();
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    window.localStorage.setItem(RAIL_OPEN_STORAGE_KEY, "open");
    setThemePreference("light");
  });

  afterEach(() => {
    resetThemePreferenceForTests();
    resetDisplayPrefScopeForTests();
    resetStatisticsDisplayPrefScopeForTests();
    window.localStorage.clear();
  });

  it("does not persist theme or rail while the statistics scope is open", () => {
    const leave = enterStatisticsDisplayPrefScope();
    expect(displayPrefScopeActive()).toBe(true);

    setThemePreference("dark");
    setRailOpenPreference(false);

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(window.localStorage.getItem(RAIL_OPEN_STORAGE_KEY)).toBe("open");

    leave();
    expect(displayPrefScopeActive()).toBe(false);
    expect(readStoredThemePreference()).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(window.localStorage.getItem(RAIL_OPEN_STORAGE_KEY)).toBe("open");
  });

  it("keeps the outer baseline across nested scopes", () => {
    const outer = enterDisplayPrefScope({ theme: "light", glare: false, railOpen: true });
    setThemePreference("dark");
    const inner = enterDisplayPrefScope({ theme: "dark", glare: false, railOpen: false });
    setThemePreference("system");
    expect(inner()).toBeNull();
    const snap = outer();
    expect(snap).toEqual({ theme: "light", glare: false, railOpen: true });
  });
});
