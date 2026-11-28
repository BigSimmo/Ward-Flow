"use client";

/**
 * The Waiting board's browser stores and small hooks, split out of `delays-board.tsx` to keep that
 * file under 1,500 lines.
 */
import { useEffect, useState } from "react";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { type Movement } from "@/components/ward-management/ward-model";

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
