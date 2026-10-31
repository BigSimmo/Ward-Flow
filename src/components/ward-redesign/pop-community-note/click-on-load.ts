"use client";

import { useEffect } from "react";

/**
 * Preview only: once the page has drawn, presses the control that opens a pop-up, as a person would
 * (the page owns the pop-up's state). Polls for up to ten seconds, then gives up quietly.
 */
export function useClickOnLoad(find: () => HTMLElement | null) {
  useEffect(() => {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const control = find();
      if (!control && tries < 100) return;
      window.clearInterval(timer);
      control?.click();
    }, 100);
    return () => window.clearInterval(timer);
    // Runs once, on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** The first visible element matching `selector` whose text is `text` (or any, without `text`). */
export function visibleControl(selector: string, text?: string): HTMLElement | null {
  for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
    if (text !== undefined && element.textContent?.trim() !== text) continue;
    const box = element.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) return element;
  }
  return null;
}
