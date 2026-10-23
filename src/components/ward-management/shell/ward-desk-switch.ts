"use client";

/**
 * **A DESK SWITCH ON ITS WAY.** Go to a desk takes the new desk's access at once, then moves to its
 * home. On a slow server the old page stays up for seconds, and under the new desk it read "Not part
 * of your role" until the home arrived, which looked like the switch had failed (visual desk, #576).
 * While the page is still the one the switch started from, the page area says the desk is opening
 * instead. This changes nothing about what a desk can open: any other page, or the same page once
 * the wait is over, gets the usual closed screen.
 */
import { useSyncExternalStore } from "react";

/** How long the old page may wait for the new desk's home before it shows the closed screen. */
export const DESK_SWITCH_WAIT_MS = 15_000;

let from: string | null = null;
const listeners = new Set<() => void>();

function emit(next: string | null) {
  if (from === next) return;
  from = next;
  for (const listener of listeners) listener();
}

/** Called just before a switch changes the desk, with the page it leaves and the page it goes to. */
export function noteDeskSwitch(leaving: string, going: string): void {
  emit(leaving === going ? null : leaving);
}

export function clearDeskSwitch(): void {
  emit(null);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The page a desk switch is leaving, while it is on its way. */
export function useDeskSwitchFrom(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => from,
    () => null,
  );
}
