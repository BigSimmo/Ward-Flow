"use client";

import { useCallback, useEffect, useId, useRef, type RefObject } from "react";
import { modalFocusTargets } from "./focus-targets";
import {
  canRestoreFocusTo,
  isTopmostSheet,
  overlayOpener,
  popSheet,
  pushSheet,
  SHEET_AUTOFOCUS_SELECTOR,
  startSheetOpenFocus,
  updateSheetRoot,
  type SheetFocusController,
} from "./sheet-focus";

export type UseModalFocusOptions = {
  open: boolean;
  /** Escape calls this (only while this layer is the top of the sheet stack). */
  onClose: () => void;
  /** The element focus is kept inside: the `role="dialog"` panel. */
  panelRef: RefObject<HTMLElement | null>;
  /** Where focus starts. Beats a `data-sheet-autofocus` child. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /**
   * Where focus starts when there is no `initialFocusRef` and no `data-sheet-autofocus` child,
   * usually the close button. When it is passed but empty, the panel takes focus. When it is not
   * passed at all, the first focusable control takes focus, then the panel.
   */
  fallbackFocusRef?: RefObject<HTMLElement | null>;
  /** Where focus returns on close, read at close time. Defaults to whatever had focus on open. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Escape closes the layer. On by default. */
  closeOnEscape?: boolean;
  /**
   * `deferred` (the default) moves focus in from the next frame through the shared settle
   * controller. `immediate` also moves it synchronously on open, for a modal whose callers expect
   * focus inside as soon as the open render commits.
   */
  focusOnOpen?: "deferred" | "immediate";
  /**
   * `bubble` (the default) handles Escape after everything inside the panel, so a menu or field
   * that handles its own Escape (`preventDefault`) keeps it. `capture` handles Escape and Tab
   * before anything else on the page and stops the event there, for a modal opened over a screen
   * whose own window-level Escape shortcut does not consult the sheet stack.
   */
  keyPhase?: "bubble" | "capture";
};

export type UseModalFocusResult = {
  /**
   * Callback ref for the modal's outermost element (its scrim or backdrop), so the sheet stack
   * inerts everything outside it. Optional: without it the panel is the stack root.
   */
  rootRef: (node: HTMLElement | null) => void;
};

/** First control for opening focus. Layout is not required here, so a not-yet-measured panel still works. */
function firstControlIn(panel: HTMLElement | null) {
  return modalFocusTargets(panel, false, false)[0] ?? null;
}

/**
 * The one modal focus contract shared by `Dialog`, `PhoneSheet` and every hand-built Ward modal.
 * While `open`, the layer joins the shared sheet stack (`sheet-focus`), so the page behind is inert
 * and its scroll is held; focus moves inside (`initialFocusRef`, then a `data-sheet-autofocus`
 * child, then `fallbackFocusRef`); Tab and Shift+Tab wrap inside the panel; Escape closes only the
 * top-most layer; and on close focus returns to `returnFocusRef` or the opener, unless another
 * layer took over or focus already moved somewhere real.
 */
export function useModalFocus({
  open,
  onClose,
  panelRef,
  initialFocusRef,
  fallbackFocusRef,
  returnFocusRef,
  closeOnEscape = true,
  focusOnOpen = "deferred",
  keyPhase = "bubble",
}: UseModalFocusOptions): UseModalFocusResult {
  const modalId = useId();
  const rootElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const closeOnEscapeRef = useRef(closeOnEscape);
  const openFocusRef = useRef<SheetFocusController | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
    closeOnEscapeRef.current = closeOnEscape;
  }, [onClose, closeOnEscape]);

  const rootRef = useCallback(
    (node: HTMLElement | null) => {
      rootElementRef.current = node;
      updateSheetRoot(modalId, node);
    },
    [modalId],
  );

  // Read at close time, so a caller can retarget the return while the modal is open.
  const resolveReturnTarget = useCallback(() => returnFocusRef?.current ?? null, [returnFocusRef]);
  const hasFallback = fallbackFocusRef !== undefined;

  useEffect(() => {
    if (!open) return;
    const opener = overlayOpener();
    const openPanel = panelRef.current;
    const capture = keyPhase === "capture";

    pushSheet(modalId, rootElementRef.current ?? openPanel);
    const resolveTarget = () => {
      const panel = panelRef.current;
      return (
        initialFocusRef?.current ??
        panel?.querySelector<HTMLElement>(SHEET_AUTOFOCUS_SELECTOR) ??
        (hasFallback ? fallbackFocusRef?.current : firstControlIn(panel)) ??
        panel
      );
    };
    if (focusOnOpen === "immediate") {
      const panel = panelRef.current;
      // The panel is the last resort, and a plain div ignores focus() without a tabindex.
      if (panel && !panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");
      resolveTarget()?.focus({ preventScroll: true });
    }
    openFocusRef.current = startSheetOpenFocus({
      sheetId: modalId,
      getPanel: () => panelRef.current,
      resolveTarget,
    });

    function onKeyDown(event: KeyboardEvent) {
      // Only the top layer reacts: a dialog over a drawer closes alone, and the drawer's own Tab
      // trap stays out of the way.
      if (!isTopmostSheet(modalId)) return;
      if (event.key === "Escape") {
        if (!closeOnEscapeRef.current) {
          // A layer that ignores Escape still owns it in the capture phase, so the screen behind
          // (the idle lock's, for one) cannot act on it either.
          if (capture) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
          return;
        }
        // In the bubble phase a menu or field inside the panel that handled Escape has said so.
        if (event.defaultPrevented) return;
        if (event.target instanceof HTMLElement && event.target.tagName === "SELECT") return;
        event.preventDefault();
        if (capture) event.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      const focusable = modalFocusTargets(panel, true);
      // Move focus explicitly rather than trusting the platform's Tab order, which varies by
      // browser for programmatically focused buttons.
      event.preventDefault();
      if (capture) event.stopImmediatePropagation();
      if (focusable.length === 0) {
        panel?.focus();
        return;
      }
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const index = active ? focusable.indexOf(active) : -1;
      const next =
        index === -1
          ? event.shiftKey
            ? focusable.length - 1
            : 0
          : (index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
      focusable[next].focus();
    }

    window.addEventListener("keydown", onKeyDown, capture);
    return () => {
      window.removeEventListener("keydown", onKeyDown, capture);
      openFocusRef.current?.cancel();
      openFocusRef.current = null;
      popSheet(modalId);
      const target = [resolveReturnTarget(), opener].find((element): element is HTMLElement =>
        Boolean(element?.isConnected),
      );
      // The panel is usually gone, so focus has fallen to the page; a panel that stays mounted
      // while closed may still hold it. Hand it back to the opener unless another layer has taken
      // over (a sheet that replaced this modal owns focus now) or focus moved somewhere real.
      const active = document.activeElement;
      const focusFell =
        active == null ||
        active === document.body ||
        !active.isConnected ||
        Boolean(openPanel?.isConnected && openPanel.contains(active));
      if (target && focusFell && canRestoreFocusTo(target)) target.focus({ preventScroll: true });
    };
  }, [
    open,
    modalId,
    panelRef,
    initialFocusRef,
    fallbackFocusRef,
    hasFallback,
    resolveReturnTarget,
    focusOnOpen,
    keyPhase,
  ]);

  return { rootRef };
}
