"use client";

import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

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

/**
 * A narrower print of the same page, named on the root as `data-print-scope` so the print styles
 * can follow it. `ed-placement` is the Patients short sheet: only the people in ED and in placement
 * (ward-flow-print.css). Cleared on `afterprint`.
 */
export type PrintScope = "ed-placement";
let scope: PrintScope | null = null;

function clearPrint() {
  forced = false;
  scope = null;
  delete document.documentElement.dataset.printScope;
  emit();
}

/**
 * Prints the page from a button, as Ctrl+P does, optionally narrowed to a scope. The print layout is
 * drawn before the browser takes the sheet: a button's own click runs before React would render the
 * `beforeprint` change, so the page would otherwise print its screen layout (folded groups).
 */
export function printPage(nextScope: PrintScope | null = null) {
  flushSync(() => {
    forced = true;
    scope = nextScope;
    if (nextScope) document.documentElement.dataset.printScope = nextScope;
    else delete document.documentElement.dataset.printScope;
    emit();
  });
  window.addEventListener("afterprint", clearPrint, { once: true });
  window.print();
}

/** The scope of the print under way, or `null` (a whole-page print, or not printing). */
export function usePrintScope(): PrintScope | null {
  return useSyncExternalStore(
    subscribe,
    () => scope,
    () => null,
  );
}
