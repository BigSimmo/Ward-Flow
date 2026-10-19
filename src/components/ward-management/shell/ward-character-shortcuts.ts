"use client";

import { createBrowserStore } from "@/lib/client-store-factory";

// This browser preference stores only an on/off choice, never typed or patient information.
const KEY = "ward-flow-character-shortcuts";
const CHANGE = "ward-flow-character-shortcuts-change";
let fallback: boolean | null = null;

/** Read at the keystroke so mounted screens honour a changed preference immediately. */
export function areCharacterShortcutsEnabled(): boolean {
  if (fallback !== null) return fallback;
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
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

const useStoredPreference = createBrowserStore(subscribe, areCharacterShortcutsEnabled, true);

export function setCharacterShortcutsEnabled(enabled: boolean): void {
  try {
    if (enabled) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, "off");
    fallback = null;
  } catch {
    fallback = enabled;
  }
  window.dispatchEvent(new Event(CHANGE));
}

/** One app-wide choice, shared by Settings and Handover's existing shortcut control. */
export function useCharacterShortcutsPreference(): [boolean, (enabled: boolean) => void] {
  return [useStoredPreference(), setCharacterShortcutsEnabled];
}
