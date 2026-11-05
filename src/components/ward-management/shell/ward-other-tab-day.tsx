"use client";

import { useSyncExternalStore } from "react";
import { X } from "lucide-react";
import styles from "./ward-offline-banner.module.css";

/**
 * SD-03 and F5 (audit, 5 Nov 2026): two demonstration tabs that have both acted keep separate days
 * (a tab that owns its day never takes a peer's, `ward-flow-provider.tsx`). That used to happen
 * silently. When this tab owns its day and another open tab saves a different one, this note says so.
 * A reload would not help: each tab reloads its own saved copy, so the note asks to work in one tab.
 */
export const OTHER_TAB_DAY_NOTICE =
  "Another open tab has changed this demonstration day too. Each tab now keeps its own version, so work in one tab only.";

let state: "none" | "shown" | "closed" = "none";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Called once this tab owns its day and an open tab saves a different one. Shows once per page. */
export function markOtherTabChangedDay() {
  if (state !== "none") return;
  state = "shown";
  notify();
}

/** Test-only reset. */
export function resetOtherTabDayForTests() {
  state = "none";
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A quiet note under the header, with a close button, while the two tabs disagree. */
export function WardOtherTabDayNote() {
  const shown = useSyncExternalStore(
    subscribe,
    () => state === "shown",
    () => false,
  );
  if (!shown) return null;
  return (
    <p className={`${styles.quiet} ${styles.recovery}`} role="status" data-testid="ward-other-tab-day" data-print-hide>
      {OTHER_TAB_DAY_NOTICE}
      <button
        type="button"
        className={styles.recoveryClose}
        aria-label="Close notice"
        onClick={() => {
          state = "closed";
          notify();
        }}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </p>
  );
}
