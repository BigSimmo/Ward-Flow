"use client";

import { useEffect, useSyncExternalStore } from "react";

import { isActiveRailEntry, type RailEntry } from "@/components/ward-management/shell/ward-rail-entries";

/**
 * Find (mock-up, 26 Nov 2026): the open Find tab, for the rail. The tab lives in the address's
 * `?tab=`, which the rail does not read, so Find reports it here and the rail lights Find on every
 * tab (audit two, B11: the coordinator's rail has one Find row, no All EDs or All wards row).
 */
let current: string | null = null;
const listeners = new Set<() => void>();

export function useReportFindTab(tab: string) {
  useEffect(() => {
    current = tab;
    listeners.forEach((listener) => listener());
    return () => {
      current = null;
      listeners.forEach((listener) => listener());
    };
  }, [tab]);
}

export function useOpenFindTab(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => null,
  );
}

/** The rail entry every Find tab lights. */
const FIND_RAIL_ENTRY = "hub";

/** The rail's "is this entry the page I am on": on any Find tab, the Find entry and no other. */
export function useIsActiveRailEntry(): (pathname: string, entry: RailEntry) => boolean {
  const openTab = useOpenFindTab();
  const settingsSection = useOpenSettingsSection();
  return (pathname, entry) => {
    if (openTab) return entry.id === FIND_RAIL_ENTRY;
    // Gate r10 (A1 call 8, flipped): the access admin's Staff access row lights only while the
    // Settings page shows its Staff access pane; one lit row at a time.
    if (entry.id === STAFF_ACCESS_RAIL_ENTRY) return settingsSection === "access";
    return isActiveRailEntry(pathname, entry);
  };
}

/** The access admin's rail row for the Settings Staff access pane (`next-role-menu.ts`). */
const STAFF_ACCESS_RAIL_ENTRY = "staff-access";

/** The Settings section in view, reported by the Settings page, for the rail (as the Find tab is). */
let settingsCurrent: string | null = null;
const settingsListeners = new Set<() => void>();

export function useReportSettingsSection(section: string) {
  useEffect(() => {
    settingsCurrent = section;
    settingsListeners.forEach((listener) => listener());
    return () => {
      settingsCurrent = null;
      settingsListeners.forEach((listener) => listener());
    };
  }, [section]);
}

function useOpenSettingsSection(): string | null {
  return useSyncExternalStore(
    (listener) => {
      settingsListeners.add(listener);
      return () => settingsListeners.delete(listener);
    },
    () => settingsCurrent,
    () => null,
  );
}
