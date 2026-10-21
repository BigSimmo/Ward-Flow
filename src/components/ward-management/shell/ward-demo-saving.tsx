"use client";

import { createContext, useContext } from "react";
import { TYPED_TEXT_NOT_KEPT } from "../ward-flow-typed-text-ledger";
import styles from "./ward-offline-banner.module.css";

/**
 * How much of the submitted demonstration state is saved on this device. Since 21 Oct 2026 (Josh,
 * fix plan item 2) typed text no longer stops the save: the rest of the day is kept and typed fields
 * read `TYPED_TEXT_NOT_KEPT` after a reload. Saving stops only when that copy cannot be made safely.
 * Session draft recovery is separate.
 */
export type WardDemoSaving = "saved" | "typed-text-not-kept" | "not-saved";
export const WardDemoNotSavedContext = createContext<WardDemoSaving>("saved");

/** A quiet, persistent note under the header once typed text is held or saving has stopped. */
export function WardDemoNotSavedNote() {
  const saving = useContext(WardDemoNotSavedContext);
  if (saving === "typed-text-not-kept")
    return (
      <p className={styles.quiet} role="status" data-testid="ward-demo-typed-text-not-kept">
        Demonstration state is saved on this device except typed text, which a reload shows as “{TYPED_TEXT_NOT_KEPT}”.
      </p>
    );
  if (saving !== "not-saved") return null;
  return (
    <p className={styles.quiet} role="status" data-testid="ward-demo-not-saved">
      Demonstration state is not saved on this device, so a reload starts it again. Some synthetic form drafts may still
      be recovered within this browser session.
    </p>
  );
}
