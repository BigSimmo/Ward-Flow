"use client";

import styles from "./ward-offline-banner.module.css";

/** A quiet, persistent note under the header once typed text is held (`saving`) or saving has stopped. */
export function WardDemoSavingNote({ saving }: { saving: boolean | "pending" }) {
  if (saving === "pending")
    return (
      <p className={styles.quiet} role="status" data-testid="ward-demo-save-pending">
        Demonstration changes are not yet saved on this device. Keep this page open.
      </p>
    );
  if (saving)
    return (
      <p className={styles.quiet} role="status" data-testid="ward-demo-typed-text-not-kept">
        Demonstration state is saved on this device, except typed text.
      </p>
    );
  return (
    <p className={styles.quiet} role="status" data-testid="ward-demo-not-saved">
      Demonstration state is not saved on this device. A reload starts it again.
    </p>
  );
}
