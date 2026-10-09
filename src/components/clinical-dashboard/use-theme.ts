"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import { DEFAULT_THEME, nextTheme, type ResolvedTheme, type ThemePreference } from "@/lib/theme";
import {
  applyThemeToDocument,
  readResolvedTheme,
  readStoredThemePreference,
  setThemePreference,
  subscribeThemePreference,
} from "@/lib/theme-client";

/*
 * The app's theme hook. It is a thin view over the one theme switch in `@/lib/theme-client`
 * (design system v8, section 4), which owns the stored preference and applies `data-theme`, the
 * legacy `.dark` class and `theme-color` together. The ward shell's appearance controls write
 * through the same module, so this hook and the ward controls always agree.
 */

function getServerThemeSnapshot(): ResolvedTheme {
  return DEFAULT_THEME;
}

function getServerPreferenceSnapshot(): ThemePreference {
  return "system";
}

// The transition class comes off on a short timer. Track the pending timer so a rapid second toggle
// replaces it instead of stacking removals, and bail out if it fires after the owning environment is
// gone — a leaked firing after DOM test teardown ("document is not defined") intermittently failed
// Unit coverage.
let themeTransitionTimer: ReturnType<typeof setTimeout> | null = null;

function markTransition() {
  document.documentElement.classList.add("theme-transitioning");
  if (themeTransitionTimer !== null) clearTimeout(themeTransitionTimer);
  themeTransitionTimer = setTimeout(() => {
    themeTransitionTimer = null;
    if (typeof document === "undefined") return;
    document.documentElement.classList.remove("theme-transitioning");
  }, 200);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribeThemePreference, readResolvedTheme, getServerThemeSnapshot);
  const preference = useSyncExternalStore(
    subscribeThemePreference,
    readStoredThemePreference,
    getServerPreferenceSnapshot,
  );

  // Keep the document in step when the OS changes while in "system", or another tab changes the pin.
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains("dark");
    applyThemeToDocument(preference);
    if (wasDark !== (theme === "dark")) markTransition();
  }, [theme, preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    const wasDark = document.documentElement.classList.contains("dark");
    const resolved = setThemePreference(next);
    if (wasDark !== (resolved === "dark")) markTransition();
  }, []);

  const toggleTheme = useCallback(() => {
    // A direct toggle always pins an explicit light/dark choice so a single tap has a predictable
    // result even when the current theme came from the OS.
    setPreference(nextTheme(readResolvedTheme()));
  }, [setPreference]);

  return { theme, preference, toggleTheme, setPreference };
}
