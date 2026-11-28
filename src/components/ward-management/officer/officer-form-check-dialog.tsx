import type { RefObject } from "react";
import { Dialog, StatusGlyph } from "@/components/wf";
import type { Movement } from "@/components/ward-management/ward-model";

import { formRequiredLabel } from "./officer-screen-helpers";
import styles from "./officer.module.css";

/**
 * Paperwork checks for one transport job, moved unchanged from `officer-screen.tsx` (H-0906). The
 * ticks are local to the screen and are never saved to the movement record. Audit two #38 (O36): the
 * kit `Dialog` draws the frame and holds focus; the checks and their words are as before.
 */
export function OfficerFormCheckDialog({
  job,
  umrn,
  patientName,
  verifiedChecks,
  returnFocusRef,
  onToggleCheck,
  onClose,
}: {
  job: Movement;
  umrn: string | undefined;
  patientName: string;
  verifiedChecks: Record<string, boolean[]>;
  /** Where focus returns on close: the control that opened the checks. */
  returnFocusRef: RefObject<HTMLElement | null>;
  onToggleCheck: (movementId: string, index: number) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onClose={onClose}
      title="Paperwork checks"
      description={`${formRequiredLabel(job.transport!)} · ${umrn} · ${patientName}`}
      closeLabel="Close paperwork checks"
      returnFocusRef={returnFocusRef}
      primary={{ label: "Close checks", onAction: onClose }}
    >
      <p className={styles.modalLead}>
        {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
        Confirm paperwork with the clinical team for <strong>{patientName}</strong>. These checks do not establish legal
        authorisation.
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
      <p className={styles.muted}>
        <StatusGlyph tone="neutral" size={9} /> Not saved
      </p>
    </Dialog>
  );
}
