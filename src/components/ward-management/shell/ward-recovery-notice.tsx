"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { RESTORED_NOTICE_PREFIX } from "../ward-flow-demo-storage";
import styles from "./ward-offline-banner.module.css";

/** Presentation only: the provider still owns recovery and its exact explanatory wording. */
export const WardRecoveryNoticeContext = createContext<string | null>(null);

/** Holds no record content: only that this tab has already seen a routine restore notice. */
const ROUTINE_SEEN_KEY = "ward-flow:restore-notice-seen";
/** How long a routine restore notice stays before it fades. */
const ROUTINE_NOTICE_MS = 8_000;

function routineAlreadySeen(): boolean {
  try {
    return window.sessionStorage.getItem(ROUTINE_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markRoutineSeen() {
  try {
    window.sessionStorage.setItem(ROUTINE_SEEN_KEY, "1");
  } catch {
    // Storage blocked: the notice simply shows again next time.
  }
}

/**
 * Keep recovery feedback inside the shell's existing status area, without another pinned layer.
 *
 * Simplification A3 (Josh, 19 Oct 2026): the routine "Restored the last successful save" notice
 * used to sit across the top of every page after any refresh. It now shows once per tab and fades
 * after a few seconds. A failed or unavailable save is different news and stays until it is fixed.
 */
export function WardRecoveryNotice() {
  const notice = useContext(WardRecoveryNoticeContext);
  const routine = notice?.startsWith(RESTORED_NOTICE_PREFIX) ?? false;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!routine) return;
    if (routineAlreadySeen()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads tab storage after mount, which the server render cannot
      setHidden(true);
      return;
    }
    // Marked seen only once it has been on screen for the full pause, so an effect that React
    // cancels (StrictMode, or leaving the page early) never hides a notice nobody saw.
    const timer = window.setTimeout(() => {
      markRoutineSeen();
      setHidden(true);
    }, ROUTINE_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [routine, notice]);

  if (!notice || (routine && hidden)) return null;
  return (
    <p
      className={`${styles.quiet} ${styles.recovery}`}
      role="status"
      data-testid="ward-recovery-notice"
      data-routine={routine ? "true" : undefined}
      data-print-hide
    >
      {notice}
    </p>
  );
}
