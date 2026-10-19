"use client";

import { createContext, useContext } from "react";
import styles from "./ward-offline-banner.module.css";

/** Whether submitted demonstration state has stopped saving on this device. Session draft recovery is separate. */
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
      Demonstration state is not saved on this device, so a reload starts it again. Some synthetic form drafts may still
      be recovered within this browser session.
    </p>
  );
}
