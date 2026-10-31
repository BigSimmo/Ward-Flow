"use client";

// Preview copy of `IdleLockScreen` in `src/components/ward-management/front-door/lock-cards.tsx`.
// The wiring is unchanged (the same props, role, test id and words); the layout is the redesign:
// a calm, full-screen cover in place of the sign-in page's Night entrance.

import type { ReactNode, RefObject } from "react";
import { ArrowRight, Lock } from "lucide-react";

import { Button } from "@/components/wf";

import styles from "./idle-lock.module.css";

/**
 * The covered desk after the idle time. Redesign: one quiet, opaque navy cover, so nothing of the
 * desk shows, with the lock, the reason and the one way back in the centre. The product name and
 * the synthetic-data chip stay at the top, as on today's entrance band.
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
      className={styles.screen}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ward-idle-lock-title"
    >
      <div className={styles.top}>
        <span className={styles.wordmark}>Ward Flow</span>
        <span className={styles.syn}>
          <i aria-hidden="true" />
          Synthetic data
        </span>
      </div>
      <div className={styles.centre}>
        <span className={styles.lockIcon} aria-hidden="true">
          <Lock aria-hidden="true" />
        </span>
        <h1 id="ward-idle-lock-title" className={styles.title}>
          {title}
        </h1>
        <p className={styles.text}>{children}</p>
        <Button
          variant="light"
          iconEnd={ArrowRight}
          className={styles.btn}
          data-testid="ward-idle-unlock"
          onClick={onAction}
        >
          {action}
        </Button>
      </div>
    </div>
  );
}
