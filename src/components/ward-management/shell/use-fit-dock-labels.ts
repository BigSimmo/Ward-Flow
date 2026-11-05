"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

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
  const binding = useRef<{ dock: HTMLElement; selector: string; dispose: () => void } | null>(null);
  // The executive dock can mount after loading or a viewport change. Check the node each commit,
  // but keep the observers and fitted sizes while the same dock and labels remain mounted.
  useLayoutEffect(() => {
    const dock = dockRef.current;
    if (binding.current?.dock === dock && binding.current.selector === selector) return;
    binding.current?.dispose();
    binding.current = null;
    if (!dock || typeof ResizeObserver === "undefined") return;
    let active = true;
    // The dock's children being watched, so a replaced child is let go rather than kept observed.
    const observed = new Set<Element>();
    const fitAll = () => {
      if (!active) return;
      for (const label of dock.querySelectorAll<HTMLElement>(selector)) fitDockLabel(label);
      const current = new Set(dock.children);
      for (const item of observed) {
        if (current.has(item)) continue;
        observer.unobserve(item);
        observed.delete(item);
      }
      for (const item of current) {
        if (observed.has(item)) continue;
        observer.observe(item);
        observed.add(item);
      }
    };
    const observer = new ResizeObserver(fitAll);
    observer.observe(dock);
    const labelChanged = (node: Node) => {
      const element = node instanceof Element ? node : node.parentElement;
      return Boolean(element?.closest(selector) || (node instanceof Element && node.querySelector(selector)));
    };
    const mutations = new MutationObserver((records) => {
      if (
        records.some(
          (record) => labelChanged(record.target) || [...record.addedNodes, ...record.removedNodes].some(labelChanged),
        )
      )
        fitAll();
    });
    mutations.observe(dock, { childList: true, subtree: true, characterData: true });
    fitAll();
    void document.fonts?.ready.then(fitAll);
    document.fonts?.addEventListener("loadingdone", fitAll);
    binding.current = {
      dock,
      selector,
      dispose: () => {
        active = false;
        observer.disconnect();
        observed.clear();
        mutations.disconnect();
        document.fonts?.removeEventListener("loadingdone", fitAll);
      },
    };
  });
  useLayoutEffect(
    () => () => {
      binding.current?.dispose();
      binding.current = null;
    },
    [],
  );
}
