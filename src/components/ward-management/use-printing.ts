"use client";

import { useSyncExternalStore } from "react";

/**
 * True while the page is being printed. A list that hides rows behind "Show N" or "Show all N" reads
 * this to draw every row, so the paper holds what the screen holds (INV-PRINT-005, 14 Nov 2026).
 * It follows the print media query (which the browser flips before it lays out the sheet) and the
 * `beforeprint` / `afterprint` events, so emulated and real printing both see it. Never true on the
 * server or on screen.
 */
let forced = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const query = typeof window.matchMedia === "function" ? window.matchMedia("print") : null;
  const before = () => {
    forced = true;
    emit();
  };
  const after = () => {
    forced = false;
    emit();
  };
  query?.addEventListener?.("change", listener);
  window.addEventListener("beforeprint", before);
  window.addEventListener("afterprint", after);
  return () => {
    listeners.delete(listener);
    query?.removeEventListener?.("change", listener);
    window.removeEventListener("beforeprint", before);
    window.removeEventListener("afterprint", after);
  };
}

function snapshot(): boolean {
  if (forced) return true;
  return typeof window.matchMedia === "function" ? window.matchMedia("print").matches : false;
}

export function usePrinting(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
