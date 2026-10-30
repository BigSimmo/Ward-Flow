"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { canRestoreFocusTo } from "./sheet-focus";

function isTextEntry(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;
  return !["button", "checkbox", "radio", "range", "reset", "submit", "color", "file", "image"].includes(target.type);
}

/**
 * Alt+N (Option+N on a Mac). Read from `code`, not `key`: on a Mac Option+N is a dead key. Ctrl
 * must be up so AltGr layouts keep their own characters.
 */
export function isToastJumpKey(event: KeyboardEvent) {
  return (
    event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.isComposing && event.code === "KeyN"
  );
}

function isShown(element: HTMLElement) {
  return window.getComputedStyle(element).display !== "none";
}

/**
 * Alt+N moves focus to the newest notice's first control (a running Undo, the action, or close),
 * so a keyboard user can reach Undo without hunting for it; Alt+N again or Escape goes back. With no
 * notice showing it opens the Recent list instead (`recentRequest` is bumped).
 */
export function useToastJumpKey(regionRef: RefObject<HTMLElement | null>) {
  const [recentRequest, setRecentRequest] = useState(0);
  const cameFrom = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const goBack = () => {
      const target = cameFrom.current;
      cameFrom.current = null;
      if (target && canRestoreFocusTo(target)) target.focus({ preventScroll: true });
      else (document.activeElement as HTMLElement | null)?.blur?.();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const region = regionRef.current;
      if (!region) return;
      const active = document.activeElement;
      const inToast = active instanceof HTMLElement && Boolean(active.closest("[data-wf-toast]"));

      if (event.key === "Escape" && inToast && cameFrom.current && region.contains(active)) {
        // Back to where the person was, without also closing a sheet open underneath.
        event.preventDefault();
        event.stopImmediatePropagation();
        goBack();
        return;
      }
      if (!isToastJumpKey(event) || event.defaultPrevented) return;
      if (isTextEntry(event.target) && !inToast) return;
      event.preventDefault();

      if (inToast && region.contains(active)) {
        goBack();
        return;
      }
      const cards = Array.from(region.querySelectorAll<HTMLElement>('[data-wf-toast]:not([data-leaving="true"])'));
      const newest = cards.at(-1);
      if (!newest) {
        setRecentRequest((count) => count + 1);
        return;
      }
      cameFrom.current = active instanceof HTMLElement && active !== document.body ? active : null;
      const primary = newest.querySelector<HTMLElement>("[data-toast-primary]");
      if (primary && isShown(primary)) {
        primary.focus({ preventScroll: true });
        return;
      }
      // The phone pill hides its X on a toast that closes itself: the card itself takes focus.
      if (!newest.hasAttribute("tabindex")) newest.tabIndex = -1;
      newest.focus({ preventScroll: true });
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [regionRef]);

  return { recentRequest };
}
