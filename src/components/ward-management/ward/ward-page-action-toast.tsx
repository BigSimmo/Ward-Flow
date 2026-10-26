"use client";

import { useEffect, useState } from "react";
import { actionToastText, isWarningToast, type ActionToast } from "@/components/ward-management/ward-action-toast";
import { StatusGlyph } from "@/components/wf";
import styles from "./ward.module.css";

/** How long a recorded step stays on the ward page toast. */
const SUCCESS_MS = 5_000;

/**
 * Audit A-1 (26 Oct 2026): the ward page toast never cleared, so a saved step stayed pinned over
 * the page for the rest of the visit. A success now clears itself. A warning stays until it is
 * closed or replaced, so a refusal is not lost while the nurse looks away.
 */
export function useWardPageToast() {
  const [toastMessage, setToastMessage] = useState<ActionToast | null>(null);
  useEffect(() => {
    if (typeof toastMessage !== "string") return;
    const timer = window.setTimeout(() => setToastMessage(null), SUCCESS_MS);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);
  return [toastMessage, setToastMessage] as const;
}

/** The ward page's action toast (Owner Rule D4). */
export function WardPageActionToast({ toast, onClose }: { toast: ActionToast | null; onClose: () => void }) {
  const warning = isWarningToast(toast);
  return (
    <div
      className={`${styles.actionToast} ${toast ? styles.show : ""}`}
      role="status"
      aria-live="polite"
      data-testid="ward-action-toast"
      data-tone={warning ? "warning" : undefined}
    >
      <StatusGlyph tone={warning ? "warning" : "success"} size={10} />
      <span>{toast === null ? null : actionToastText(toast)}</span>
      {warning ? (
        <button
          type="button"
          className={styles.actionToastClose}
          data-testid="ward-action-toast-close"
          onClick={onClose}
        >
          Close
        </button>
      ) : null}
    </div>
  );
}
