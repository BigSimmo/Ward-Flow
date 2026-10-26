"use client";

import { useState, type FormEvent } from "react";
import { OVERRIDE_REASONS, type OverrideReason } from "@/components/ward-management/ward-change-reasons";
import { useHoldOpenForm } from "@/components/ward-management/use-hold-open-form";
import { bedNumberLabel } from "./ward-bed-board-logic";
import styles from "./ward.module.css";

/** A Bed board move the engine refused until a reason is recorded (audit CS3-12). */
export type OpenBedAsk = { admissionId: string; fromBed: number; bedNumber: number; name: string };

/**
 * Audit CS3-12 (Josh, 26 Oct 2026, Part A 3): a person who needs a locked bed moves to an open bed
 * only with a recorded reason, as at admission. Shown on the Bed board after that refusal; the
 * same five reasons, as radios, as the admission override form uses.
 */
export function WardBedMoveReasonForm({
  ask,
  onMove,
  onCancel,
}: {
  ask: OpenBedAsk;
  onMove: (reason: OverrideReason) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<OverrideReason>();
  // Audit CS3-01: checked against the board the form opened on.
  useHoldOpenForm(true);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reason) onMove(reason);
  }
  return (
    <form className={styles.declineForm} onSubmit={submit} data-testid="ward-bed-move-reason">
      <fieldset className={styles.declineFieldset}>
        <legend className={styles.declineLegend}>
          Bed {bedNumberLabel(ask.bedNumber)} is an open bed. Record why {ask.name} is moving there from bed{" "}
          {bedNumberLabel(ask.fromBed)}
        </legend>
        {OVERRIDE_REASONS.map((option) => (
          <label key={option} className={styles.declineOption}>
            <input
              type="radio"
              name={`ward-bed-move-reason-${ask.admissionId}`}
              value={option}
              checked={reason === option}
              onChange={() => setReason(option)}
            />
            {option}
          </label>
        ))}
        {/* Native `disabled`: transient inertness while the form waits for a choice, as in the
            admission override form. */}
        <button type="submit" className={styles.acceptButton} disabled={!reason}>
          Record reason and move
        </button>
        <button type="button" className={styles.declineButton} onClick={onCancel}>
          Cancel
        </button>
      </fieldset>
    </form>
  );
}
