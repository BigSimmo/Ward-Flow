"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { cx } from "./cx";
import { StatusGlyph, type WfTone } from "./status-glyph";
import styles from "./overlay.module.css";

/**
 * An Undo window on the toast. A 2px line under the toast shrinks over `durationMs` and pauses
 * while the toast is hovered or holds focus. Under reduced motion the line hides and the time left
 * shows in words. The window is fixed when the toast mounts: give the toast a new `key` to start a
 * new one.
 */
export type ToastUndo = {
  /** Defaults to "Undo". */
  label?: string;
  durationMs: number;
  onUndo: () => void;
  /** Called once when the window runs out without Undo being pressed. */
  onExpire?: () => void;
};

export type ToastViewProps = {
  tone?: WfTone;
  title: ReactNode;
  /** Second line, kept short. */
  body?: ReactNode;
  /** Mono meta on the right, such as "1s ago" or "28m left". */
  meta?: ReactNode;
  /** One action (Undo, Release). A toast with an action stays until dismissed. */
  action?: { label: string; onAction: () => void };
  /** Undo with a time window and its shrinking line. */
  undo?: ToastUndo;
  onClose?: () => void;
  /** Accessible name of the close button. */
  closeLabel?: string;
  className?: string;
  style?: CSSProperties;
  "data-testid"?: string;
  "data-tone"?: string;
  "data-announce-key"?: number;
};

type UndoPhase = "running" | "undone" | "expired";

/**
 * Runs the Undo window. The timer is the source of truth, so the window ends on time even where a
 * stylesheet turns animations off; the line only mirrors it. Pausing keeps the time left.
 */
function useUndoWindow(undo: ToastUndo | undefined, paused: boolean) {
  const durationMs = undo?.durationMs ?? 0;
  const [phase, setPhase] = useState<UndoPhase>("running");
  const [secondsLeft, setSecondsLeft] = useState(() => Math.ceil(durationMs / 1000));
  const remainingRef = useRef(durationMs);
  const onExpireRef = useRef(undo?.onExpire);

  useEffect(() => {
    onExpireRef.current = undo?.onExpire;
  }, [undo?.onExpire]);

  const active = Boolean(undo) && phase === "running";

  useEffect(() => {
    if (!active || paused) return;
    const startedAt = Date.now();
    const startRemaining = remainingRef.current;
    const left = () => Math.max(0, startRemaining - (Date.now() - startedAt));
    const expire = window.setTimeout(() => {
      remainingRef.current = 0;
      setSecondsLeft(0);
      setPhase("expired");
      onExpireRef.current?.();
    }, startRemaining);
    const tick = window.setInterval(() => setSecondsLeft(Math.ceil(left() / 1000)), 250);
    return () => {
      window.clearTimeout(expire);
      window.clearInterval(tick);
      remainingRef.current = left();
    };
  }, [active, paused]);

  return { phase, secondsLeft, finish: () => setPhase("undone") };
}

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
  undo,
  onClose,
  closeLabel = "Dismiss",
  className,
  style,
  ...data
}: ToastViewProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;
  const { phase, secondsLeft, finish } = useUndoWindow(undo, paused);

  return (
    <div
      className={cx(styles.glass, styles.toast, undo && styles.toastUndo, className)}
      style={undo ? ({ ...style, "--wf-undo-ms": `${Math.max(0, undo.durationMs)}ms` } as CSSProperties) : style}
      data-undo={undo ? phase : undefined}
      data-paused={undo && paused ? "true" : undefined}
      onPointerEnter={undo ? () => setHovered(true) : undefined}
      onPointerLeave={undo ? () => setHovered(false) : undefined}
      onFocus={undo ? () => setFocused(true) : undefined}
      onBlur={
        undo
          ? (event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
            }
          : undefined
      }
      {...data}
    >
      {tone ? <StatusGlyph tone={tone} /> : null}
      <div className={styles.toastText}>
        <span className={styles.toastTitle}>{title}</span>
        {body ? <span className={styles.toastBody}>{body}</span> : null}
      </div>
      {meta ? <span className={styles.toastMeta}>{meta}</span> : null}
      {undo && phase === "running" ? (
        // Words for reduced motion only; hidden from the live region so it never reads a running tally.
        <span className={cx(styles.toastMeta, styles.undoWords)} aria-hidden="true" data-undo-left="">
          {secondsLeft}s left
        </span>
      ) : null}
      {action ? (
        <Button variant="ghost" size="sm" className={styles.toastAction} onClick={action.onAction}>
          {action.label}
        </Button>
      ) : null}
      {undo ? (
        <Button
          variant="ghost"
          size="sm"
          className={styles.toastAction}
          // Stays in place once used or run out, so focus is never dropped, but no longer acts.
          aria-disabled={phase !== "running" || undefined}
          onClick={() => {
            if (phase !== "running") return;
            finish();
            undo.onUndo();
          }}
        >
          {undo.label ?? "Undo"}
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
      {undo ? <span className={styles.undoBar} aria-hidden="true" data-undo-bar="" /> : null}
    </div>
  );
}
