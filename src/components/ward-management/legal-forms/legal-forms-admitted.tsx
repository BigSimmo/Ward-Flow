"use client";

import { Button } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import {
  formProgression,
  formProgressionPhrase,
  legalFormNowWords,
  NEXT_FORM_TO_RECORD,
} from "./legal-form-progression";
import styles from "./legal-forms.module.css";

// The list lives at the ward root so the ward desk and the coordinator's alerts read it too.
export { admittedOnAForm } from "@/components/ward-management/ward-legal-admitted";

export const WARD_RECORDS_ADMITTED =
  "The ward records the next form for a person admitted to its bed, under Admitted on a form.";

/**
 * Everyone on a form on the list (D-157): the open-movement table rows, then the same
 * admitted-on-a-form journeys the screen shows, with no duplicates.
 */
export function legalFormsListPopulation<M extends { id: string }>(rows: readonly M[], admitted: readonly M[]): M[] {
  const seen = new Set(rows.map((row) => row.id));
  return [...rows, ...admitted.filter((movement) => !seen.has(movement.id))];
}

/** What the record holds now: the form still to record, or the form recorded since arrival. */
export function admittedFormLine(movement: Movement): string {
  const progression = formProgression(movement);
  if (progression) return `${NEXT_FORM_TO_RECORD} (${formProgressionPhrase(progression)})`;
  // Audit H4 (14 Nov 2026): "Form 3B ended" once a person recorded its end, never "recorded" as live.
  const words = legalFormNowWords(movement);
  return words?.endsWith(" ended") ? words : `${words ?? "Form"} recorded`;
}

export function LegalFormsAdmitted({
  rows,
  now,
  nameOf,
  umrnOf,
  wardNameOf,
  recordUnavailable,
  onRecord,
}: {
  rows: readonly Movement[];
  now: Instant;
  nameOf: (movement: Movement) => string;
  umrnOf: (movement: Movement) => string;
  wardNameOf: (movement: Movement) => string | null;
  recordUnavailable?: string;
  onRecord: (movementId: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section aria-label="Admitted on a form" data-testid="ward-legal-forms-admitted">
      <div className={styles.groupHead}>
        <span>Admitted on a form</span>
        <span className={styles.groupCount}>{rows.length}</span>
        <span className={styles.groupOrder}>the ward records the next form</span>
      </div>
      <ul className={styles.historyList}>
        {rows.map((movement) => (
          <li key={movement.id} className={styles.admittedRow}>
            <span className={styles.cellStack}>
              <span className={styles.name}>{nameOf(movement)}</span>
              <span className={`${styles.sub} ${styles.mono}`}>{umrnOf(movement)}</span>
            </span>
            <span className={styles.cellStack}>
              <span>{admittedFormLine(movement)}</span>
              <span className={styles.sub}>
                {wardNameOf(movement) ?? "Receiving ward"}
                {movement.closure ? `, arrived ${formatInstantWithDay(movement.closure.at, now)}` : ""}
              </span>
            </span>
            <Button
              variant="sec"
              size="sm"
              disabledReason={recordUnavailable}
              onClick={() => onRecord(movement.id)}
              aria-label={`Record a form for ${nameOf(movement)}`}
            >
              Record a form
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
