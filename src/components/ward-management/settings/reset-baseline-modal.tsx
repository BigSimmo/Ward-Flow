"use client";

import { useRef } from "react";
import { AlertTriangle, RotateCcw, X } from "lucide-react";

import { defaultWardConfiguration } from "../ward-configuration";
import { useWardModalFocus } from "../ward-modal-focus";
import styles from "./settings.module.css";

export interface ResetBaselineModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

export function ResetBaselineModal({ isOpen, onClose, onConfirm }: ResetBaselineModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const defaults = defaultWardConfiguration();

  // Focus trapping, Escape key listener, and focus restoration to trigger
  useWardModalFocus(isOpen, dialogRef, onClose);

  if (!isOpen) return null;

  return (
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
      >
        <header className={styles.modalHeader}>
          <div className={styles.resetHeaderMeta}>
            <div className={styles.dangerBadge}>
              <AlertTriangle size={14} aria-hidden="true" />
              <span>Destructive Action</span>
            </div>
            <h3 id="reset-modal-title" className={styles.modalTitle}>
              Restore Settings defaults?
            </h3>
          </div>
          <button type="button" className={styles.btnSecondary} onClick={onClose} aria-label="Close modal">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.modalBody}>
          <p id="reset-modal-desc">
            Restores this prototype’s coordination defaults and local Settings preferences, including appearance and
            navigation. The configuration request is recorded in the session event log. Referrals and movements are not
            reset.
          </p>

          <div className={styles.baselineParametersCard}>
            <span className={styles.baselineListTitle}>Prototype Coordination Defaults</span>
            <ul className={styles.baselineList}>
              <li>
                <span>Emergency Department access target:</span>{" "}
                <strong>{defaults.edAccessTargetMinutes / 60} hours</strong>
              </li>
              <li>
                <span>Parallel referral cap:</span> <strong>{defaults.parallelReferralCap} destinations</strong>
              </li>
              <li>
                <span>Pulled-bed hold duration:</span> <strong>{defaults.pullHoldMinutes} minutes</strong>
              </li>
              <li>
                <span>Morning rollup deadline:</span>{" "}
                <strong>
                  {String(Math.floor(defaults.morningRollupDeadlineMinutes / 60)).padStart(2, "0")}:
                  {String(defaults.morningRollupDeadlineMinutes % 60).padStart(2, "0")}
                </strong>
              </li>
              <li>
                <span>First due-time warning (urgent):</span> <strong>{defaults.dueSoonUrgentMinutes} minutes</strong>
              </li>
              <li>
                <span>Second due-time warning (soon):</span> <strong>{defaults.dueSoonMinutes} minutes</strong>
              </li>
              <li>
                <span>Appearance theme:</span> <strong>System default (Auto)</strong>
              </li>
              <li>
                <span>Navigation rail:</span> <strong>Expanded (Open)</strong>
              </li>
            </ul>
          </div>
        </div>

        <footer className={styles.modalFooter}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnDanger}
            onClick={onConfirm}
            data-testid="confirm-restore-defaults-btn"
          >
            <RotateCcw size={15} aria-hidden="true" />
            <span>Restore Settings defaults</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
