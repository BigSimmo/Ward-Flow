"use client";

import { X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { Button, StatusGlyph, type WfTone } from "@/components/wf";

import styles from "./notices.module.css";

/**
 * Mock-up copy of draft PR #1124's `ToastView` (`src/components/wf/toast.tsx`), cut to what the
 * redesign preview draws: the glyph, the words, one optional action and the close button. The Undo
 * window and the pausing clock are left out because the preview holds every notice still for
 * review; the motion (220ms in, 160ms out, a 120ms fade under reduced motion) is kept in the CSS.
 *
 * Redesign changes from #1124 (D-91):
 * - The title and body wrap in full on every width, so a name, place or ward is never cut to "…".
 * - The phone pill rests clear of the dock and its + (see notices.module.css `.region`).
 */
export type NoticeCardProps = {
  tone?: WfTone;
  title: ReactNode;
  /** Second line, kept short. */
  body?: ReactNode;
  /** One action (Undo, Release). A notice with an action stays until it is closed. */
  action?: { label: string; onAction: () => void };
  /** True when the notice closes itself; the phone pill then hides its X, as #1124 draws it. */
  autoDismiss?: boolean;
  /** On its way out: plays the exit, takes no pointer or focus and is hidden from assistive technology. */
  leaving?: boolean;
  onClose?: () => void;
  closeLabel?: string;
  style?: CSSProperties;
  /** 1, 2… for a card folded behind the newest; it is drawn behind, not hidden. */
  depth?: number;
  faded?: boolean;
};

export function NoticeCard({
  tone,
  title,
  body,
  action,
  autoDismiss = false,
  leaving = false,
  onClose,
  closeLabel = "Dismiss",
  style,
  depth = 0,
  faded = false,
}: NoticeCardProps) {
  return (
    <div
      className={`${styles.glass} ${styles.card}`}
      style={style}
      // #1124's marker for a shown notice: a help corner card reads it to step back on a phone.
      data-wf-toast=""
      data-tone={tone}
      data-auto-dismiss={autoDismiss ? "true" : undefined}
      data-leaving={leaving ? "true" : undefined}
      data-depth={depth > 0 ? depth : undefined}
      data-faded={faded ? "true" : undefined}
      aria-hidden={leaving || undefined}
      inert={leaving || undefined}
    >
      {tone ? <StatusGlyph tone={tone} className={styles.glyph} /> : null}
      <div className={styles.text}>
        <span className={styles.title}>{title}</span>
        {body ? <span className={styles.body}>{body}</span> : null}
      </div>
      {action ? (
        <Button variant="ghost" size="sm" className={styles.action} onClick={action.onAction}>
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
          className={styles.close}
          onClick={onClose}
        />
      ) : null}
    </div>
  );
}
