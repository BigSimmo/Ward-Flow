import type { RefObject } from "react";

import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";

import styles from "./ward-answer-view.module.css";

/**
 * The ward's Accept in principle dialog, moved out of `ward-answer-view.tsx` (H-0283, 27 Oct 2026).
 * The markup and words are unchanged. The answer view keeps the state, the focus return and the
 * dispatch, and passes them in.
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
  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="accept-modal-title"
      ref={dialogRef}
    >
      <div className={styles.modalDialog}>
        <div className={styles.modalHead}>
          <h3 id="accept-modal-title" className={styles.modalTitle}>
            Accept referral in principle
          </h3>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={onCancel}>
            Cancel
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="ward-answer-allocating-movement">
              Patient
            </label>
            <input
              type="text"
              className={styles.formInput}
              id="ward-answer-allocating-movement"
              // Josh, 22 Oct 2026: the ward sees the name before it accepts. The tier and referral
              // time still tell two waiting requests apart (D-39).
              value={`${patientName} (${movement.cohort}), Tier ${movement.urgency}${movement.referredAt === undefined ? "" : `, referred ${formatInstantWithDay(movement.referredAt, now)}`}`}
              readOnly
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="ward-answer-target-unit">
              Target Unit
            </label>
            <input type="text" className={styles.formInput} id="ward-answer-target-unit" value={unitName} readOnly />
          </div>
          <p className={styles.formNote} data-testid="ward-answer-no-bed-named">
            Accepting does not allocate a bed. No bed number is recorded.
          </p>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="hold-duration-select">
              Pull time limit
            </label>
            <select
              id="hold-duration-select"
              className={styles.formSelect}
              value={extended ? "extended" : "standard"}
              onChange={(e) => onChooseHold(e.target.value === "extended")}
            >
              {holdChoices.map((choice) => (
                <option key={choice.label} value={choice.extended ? "extended" : "standard"}>
                  {choice.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.modalFoot}>
          <button type="button" className={styles.btn} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnGood}`} onClick={onConfirm}>
            Confirm acceptance
          </button>
        </div>
      </div>
    </div>
  );
}
