"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";
import { OverlayPortal } from "./overlay-root";
import { Button } from "./button";
import { cx, present } from "./cx";
import styles from "./dialog.module.css";
import { useModalFocus } from "./use-modal-focus";

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
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  // The scrim closes the dialog only when the press starts on it, so a drag that begins inside the
  // panel and ends on the scrim does not dismiss.
  const scrimPressRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Stack, inert background, opening focus, Tab wrap, top-layer Escape and focus return.
  const { rootRef: setScrimRef } = useModalFocus({
    open,
    onClose,
    panelRef,
    initialFocusRef,
    fallbackFocusRef: closeRef,
    returnFocusRef,
  });

  if (!open) return null;

  return (
    <OverlayPortal layer="modal" name={title}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- a backdrop click closes it for the pointer, and Escape closes it from the keyboard */}
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
          {present(description) || present(children) ? (
            <div className={styles.body}>
              {present(description) ? (
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
