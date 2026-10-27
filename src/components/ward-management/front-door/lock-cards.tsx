"use client";

import type { ReactNode, RefObject } from "react";
import { Lock } from "lucide-react";

import { Arrow, BedBoardTexture, Brand } from "./front-door-parts";
import doorStyles from "./front-door.module.css";
import styles from "./lock-cards.module.css";

/** The countdown ring's circumference for a radius of 36 (2 × π × 36). */
const RING = 226.2;

/**
 * "Still there?" for the last minute before an idle sign-out (Josh, 21 Oct 2026). The app stays in
 * view under a navy veil, and on phones the prompt is a bottom sheet in thumb reach, like the
 * sign-in sheet.
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
        <h1 id="ward-idle-warn-title">Still there?</h1>
        <p id="ward-idle-warn-text" data-testid="ward-idle-countdown">
          This desk has not been used for {minutes - 1} minutes. You will be signed out in{" "}
          <span className={styles.tabular}>{secondsLeft === 1 ? "1 second" : `${secondsLeft} seconds`}</span>.
        </p>
        <button
          type="button"
          className={`${doorStyles.btn} ${doorStyles.btnPrimary}`}
          data-testid="ward-idle-still-here"
          onClick={onStillHere}
        >
          I&apos;m still here
        </button>
        {onSignOutNow && (
          <button type="button" className={`${doorStyles.link} ${styles.signOutNow}`} onClick={onSignOutNow}>
            Sign out now
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The covered desk after the idle time: the same Night entrance as the sign-in page, so nothing of
 * the desk shows, with the lock card where the sign-in card sits.
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
      className={doorStyles.screen}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ward-idle-lock-title"
    >
      <div className={doorStyles.door}>
        <BedBoardTexture />
        <Brand />
        <div className={doorStyles.panel}>
          <div className={doorStyles.card}>
            <div className={styles.lockIn}>
              <span className={`${doorStyles.bigicon} ${styles.lockIcon}`}>
                <Lock aria-hidden="true" />
              </span>
              <h1 id="ward-idle-lock-title">{title}</h1>
              <p>{children}</p>
              <button
                type="button"
                className={`${doorStyles.btn} ${doorStyles.btnPrimary}`}
                data-testid="ward-idle-unlock"
                onClick={onAction}
              >
                {action}
                <Arrow />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
