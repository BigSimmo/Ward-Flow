"use client";

import { Hand } from "lucide-react";
import { buttonClass } from "@/components/wf";
import styles from "./ward-home-tab.module.css";

/**
 * Opens placing and moving (the bed board) inside Ward home. Josh, 27 Oct 2026: the Ward page has
 * two views, Ward home and Decisions. Bed board is no longer a tab, as Every bed already shows the
 * beds, so the board opens from here: a button in the Every bed head on desktop, and a line by the
 * round on a phone. Both carry the `ward-open-bed-board` test id; only one renders at a time.
 */
export function WardPlaceOrMove({
  variant,
  waiting,
  onOpen,
}: {
  variant: "head" | "phone";
  /** People accepted for this ward and waiting to be placed in a bed. */
  waiting: number;
  /** Without it, nothing renders. */
  onOpen: (() => void) | undefined;
}) {
  if (!onOpen) return null;
  if (variant === "phone") {
    return (
      <p className={styles.phoneBoardHint}>
        {waiting > 0 ? `${waiting} waiting for a bed.` : "Need a different bed?"}{" "}
        <button type="button" className={styles.phoneBoardLink} data-testid="ward-open-bed-board" onClick={onOpen}>
          Place or move beds
        </button>
      </p>
    );
  }
  return (
    <button
      type="button"
      className={buttonClass({ variant: waiting > 0 ? "tint" : "ghost", size: "sm" })}
      aria-label={waiting > 0 ? `Place or move beds, ${waiting} waiting to be placed` : "Place or move beds"}
      data-testid="ward-open-bed-board"
      onClick={onOpen}
    >
      <Hand size={14} aria-hidden="true" />
      Place or move
      {waiting > 0 ? (
        <span className={styles.placeCount} aria-hidden="true">
          {waiting}
        </span>
      ) : null}
    </button>
  );
}
