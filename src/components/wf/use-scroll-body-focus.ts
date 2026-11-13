"use client";

import { useEffect, type RefObject } from "react";

// Its own file, apart from `useScrollRegionFocus`, so the hero and phone figure strips on every
// screen's first load do not carry the dialog-only hook (phone size limits, 13 Nov 2026).

/**
 * Spec item 5 (F-57, 13 Nov 2026): a dialog body that scrolls but holds nothing to focus (a printable
 * sheet, a long read-only note) cannot be scrolled from the keyboard. While it overflows and has no
 * control inside, it takes a tab stop and a name ("{label}, scroll with arrow keys") as a region;
 * once it fits or gains a control it leaves the tab order again. Attributes this hook did not set are
 * left alone. `active` re-runs the check when the body mounts (a dialog opening).
 */
export function useScrollBodyFocus(ref: RefObject<HTMLElement | null>, label: string, active = true): void {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    let owned = false;
    const sync = () => {
      const scrolls = node.scrollHeight > node.clientHeight + 1;
      const hasControl = node.querySelector(SCROLL_BODY_CONTROLS) !== null;
      if (scrolls && !hasControl) {
        if (!owned && node.hasAttribute("tabindex")) return;
        owned = true;
        node.setAttribute("tabindex", "0");
        node.setAttribute("role", "region");
        node.setAttribute("aria-label", `${label}, scroll with arrow keys`);
      } else if (owned) {
        owned = false;
        node.removeAttribute("tabindex");
        node.removeAttribute("role");
        node.removeAttribute("aria-label");
      }
    };
    sync();
    const observers: Array<{ disconnect: () => void }> = [];
    if (typeof ResizeObserver !== "undefined") {
      const resize = new ResizeObserver(sync);
      resize.observe(node);
      observers.push(resize);
    }
    if (typeof MutationObserver !== "undefined") {
      const mutation = new MutationObserver(sync);
      mutation.observe(node, { childList: true, subtree: true });
      observers.push(mutation);
    }
    return () => {
      for (const observer of observers) observer.disconnect();
    };
  }, [ref, label, active]);
}

const SCROLL_BODY_CONTROLS =
  'a[href], button:not(:disabled), input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';
