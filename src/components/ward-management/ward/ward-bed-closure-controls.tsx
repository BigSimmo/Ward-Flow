"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button, Menu, type MenuItem } from "@/components/wf";
import { ClosureChoice, REVIEW_AFTER_CHOICES } from "../ward-closure-choice";
import styles from "./ward-bed-dossier-drawer.module.css";
import { activeClosedBeds } from "@/components/ward-management/ward-ready-beds";
import type { Unit } from "@/components/ward-management/ward-model";
import { WARD_CLOSURE_REASONS, wardClosureReasonLabel } from "../ward-bed-closure-reason";

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
 *
 * A14-19 (Josh, 18 Nov 2026, D-263): "Close this bed" opens the kit menu "Why is this bed closing?"
 * (the ward closure reasons, then "Not given", then "Cancel"), so closing stays two taps and the
 * reason is chosen as the bed closes. Escape, Cancel or a tap outside backs out with nothing changed.
 */
export type BedClosureActions = {
  /**
   * Set only for a ready bed this desk may close. `reviewAfter` is the "Review in" id ("" for Not
   * known); `reason` is the closure reason id ("" for Not given).
   */
  onCloseBed?: (reviewAfter: string, reason: string) => void;
  /** Set only for a bed closed by number that this desk may reopen. */
  onReopenBed?: () => void;
  /** On a bed closed by number: "Review 14:00" or "Review overdue", when a review time was chosen. */
  reviewLine?: string | null;
  /** Set only on a bed closed with no reason, for a desk that may record one (R-BEDS-4). */
  onAddClosureReason?: (reasonId: string) => void;
};

/** The question "Close this bed" asks before it closes (A14-19). */
const CLOSE_BED_QUESTION = "Why is this bed closing?";

export function BedClosureControls({
  onCloseBed,
  onReopenBed,
  onAddClosureReason,
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
  const closeWith = (reason: string) => {
    onCloseBed?.(reviewAfter, reason);
    setReviewAfter("");
  };
  const reasonItems: MenuItem[] = [
    { kind: "heading", id: "why", label: CLOSE_BED_QUESTION },
    ...WARD_CLOSURE_REASONS.map((entry) => ({ id: entry.id, label: entry.label, onSelect: () => closeWith(entry.id) })),
    { id: "not-given", label: "Not given", onSelect: () => closeWith("") },
    { kind: "separator", id: "cancel-rule" },
    // Cancel only closes the menu; focus goes back to "Close this bed".
    { id: "cancel", label: "Cancel", onSelect: () => {} },
  ];
  return (
    <>
      {onAddClosureReason ? (
        <ClosureChoice
          label="Add a reason"
          testId="ward-drawer-add-closure-reason"
          value=""
          items={WARD_CLOSURE_REASONS.map((entry) => ({ id: entry.id, label: entry.label }))}
          onChange={(id) => id && onAddClosureReason(id)}
        />
      ) : null}
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
        <Menu
          label={CLOSE_BED_QUESTION}
          items={reasonItems}
          trigger={(props) => (
            <Button
              {...props}
              variant="sec"
              size={size}
              iconEnd={ChevronDown}
              className={styles.pill}
              data-testid="ward-drawer-close-bed"
              aria-describedby="ward-drawer-close-bed-note"
            >
              Close this bed
            </Button>
          )}
        />
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
