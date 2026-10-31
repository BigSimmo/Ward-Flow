"use client";

// Preview copy of `ward/ward-answer-accept-dialog.tsx` (WardAcceptDialog), redesigned on the kit
// Dialog. The props, the hold callback and the confirm are today's; the page fork still owns the
// state, the focus return and the dispatch.

import { useCallback, useState, type RefObject } from "react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { Button, Dialog, Radio } from "@/components/wf";

import styles from "./ward-accept.module.css";

/**
 * The ward's Accept in principle dialog, moved out of `ward-answer-view.tsx` (H-0283, 27 Oct 2026).
 * The answer view keeps the state, the focus return and the dispatch, and passes them in.
 * Redesign: the facts as a short list, the no-bed sentence as a note, and the pull time limit as a
 * choice with nothing chosen; Confirm acceptance waits for it.
 */
export function WardAcceptDialog({
  movement,
  patientName,
  unitName,
  now,
  extended,
  holdChoices,
  dialogRef,
  onChooseHold,
  onCancel,
  onConfirm,
}: {
  movement: Movement;
  patientName: string;
  unitName: string;
  now: Instant;
  extended: boolean;
  holdChoices: readonly { extended: boolean; label: string }[];
  dialogRef: RefObject<HTMLDivElement | null>;
  onChooseHold: (extended: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Nothing pre-selected: today the select starts on standard. The page's `extended` is only
  // trusted once this dialog has had a tap.
  const [chosen, setChosen] = useState(false);
  // The page's own modal-focus hook holds `dialogRef`; it points at the kit Dialog's panel.
  const bodyRef = useCallback(
    (node: HTMLDivElement | null) => {
      dialogRef.current = node?.closest<HTMLDivElement>('[role="dialog"]') ?? null;
    },
    [dialogRef],
  );

  return (
    <Dialog
      open
      onClose={onCancel}
      title="Accept referral in principle"
      closeLabel="Close accept in principle"
      size="md"
      data-testid="ward-accept-dialog"
    >
      <div ref={bodyRef} className={styles.body}>
        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt className={styles.factLabel}>Patient</dt>
            {/* Josh, 22 Oct 2026: the ward sees the name before it accepts. The tier and referral
                time still tell two waiting requests apart (D-39). Surname first (D-83). */}
            <dd className={styles.factValue} id="ward-answer-allocating-movement">
              <strong className={styles.name}>{patientName}</strong>
              <span className={styles.factSub}>
                {movement.cohort} · Tier {movement.urgency}
                {movement.referredAt === undefined
                  ? null
                  : ` · referred ${formatInstantWithDay(movement.referredAt, now)}`}
              </span>
            </dd>
          </div>
          <div className={styles.fact}>
            <dt className={styles.factLabel}>Target unit</dt>
            <dd className={styles.factValue} id="ward-answer-target-unit">
              {unitName}
            </dd>
          </div>
        </dl>

        <p className={styles.note} data-testid="ward-answer-no-bed-named">
          Accepting does not allocate a bed. No bed number is recorded.
        </p>

        <fieldset className={styles.options} id="hold-duration-select">
          <legend className={styles.legend}>Pull time limit</legend>
          {holdChoices.map((choice) => (
            <Radio
              key={choice.label}
              className={styles.option}
              name={`hold-duration-${movement.id}`}
              value={choice.extended ? "extended" : "standard"}
              checked={chosen && extended === choice.extended}
              onChange={() => {
                setChosen(true);
                onChooseHold(choice.extended);
              }}
              label={choice.label}
            />
          ))}
        </fieldset>

        {/* One footer row, as the other popups: Cancel, then the reason and the one filled button. */}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="pri"
            disabledReason={chosen ? undefined : "Choose a pull time limit first"}
            onClick={onConfirm}
          >
            Confirm acceptance
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
