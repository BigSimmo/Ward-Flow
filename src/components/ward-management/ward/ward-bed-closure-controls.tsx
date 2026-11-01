"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/wf";
import styles from "./ward-bed-dossier-drawer.module.css";

/**
 * H-0978 / WS-15 (workflow speed audit, Josh 26 Oct 2026, "Close the exact bed"): an empty bed's
 * drawer offered no status change, and a closed bed had no Reopen. The ward now closes and reopens
 * the exact bed it opened, recorded as a closed mark on that bed (`SET_BED_CLOSED`, `Unit.closedBeds`),
 * so closing bed 3 shows bed 3 as Closed and never another tile. A closed bed is not offered, so the
 * ward's Ready figure is one lower while it stays closed (`boundedBedAvailability`).
 *
 * The ward screen decides which taps exist (a ready bed that isn't held may close, a bed closed by
 * number may reopen) and leaves both out for a desk that may not raise the event. Each is raised from the
 * tap here and never from an effect or a timer. Kept in its own file so the bed drawer stays small.
 */
export type BedClosureActions = {
  /** Set only for a ready bed this desk may close. */
  onCloseBed?: () => void;
  /** Set only for a bed closed by number that this desk may reopen. */
  onReopenBed?: () => void;
};

export function BedClosureControls({
  onCloseBed,
  onReopenBed,
  size,
  children,
}: BedClosureActions & {
  /** "lg" for the desktop footer; the phone sheet uses the default size. */
  size?: "lg";
  /** The phone sheet's role-lock note, which always shows straight after these taps. */
  children?: ReactNode;
}) {
  if (!onCloseBed && !onReopenBed) return <>{children}</>;
  return (
    <>
      {onCloseBed ? (
        <Button
          variant="sec"
          size={size}
          className={styles.pill}
          data-testid="ward-drawer-close-bed"
          aria-describedby="ward-drawer-close-bed-note"
          onClick={onCloseBed}
        >
          Close this bed
        </Button>
      ) : null}
      {onReopenBed ? (
        <Button
          variant="pri"
          size={size}
          className={styles.pill}
          data-testid="ward-drawer-reopen-bed"
          aria-describedby="ward-drawer-reopen-bed-note"
          onClick={onReopenBed}
        >
          Reopen this bed
        </Button>
      ) : null}
      {onCloseBed ? (
        <p className={styles.meta} id="ward-drawer-close-bed-note">
          A closed bed is not offered until reopened.
        </p>
      ) : null}
      {onReopenBed ? (
        <p className={styles.meta} id="ward-drawer-reopen-bed-note">
          Reopening offers this bed again.
        </p>
      ) : null}
      {children}
    </>
  );
}
