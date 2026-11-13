"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/wf";
import { ClosureChoice, REVIEW_AFTER_CHOICES } from "../ward-closure-choice";
import styles from "./ward-bed-dossier-drawer.module.css";
import { activeClosedBeds } from "@/components/ward-management/ward-ready-beds";
import type { Unit } from "@/components/ward-management/ward-model";
import { wardClosureReasonLabel } from "../ward-bed-closure-reason";

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
 *
 * Item 6 (10 Nov 2026): closing offers "Review in", "Not known" by default, so the bed is looked at
 * again. The time only prompts ("Review 14:00", "Review overdue"); reopening is always this tap.
 */
export type BedClosureActions = {
  /** Set only for a ready bed this desk may close. `reviewAfter` is the "Review in" id ("" for Not known). */
  onCloseBed?: (reviewAfter: string) => void;
  /** Set only for a bed closed by number that this desk may reopen. */
  onReopenBed?: () => void;
  /** On a bed closed by number: "Review 14:00" or "Review overdue", when a review time was chosen. */
  reviewLine?: string | null;
};

export function BedClosureControls({
  onCloseBed,
  onReopenBed,
  reviewLine,
  size,
  children,
}: BedClosureActions & {
  /** "lg" for the desktop footer; the phone sheet uses the default size. */
  size?: "lg";
  /** The phone sheet's role-lock note, which always shows straight after these taps. */
  children?: ReactNode;
}) {
  const [reviewAfter, setReviewAfter] = useState("");
  if (!onCloseBed && !onReopenBed) return <>{children}</>;
  return (
    <>
      {onCloseBed ? (
        <ClosureChoice
          label="Review in"
          testId="ward-drawer-close-bed-review"
          value={reviewAfter}
          items={REVIEW_AFTER_CHOICES}
          onChange={setReviewAfter}
        />
      ) : null}
      {onCloseBed ? (
        <Button
          variant="sec"
          size={size}
          className={styles.pill}
          data-testid="ward-drawer-close-bed"
          aria-describedby="ward-drawer-close-bed-note"
          onClick={() => {
            onCloseBed(reviewAfter);
            setReviewAfter("");
          }}
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
        <p className={styles.meta} id="ward-drawer-reopen-bed-note" data-testid="ward-drawer-reopen-bed-note">
          {reviewLine ? `${reviewLine}. ` : ""}Reopening offers this bed again.
        </p>
      ) : null}
      {children}
    </>
  );
}

/**
 * C03 (design critique v2, Josh 13 Nov 2026): a closed bed with nobody in it opens as the bed and
 * its closure, never as an empty patient record. The words are the bed list's own ("Closed until it
 * is reopened", with the review line) and the bed board's ("Not offered"); the reason is the one
 * chosen on closing (D-148), or says none was.
 */
export function closedBedWords(
  unit: Unit,
  bedNumber: number,
  reviewLine: string | undefined,
): { state: string; reason: string } {
  const mark = activeClosedBeds(unit).find((each) => each.bedNumber === bedNumber);
  return {
    state: reviewLine ? `Closed until reopened · ${reviewLine}` : "Closed until it is reopened",
    reason: mark?.reason ? wardClosureReasonLabel(mark.reason) : "No reason recorded",
  };
}
