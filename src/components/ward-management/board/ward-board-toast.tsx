"use client";

import { StatusGlyph } from "@/components/wf";

import { actionToastText, isWarningToast, type ActionToast } from "@/components/ward-management/ward-action-toast";

import styles from "./board.module.css";

/** The bed board's action toast. A refusal shows the warning glyph and tone (walk-through WT-10). */
export function BoardToastView({ toast }: { toast: ActionToast | null }) {
  if (!toast) return null;
  return (
    <div
      className={styles.toast}
      role="status"
      aria-live="polite"
      data-testid="ward-board-toast"
      data-tone={isWarningToast(toast) ? "warning" : undefined}
    >
      {isWarningToast(toast) ? <StatusGlyph tone="warning" size={10} className={styles.toastGlyph} /> : null}
      {actionToastText(toast)}
    </div>
  );
}
