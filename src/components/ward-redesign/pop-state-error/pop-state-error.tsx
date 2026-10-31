"use client";

import { useMemo, useState, type ReactNode } from "react";

import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import { WardFlowErrorPanel } from "./ward-flow-error-panel";
import styles from "./pop-state-error.module.css";

/**
 * The Error mock-up: what Home shows when its screen throws while drawing. Drawn from a copy of
 * today's Ward Flow boundary panel (`src/app/ward-flow/error.tsx` and `ward-flow-error-panel.tsx`)
 * with the boundary's own title and description, inside the shell (rail and header stay, as they do
 * in the app). It shows what the signed-in shared site shows: the fixed sentence, not the message.
 * Try again draws Home again, as `retry()` re-renders the segment; Reload page reloads the mock-up.
 */
export function PopStateError({ page }: { page: ReactNode }) {
  const [retried, setRetried] = useState(false);
  // A stand-in error for the boundary to receive. Nothing threw; it carries no record and no digest.
  const error = useMemo(() => {
    const preview = new Error("Preview only: no error was thrown.");
    preview.stack = undefined;
    return preview;
  }, []);
  if (retried) return page;
  return (
    <main id="main-content" className={styles.main}>
      <WardFlowErrorPanel
        error={error}
        retry={() => setRetried(true)}
        title="This ward screen could not be shown"
        description="Try again keeps the same prototype state. Reloading may restore the last saved synthetic data; anything not yet saved may be lost."
        logLabel="Unhandled runtime error captured by the Ward Flow boundary:"
        testId="ward-flow-error-boundary"
        showDetail={false}
      />
      <WardPrototypeFooter className={styles.footer} />
    </main>
  );
}
