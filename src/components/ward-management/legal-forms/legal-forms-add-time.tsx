"use client";

import { useState } from "react";

import { Button, DateField, Dialog, Field, Segmented, TextInput, requestConfirm } from "@/components/wf";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";

import {
  writtenDraftFor,
  writtenSaveOf,
  writtenTimeCheck,
  type WrittenDraft,
  type WrittenSave,
} from "./legal-forms-written-time";
import styles from "./legal-forms.module.css";
import own from "./legal-forms-add-time.module.css";

/** Asked before a typed, unsaved time is dropped. */
const DISCARD_TYPED_TIME = "You have a typed time that is not saved. Discard it?";

/**
 * ADD THE TIME (redesign, Josh 31 Oct 2026). The row's "Add the time" opens the side panel's
 * "Record the time written" form as its own pop-up over the list. The fields, checks, wording and
 * save (`RECORD_LEGAL_FORM_WRITTEN`, with Undo on the toast) are the panel's own. The date is the
 * kit's DD/MM/YYYY box and the time a typed 24-hour HH:MM (bug list rows 24 and 25). Only the typed
 * time is recorded: nothing is worked out from it (D5, D-70, D-93). Region and age band open on
 * "Not recorded" unless the form already holds one, so nothing is saved that nobody chose.
 */
export function AddTimeDialog({
  movement,
  name,
  umrn,
  now,
  dayZero,
  recordUnavailable,
  refusal,
  onClose,
  onSave,
}: {
  movement: Movement;
  /** Surname first, the patient's formal name (D-83). */
  name: string;
  umrn: string;
  now: Instant;
  dayZero: Date;
  /** Why this route may not record a form time, if it may not. */
  recordUnavailable?: string;
  /** The engine's refusal of a save made in this pop-up, if any. */
  refusal: string | undefined;
  onClose: () => void;
  /** Records the written time; `onAccepted` runs only once the engine accepts it. */
  onSave: (save: WrittenSave, onAccepted: () => void) => void;
}) {
  const legalForm = movement.legalForm;
  const [draft, setDraft] = useState<WrittenDraft>(() => writtenDraftFor(legalForm));
  const { writtenProblem } = writtenTimeCheck(draft, now, dayZero);
  const typed = draft.date !== "" || draft.time !== "";
  // Leaving the page with a typed time asks first, in the kit's styled confirm.
  useDirtyStateGuard({ isDirty: typed });

  const close = () => {
    if (!typed) {
      onClose();
      return;
    }
    void requestConfirm({
      title: "Discard the typed time?",
      message: DISCARD_TYPED_TIME,
      confirmLabel: "Discard",
      cancelLabel: "Keep editing",
    }).then((confirmed) => {
      if (confirmed) onClose();
    });
  };

  const save = () => {
    if (recordUnavailable) return;
    const written = writtenSaveOf(draft, now, dayZero);
    if (!written) return;
    // Closes only once the engine has accepted the time; a refusal keeps it open with its reason.
    onSave(written, onClose);
  };

  const id = movement.id;
  return (
    <Dialog
      open
      onClose={close}
      title="Add the time"
      description={
        <>
          <strong>{name}</strong> · <span className={styles.mono}>{umrn}</span>
          {legalForm ? ` · Form ${legalForm.code}` : ""}
        </>
      }
      size="md"
      data-testid={`ward-legal-forms-add-time-${id}`}
    >
      <div className={own.body} data-testid={`ward-legal-forms-written-form-${id}`}>
        <div className={styles.fieldPair}>
          <Field label="Date written" id={`legal-forms-add-time-date-${id}`} hint="DD/MM/YYYY">
            <DateField
              data-sheet-autofocus
              value={draft.date}
              onValueChange={(date) => setDraft((current) => ({ ...current, date }))}
            />
          </Field>
          <Field label="Time" id={`legal-forms-add-time-time-${id}`} hint="HH:MM">
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
        {/* One line, so nobody reads a deadline into the time typed here (D5, D-70). */}
        <p
          id={`ward-legal-forms-add-time-note-${id}`}
          className={own.asWritten}
          data-testid={`ward-legal-forms-clock-preview-${id}`}
        >
          Only the written time is recorded. No expiry is calculated.
        </p>
        <div className={own.actions}>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="pri"
            data-testid={`ward-legal-forms-written-confirm-${id}`}
            aria-describedby={`ward-legal-forms-add-time-note-${id}`}
            disabledReason={recordUnavailable ?? writtenProblem}
            onClick={save}
          >
            Save time
          </Button>
        </div>
        {refusal ? (
          <p className={styles.note} role="alert" data-testid={`ward-legal-forms-written-refusal-${id}`}>
            Not recorded: {refusal}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
