"use client";

import { createContext, useContext } from "react";
import styles from "./ward-offline-banner.module.css";

/**
 * S-1 (audit 13 Oct 2026): whether this demonstration has stopped saving on this device. Typed free
 * text is never stored (the default-deny lock in `ward-flow-provider.tsx`), so once someone types
 * into a field the saved day is cleared and a reload starts again. That rule stays; this context
 * only lets the shell say so instead of losing the day silently.
 */
export const WardDemoNotSavedContext = createContext(false);

function useWardDemoNotSaved(): boolean {
  return useContext(WardDemoNotSavedContext);
}

/** A quiet, persistent note under the header once saving on this device has stopped. */
export function WardDemoNotSavedNote() {
  const notSaved = useWardDemoNotSaved();
  if (!notSaved) return null;
  return (
    <p className={styles.quiet} role="status" data-testid="ward-demo-not-saved">
      Not saved on this device. Typed text is never stored, so a reload starts the demonstration again.
    </p>
  );
}
