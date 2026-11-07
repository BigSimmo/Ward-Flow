"use client";

/**
 * Triage and risk: the Summary button at the foot of the section list (7 Nov 2026), which
 * replaces the floating one so nothing on the form is covered. Josh (7 Nov) kept the left column to
 * the sections only: the Before you sign list, the Now box and the last triage at a glance were each
 * removed as low value there. The last triage stays one tap away in the summary's Last triage tab.
 * Synthetic data only.
 */
import { Button } from "@/components/wf";

import styles from "./triage-risk-side.module.css";

export function SideSummary({ left, signed, onOpen }: { left: number; signed: boolean; onOpen: () => void }) {
  return (
    <div className={styles.summary}>
      <Button className={styles.summaryButton} onClick={onOpen} aria-haspopup="dialog">
        Summary · {signed ? "signed" : left ? `${left} left` : "ready"}
      </Button>
    </div>
  );
}
