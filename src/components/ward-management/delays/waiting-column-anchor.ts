"use client";

/**
 * Note 8, issue 5 (Josh, 8 Nov 2026): on Waiting the list and the follow-up column sit side by side
 * and either can be the longer one (the list folds by group; the quiet list grows). The shorter one
 * used to scroll away and leave a large empty gap beside the longer one. This anchors the SHORTER
 * column: it scrolls with the page until its own end is in view, then holds there (or holds under
 * the header when it fits on screen), so both columns stay filled while the longer one scrolls.
 * The longer column is never pinned. Purely a layout aid: it changes no data.
 */
import { useLayoutEffect, type RefObject } from "react";

const GAP = 12;

function scrollerOf(node: HTMLElement): HTMLElement | null {
  for (let el = node.parentElement; el; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowY;
    if (overflow === "auto" || overflow === "scroll") return el;
  }
  return null;
}

export function useShorterColumnAnchor(splitRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    const split = splitRef.current;
    if (!enabled || !split || typeof ResizeObserver === "undefined") return;
    const scroller = scrollerOf(split);
    const update = () => {
      const columns = Array.from(split.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement && child.offsetParent !== null,
      );
      for (const column of columns) {
        column.removeAttribute("data-anchor");
        column.style.removeProperty("--anchor-top");
      }
      if (columns.length !== 2) return;
      const [a, b] = columns;
      // Only when they sit side by side: under 64rem the CSS stacks them, and a pinned column
      // would then cover the one below it.
      if (Math.abs(a.offsetTop - b.offsetTop) > 1) return;
      if (Math.abs(a.offsetHeight - b.offsetHeight) < 48) return;
      const shorter = a.offsetHeight < b.offsetHeight ? a : b;
      const header = parseFloat(getComputedStyle(split).getPropertyValue("--wf-header-height")) || 0;
      const top = (header > 0 ? header * (header < 10 ? 16 : 1) : 56) + GAP;
      const view = scroller ? scroller.clientHeight : window.innerHeight;
      // Fits: hold under the header. Taller than the screen: hold once its end is in view.
      const anchorTop = Math.min(top, view - shorter.offsetHeight - GAP);
      shorter.setAttribute("data-anchor", "");
      shorter.style.setProperty("--anchor-top", `${Math.round(anchorTop)}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(split);
    for (const child of Array.from(split.children)) observer.observe(child);
    if (scroller) observer.observe(scroller);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [splitRef, enabled]);
}
