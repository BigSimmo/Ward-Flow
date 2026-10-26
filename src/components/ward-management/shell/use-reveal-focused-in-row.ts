"use client";

import { useEffect } from "react";

/** The nearest ancestor that scrolls sideways and has more than it shows, or null. */
function sideScroller(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const overflowX = getComputedStyle(node).overflowX;
    if ((overflowX === "auto" || overflowX === "scroll") && node.scrollWidth > node.clientWidth) return node;
  }
  return null;
}

/**
 * H-0386 (26 Oct 2026): a browser scrolls a focused control into view only when none of it shows,
 * so Tab left a chip half cut off at the edge of a sideways row (Statistics sections, Movements
 * stages). On keyboard focus a part-hidden control in such a row is scrolled fully in, keeping the
 * row's own scroll padding. Touch and mouse focus are left alone, so a tap never moves its target.
 */
export function revealFocusedInRow(event: FocusEvent) {
  const el = event.target;
  if (!(el instanceof HTMLElement) || !el.matches(":focus-visible")) return;
  const row = sideScroller(el);
  if (!row) return;
  const box = el.getBoundingClientRect();
  const rowBox = row.getBoundingClientRect();
  if (box.left >= rowBox.left && box.right <= rowBox.right) return;
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
}

export function useRevealFocusedInRow() {
  useEffect(() => {
    document.addEventListener("focusin", revealFocusedInRow);
    return () => document.removeEventListener("focusin", revealFocusedInRow);
  }, []);
}
