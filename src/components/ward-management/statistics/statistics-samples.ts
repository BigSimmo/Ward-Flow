"use client";

import { useSyncExternalStore } from "react";

import { announceToWardShell } from "../shell/ward-live-region";
import { wardEnvironment, type WardEnvironment } from "../ward-feature-flags";

const STORAGE_KEY = "ward-flow-statistics-samples";
const CHANGE_EVENT = "ward-flow-statistics-samples-change";

/**
 * Owner polish (3 Nov 2026): the demo shows example history until the viewer turns it off, so Weekly
 * and the unit pages show invented trends rather than dashes. The live site runs as the demo too
 * (as Show me does, D-92), so it is on there. Production and local builds keep it off until asked
 * for. The environment is the one feature flags read (`wardEnvironment`).
 */
export function statisticsSamplesDefault(environment: WardEnvironment = wardEnvironment()): boolean {
  return environment === "demo";
}

let fallback: boolean | null = null;

/** This device's own choice wins; with none, the build's default. */
function snapshot(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "on") return true;
    if (stored === "off") return false;
    return statisticsSamplesDefault();
  } catch {
    // Storage unavailable: the choice made on this page, else the default.
    return fallback ?? statisticsSamplesDefault();
  }
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}
export function setStatisticsSamples(enabled: boolean) {
  fallback = enabled;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    /* In-memory preference works when storage is unavailable. */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  // WF-42: say what changed — invented charts appear or hide below, which is easy to miss.
  announceToWardShell(
    enabled
      ? "Example history is on, and invented 30-day charts are shown below."
      : "Example history is off, and the invented charts are hidden.",
  );
}
/**
 * Optional invented history: on by default in the demo, off elsewhere. The viewer's choice is kept on
 * this device, apart from clinical workflow state.
 */
export function useStatisticsSamples() {
  return useSyncExternalStore(subscribe, snapshot, () => statisticsSamplesDefault());
}
