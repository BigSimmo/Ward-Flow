import type { RefObject } from "react";
import { ListChecks, X } from "lucide-react";
import { Button, Icon, StatusGlyph } from "@/components/wf";
import type { Movement } from "@/components/ward-management/ward-model";

import { formRequiredLabel } from "./officer-screen-helpers";
import styles from "./officer.module.css";

/**
 * Paperwork checks for one transport job, moved unchanged from `officer-screen.tsx` (H-0906). The
 * ticks are local to the screen and are never saved to the movement record.
 */
export function OfficerFormCheckDialog({
  job,
  umrn,
  patientName,
  verifiedChecks,
  dialogRef,
  onToggleCheck,
  onClose,
}: {
  job: Movement;
  umrn: string | undefined;
  patientName: string;
  verifiedChecks: Record<string, boolean[]>;
  dialogRef: RefObject<HTMLDivElement | null>;
  onToggleCheck: (movementId: string, index: number) => void;
  onClose: () => void;
}) {
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- a backdrop click closes it for the pointer, and the shared modal focus helper closes it on Escape
    <div
      ref={dialogRef}
      className={styles.modalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-verify-title"
      onClick={onClose}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- only stops a click inside the dialog reaching the backdrop that closes it */}
      <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
        <header className={styles.modalHead}>
          <span className={styles.modalTile} aria-hidden="true">
            <Icon icon={ListChecks} size={16} />
          </span>
          <span className={styles.modalTitles}>
            <h3 id="form-verify-title" className={styles.modalTitle}>
              Paperwork checks (not saved)
            </h3>
            <span className={styles.modalSub}>
              {formRequiredLabel(job.transport!)} · {umrn} · {patientName}
            </span>
          </span>
          <Button variant="ghost" size="sm" iconOnly icon={X} onClick={onClose} aria-label="Close paperwork checks" />
        </header>
        <div className={styles.modalBody}>
          <p className={styles.modalLead}>
            {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
            Confirm paperwork with the clinical team for <strong>{patientName}</strong>. These local checks do not
            establish legal authorisation and are not saved to the movement record.
          </p>
          <h4 className={styles.sectionTitle}>Transfer checks</h4>
          <div className={styles.checklist}>
            {[
              "Identity checked with the sending team",
              "Paper form seen",
              "Belongings with the patient",
              "Receiving ward told we are leaving",
            ].map((label, idx) => {
              const isChecked = verifiedChecks[job.id]?.[idx] ?? false;
              return (
                <label key={idx} className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleCheck(job.id, idx)}
                    data-testid={`ward-officer-check-${idx}-${job.id}`}
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </div>
        <footer className={styles.modalFoot}>
          <span className={styles.muted}>
            <StatusGlyph tone="neutral" size={9} /> Not saved to the movement record
          </span>
          <Button variant="pri" size="sm" onClick={onClose}>
            Close checks
          </Button>
        </footer>
      </div>
    </div>
  );
}
