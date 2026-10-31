"use client";

import { useState, type ReactNode } from "react";

import { admittedOnAForm } from "@/components/ward-management/legal-forms/legal-forms-admitted";
import { formProgression } from "@/components/ward-management/legal-forms/legal-form-progression";
import { movementPickerLabel, type RecordDraft } from "@/components/ward-management/legal-forms/legal-forms-sheets";
import { isOwnedLegalFormCode } from "@/components/ward-management/legal-forms/legal-forms-view";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { movementRefuses3C } from "@/components/ward-management/ward-legal-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";

import { RecordFormSheetRedesign } from "./record-form-sheet";

// A form save whose confirmation never arrived: the sheet keeps its draft and says why.
const UNCONFIRMED_SAVE = { commandId: "", status: "failed", message: SAVE_NOT_CONFIRMED } as const;

/**
 * Record a form, drawn over Legal forms. Opened as a patient's "Record next form" opens it: the
 * movement chosen, the form type blank (MHA forms are never prefilled) and no time typed. The save
 * is the Legal forms page's own: `RECORD_LEGAL_FORM_WRITTEN` as this route's role, with Undo on the toast.
 */
export function PopRecordForm({ page }: { page: ReactNode }) {
  const { movements, referrals, patients, admissions, dispatch, rejections } = useWardFlowSelect(
    "movements",
    "referrals",
    "patients",
    "admissions",
    "dispatch",
    "rejections",
  );
  const now = useWardFlowClock();
  const gate = useRoleGate();
  const routeRole = useRouteRole();
  const raise = useWardRaise(routeRole);
  const { offer: offerStep } = useUndoableStep({ dispatch, rejections, now, routeRole });

  const openMovements = movements.filter(isOpen);
  const admitted = admittedOnAForm(movements, admissions);
  const recordable =
    routeRole === "ed" ? openMovements : routeRole === "ward" ? admitted : [...openMovements, ...admitted];
  // A person whose last form ended and whose next form is still to record; failing that, someone on
  // a legal status with no form recorded yet; failing that, the first open movement.
  const [target] = useState<Movement | undefined>(
    () =>
      recordable.find((movement) => formProgression(movement) !== undefined) ??
      recordable.find((movement) => movement.legalForm === undefined && movement.legalStatus !== "Voluntary") ??
      recordable[0],
  );
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState<RecordDraft>({ form: "", movement: target?.id ?? "" });

  const writtenGate = gate("RECORD_LEGAL_FORM_WRITTEN", "record-a-form");
  const patientOf = (movement: Movement) => resolveSubjectPatient(movement, { patients, referrals });

  return (
    <>
      {page}
      <RecordFormSheetRedesign
        open={open}
        onClose={() => setOpen(false)}
        draft={draft}
        onDraft={setDraft}
        openMovements={recordable}
        // Surname first (D-83).
        labelOf={(movement) => movementPickerLabel(patientOf(movement).formalName, patientOf(movement).umrn, movement)}
        now={now}
        recordUnavailable={writtenGate.reason}
        targetMovement={target?.id}
        onSaveForm={({ movementId, formCode, writtenAt, region }) => {
          if (!writtenGate.allowed || !isOwnedLegalFormCode(formCode)) return false;
          const movement = recordable.find((candidate) => candidate.id === movementId);
          if (!movement || (formCode === "3C" && movementRefuses3C(movement))) return false;
          const written = { movementId, formCode, writtenAt, ...(region ? { region } : {}) };
          const completion = raise("RECORD_LEGAL_FORM_WRITTEN", written);
          const accepted = (outcome: Awaited<typeof completion>) => {
            offerStep(
              {
                success: `Form ${formCode} recorded`,
                undo: (at) => ({ type: "UNDO_LEGAL_FORM_RECORD", role: routeRole, now: at, movementId }),
                undone: "Form record undone.",
              },
              { completion: outcome },
            );
            if (outcome?.status === "accepted") return outcome.isCurrent?.() ?? true;
            return outcome?.status === "refused"
              ? `Not recorded: ${outcome.message ?? "The action was refused."}`
              : (outcome?.message ?? SAVE_NOT_CONFIRMED);
          };
          const unconfirmed = () => accepted(UNCONFIRMED_SAVE);
          return completion && "then" in completion ? completion.then(accepted, unconfirmed) : accepted(completion);
        }}
      />
    </>
  );
}
