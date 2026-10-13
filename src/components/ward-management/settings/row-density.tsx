"use client";

import { useCallback, useEffect } from "react";

import { createBrowserStore } from "@/lib/client-store-factory";

/**
 * Row density (Settings, Display). Site review (12 Oct 2026): the control was greyed with no
 * reason although the v9 tokens already carry it, so it is wired. Comfortable keeps the default
 * rows; Compact sets `data-density="dense"` on the body, which `ward-flow-v9-tokens.css` turns into
 * 36px rows (`--wf-row`). The body, not the root, so the host app's own `html[data-density]` type
 * preference is never overwritten. A per-browser preference, like reduce motion.
 */
export type RowDensity = "comfortable" | "compact";

const KEY = "ward-flow-row-density";
const CHANGE = "ward-row-density-change";
let fallback: RowDensity | null = null;

function read(): RowDensity {
  if (fallback) return fallback;
  try {
    return window.localStorage.getItem(KEY) === "compact" ? "compact" : "comfortable";
  } catch {
    return "comfortable";
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

const useStoredDensity = createBrowserStore<RowDensity>(subscribe, read, "comfortable");

export function useRowDensity(): [RowDensity, (next: RowDensity) => void] {
  const density = useStoredDensity();
  const set = useCallback((next: RowDensity) => {
    try {
      window.localStorage.setItem(KEY, next);
      fallback = null;
    } catch {
      // Keep the choice for this session when storage is blocked.
      fallback = next;
    }
    window.dispatchEvent(new Event(CHANGE));
  }, []);
  return [density, set];
}

/** Mounted once above every Ward route, so reload and navigation keep the chosen density. */
export function WardRowDensity() {
  const [density] = useRowDensity();
  useEffect(() => {
    const body = document.body;
    if (density === "compact") body.setAttribute("data-density", "dense");
    else body.removeAttribute("data-density");
    return () => body.removeAttribute("data-density");
  }, [density]);
  return null;
}
