"use client";

// Redesign (point 18, Josh 30 Oct 2026): the Waiting table's legal cell and phone prefix show the
// recorded form time only as typed, as the Legal forms mock-up does. No countdown, "left",
// "overdue" or due-soon colour is worked out from it. Copies of `legalCell` and `phonePrefix` in
// `delays-board-rows.tsx`; everything else about the cells is unchanged.
import { type ReactNode } from "react";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { legalStatusFull, legalStatusShort } from "@/components/ward-management/ward-legal-forms";
import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";
import { Tooltip } from "@/components/wf/tooltip";
import { Glyph } from "@/components/ward-management/delays/delays-board-parts";
import type { BoardRow } from "@/components/ward-management/delays/delays-board-model";
import styles from "@/components/ward-management/delays/delays-board.module.css";
import redesign from "./waiting-redesign.module.css";

export function legalCellAsTyped(row: BoardRow, now: Instant): ReactNode {
  const short = legalStatusShort(row.movement);
  const full = legalStatusFull(row.movement);
  const typed = row.movement.legalForm === undefined ? undefined : currentLegalDueAt(row.movement);
  if (typed === undefined) return legalTip(full, <>{short}</>);
  const ends = `Ends ${formatInstantWithDay(typed, now)}`;
  return (
    <span className={redesign.legalTyped}>
      {legalTip(`${full}, ${ends} as typed`, <>{short}</>)}
      <span className={redesign.legalTypedTime}>
        <span>{ends}</span> <span className={redesign.legalTypedWord}>as typed</span>
      </span>
    </span>
  );
}

function legalTip(content: string, chip: ReactNode): ReactNode {
  return (
    <Tooltip content={content}>
      <button
        type="button"
        className={styles.legalChip}
        data-legal-tip=""
        data-testid="delays-legal-chip"
        // Safari does not focus a tapped button; focusing it here opens the tip on a tap.
        onClick={(event) => event.currentTarget.focus()}
      >
        {chip}
      </button>
    </Tooltip>
  );
}

/** Phone: the second line leads with the form and its typed end time, or that it was escalated. */
export function phonePrefixAsTyped(row: BoardRow, now: Instant): ReactNode {
  const form = row.movement.legalForm;
  const typed = form === undefined ? undefined : currentLegalDueAt(row.movement);
  if (form !== undefined && typed !== undefined) {
    return (
      <>
        <b className={styles.phPre}>{`Form ${form.code} ends ${formatInstantWithDay(typed, now)} as typed`}</b>
        {" · "}
      </>
    );
  }
  // A person on an order always shows their form, before the UMRN, even with no typed time.
  const onOrderForm = form !== undefined && row.movement.legalStatus !== "Voluntary" ? form : undefined;
  if (row.movement.escalation !== undefined)
    return (
      <>
        <Glyph tone="info" />
        <b className={styles.phPre}>{onOrderForm ? `Form ${onOrderForm.code} · Escalated` : "Escalated"}</b>
        {" · "}
      </>
    );
  if (onOrderForm)
    return (
      <>
        <b className={styles.phPre}>{`Form ${onOrderForm.code}, time not written`}</b>
        {" · "}
      </>
    );
  return null;
}
