"use client";

import { useCallback, useEffect } from "react";
import { createBrowserStore } from "@/lib/client-store-factory";

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
/** The nearest fixed or sticky box holding `element` (a pinned header, action bar or the phone dock). */
function pinnedBox(element: Element | null): HTMLElement | null {
  for (let node = element; node && node !== document.body; node = node.parentElement) {
    const position = getComputedStyle(node).position;
    if (position === "fixed" || position === "sticky") return node as HTMLElement;
  }
  return null;
}

/** The box that scrolls the page: the shell's work column where it scrolls, else the window. A
 *  row that scrolls sideways (a chip strip) is never the one moved. */
function scrollerOf(element: HTMLElement): Element | null {
  const column = element.closest("[data-wf-scroller]");
  if (column && column.scrollHeight > column.clientHeight + 1) return column;
  return document.scrollingElement;
}

/** Room left between a control brought clear and the bar it was under. */
const FOCUS_CLEARANCE = 8;

/**
 * WCAG 2.4.11 (device sweep, 24 Oct 2026): a control reached with the keyboard is never left
 * hidden under a pinned bar. Scroll padding keeps it clear of the header and the dock, but a page's
 * own sticky action bar (Patient, Movement, Handover) can still sit over it. After the browser has
 * scrolled to the focused control, this checks its top and bottom edges and, if a fixed or sticky
 * bar that does not hold it covers either, scrolls just far enough to bring it clear. Dialogs keep
 * their own focus handling and are left alone.
 */
function keepKeyboardFocusClear(event: FocusEvent) {
  const element = event.target;
  if (!(element instanceof HTMLElement) || typeof document.elementFromPoint !== "function") return;
  if (element.closest('[role="dialog"], [aria-modal="true"]')) return;
  try {
    if (!element.matches(":focus-visible")) return;
  } catch {
    return;
  }
  requestAnimationFrame(() => {
    if (document.activeElement !== element) return;
    const rect = element.getBoundingClientRect();
    if (rect.height === 0 || rect.bottom <= 0 || rect.top >= window.innerHeight) return;
    const x = Math.min(Math.max(rect.left + rect.width / 2, 0), window.innerWidth - 1);
    let shift = 0;
    for (const y of [rect.top + 2, rect.bottom - 2]) {
      if (y < 0 || y >= window.innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      if (!hit || element.contains(hit) || hit.contains(element)) continue;
      const bar = pinnedBox(hit);
      if (!bar || bar.contains(element)) continue;
      const box = bar.getBoundingClientRect();
      // A full-screen layer is not a bar to scroll clear of.
      if (box.height > window.innerHeight / 2) continue;
      // A bar in the lower half of the window is a foot bar: the control moves up above it.
      // One in the upper half is a header: the control moves down below it.
      if (box.top + box.height / 2 > window.innerHeight / 2) {
        if (box.top < rect.bottom) shift = Math.max(shift, rect.bottom - box.top + FOCUS_CLEARANCE);
      } else if (box.bottom > rect.top) {
        shift = Math.min(shift, rect.top - box.bottom - FOCUS_CLEARANCE);
      }
    }
    if (shift !== 0) scrollerOf(element)?.scrollBy({ top: shift, behavior: "instant" });
  });
}

/** Mounted above every Ward route so reload and navigation restore both preferences. */
export function WardAccessibility() {
  useEffect(() => {
    document.addEventListener("focusin", keepKeyboardFocusClear);
    return () => document.removeEventListener("focusin", keepKeyboardFocusClear);
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
