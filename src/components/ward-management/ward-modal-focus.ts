"use client";

import { useEffect, useId, useRef, type RefObject } from "react";
import { canRestoreFocusTo, isTopmostSheet, popSheet, pushSheet } from "@/components/ui/sheet-focus";

/** Shared Ward dialog lifecycle using the existing overlay stack and background isolation. */
export function useWardModalFocus(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const id = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const panel = ref.current;
    if (!open || !panel) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ),
      ).filter((element) => !element.closest("[hidden], [inert]"));
    pushSheet(id, panel);
    (focusables()[0] ?? panel).focus();
    const keydown = (event: KeyboardEvent) => {
      if (!isTopmostSheet(id)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
      } else if (event.key === "Tab") {
        const items = focusables();
        const first = items[0] ?? panel;
        const last = items.at(-1) ?? panel;
        if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", keydown, true);
    return () => {
      window.removeEventListener("keydown", keydown, true);
      popSheet(id);
      if (previous?.isConnected && canRestoreFocusTo(previous)) previous.focus();
    };
  }, [open, ref, id]);
}
