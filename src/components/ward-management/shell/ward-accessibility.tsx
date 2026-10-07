"use client";

import { useCallback, useEffect } from "react";
import { createBrowserStore } from "@/lib/client-store-factory";

type Preference = "reduced-motion" | "high-contrast";
const CHANGE = "ward-accessibility-change";
const fallback: Partial<Record<Preference, boolean>> = {};
function read(preference: Preference): boolean {
  try {
    return window.localStorage.getItem(`ward-flow-${preference}`) === "true";
  } catch {
    return fallback[preference] ?? false;
  }
}
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}
const useReducedMotion = createBrowserStore(subscribe, () => read("reduced-motion"), false);
const useHighContrast = createBrowserStore(subscribe, () => read("high-contrast"), false);
export function useWardAccessibilityPreference(preference: Preference): [boolean, (enabled: boolean) => void] {
  const reduced = useReducedMotion();
  const contrast = useHighContrast();
  const set = useCallback(
    (enabled: boolean) => {
      fallback[preference] = enabled;
      try {
        window.localStorage.setItem(`ward-flow-${preference}`, String(enabled));
      } catch {
        // Keep the preference usable when storage is blocked.
      }
      window.dispatchEvent(new Event(CHANGE));
    },
    [preference],
  );
  return [preference === "reduced-motion" ? reduced : contrast, set];
}
/** Mounted above every Ward route so reload and navigation restore both preferences. */
export function WardAccessibility() {
  const [reduced] = useWardAccessibilityPreference("reduced-motion");
  const [contrast] = useWardAccessibilityPreference("high-contrast");
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-reduced-motion", reduced);
    root.toggleAttribute("data-high-contrast", contrast);
    return () => {
      root.removeAttribute("data-reduced-motion");
      root.removeAttribute("data-high-contrast");
    };
  }, [reduced, contrast]);
  return null;
}
