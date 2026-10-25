"use client";

import { useRef } from "react";
import { RotateCcw, X } from "lucide-react";

import { StatusGlyph } from "@/components/wf";

import { useWardModalFocus } from "../ward-modal-focus";
import { defaultWardConfiguration } from "../ward-configuration";
import { MORNING_ROLLUP_TIME_MINUTES } from "../ward-model";
import {
  DUE_SOON_MINUTES,
  DUE_SOON_URGENT_MINUTES,
  TRANSFER_ACCEPTANCE_TARGET_MINUTES,
  TRANSPORT_BOOKED_TARGET_MINUTES,
  WARD_ANSWER_TARGET_MINUTES,
} from "../ward-operational-defaults";
import styles from "./settings-modals.module.css";

function shortDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const rest = minutes % 60;
  return rest === 0 ? `${minutes / 60}h` : `${Math.floor(minutes / 60)}h ${rest}m`;
}

function clock24(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** The values a restore writes, read from the same defaults the engine uses. */
function restoredValues(): readonly (readonly [string, string])[] {
  const defaults = defaultWardConfiguration();
  return [
    ["ED wait target", `${defaults.edAccessTargetMinutes / 60}h`],
    ["Wards asked at once", String(defaults.parallelReferralCap)],
    ["Pull time limit", shortDuration(defaults.pullHoldMinutes)],
    ["Morning count", clock24(defaults.morningRollupDeadlineMinutes ?? MORNING_ROLLUP_TIME_MINUTES)],
    ["Early warning", shortDuration(defaults.dueSoonMinutes ?? DUE_SOON_MINUTES)],
    ["Final warning", shortDuration(defaults.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES)],
    ["Referral decision", shortDuration(defaults.referralDecisionTargetMinutes ?? WARD_ANSWER_TARGET_MINUTES)],
    [
      "Transfer acceptance",
      shortDuration(defaults.transferAcceptanceTargetMinutes ?? TRANSFER_ACCEPTANCE_TARGET_MINUTES),
    ],
    ["Transport booked", shortDuration(defaults.transportBookedTargetMinutes ?? TRANSPORT_BOOKED_TARGET_MINUTES)],
    ["Theme", "Auto"],
    ["Glare", "Off"],
    ["Sidebar", "Full"],
    ["Buzz sound", "On"],
  ];
}

export interface ResetBaselineModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly pending?: boolean;
}

export function ResetBaselineModal({ isOpen, onClose, onConfirm, pending = false }: ResetBaselineModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trapping, Escape key listener, and focus restoration to trigger
  useWardModalFocus(isOpen, dialogRef, onClose);

  if (!isOpen) return null;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- a backdrop click closes it for the pointer, and Escape closes it from the keyboard
    <div
      className={styles.modalOverlay}
      data-testid="ward-reset-baseline-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.modalDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-modal-title"
        aria-describedby="reset-modal-desc"
        tabIndex={-1}
      >
        <header className={styles.modalHeader}>
          <div className={styles.resetHeaderMeta}>
            <div className={styles.noticeLine}>
              <StatusGlyph tone="warning" size={10} />
              <span>Saves and records</span>
            </div>
            <h3 id="reset-modal-title" className={styles.modalTitle}>
              Restore all defaults?
            </h3>
          </div>
          <button type="button" className={styles.btnSecondary} onClick={onClose} aria-label="Close modal">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.modalBody}>
          <p id="reset-modal-desc">
            This saves all nine rules at their defaults and records the change in the audit. It also resets this
            browser&rsquo;s theme, glare, sidebar and buzz sound. You can undo it from the toast.
          </p>

          <div className={styles.baselineParametersCard}>
            <span className={styles.baselineListTitle}>Defaults</span>
            <ul className={styles.baselineList}>
              {restoredValues().map(([name, value]) => (
                <li key={name}>
                  <span>{name}</span> <strong>{value}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <footer className={styles.modalFooter}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={onConfirm}
            disabled={pending}
            data-testid="confirm-restore-defaults-btn"
          >
            <RotateCcw size={15} aria-hidden="true" />
            <span>{pending ? "Restoring…" : "Restore all defaults"}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
