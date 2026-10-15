"use client";

import { useEffect, type RefObject } from "react";
import { lockPageScroll } from "@/components/ui/sheet-focus";
import { useModalFocus } from "@/components/wf";

/**
 * Ward dialog lifecycle for a hand-built modal panel, on the one shared contract (`useModalFocus`):
 * the sheet stack inerts the page behind, focus moves to the first control as soon as it opens,
 * Tab wraps inside the panel, Escape closes only the top layer, and focus returns to the opener.
 * Keys are handled in the capture phase and stopped there, because the screens these panels open
 * over keep window-level Escape shortcuts of their own.
 */
export function useWardModalFocus(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void) {
  useModalFocus({ open, onClose, panelRef: ref, focusOnOpen: "immediate", keyPhase: "capture" });
}

/**
 * Holds the page still while a modal that keeps its own focus handling is open, so a swipe in it
 * never scrolls the page behind (Josh, 12 Oct 2026, iPhone). `useWardModalFocus` and the shared
 * Sheet, Dialog and phone sheet already hold it through the sheet stack.
 */
export function useWardPageScrollLock(open: boolean) {
  useEffect(() => (open ? lockPageScroll() : undefined), [open]);
}
