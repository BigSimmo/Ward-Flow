"use client";

import type { CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { cx } from "./cx";
import { StatusGlyph, type WfTone } from "./status-glyph";
import styles from "./overlay.module.css";

export type ToastViewProps = {
  tone?: WfTone;
  title: ReactNode;
  /** Second line, kept short. */
  body?: ReactNode;
  /** Mono meta on the right, such as "1s ago" or "28m left". */
  meta?: ReactNode;
  /** One action (Undo, Release). A toast with an action stays until dismissed. */
  action?: { label: string; onAction: () => void };
  onClose?: () => void;
  /** Accessible name of the close button. */
  closeLabel?: string;
  className?: string;
  style?: CSSProperties;
  "data-testid"?: string;
  "data-tone"?: string;
  "data-announce-key"?: number;
};

/**
 * The v6 toast card: regular glass, glyph first, one line, optional Undo and close. Presentational
 * only. `ToastProvider` in `@/components/ui/toast` renders it inside its polite live region; a
 * page that keeps its own toast state can render it directly inside a `role="status"` region.
 */
export function ToastView({
  tone,
  title,
  body,
  meta,
  action,
  onClose,
  closeLabel = "Dismiss",
  className,
  ...data
}: ToastViewProps) {
  return (
    <div className={cx(styles.glass, styles.toast, className)} {...data}>
      {tone ? <StatusGlyph tone={tone} /> : null}
      <div className={styles.toastText}>
        <span className={styles.toastTitle}>{title}</span>
        {body ? <span className={styles.toastBody}>{body}</span> : null}
      </div>
      {meta ? <span className={styles.toastMeta}>{meta}</span> : null}
      {action ? (
        <Button variant="ghost" size="sm" className={styles.toastAction} onClick={action.onAction}>
          {action.label}
        </Button>
      ) : null}
      {onClose ? (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={X}
          aria-label={closeLabel}
          className={styles.toastClose}
          onClick={onClose}
        />
      ) : null}
    </div>
  );
}
