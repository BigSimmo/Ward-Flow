"use client";

import { useEffect, useRef } from "react";
import { hasOpenSheet } from "@/components/wf/sheet-focus";

function isTextEntry(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

/**
 * Escape closes a help corner card (the tour offer, What's new, a screen hint) as its "Not now" or
 * "Got it" does, once nothing else has taken the key: an open sheet, dialog, menu or popover answers
 * Escape first, and typing is left alone (notifications pass, 30 Oct 2026).
 */
export function useCornerCardEscape(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || hasOpenSheet() || isTextEntry(event.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"], [role="menu"]')) return;
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);
}
