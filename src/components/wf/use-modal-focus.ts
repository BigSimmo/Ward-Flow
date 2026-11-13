"use client";

import { useCallback, useEffect, useId, useRef, type RefObject } from "react";
import { modalFocusTargets } from "./focus-targets";
import { focusOpenerPlace, rememberOpenerPlace } from "./focus-opener";
import {
  canRestoreFocusTo,
  isTopmostSheet,
  overlayOpener,
  popSheet,
  pushSheet,
  SHEET_AUTOFOCUS_SELECTOR,
  startSheetOpenFocus,
  updateSheetRoot,
  updateSheetInteractionRoots,
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
  /** Opt-in guided interaction: only these current target subtrees also stay available. */
  interactionRoots?: readonly (HTMLElement | null)[];
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

/** The panel's own heading: what `aria-labelledby` names, else its first heading. */
function panelHeading(panel: HTMLElement | null): HTMLElement | null {
  if (!panel) return null;
  const labelledBy = panel.getAttribute("aria-labelledby")?.split(/\s+/)[0];
  const named = labelledBy ? panel.ownerDocument.getElementById(labelledBy) : null;
  if (named && panel.contains(named)) return named;
  return panel.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6, [role="heading"]');
}

/**
 * Spec item 5 (F-103, 13 Nov 2026): a box whose opening focus would land on a drop-down opens on its
 * heading instead (`tabindex="-1"`), so the first keys pressed do not change an answer and Tab
 * then reaches the close button and the drop-down in page order. Any other target is kept.
 */
export function openingFocusTarget(panel: HTMLElement | null, target: HTMLElement | null): HTMLElement | null {
  if (!(target instanceof HTMLSelectElement)) return target;
  const heading = panelHeading(panel);
  if (!heading) return target;
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  return heading;
}

export type ModalKeyOptions = {
  /** The layer's id in the sheet stack: only the top layer acts. */
  modalId: string;
  panel: HTMLElement | null;
  onClose: () => void;
  closeOnEscape?: boolean;
  /** `capture` stops the event, for a modal over a screen with its own window-level keys. */
  capture?: boolean;
  /** Extra live subtrees whose controls stay in the Tab cycle (a guided interaction). */
  interactionRoots?: readonly HTMLElement[];
};

/**
 * The one Escape and Tab contract for every kit overlay (`useModalFocus` and `Sheet`). Only the top
 * layer reacts. Escape closes it unless something inside already handled the key; a closed native
 * drop-down no longer swallows it (an open one's list takes Escape itself in the browser, so the
 * first Escape closes the list and the next closes the box). Tab and Shift+Tab wrap inside the panel
 * and any actionable toast.
 */
export function handleModalKeyDown(event: KeyboardEvent, options: ModalKeyOptions): void {
  const { modalId, panel, onClose, closeOnEscape = true, capture = false, interactionRoots = [] } = options;
  // Only the top layer reacts: a dialog over a drawer closes alone, and the drawer's own Tab
  // trap stays out of the way.
  if (!isTopmostSheet(modalId)) return;
  if (event.key === "Escape") {
    if (!closeOnEscape) {
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
    event.preventDefault();
    if (capture) event.stopImmediatePropagation();
    onClose();
    return;
  }
  if (event.key !== "Tab") return;
  const roots = interactionRoots.filter((root) => root.isConnected);
  // A target may itself be the button. Its parent supplies the shared visibility/disabled
  // filtering, then containment keeps every unrelated sibling out of the Tab cycle.
  const focusable = [
    ...new Set([
      ...modalFocusTargets(panel, true),
      ...roots.flatMap((root) => modalFocusTargets(root.parentElement).filter((element) => root.contains(element))),
    ]),
  ];
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
  interactionRoots,
}: UseModalFocusOptions): UseModalFocusResult {
  const modalId = useId();
  const rootElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const closeOnEscapeRef = useRef(closeOnEscape);
  const openFocusRef = useRef<SheetFocusController | null>(null);
  const interactionRootsRef = useRef(interactionRoots);

  useEffect(() => {
    interactionRootsRef.current = interactionRoots;
    updateSheetInteractionRoots(
      modalId,
      interactionRoots?.filter((root): root is HTMLElement => Boolean(root?.isConnected)) ?? [],
    );
  }, [interactionRoots, modalId]);

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
    const openerPlace = rememberOpenerPlace(opener);
    const openPanel = panelRef.current;
    const capture = keyPhase === "capture";

    pushSheet(
      modalId,
      rootElementRef.current ?? openPanel,
      interactionRootsRef.current?.filter((root): root is HTMLElement => Boolean(root?.isConnected)) ?? [],
    );
    const resolveTarget = () => {
      const panel = panelRef.current;
      return (
        openingFocusTarget(
          panel,
          initialFocusRef?.current ??
            panel?.querySelector<HTMLElement>(SHEET_AUTOFOCUS_SELECTOR) ??
            (hasFallback ? fallbackFocusRef?.current : firstControlIn(panel)) ??
            null,
        ) ?? panel
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
      handleModalKeyDown(event, {
        modalId,
        panel: panelRef.current,
        onClose: () => onCloseRef.current(),
        closeOnEscape: closeOnEscapeRef.current,
        capture,
        interactionRoots:
          interactionRootsRef.current?.filter((root): root is HTMLElement => Boolean(root?.isConnected)) ?? [],
      });
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
      if (!focusFell) return;
      if (target) {
        if (canRestoreFocusTo(target)) target.focus({ preventScroll: true });
        return;
      }
      // The opener left the page with its row (the action removed it): the row now in its place,
      // else the heading above it, rather than the page body.
      focusOpenerPlace(openerPlace, canRestoreFocusTo);
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
