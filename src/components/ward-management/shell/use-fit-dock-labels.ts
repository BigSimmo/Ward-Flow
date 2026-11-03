"use client";

import { useLayoutEffect, type RefObject } from "react";

/** House rule: no text under 12px, so a label stops shrinking here. */
const DOCK_LABEL_MIN_PX = 12;

/**
 * The longest word fits the tab, and no third line hides under the two-line clamp. A line height
 * of 1 lets the letters' tops and tails overhang the box by a few pixels, so only a hidden line
 * (more than half a line of overflow) counts.
 */
function fits(label: HTMLElement) {
  const size = Number.parseFloat(getComputedStyle(label).fontSize) || DOCK_LABEL_MIN_PX;
  return label.scrollWidth <= label.clientWidth && label.scrollHeight <= label.clientHeight + size / 2;
}

/**
 * Shrink one dock label until its longest word fits its column and its lines fit the two-line
 * clamp, but never below 12px. Words are never split (ward-phone-menu.module.css .dockLabel).
 * A half-pixel binary search: a label that fits at its own size is left alone.
 */
export function fitDockLabel(label: HTMLElement) {
  label.style.fontSize = "";
  if (fits(label)) return;
  let high = Number.parseFloat(getComputedStyle(label).fontSize);
  let low = DOCK_LABEL_MIN_PX;
  while (high - low > 0.5) {
    const mid = Math.round(low + high) / 2;
    label.style.fontSize = `${mid}px`;
    if (fits(label)) low = mid;
    else high = mid;
  }
  label.style.fontSize = `${low}px`;
}

/**
 * Q307 (Josh, 2 Nov 2026): at 200% text a dock label ("Referrals", "Activity") shrinks to fit its
 * tab instead of breaking mid-word. Labels at today's size already fit and are left alone.
 */
export function useFitDockLabels(dockRef: RefObject<HTMLElement | null>, selector: string) {
  useLayoutEffect(() => {
    const dock = dockRef.current;
    if (!dock || typeof ResizeObserver === "undefined") return;
    const fitAll = () => {
      for (const label of dock.querySelectorAll<HTMLElement>(selector)) fitDockLabel(label);
    };
    fitAll();
    // A width change (rotation) or a text-size change both resize the dock's tabs.
    const observer = new ResizeObserver(fitAll);
    observer.observe(dock);
    for (const item of dock.children) observer.observe(item);
    void document.fonts?.ready.then(fitAll);
    return () => observer.disconnect();
  });
}
