"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useOptionalToast } from "@/components/wf";
import {
  BROUGHT_UP_TO_DATE_NOTICE,
  OPEN_ITEMS_CLOSED_NOTICE,
  RESTORED_NOTICE_PREFIX,
} from "../ward-flow-demo-storage-constants";
import styles from "./ward-offline-banner.module.css";

/** Holds no record content: only that this tab has already seen a routine restore notice. */
const ROUTINE_SEEN_KEY = "ward-flow:restore-notice-seen";

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
 *
 * DA-27 (overall review, 20 Oct 2026): it is marked seen the moment it first shows, so leaving the
 * page within those few seconds no longer brings it back on the next page in this tab, and it has
 * a close button. The failure notices have none: they stay until the problem is fixed.
 *
 * CS3-17 (26 Oct 2026): a restore that closed something the user had open is not routine. It
 * shows every time, does not fade, and has the close button.
 */
export function WardRecoveryNoticeBody({ notice, fadeAfterMs }: { notice: string; fadeAfterMs: number }) {
  // Only a notice that is still a successful restore can close. A failed save is put in front of
  // the restore notice, so it starts with the failure and stays until the problem is fixed.
  const restored = notice.startsWith(RESTORED_NOTICE_PREFIX);
  const closedOpenItems = restored && notice.endsWith(OPEN_ITEMS_CLOSED_NOTICE);
  const routine = restored && !closedOpenItems;
  // GEN1 (Josh, 3 Nov 2026): routine news ("Restored the last successful save", "Brought up to
  // date from another open tab") is an info toast like every other outcome, not a strip that
  // pushes the page down. A failed or unavailable save, and a restore that closed something,
  // stay in the strip because they need reading. Without a toast host the strip is kept.
  const toast = useOptionalToast();
  const asToast = toast !== null && (routine || notice === BROUGHT_UP_TO_DATE_NOTICE);
  const pushedRef = useRef<string | null>(null);
  const [hidden, setHidden] = useState(false);
  // True once this notice has claimed the tab's one showing. StrictMode re-runs the effect on the
  // same instance, and this ref survives that, so the re-run keeps the notice it already claimed.
  const claimed = useRef(false);

  useEffect(() => {
    if (!asToast || !toast || pushedRef.current === notice) return;
    if (routine) {
      if (!claimed.current && routineAlreadySeen()) return;
      claimed.current = true;
      markRoutineSeen();
    }
    pushedRef.current = notice;
    toast.push({ tone: "info", title: notice, testId: "ward-recovery-notice" });
  }, [asToast, toast, routine, notice]);

  useEffect(() => {
    if (!routine || asToast) return;
    if (!claimed.current) {
      if (routineAlreadySeen()) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reads tab storage after mount, which the server render cannot
        setHidden(true);
        return;
      }
      claimed.current = true;
      markRoutineSeen();
    }
    const timer = window.setTimeout(() => setHidden(true), fadeAfterMs);
    return () => window.clearTimeout(timer);
  }, [routine, asToast, notice, fadeAfterMs]);

  if (asToast) return null;
  if ((routine || closedOpenItems) && hidden) return null;
  return (
    <p
      className={`${styles.quiet} ${styles.recovery}`}
      role="status"
      data-testid="ward-recovery-notice"
      data-routine={routine ? "true" : undefined}
      data-print-hide
    >
      {notice}
      {routine || closedOpenItems ? (
        <button
          type="button"
          className={styles.recoveryClose}
          aria-label="Close notice"
          data-testid="ward-recovery-notice-close"
          onClick={() => {
            markRoutineSeen();
            setHidden(true);
          }}
        >
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </p>
  );
}
