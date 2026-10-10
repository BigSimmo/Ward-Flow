"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";
import { OverlayPortal } from "@/components/ui/overlay-root";
import {
  canRestoreFocusTo,
  isTopmostSheet,
  popSheet,
  pushSheet,
  startSheetOpenFocus,
  updateSheetRoot,
  type SheetFocusController,
} from "@/components/ui/sheet-focus";
import { Button } from "./button";
import { cx } from "./cx";
import styles from "./dialog.module.css";

export type DialogAction = {
  label: string;
  onAction: () => void;
  /** Shows a spinner and sets `aria-busy`; clicks are ignored while it runs. */
  loading?: boolean;
  /** Why the action is unavailable. Keeps the tab stop and shows the reason. */
  disabledReason?: string;
};

export type DialogProps = {
  open: boolean;
  /** Escape, the close button and a press on the scrim all call this. */
  onClose: () => void;
  /** Names the dialog (`aria-labelledby`). Short and specific: "Release bed 4?". */
  title: string;
  /** One or two lines under the title, read as the dialog's description. */
  description?: ReactNode;
  children?: ReactNode;
  /** The one primary action. `danger` is for a step that cannot be undone. */
  primary?: DialogAction & { tone?: "default" | "danger" };
  /** Secondary actions (Cancel, Keep editing). Ghost buttons before the primary. */
  secondary?: DialogAction[];
  /** Shows the close button in the header. On by default. */
  closable?: boolean;
  /** Accessible name of the close button. */
  closeLabel?: string;
  /** A press that starts on the scrim closes the dialog. On by default. */
  closeOnScrim?: boolean;
  /** Where focus starts. Defaults to a `data-sheet-autofocus` child, then the close button. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Where focus returns on close. Defaults to whatever had focus when the dialog opened. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  size?: "sm" | "md" | "lg";
  className?: string;
  "data-testid"?: string;
};

const FOCUSABLE =
  'a[href], button:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function focusableIn(panel: HTMLElement | null) {
  return Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.tabIndex >= 0 &&
      !element.closest('[aria-hidden="true"], [inert]') &&
      element.getClientRects().length > 0,
  );
}

/**
 * v9 modal dialog: sheet glass over the strong scrim, for a step that blocks the page (a confirm for
 * something that cannot be undone, or a short form). Header with the title and close, a body, and a
 * footer with secondary actions as ghost buttons and at most one primary. It joins the shared sheet
 * stack, so the page behind is inert, Tab stays inside, Escape closes only the top layer, and focus
 * returns to whatever opened it.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  primary,
  secondary,
  closable = true,
  closeLabel = "Close",
  closeOnScrim = true,
  initialFocusRef,
  returnFocusRef,
  size = "md",
  className,
  ...data
}: DialogProps) {
  const dialogId = useId();
  const titleId = useId();
  const descId = useId();
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const openFocusRef = useRef<SheetFocusController | null>(null);
  // The scrim closes the dialog only when the press starts on it, so a drag that begins inside the
  // panel and ends on the scrim does not dismiss.
  const scrimPressRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Read at close time, so a caller can retarget the return while the dialog is open.
  const resolveReturnTarget = useCallback(() => returnFocusRef?.current ?? null, [returnFocusRef]);

  const setScrimRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrimRef.current = node;
      updateSheetRoot(dialogId, node);
    },
    [dialogId],
  );

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    pushSheet(dialogId, scrimRef.current);
    openFocusRef.current = startSheetOpenFocus({
      sheetId: dialogId,
      getPanel: () => panelRef.current,
      resolveTarget: () =>
        initialFocusRef?.current ??
        panelRef.current?.querySelector<HTMLElement>('[data-sheet-autofocus="true"]') ??
        closeRef.current ??
        panelRef.current,
    });

    function onKeyDown(event: KeyboardEvent) {
      // Only the top layer reacts: a dialog over a drawer closes alone, and a menu or tip inside
      // the dialog that handles its own Escape stops it before it reaches here.
      if (!isTopmostSheet(dialogId)) return;
      if (event.key === "Escape") {
        if (event.defaultPrevented) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableIn(panelRef.current);
      event.preventDefault();
      if (focusable.length === 0) {
        panelRef.current?.focus();
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

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      openFocusRef.current?.cancel();
      openFocusRef.current = null;
      popSheet(dialogId);
      const target = [resolveReturnTarget(), opener].find((element): element is HTMLElement =>
        Boolean(element?.isConnected),
      );
      // The panel is gone, so focus has fallen to the page. Hand it back to the opener unless
      // another layer has taken over (a sheet that replaced this dialog owns focus now).
      const active = document.activeElement;
      const focusFell = active == null || active === document.body || !active.isConnected;
      if (target && focusFell && canRestoreFocusTo(target)) target.focus({ preventScroll: true });
    };
  }, [open, dialogId, initialFocusRef, resolveReturnTarget]);

  if (!open) return null;

  return (
    <OverlayPortal layer="modal" name={title}>
      <div
        ref={setScrimRef}
        className={styles.scrim}
        onPointerDown={(event) => {
          scrimPressRef.current = event.target === event.currentTarget;
        }}
        onClick={(event) => {
          const startedOnScrim = scrimPressRef.current;
          scrimPressRef.current = false;
          if (closeOnScrim && startedOnScrim && event.target === event.currentTarget) onCloseRef.current();
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          className={cx(styles.panel, styles[size], className)}
          {...data}
        >
          <div className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {closable ? (
              <Button
                ref={closeRef}
                variant="ghost"
                size="sm"
                iconOnly
                icon={X}
                aria-label={closeLabel}
                className={styles.close}
                onClick={() => onCloseRef.current()}
              />
            ) : null}
          </div>
          {description || children ? (
            <div className={styles.body}>
              {description ? (
                <p id={descId} className={styles.description}>
                  {description}
                </p>
              ) : null}
              {children}
            </div>
          ) : null}
          {primary || secondary?.length ? (
            <div className={styles.footer}>
              {secondary?.map((action) => (
                <Button
                  key={action.label}
                  variant="ghost"
                  loading={action.loading}
                  disabledReason={action.disabledReason}
                  onClick={action.onAction}
                >
                  {action.label}
                </Button>
              ))}
              {primary ? (
                <Button
                  variant={primary.tone === "danger" ? "danger" : "pri"}
                  loading={primary.loading}
                  disabledReason={primary.disabledReason}
                  onClick={primary.onAction}
                >
                  {primary.label}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </OverlayPortal>
  );
}
