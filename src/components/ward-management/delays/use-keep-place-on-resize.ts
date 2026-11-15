"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * R-HOME-16: turning a tablet or narrowing the window swaps the list between its table, tablet and
 * phone drawings, which used to throw the page back to the top. While the list is scrolled, this notes
 * the first row in view and how far down it sits; when `layoutKey` changes it puts that row back at
 * the same height. The open row is page state, so it is unaffected. Held in memory only.
 */
export function useKeepPlaceOnResize(layoutKey: string, rowSelector: string): void {
  const place = useRef<{ id: string; offset: number } | null>(null);
  const lastKey = useRef(layoutKey);

  useEffect(() => {
    const note = () => {
      for (const row of document.querySelectorAll<HTMLElement>(rowSelector)) {
        const box = row.getBoundingClientRect();
        if (box.height > 0 && box.bottom > 0) {
          place.current = { id: row.getAttribute("data-testid") ?? "", offset: box.top };
          return;
        }
      }
    };
    document.addEventListener("scroll", note, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", note, { capture: true });
  }, [rowSelector]);

  useLayoutEffect(() => {
    if (lastKey.current === layoutKey) return;
    lastKey.current = layoutKey;
    const saved = place.current;
    if (!saved || saved.id === "") return;
    const row = [...document.querySelectorAll<HTMLElement>(rowSelector)].find(
      (candidate) => candidate.getAttribute("data-testid") === saved.id,
    );
    if (!row) return;
    const delta = row.getBoundingClientRect().top - saved.offset;
    if (Math.abs(delta) < 1) return;
    let node: HTMLElement | null = row.parentElement;
    while (node) {
      const overflowY = getComputedStyle(node).overflowY;
      if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
        node.scrollTop += delta;
        return;
      }
      node = node.parentElement;
    }
    window.scrollBy(0, delta);
  }, [layoutKey, rowSelector]);
}
