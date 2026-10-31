"use client";

import { type RefObject, useEffect, useRef } from "react";
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
function isToastJumpKey(event: KeyboardEvent) {
  return (
    event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.isComposing && event.code === "KeyN"
  );
}

function isShown(element: HTMLElement) {
  return window.getComputedStyle(element).display !== "none";
}

const LIVE_CARD = '[data-wf-toast-host] [data-wf-toast]:not([data-leaving="true"])';

/**
 * Alt+N moves focus to the newest notice's first control (a running Undo, the action, or close),
 * so a keyboard user can reach Undo without hunting for it; Alt+N again or Escape goes back. With no
 * notice showing it does nothing.
 *
 * A page can hold more than one toast region (each Ward Flow shell mounts its own provider), so only
 * the region holding the newest notice answers.
 */
export function useToastJumpKey(regionRef: RefObject<HTMLElement | null>) {
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

      if (inToast) {
        if (!region.contains(active)) return;
        event.preventDefault();
        goBack();
        return;
      }
      const newest = Array.from(document.querySelectorAll<HTMLElement>(LIVE_CARD)).at(-1);
      if (!newest || !region.contains(newest)) return;
      event.preventDefault();
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
}
