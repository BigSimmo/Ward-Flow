"use client";

import { useRef } from "react";
import { AlertTriangle, RotateCcw, X } from "lucide-react";

import { useWardModalFocus } from "../ward-modal-focus";
import { defaultWardConfiguration } from "../ward-configuration";
import { MORNING_ROLLUP_TIME_MINUTES } from "../ward-model";
import { DUE_SOON_MINUTES, DUE_SOON_URGENT_MINUTES } from "../ward-operational-defaults";
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
    ["Pull hold", shortDuration(defaults.pullHoldMinutes)],
    ["Morning count", clock24(defaults.morningRollupDeadlineMinutes ?? MORNING_ROLLUP_TIME_MINUTES)],
    ["First warning", shortDuration(defaults.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES)],
    ["Second warning", shortDuration(defaults.dueSoonMinutes ?? DUE_SOON_MINUTES)],
    ["Theme", "Auto"],
    ["Sidebar", "Full"],
    ["Buzz sound", "On"],
  ];
}

export interface ResetBaselineModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

export function ResetBaselineModal({ isOpen, onClose, onConfirm }: ResetBaselineModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

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
            This saves the six coordination rules at their defaults and records the change in the audit. It also resets
            this browser&rsquo;s theme, sidebar and buzz sound.
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
            className={styles.btnDanger}
            onClick={onConfirm}
            data-testid="confirm-restore-defaults-btn"
          >
            <RotateCcw size={15} aria-hidden="true" />
            <span>Restore all defaults</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
