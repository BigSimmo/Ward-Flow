"use client";

import { useState, type ReactNode } from "react";

import { Button, Dialog } from "@/components/wf";
import { examinationBlockedReason } from "@/components/ward-management/ed/ed-blocked-reasons";
import { legalFormGroupRows } from "@/components/ward-management/legal-forms/legal-forms-derivations";
import { formTitle, needsExamination } from "@/components/ward-management/legal-forms/legal-forms-view";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { useWardFormSave } from "@/components/ward-management/use-ward-form-save";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import type { Movement } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById, edShortName } from "@/components/ward-management/ward-sites";

import styles from "./pop-record-exam.module.css";

type Outcome = "inpatient_order" | "community_order" | "revoked" | "further_examination_ordered";

// The four outcomes and their words, exactly as the ED row's examination form offers them
// (`ed-screen-row-forms.tsx`). "Further examination ordered" settles nothing and only says a
// repeat examination is coming (owner item 7, 17 Sept 2026).
const OUTCOMES: readonly { value: Outcome; label: string }[] = [
  { value: "inpatient_order", label: "Inpatient treatment order" },
  { value: "community_order", label: "Community treatment order" },
  { value: "revoked", label: "Revoked — does not proceed" },
  { value: "further_examination_ordered", label: "Further examination ordered" },
];

/**
 * Record exam, drawn over Legal forms. Today Legal forms sends this step to the ED board ("Record on
 * ED"), where the row's examination form records it; this draws that form as a popup, opened on the
 * longest waiting person on a form who still needs an examination. Its options, check and save
 * (`RECORD_EXAMINATION` as the ED, with Undo on the toast) are the ED form's own.
 */
export function PopRecordExam({ page }: { page: ReactNode }) {
  const { movements, patients, referrals, dispatch, rejections } = useWardFlowSelect(
    "movements",
    "patients",
    "referrals",
    "dispatch",
    "rejections",
  );
  const now = useWardFlowClock();
  const raise = useWardRaise("ed");
  const { offer: offerStep } = useUndoableStep({ dispatch, rejections, now, routeRole: "ed" });

  const [target] = useState<Movement | undefined>(() => {
    const waiting = (movement: Movement) =>
      isOpen(movement) &&
      needsExamination(movement) &&
      movement.examination === undefined &&
      examinationBlockedReason(movement) === undefined;
    // Legal forms' own order: everyone on a form, then the rest, each longest waiting first.
    const onAForm = [
      ...legalFormGroupRows(movements, now, "with-deadline"),
      ...legalFormGroupRows(movements, now, "no-deadline"),
    ];
    return onAForm.find(waiting) ?? movements.find(waiting);
  });
  const [open, setOpen] = useState(true);
  const [outcome, setOutcome] = useState<Outcome>();
  const save = useWardFormSave(target?.id ?? "none");

  if (!target) return <>{page}</>;
  const patient = resolveSubjectPatient(target, { patients, referrals, movements });
  const ed = edById(target.originEdId);
  const close = () => setOpen(false);
  const confirm = () => {
    if (!outcome || save.pending) return;
    const movementId = target.id;
    save.submit(() => {
      const completion = raise("RECORD_EXAMINATION", { movementId, outcome });
      offerStep(
        {
          success: "Examination recorded",
          undo: (at) => ({ type: "UNDO_ED_STEP", role: "ed", now: at, movementId }),
          undone: "Undone. Back as it was.",
        },
        { completion },
      );
      return completion;
    }, close);
  };

  return (
    <>
      {page}
      <Dialog
        open={open}
        onClose={close}
        // Surname first (D-83).
        title={`Examination outcome for ${patient.formalName}`}
        description={
          <>
            <span className={styles.mono}>{patient.umrn}</span>
            {target.legalForm ? ` · Form ${target.legalForm.code}, ${formTitle(target.legalForm.code)}` : null}
            {ed ? ` · ${edShortName(ed)}` : null}
          </>
        }
        size="md"
        data-testid={`ward-ed-examine-form-${target.id}`}
      >
        <fieldset className={styles.options} disabled={save.pending}>
          <legend className={styles.legend}>Outcome from the examination</legend>
          {OUTCOMES.map((option) => (
            <label key={option.value} className={styles.option}>
              <input
                type="radio"
                name={`examination-outcome-${target.id}`}
                value={option.value}
                checked={outcome === option.value}
                onChange={() => setOutcome(option.value)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        {/* The ED form's own button and reason, in the popup body so the whole label fits on a phone. */}
        <div className={styles.actions}>
          <Button
            variant="pri"
            className={styles.confirm}
            loading={save.pending}
            disabledReason={outcome ? undefined : "Choose an outcome first"}
            onClick={confirm}
          >
            Confirm examination outcome
          </Button>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
        </div>
        {save.pending ? (
          <p className={styles.note} role="status">
            Saving examination outcome…
          </p>
        ) : null}
        {save.error ? (
          <p className={styles.error} role="alert">
            {save.error}
          </p>
        ) : null}
      </Dialog>
    </>
  );
}
