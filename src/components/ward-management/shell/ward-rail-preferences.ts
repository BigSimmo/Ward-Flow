"use client";

import { useEffect, useLayoutEffect } from "react";

import { createBrowserStore } from "@/lib/client-store-factory";
import {
  applyGlareToDocument,
  applyThemeToDocument,
  readStoredGlarePreference,
  readStoredThemePreference,
} from "@/lib/theme-client";
import { useAppearanceStore, useGlareStore } from "./ward-bar";
import { openWardDrawer } from "./ward-drawer-bus";
import { RAIL_OPEN_STORAGE_KEY } from "./ward-rail-early";

/*
 * The parts of the rail every screen size needs: the remembered rail preference, the page-wide
 * theme, glare and rail attributes, and the drawer shortcuts. Split out of `ward-rail.tsx`
 * (16 October 2026) so a phone, which never draws the rail, can keep these without loading the
 * rail itself (`ward-rail-lazy.tsx`). The behaviour is unchanged.
 */

function readRailOpenPreference(storedValue: string | null | undefined): boolean {
  // Standard §7.7: "A browser that refuses storage still gets the page, open." Absent or any
  // value other than the literal "closed" reads as open.
  return storedValue !== "closed";
}

let inMemoryFallback: boolean | null = null;

function getRailOpenSnapshot(): boolean {
  if (inMemoryFallback !== null) return inMemoryFallback;
  try {
    return readRailOpenPreference(window.localStorage.getItem(RAIL_OPEN_STORAGE_KEY));
  } catch {
    return true;
  }
}

const railOpenChangeEvent = "ward-flow-rail-change";

function subscribeRailOpen(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(railOpenChangeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(railOpenChangeEvent, onChange);
  };
}

/**
 * Exported for the Settings rail control, together with `setRailOpenPreference` below. These two
 * are the ONLY writers of the rail preference, which is why they are shared rather than copied:
 * `setRailOpenPreference` dispatches `ward-flow-rail-change`, and a duplicate writer that omitted
 * that dispatch would leave the rail stale until a reload.
 *
 * `RAIL_OPEN_STORAGE_KEY` is not re-exported from here, deliberately, so a two-keys catcher can
 * still fail. It lives in `./ward-rail-early` only so the pre-paint script reads the same key.
 */
export const useRailOpenStore = createBrowserStore(subscribeRailOpen, getRailOpenSnapshot, true);

export function setRailOpenPreference(open: boolean) {
  try {
    window.localStorage.setItem(RAIL_OPEN_STORAGE_KEY, open ? "open" : "closed");
    inMemoryFallback = null;
  } catch {
    inMemoryFallback = open;
  }
  window.dispatchEvent(new Event(railOpenChangeEvent));
}

/**
 * Keeps the page's rail, theme and glare attributes in step with the stored preferences, and
 * returns the three values for the rail's own controls.
 */
export function useWardDocumentPreferences() {
  const open = useRailOpenStore();
  const appearance = useAppearanceStore();
  const glare = useGlareStore();

  // Keeps the root attribute in sync with the remembered preference on every mount and whenever
  // it changes elsewhere (another tab, the rail toggle, Settings).
  useEffect(() => {
    document.documentElement.setAttribute("data-rail", open ? "open" : "closed");
  }, [open]);

  // The pre-paint script already applied the pin. Re-applying after hydration is idempotent and
  // keeps data-theme, .dark and theme-color together if anything changed them in between. The theme
  // is one app-wide preference, so leaving Ward Flow keeps it rather than handing the root back.
  // The effect re-runs when `appearance` changes but applies the stored value: during hydration the
  // store still reports its server default, and applying that would flash the wrong theme.
  useLayoutEffect(() => {
    const preference = readStoredThemePreference();
    applyThemeToDocument(preference);
    if (preference !== "system" || typeof window.matchMedia !== "function") return;
    // Auto follows the OS live, so both theme layers move together when it changes.
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyThemeToDocument("system");
    };
    query.addEventListener("change", onChange);
    return () => {
      query.removeEventListener("change", onChange);
    };
  }, [appearance]);

  // Glare mode the same way: painted before first paint, re-applied when it changes in another tab.
  useLayoutEffect(() => {
    applyGlareToDocument(readStoredGlarePreference());
  }, [glare]);

  return { open, appearance, glare };
}

/** Shift+T, Shift+R and Shift+A open the Tasks, Referral and Activity drawers. True when handled. */
export function openDrawerForShortcut(event: KeyboardEvent): boolean {
  if (!event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;
  const drawer =
    event.key === "T" || event.key === "t"
      ? "tasks"
      : event.key === "R" || event.key === "r"
        ? "referral"
        : event.key === "A" || event.key === "a"
          ? "activity"
          : null;
  if (drawer === null) return false;
  event.preventDefault();
  openWardDrawer(drawer);
  return true;
}

/** True when a keystroke belongs to a field, so the page shortcuts leave it alone. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const tag = target instanceof HTMLElement ? target.tagName : "";
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return true;
  return target instanceof HTMLElement && target.isContentEditable;
}
