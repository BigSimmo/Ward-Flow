"use client";

import { useSyncExternalStore } from "react";

import { wardEnvironment, type WardEnvironment } from "../ward-feature-flags";

const STORAGE_KEY = "ward-flow-statistics-samples";
const CHANGE_EVENT = "ward-flow-statistics-samples-change";

/**
 * Owner polish (3 Nov 2026): the demo shows example history until the viewer turns it off, so Weekly
 * and the unit pages show invented trends rather than dashes. Production, the signed-in shared site
 * and local builds keep it off until asked for. The environment is the one feature flags read
 * (`wardEnvironment`); a shared build is never the public demo (as the demo roles tool reads it).
 */
export function statisticsSamplesDefault(
  environment: WardEnvironment = wardEnvironment(),
  shared: string | undefined = process.env.NEXT_PUBLIC_WARD_SHARED_ENABLED,
): boolean {
  return environment === "demo" && shared?.trim().toLowerCase() !== "true";
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
}
/**
 * Optional invented history: on by default in the demo, off elsewhere. The viewer's choice is kept on
 * this device, apart from clinical workflow state.
 */
export function useStatisticsSamples() {
  return useSyncExternalStore(subscribe, snapshot, () => statisticsSamplesDefault());
}
