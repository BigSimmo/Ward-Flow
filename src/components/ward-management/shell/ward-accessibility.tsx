"use client";

import { useCallback, useEffect } from "react";
import { createBrowserStore } from "@/lib/client-store-factory";
import { preloadWhenIdle } from "../preload-when-idle";

type Preference = "reduced-motion" | "high-contrast";
const CHANGE = "ward-accessibility-change";
const fallback: Partial<Record<Preference, boolean>> = {};
function read(preference: Preference): boolean {
  // Session fallback wins when a write was refused (private browsing / blocked storage).
  if (Object.prototype.hasOwnProperty.call(fallback, preference)) return fallback[preference]!;
  try {
    return window.localStorage.getItem(`ward-flow-${preference}`) === "true";
  } catch {
    return false;
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
      try {
        window.localStorage.setItem(`ward-flow-${preference}`, String(enabled));
        delete fallback[preference];
      } catch {
        // Keep the preference usable when storage is blocked.
        fallback[preference] = enabled;
      }
      window.dispatchEvent(new Event(CHANGE));
    },
    [preference],
  );
  return [preference === "reduced-motion" ? reduced : contrast, set];
}
/** Mounted above every Ward route so reload and navigation restore both preferences. */
export function WardAccessibility() {
  useEffect(() => {
    // The WCAG 2.4.11 check is its own file, so the shell every route loads stays small.
    // Q278 (pre-launch review E6, 2 Nov 2026): it used to load only on the first focus, so a device
    // that went offline first threw "Loading chunk failed" on every focus and never got the check.
    // It now also loads once the page is idle, and a failed load is caught and tried again later.
    let check: ((event: FocusEvent) => void) | undefined;
    let loading: Promise<((event: FocusEvent) => void) | undefined> | undefined;
    let live = true;
    const load = () =>
      (loading ??= import("./keep-focus-clear").then(
        (module) => (check = module.keepKeyboardFocusClear),
        () => {
          loading = undefined;
          return undefined;
        },
      ));
    preloadWhenIdle(load);
    const onFocus = (event: FocusEvent) => {
      if (check) return check(event);
      void load().then((loaded) => {
        if (loaded && live) loaded(event);
      });
    };
    document.addEventListener("focusin", onFocus);
    return () => {
      live = false;
      document.removeEventListener("focusin", onFocus);
    };
  }, []);
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
