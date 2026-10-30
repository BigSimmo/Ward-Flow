"use client";

import { useState, type ReactNode } from "react";

import { Button, Dialog, Field, Segmented, TextInput } from "@/components/wf";
import { legalFormGroupRows } from "@/components/ward-management/legal-forms/legal-forms-derivations";
import {
  instantFromDateAndTimeInputs,
  isOwnedLegalFormCode,
} from "@/components/ward-management/legal-forms/legal-forms-view";
import { WARD_RECORDS_ADMITTED } from "@/components/ward-management/legal-forms/legal-forms-admitted";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import type { LegalClockAgeBand, LegalClockRegion } from "@/components/ward-management/ward-legal-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import styles from "@/components/ward-management/legal-forms/legal-forms.module.css";

import own from "./pop-add-time.module.css";

// From the Legal forms side panel (`legal-forms-panel.tsx`): "not_recorded" until someone picks a
// band or region, so nothing is saved that nobody chose (finding 210, 27 Oct 2026).
type WrittenDraft = {
  date: string;
  time: string;
  region: LegalClockRegion | "not_recorded";
  ageBand: LegalClockAgeBand | "not_recorded";
};
const BLANK_WRITTEN: WrittenDraft = { date: "", time: "", region: "not_recorded", ageBand: "not_recorded" };

/**
 * "Add the time", drawn over Legal forms. Today the row's link opens the side panel and focuses its
 * "Record the time written" form; this draws that same form as its own popup, opened on the first
 * person under "Time not written". The fields, checks, wording and save (`RECORD_LEGAL_FORM_WRITTEN`
 * with Undo on the toast) are the panel's own. Only the typed time is recorded: nothing is worked
 * out from it.
 */
export function PopAddTime({ page }: { page: ReactNode }) {
  const { movements, patients, referrals, dispatch, dayZero, rejections } = useWardFlowSelect(
    "movements",
    "patients",
    "referrals",
    "dispatch",
    "dayZero",
    "rejections",
  );
  const now = useWardFlowClock();
  const gate = useRoleGate();
  const routeRole = useRouteRole();
  const raise = useWardRaise(routeRole);
  const { runRecorded } = useUndoableStep({ dispatch, rejections, now, routeRole });

  const [target] = useState<Movement | undefined>(() =>
    legalFormGroupRows(movements, now, "no-deadline").find(
      (movement) => movement.formedAt === undefined && isOwnedLegalFormCode(movement.legalForm?.code),
    ),
  );
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState<WrittenDraft>(() => ({
    ...BLANK_WRITTEN,
    region: target?.legalForm?.region ?? BLANK_WRITTEN.region,
    ageBand: target?.legalForm?.ageBand ?? BLANK_WRITTEN.ageBand,
  }));
  // Only a refusal of a save made in this popup is shown in it.
  const [refusalsAtOpen] = useState(rejections.length);

  if (!target || !target.legalForm) return <>{page}</>;
  const legalForm = target.legalForm;
  const patient = resolveSubjectPatient(target, { patients, referrals });
  const writtenGate = gate("RECORD_LEGAL_FORM_WRITTEN", "record-a-form");
  const recordUnavailable = routeRole === "ward" ? WARD_RECORDS_ADMITTED : writtenGate.reason;

  const typedWrittenAt = instantFromDateAndTimeInputs(draft.date, draft.time, dayZero);
  // The same rule as the Record a form sheet: a form cannot have been written after now.
  const writtenLater = typedWrittenAt !== undefined && typedWrittenAt > now;
  const writtenProblem =
    typedWrittenAt === undefined
      ? "Enter the time written on the form"
      : writtenLater
        ? "The time written cannot be later than now"
        : undefined;
  const refusal = rejections
    .slice(refusalsAtOpen)
    .findLast((entry) => entry.movementId === target.id && entry.attempted === "RECORD_LEGAL_FORM_WRITTEN");

  const save = () => {
    if (recordUnavailable || typedWrittenAt === undefined || writtenLater) return;
    const formCode = legalForm.code;
    if (!isOwnedLegalFormCode(formCode)) return;
    const movementId = target.id;
    const region = draft.region === "not_recorded" ? undefined : draft.region;
    const ageBand = draft.ageBand === "not_recorded" ? null : draft.ageBand;
    runRecorded(
      () => {
        const written = { movementId, formCode, writtenAt: typedWrittenAt, ...(region ? { region } : {}), ageBand };
        const completion = raise("RECORD_LEGAL_FORM_WRITTEN", written);
        // Closes only once the engine has accepted the time; a refusal keeps it open with its reason.
        const closeIfAccepted = (outcome: Awaited<typeof completion>) =>
          outcome?.status === "accepted" && (outcome.isCurrent?.() ?? true) && setOpen(false);
        if (completion && "then" in completion) void completion.then(closeIfAccepted, () => undefined);
        else closeIfAccepted(completion);
        return completion;
      },
      {
        success: "Form time recorded",
        undo: (at) => ({ type: "UNDO_LEGAL_FORM_RECORD", role: routeRole, now: at, movementId }),
        undone: "Form time undone.",
      },
    );
  };

  return (
    <>
      {page}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        // Redesign: titled with the link that opens it. The form's full name is on the row behind.
        title="Add the time"
        description={
          <>
            {/* Surname first (D-83). */}
            <strong>{patient.formalName}</strong> · <span className={styles.mono}>{patient.umrn}</span> · Form{" "}
            {legalForm.code}
          </>
        }
        size="md"
        data-testid={`ward-legal-forms-written-form-${target.id}`}
      >
        <div className={own.body}>
          <div className={styles.fieldPair}>
            <Field label="Date written" id={`legal-forms-written-date-${target.id}`}>
              <TextInput
                type="date"
                value={draft.date}
                onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
              />
            </Field>
            {/* Redesign: the 24-hour HH:MM text field Record a form uses, typed as written (never a
                12-hour picker). The same parser reads it. */}
            <Field label="Time" id={`legal-forms-written-time-${target.id}`}>
              <TextInput
                placeholder="HH:MM"
                inputMode="numeric"
                autoComplete="off"
                value={draft.time}
                onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))}
              />
            </Field>
          </div>
          <div className={own.choices}>
            <div className={own.choice}>
              <span className={own.choiceLabel} aria-hidden="true">
                Region
              </span>
              <Segmented
                label="Region"
                size="sm"
                value={draft.region}
                onChange={(region) => setDraft((current) => ({ ...current, region }))}
                items={[
                  { id: "not_recorded", label: "Not recorded" },
                  { id: "metro", label: "Metro" },
                  { id: "country", label: "Country" },
                ]}
              />
            </div>
            <div className={own.choice}>
              <span className={own.choiceLabel} aria-hidden="true">
                Age band
              </span>
              <Segmented
                label="Age band"
                size="sm"
                value={draft.ageBand}
                onChange={(ageBand) => setDraft((current) => ({ ...current, ageBand }))}
                items={[
                  { id: "not_recorded", label: "Not recorded" },
                  { id: "adult", label: "Adult" },
                  { id: "under_18", label: "Under 18" },
                ]}
              />
            </div>
          </div>
          <p
            id={`ward-legal-forms-clock-preview-${target.id}`}
            className={own.asWritten}
            data-testid={`ward-legal-forms-clock-preview-${target.id}`}
          >
            Only the written time is recorded. No expiry is calculated.
          </p>
          {/* One footer row, as the other Legal forms popups: Cancel, then the reason and Save. */}
          <div className={own.actions}>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="pri"
              data-testid={`ward-legal-forms-written-confirm-${target.id}`}
              aria-describedby={`ward-legal-forms-clock-preview-${target.id}`}
              disabledReason={recordUnavailable ?? writtenProblem}
              onClick={save}
            >
              Save time
            </Button>
          </div>
          {refusal ? (
            <p className={styles.note} role="alert" data-testid={`ward-legal-forms-written-refusal-${target.id}`}>
              Not recorded: {refusal.reason}
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
