"use client";

import type { ReactNode, RefObject } from "react";
import { ArrowRight, Lock } from "lucide-react";

import { Button } from "@/components/wf";

import styles from "./lock-cards.module.css";

/** The countdown ring's circumference for a radius of 36 (2 × π × 36). */
const RING = 226.2;

/**
 * "Still there?" for the last minute before an idle sign-out (Josh, 21 Oct 2026). The app stays in
 * view under a veil, and on phones the prompt rises from the bottom edge, in thumb reach.
 *
 * Idle warning redesign (approved by Josh, 31 Oct 2026): the kit dialog's look, with the title on
 * top, the ring beside its sentence, and a footer where Sign out now is quiet and I'm still here is
 * the one filled button. Focus starts on I'm still here (`data-sheet-autofocus`, read by the lock's
 * `useModalFocus` in `shell/ward-access.tsx`), so Enter or Space keeps the desk signed in.
 */
export function IdleWarningSheet({
  panelRef,
  minutes,
  secondsLeft,
  warningSeconds,
  onStillHere,
  onSignOutNow,
}: {
  panelRef: RefObject<HTMLDivElement | null>;
  minutes: number;
  secondsLeft: number;
  warningSeconds: number;
  onStillHere: () => void;
  onSignOutNow?: () => void;
}) {
  const share = Math.max(0, Math.min(1, secondsLeft / warningSeconds));
  return (
    <div className={styles.veil}>
      <div
        ref={panelRef}
        className={styles.sheet}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ward-idle-warn-title"
        aria-describedby="ward-idle-warn-text"
      >
        <h1 id="ward-idle-warn-title" className={styles.warnTitle}>
          Still there?
        </h1>
        <div className={styles.warnBody}>
          <span className={styles.ring} aria-hidden="true">
            <svg viewBox="0 0 84 84">
              <circle className={styles.ringTrack} cx="42" cy="42" r="36" />
              <circle
                className={styles.ringFill}
                cx="42"
                cy="42"
                r="36"
                style={{ strokeDasharray: RING, strokeDashoffset: (RING * (1 - share)).toFixed(1) }}
              />
            </svg>
            <b>{secondsLeft}</b>
          </span>
          <p id="ward-idle-warn-text" data-testid="ward-idle-countdown" className={styles.warnText}>
            This desk has not been used for {minutes - 1} minutes. You will be signed out in{" "}
            <span className={styles.tabular}>{secondsLeft === 1 ? "1 second" : `${secondsLeft} seconds`}</span>.
          </p>
        </div>
        <div className={styles.warnActions}>
          {onSignOutNow && (
            <Button variant="ghost" className={styles.warnButton} onClick={onSignOutNow}>
              Sign out now
            </Button>
          )}
          <Button
            variant="pri"
            className={styles.warnButton}
            data-testid="ward-idle-still-here"
            data-sheet-autofocus=""
            onClick={onStillHere}
          >
            I&apos;m still here
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The covered desk after the idle time. Idle lock redesign (approved by Josh, 31 Oct 2026): one
 * calm, opaque navy cover, so nothing of the desk shows, with the lock, the reason and the one way
 * back in the centre. The product name and the synthetic-data mark stay at the top. Escape does not
 * unlock (`useModalFocus` in `shell/ward-access.tsx`); only the button does.
 */
export function IdleLockScreen({
  panelRef,
  title,
  children,
  action,
  onAction,
}: {
  panelRef: RefObject<HTMLDivElement | null>;
  title: string;
  children: ReactNode;
  action: string;
  onAction: () => void;
}) {
  return (
    <div
      ref={panelRef}
      className={styles.lockScreen}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ward-idle-lock-title"
    >
      <div className={styles.lockTop}>
        <span className={styles.wordmark}>Ward Flow</span>
        <span className={styles.syn}>
          <i aria-hidden="true" />
          Synthetic data
        </span>
      </div>
      <div className={styles.lockCentre}>
        <span className={styles.lockIcon} aria-hidden="true">
          <Lock aria-hidden="true" />
        </span>
        <h1 id="ward-idle-lock-title" className={styles.lockTitle}>
          {title}
        </h1>
        <p className={styles.lockText}>{children}</p>
        <Button
          variant="light"
          iconEnd={ArrowRight}
          className={styles.lockButton}
          data-testid="ward-idle-unlock"
          onClick={onAction}
        >
          {action}
        </Button>
      </div>
    </div>
  );
}
