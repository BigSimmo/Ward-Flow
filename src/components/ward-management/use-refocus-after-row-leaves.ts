"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * RB-N01 / NB-02 / A1K-04: a button that closes its own row (Done, Accept) leaves with the row, which
 * drops keyboard focus to the page. Call `mark(index)` as the row's button is pressed; once the rows
 * next change and focus has been lost, focus goes to the same button on the row now in that place (or the
 * last one), else to `fallback`. A refused step keeps its row and focus, so nothing moves.
 */
export function useRefocusAfterRowLeaves({
  list,
  selector,
  rowsKey,
  fallback,
}: {
  list: RefObject<HTMLElement | null>;
  /** The control to focus on the row that takes the closed row's place. */
  selector: string;
  /** Changes whenever the rows change, e.g. their ids joined. */
  rowsKey: string;
  fallback?: RefObject<HTMLElement | null>;
}): (index: number) => void {
  const marked = useRef<number | null>(null);
  useEffect(() => {
    const index = marked.current;
    const active = document.activeElement;
    if (index === null) return;
    marked.current = null;
    if (active !== null && active !== document.body && active.isConnected) return;
    const targets = list.current?.querySelectorAll<HTMLElement>(selector);
    if (targets && targets.length > 0) {
      targets[Math.min(index, targets.length - 1)]!.focus();
      return;
    }
    const region = fallback?.current;
    if (!region) return;
    // A heading or region takes focus only for this hand-over, so it never joins the tab order.
    if (!region.hasAttribute("tabindex")) {
      region.setAttribute("tabindex", "-1");
      region.addEventListener("blur", () => region.removeAttribute("tabindex"), { once: true });
    }
    region.focus();
  }, [rowsKey, list, selector, fallback]);
  return (index: number) => {
    marked.current = index;
  };
}
