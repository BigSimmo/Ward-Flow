"use client";

import { createContext, useContext } from "react";
import styles from "./ward-offline-banner.module.css";

/** Presentation only: the provider still owns recovery and its exact explanatory wording. */
export const WardRecoveryNoticeContext = createContext<string | null>(null);

/** Keep recovery feedback inside the shell's existing status area, without another pinned layer. */
export function WardRecoveryNotice() {
  const notice = useContext(WardRecoveryNoticeContext);
  if (!notice) return null;
  return (
    <p
      className={`${styles.quiet} ${styles.recovery}`}
      role="status"
      data-testid="ward-recovery-notice"
      data-print-hide
    >
      {notice}
    </p>
  );
}
