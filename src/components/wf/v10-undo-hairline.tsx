"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./button";
import { cx } from "./cx";
import styles from "./v10-parts.module.css";

/* ── UndoHairline (Top 25 #17) ────────────────────────────────────────────────────────────── */

export type UndoHairlineProps = {
  active?: boolean;
  summary?: ReactNode;
  message?: ReactNode;
  remainingMs?: number;
  durationMs?: number;
  windowMs?: number;
  onUndo: () => void;
  onExpire?: () => void;
  className?: string;
};

/**
 * 8-Second 1-Tap Undo Hairline Bar (Top 25 #17).
 * Discreet bottom hairline bar with tabular countdown and 1-tap Undo for non-statutory status flips.
 */
export function UndoHairline({
  active = true,
  summary,
  message,
  remainingMs,
  durationMs,
  windowMs = 8000,
  onUndo,
  onExpire,
  className,
}: UndoHairlineProps) {
  const effectiveInitialMs = remainingMs ?? durationMs ?? windowMs;
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (!active || remainingMs !== undefined) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedMs(Math.max(0, Date.now() - startedAt));
    }, 250);
    return () => {
      window.clearInterval(timer);
      setElapsedMs(0);
    };
  }, [active, remainingMs, effectiveInitialMs]);
  const effectiveRemainingMs = remainingMs ?? Math.max(0, effectiveInitialMs - elapsedMs);
  const effectiveWindowMs = durationMs ?? windowMs;
  if (!active || effectiveRemainingMs <= 0) {
    // An active countdown that has reached zero (by its own timer or a passed-in 0) must still fire onExpire.
    return onExpire && active ? <UndoHairlineExpiryEffect active remainingMs={0} onExpire={onExpire} /> : null;
  }
  const secondsLeft = Math.max(1, Math.ceil(effectiveRemainingMs / 1000));
  const progressPct = Math.max(
    0,
    Math.min(100, Math.round((effectiveRemainingMs / Math.max(1, effectiveWindowMs)) * 100)),
  );

  return (
    <div className={cx(styles.undoHairline, className)} role="status" aria-live="polite" data-testid="wf-undo-hairline">
      {onExpire ? (
        <UndoHairlineExpiryEffect active={active} remainingMs={remainingMs ?? effectiveInitialMs} onExpire={onExpire} />
      ) : null}
      <div
        className={styles.undoHairlineTrack}
        style={{ "--wf-undo-pct": `${progressPct}%` } as CSSProperties}
        aria-hidden="true"
      />
      <div className={styles.undoHairlineBody}>
        <span className={styles.undoSummary}>{summary ?? message}</span>
        <span className={styles.undoTimer}>{secondsLeft}s</span>
        <Button variant="sec" size="sm" onClick={onUndo}>
          Undo
        </Button>
      </div>
    </div>
  );
}

function UndoHairlineExpiryEffect({
  active,
  remainingMs,
  onExpire,
}: {
  active: boolean;
  remainingMs: number;
  onExpire?: () => void;
}) {
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!active || !onExpireRef.current) return;
    if (remainingMs <= 0) {
      onExpireRef.current();
      return;
    }
    const timer = window.setTimeout(() => {
      onExpireRef.current?.();
    }, remainingMs);
    return () => window.clearTimeout(timer);
  }, [active, remainingMs]);
  return null;
}
