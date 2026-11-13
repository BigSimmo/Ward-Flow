"use client";

import { useEffect, type RefObject } from "react";

/**
 * Review 5 Nov 2026 (axe `scrollable-region-focusable`): a phone hero figure strip scrolls sideways
 * rather than cutting a label, so a keyboard user must be able to reach it. While the element
 * overflows it joins the tab order (arrow keys then scroll it); when everything fits it leaves again,
 * so a strip that needs no scrolling adds no extra stop. The element carries its own accessible name.
 * `contentKey` re-runs the check when the content changes.
 */
export function useScrollRegionFocus(ref: RefObject<HTMLElement | null>, contentKey?: unknown): void {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const sync = () => {
      if (node.scrollWidth > node.clientWidth + 1) node.tabIndex = 0;
      else node.removeAttribute("tabindex");
    };
    sync();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    for (const child of Array.from(node.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [ref, contentKey]);
}
