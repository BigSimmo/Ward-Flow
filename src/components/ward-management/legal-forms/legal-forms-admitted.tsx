"use client";

import { Button } from "@/components/wf";
import { admittedStayForArrival, type Admission } from "@/components/ward-management/ward-admissions";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { formProgression } from "./legal-form-progression";
import styles from "./legal-forms.module.css";

export const WARD_RECORDS_ADMITTED =
  "The ward records the next form for a person admitted to its bed, under Admitted on a form.";

/**
 * Journeys whose person arrived on a form and is still in the bed (walk-through WT-03, Josh's yes
 * 26 Oct 2026). Arrival closes the journey, so these are not open movements, but the person stays
 * on a legal form and the ward records the next one from the paper.
 */
export function admittedOnAForm(movements: readonly Movement[], admissions: readonly Admission[]): Movement[] {
  return movements
    .filter((movement) => movement.legalForm !== undefined && admittedStayForArrival(movement, admissions))
    .sort((a, b) => (a.closure?.at ?? a.openedAt) - (b.closure?.at ?? b.openedAt));
}

/** What the record holds now: the form still to record, or the form recorded since arrival. */
export function admittedFormLine(movement: Movement): string {
  const progression = formProgression(movement);
  if (progression)
    return `Form ${progression.nextCode} not recorded (Form ${progression.endedCode} ended ${progression.endedWhen})`;
  return `Form ${movement.legalForm?.code ?? ""} recorded`;
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
