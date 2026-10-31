"use client";

/**
 * The Waiting board's browser stores and small hooks, moved out of the role copies of
 * `delays-board-redesign.tsx` (nurse in charge, ED) to keep each file under 1,500 lines. The code is
 * unchanged from those copies and from `waiting/delays-board-redesign.tsx`, which keeps its own.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { type Movement } from "@/components/ward-management/ward-model";
import { createBrowserStore } from "@/lib/client-store-factory";

/*
 * Audit A3-14: the board opens on Longest wait (forms due first, then longest wait) and remembers
 * the viewer's own choice in this browser. Same safe localStorage pattern as the wallboard store:
 * a blocked or private store never throws, and the server snapshot is the default.
 */
const DELAYS_ORDER_STORAGE_KEY = "ward_flow_delays_order";
const DELAYS_ORDER_CHANGE_EVENT = "ward_flow_delays_order_change";
let delaysOrderFallback: boolean | undefined;

export function readDelaysFlat(): boolean {
  try {
    return window.localStorage.getItem(DELAYS_ORDER_STORAGE_KEY) !== "blocker";
  } catch {
    return delaysOrderFallback ?? true;
  }
}

export function writeDelaysFlat(flat: boolean): void {
  try {
    window.localStorage.setItem(DELAYS_ORDER_STORAGE_KEY, flat ? "longest" : "blocker");
  } catch {
    // Private browsing or a blocked store: the choice lasts for this page only.
    delaysOrderFallback = flat;
  }
  try {
    window.dispatchEvent(new Event(DELAYS_ORDER_CHANGE_EVENT));
  } catch {
    // Nothing else depends on the notification.
  }
}

function subscribeDelaysOrder(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(DELAYS_ORDER_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DELAYS_ORDER_CHANGE_EVENT, onChange);
  };
}

export const useDelaysFlatStore = createBrowserStore(subscribeDelaysOrder, readDelaysFlat, true);

/**
 * Audit A3-16: a collected patient is on the road, not in the ED. Their row says so; the waiting
 * count is unchanged until the rule for collected patients is agreed.
 */
export function transitNote(movement: Movement, now: Instant): string | undefined {
  const collectedAt = movement.transport?.collectedAt;
  if (collectedAt === undefined || movement.transport?.cancelledAt !== undefined || movement.stage === "arrived")
    return undefined;
  return `In transit since ${formatInstantWithDay(collectedAt, now)}`;
}

/** Below 64rem the person's panel is a sheet over the table (see delays-board.module.css). */
const SHEET_QUERY = "(max-width: 64rem)";

function isSheetLayout(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(SHEET_QUERY).matches;
}

function subscribeSheetLayout(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(SHEET_QUERY);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

/** True at or below 64rem, where the person's panel is a sheet over the table. */
export function useSheetLayout(): boolean {
  return useSyncExternalStore(subscribeSheetLayout, isSheetLayout, () => false);
}

/** DA-26 (design audit): which edges of a sideways-scrolling area still hide content. */
export function useSideScroll(): [(node: HTMLDivElement | null) => void, { before: boolean; after: boolean }] {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ before: false, after: false });
  useEffect(() => {
    if (node === null || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const before = node.scrollLeft > 1;
      const after = node.scrollLeft < node.scrollWidth - node.clientWidth - 1;
      setEdges((current) => (current.before === before && current.after === after ? current : { before, after }));
    };
    // The observer reports once on observe, so the first measure needs no direct call.
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    for (const child of Array.from(node.children)) observer.observe(child);
    node.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      node.removeEventListener("scroll", measure);
    };
  }, [node]);
  return [setNode, edges];
}
