/**
 * WF-31: theme / rail / glare changes on statistics must restore on leave.
 * Runtime wiring deferred — importing the session from the statistics layout reshuffled
 * shared phone chunks (~0.8 KB gzip). This test pins the restore contract for a follow-up.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readStoredThemePreference, resetThemePreferenceForTests, setThemePreference } from "@/lib/theme-client";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { RAIL_OPEN_STORAGE_KEY } from "@/components/ward-management/shell/ward-rail-early";
import { setRailOpenPreference } from "@/components/ward-management/shell/ward-rail-preferences";

describe("WF-31 statistics display prefs restore contract", () => {
  beforeEach(() => {
    resetThemePreferenceForTests();
    window.localStorage.clear();
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    window.localStorage.setItem(RAIL_OPEN_STORAGE_KEY, "open");
    setThemePreference("light");
  });

  afterEach(() => {
    resetThemePreferenceForTests();
    window.localStorage.clear();
  });

  it("can snapshot and restore theme and rail after a visit", () => {
    const snap = {
      theme: readStoredThemePreference(),
      railOpen: window.localStorage.getItem(RAIL_OPEN_STORAGE_KEY) !== "closed",
    };
    setThemePreference("dark");
    setRailOpenPreference(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    setThemePreference(snap.theme);
    setRailOpenPreference(snap.railOpen);
    expect(readStoredThemePreference()).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(window.localStorage.getItem(RAIL_OPEN_STORAGE_KEY)).toBe("open");
  });
});
