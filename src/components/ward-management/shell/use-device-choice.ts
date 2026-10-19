"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * Smart features idea 9 (19 Oct 2026): remember how a person last arranged a screen, on this
 * device only. Same safe localStorage pattern as the Delays order (delays/delays-board.tsx): a
 * blocked or private store never throws, and the server snapshot is the screen's own default.
 *
 * Only a value from the screen's fixed list is ever stored or read back, never a name, a record or
 * anything typed, and only arrangement (order, layout), never a filter that would hide a record.
 */
const CHANGE_EVENT = "ward_flow_device_choice_change";
const fallback = new Map<string, string>();

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(key: string): string | null {
  // A store can refuse writes yet still answer reads (a full quota), so a page-only choice wins.
  if (fallback.has(key)) return fallback.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** `key` is a fixed `ward_flow_choice_…` name; `allowed` is the screen's own list of choices. */
export function useDeviceChoice<T extends string>(
  key: `ward_flow_choice_${string}`,
  allowed: readonly T[],
  initial: T,
): [T, (next: T) => void] {
  const stored = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const value = allowed.find((choice) => choice === stored) ?? initial;
  const choose = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, next);
        fallback.delete(key);
      } catch {
        // Private browsing or a blocked store: the choice lasts for this page only.
        fallback.set(key, next);
      }
      try {
        window.dispatchEvent(new Event(CHANGE_EVENT));
      } catch {
        // Nothing else depends on the notification.
      }
    },
    [key],
  );
  return [value, choose];
}
