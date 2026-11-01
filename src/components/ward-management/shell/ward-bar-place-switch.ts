"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * A page's own place switch in the phone bar (Community team phone design, Q155 and Q158, Josh,
 * 1 Nov 2026): on a phone the line under the page title names the page's place and opens the
 * page's switcher, such as Switch team. The page registers it while mounted; the bar draws it in
 * place of the service line. Desktop keeps the service selector.
 */
export type WardBarPlaceSwitch = { label: string; actionLabel: string; onPress: () => void };

let current: WardBarPlaceSwitch | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(next: WardBarPlaceSwitch | null) {
  current = next;
  for (const listener of listeners) listener();
}

const read = () => current;
const readOnServer = () => null;

/** The bar's read of the page's place switch, or null. */
export function useWardBarPlaceSwitch(): WardBarPlaceSwitch | null {
  return useSyncExternalStore(subscribe, read, readOnServer);
}

/** Registers the page's place switch while the page is mounted. Pass null for none. */
export function useRegisterWardBarPlaceSwitch(entry: WardBarPlaceSwitch | null) {
  const label = entry?.label;
  const actionLabel = entry?.actionLabel;
  const onPress = entry?.onPress;
  useEffect(() => {
    if (label === undefined || actionLabel === undefined || onPress === undefined) return;
    const mine: WardBarPlaceSwitch = { label, actionLabel, onPress };
    publish(mine);
    return () => {
      if (current === mine) publish(null);
    };
  }, [label, actionLabel, onPress]);
}
