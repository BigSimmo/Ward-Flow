"use client";

/*
 * Redesign fork of `RecordFormSheet` (`ward-management/legal-forms/legal-forms-sheets.tsx`). The one
 * change is the order of the questions (review note, pop-record-form): the movement first, then the
 * form from the paper, then the time and date as written, with one line saying nothing is worked out
 * from that time. Validation, wording, draft keeping and the save are the sheet's own, unchanged.
 * Round 2 polish: a one-line description, the reason beside Save on one footer row, no clock icon
 * (the HH:MM placeholder says it), a one-line date help and a shorter draft notice.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import { draftSessionVersion, sessionDraftKey } from "@/components/ward-management/ward-session-drafts";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";

import { Button, ErrorSummary, Field, Select, Sheet, SrOnly, TextInput, type ErrorSummaryItem } from "@/components/wf";
import type { Instant } from "@/components/ward-management/ward-clock";
import { movementRefuses3C } from "@/components/ward-management/ward-legal-clock";
import { legalFormName, SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import type { Movement } from "@/components/ward-management/ward-model";
import { isOwnedLegalFormCode } from "@/components/ward-management/legal-forms/legal-forms-view";
import { parseWrittenInstant, type RecordDraft } from "@/components/ward-management/legal-forms/legal-forms-sheets";
import styles from "@/components/ward-management/legal-forms/legal-forms.module.css";
import own from "./record-form-sheet.module.css";

/** RECORD A FORM. Attaches a selectable MHA 2014 form to an open movement. */
export function RecordFormSheetRedesign({
  open,
  onClose,
  draft,
  onDraft,
  openMovements,
  labelOf,
  now = 0,
  recordUnavailable,
  onSaveForm,
  targetMovement,
}: {
  open: boolean;
  onClose: () => void;
  draft: RecordDraft;
  onDraft: (draft: RecordDraft) => void;
  openMovements: Movement[];
  labelOf: (movement: Movement) => string;
  now?: Instant;
  recordUnavailable?: string;
  /** True when accepted; a string is the refusal to show in the sheet; false is refused with no reason. */
  onSaveForm?: (input: {
    movementId: string;
    formCode: string;
    writtenAt: Instant;
    /** Finding 203: Metro or Country for a Form 1A, sent only when chosen. */
    region?: "metro" | "country";
  }) => boolean | string | Promise<boolean | string>;
  /** The movement a patient record's "Record a form" link opened the sheet for (&record=1). */
  targetMovement?: string;
}) {
  // Bumped by Clear to remount the form's fields.
  const [formKey, setFormKey] = useState(0);
  // The engine's refusal of the last save, shown in the sheet with the typed values kept.
  const [saveRefusal, setSaveRefusal] = useState<string | null>(null);
  // Said once when choosing another movement clears a time typed for the one before.
  const [timeClearedNote, setTimeClearedNote] = useState(false);
  const [timeOnForm, setTimeOnForm] = useState("");
  const [dateOnForm, setDateOnForm] = useState("");
  // Finding 203 (27 Oct 2026): a Form 1A's region, as in the side panel. Opens blank, never guessed.
  const [region, setRegion] = useState<"" | "metro" | "country">("");
  const [saving, setSaving] = useState(false);
  // Counts presses of Save while something is missing; the error summary shows from the first.
  const [refusedSaves, setRefusedSaves] = useState(0);
  // A typed time that is not a real time (such as 2505) is named on the field once the person
  // leaves it, not only after a refused save (Josh's iPhone, 25 Oct 2026).
  const [timeLeft, setTimeLeft] = useState(false);
  const submissionVersion = useRef(0);
  const world = useOptionalWardFlowSelect("scenario", "sessionAdopted", "worldGeneration", "dayZero");
  const dayZero = world?.dayZero;
  const scenario = world?.scenario ?? "standard";
  const [storageKey] = useState(() =>
    sessionDraftKey(`${scenario}/${world?.worldGeneration ?? 0}`, "legal-record", "new"),
  );
  const { clearDraft, draftRestored, draftSaved } = useDirtyStateGuard({
    storageKey: world && !world.sessionAdopted ? undefined : storageKey,
    isDirty: !!timeOnForm || !!dateOnForm || !!draft.movement,
    value: JSON.stringify({ ...draft, timeOnForm, dateOnForm }),
    onRestore: (raw) => {
      try {
        const restored: unknown = JSON.parse(raw);
        if (
          !restored ||
          typeof restored !== "object" ||
          !("movement" in restored) ||
          typeof restored.movement !== "string" ||
          !("form" in restored) ||
          typeof restored.form !== "string" ||
          !("timeOnForm" in restored) ||
          typeof restored.timeOnForm !== "string"
        )
          return false;
        if (restored.movement && !openMovements.some((movement) => movement.id === restored.movement)) return false;
        // An unsent draft for another patient never replaces the movement the link asked for.
        if (targetMovement && restored.movement !== targetMovement) return false;
        onDraft({ movement: restored.movement, form: restored.form });
        setTimeOnForm(restored.timeOnForm);
        // A draft saved before the date field existed has no date: blank means today.
        setDateOnForm("dateOnForm" in restored && typeof restored.dateOnForm === "string" ? restored.dateOnForm : "");
        return true;
      } catch {
        return false; /* A damaged form draft never becomes a legal record. */
      }
    },
  });
  const priorMovement = useRef(draft.movement);
  useEffect(() => {
    if (priorMovement.current && priorMovement.current !== draft.movement) {
      submissionVersion.current += 1;
      clearDraft();
      setTimeOnForm("");
      setDateOnForm("");
      setSaving(false);
    }
    priorMovement.current = draft.movement;
  }, [draft.movement, clearDraft]);
  const typeRef = useRef<HTMLSelectElement | null>(null);
  const baseId = useId();
  const parsedWrittenAt = parseWrittenInstant(timeOnForm, now, dayZero ? dateOnForm : "", dayZero);
  const selectedMovement = openMovements.find((movement) => movement.id === draft.movement);
  // Keep the unsent synthetic draft on dismissal; explicit Clear or an accepted save removes it.
  const dismiss = onClose;
  const saveBlockReason =
    (saving ? "Saving form…" : undefined) ??
    recordUnavailable ??
    (!draft.movement
      ? "Choose a movement first."
      : !draft.form
        ? "Choose a form type first."
        : !isOwnedLegalFormCode(draft.form)
          ? `Form ${draft.form} written time is not recorded on this sheet.`
          : draft.form === "3C" && movementRefuses3C(selectedMovement)
            ? "Form 3C is refused when the person arrived on a Form 3D."
            : parsedWrittenAt === null
              ? dayZero && dateOnForm !== ""
                ? "Enter the date and time written on the form, no later than now."
                : "Enter the time written on the form as HH:MM, no later than now."
              : undefined);
  const typeId = `${baseId}-legal-forms-new-instrument`;
  const movementId = `${baseId}-legal-forms-new-movement`;
  const timeId = `${baseId}-legal-forms-new-time`;
  // Every missing answer at once, in field order, for the summary and the fields. A system reason
  // (saving, or this route cannot record) is not the person's to fix, so it stays on the button.
  const typeProblem = !draft.form
    ? "Choose a form type"
    : !isOwnedLegalFormCode(draft.form)
      ? `Form ${draft.form} written time is not recorded on this sheet`
      : draft.form === "3C" && movementRefuses3C(selectedMovement)
        ? "Form 3C is refused when the person arrived on a Form 3D"
        : null;
  const problems: ErrorSummaryItem[] =
    saving || recordUnavailable
      ? []
      : [
          ...(!draft.movement ? [{ id: movementId, text: "Choose a movement" }] : []),
          ...(typeProblem ? [{ id: typeId, text: typeProblem }] : []),
          ...(parsedWrittenAt === null
            ? [
                {
                  id: timeId,
                  text:
                    dayZero && dateOnForm !== ""
                      ? "Enter the date and time written on the form, no later than now"
                      : "Enter the time written on the form as HH:MM, no later than now",
                },
              ]
            : []),
        ];
  const problemFor = (id: string) =>
    refusedSaves > 0 || (id === timeId && timeLeft && timeOnForm.trim() !== "")
      ? (problems.find((problem) => problem.id === id)?.text ?? null)
      : null;
  return (
    <Sheet
      open={open}
      onClose={dismiss}
      initialFocusRef={typeRef}
      title="Record a form"
      description="Record the time written on the paper form"
      portal={false}
      testId="ward-legal-record"
      footer={
        <div className={own.foot}>
          <Button
            variant="ghost"
            onClick={() => {
              submissionVersion.current += 1;
              setSaving(false);
              clearDraft();
              onDraft({ form: "", movement: "" });
              setTimeOnForm("");
              setDateOnForm("");
              setRefusedSaves(0);
              setSaveRefusal(null);
              setTimeClearedNote(false);
              setFormKey((key) => key + 1);
            }}
          >
            Clear
          </Button>
          <Button
            variant="pri"
            data-testid="ward-legal-forms-register-confirm"
            disabledReason={saveBlockReason}
            title={saveBlockReason}
            onUnavailablePress={() => {
              if (problems.length > 0) setRefusedSaves((count) => count + 1);
            }}
            onClick={() => {
              if (saveBlockReason || parsedWrittenAt === null) return;
              const owner = draftSessionVersion();
              const submission = ++submissionVersion.current;
              setSaving(true);
              setSaveRefusal(null);
              const finish = (answer: boolean | string) => {
                if (submission !== submissionVersion.current) return;
                // Release this request's spinner even if its session has ended. The owner fence
                // still prevents an old acceptance from clearing or closing a newer draft.
                setSaving(false);
                if (owner !== draftSessionVersion()) return;
                if (answer === true) {
                  clearDraft();
                  setTimeOnForm("");
                  setDateOnForm("");
                  setRegion("");
                  setRefusedSaves(0);
                  setTimeClearedNote(false);
                  onDraft({ form: "", movement: "" });
                  onClose();
                } else {
                  // Refused: the typed values stay, and the reason shows here, not only behind the sheet.
                  setSaveRefusal(
                    typeof answer === "string" && answer ? answer : "Not recorded. Check the form and try again.",
                  );
                }
              };
              try {
                const result =
                  onSaveForm?.({
                    movementId: draft.movement,
                    formCode: draft.form,
                    writtenAt: parsedWrittenAt,
                    ...(draft.form === "1A" && region ? { region } : {}),
                  }) ?? false;
                if (typeof result === "boolean" || typeof result === "string") finish(result);
                else void result.then(finish, () => finish(false));
              } catch {
                finish(false);
              }
            }}
          >
            Save form
          </Button>
        </div>
      }
    >
      {!draftSaved ? <p role="status">Session recovery unavailable. This draft stays in memory in this tab.</p> : null}
      {draftRestored ? (
        <p role="status" className={own.draftNote}>
          Draft restored · Clear removes it
        </p>
      ) : null}
      <div key={formKey} className={styles.recordForm}>
        {refusedSaves > 0 ? <ErrorSummary items={problems} action="before saving" focusKey={refusedSaves} /> : null}
        <Field label="Movement" id={movementId} error={problemFor(movementId)}>
          <Select
            disabled={saving}
            value={draft.movement}
            onChange={(event) => {
              // A time typed before any movement was chosen is kept. Replacing a chosen movement
              // clears the time typed for it, and says so.
              const replacing = draft.movement !== "" && event.target.value !== draft.movement;
              if (replacing && (timeOnForm || dateOnForm)) {
                clearDraft();
                setTimeOnForm("");
                setDateOnForm("");
                setTimeClearedNote(true);
              } else setTimeClearedNote(false);
              onDraft({ ...draft, movement: event.target.value });
            }}
          >
            <option value="">Choose a movement</option>
            {openMovements.map((movement) => (
              <option key={movement.id} value={movement.id}>
                {labelOf(movement)}
              </option>
            ))}
          </Select>
        </Field>
        {timeClearedNote ? (
          <p className={styles.note} role="status" data-testid="ward-legal-forms-time-cleared">
            Time cleared because the patient changed.
          </p>
        ) : null}
        <Field label="Form type" id={typeId} error={problemFor(typeId)}>
          <Select
            ref={typeRef}
            disabled={saving}
            value={draft.form}
            onChange={(event) => onDraft({ ...draft, form: event.target.value })}
          >
            {/* MHA forms are never prefilled: the form type is chosen from the paper every time. */}
            <option value="">Choose a form type</option>
            {SELECTABLE_LEGAL_FORMS.map((form) => (
              <option key={form.code} value={form.code}>
                {legalFormName(form)}
              </option>
            ))}
          </Select>
        </Field>
        {draft.form === "1A" ? (
          <Field label="Region" id={`${typeId}-region`}>
            <Select
              disabled={saving}
              value={region}
              onChange={(event) => setRegion(event.target.value as "" | "metro" | "country")}
              data-testid="ward-legal-forms-record-region"
            >
              <option value="">Choose metro or country</option>
              <option value="metro">Metro</option>
              <option value="country">Country</option>
            </Select>
          </Field>
        ) : null}
        <div className={styles.fieldPair}>
          <Field label="Time on form" id={timeId} error={problemFor(timeId)}>
            <TextInput
              placeholder="HH:MM"
              inputMode="numeric"
              autoComplete="off"
              aria-required="true"
              disabled={saving}
              value={timeOnForm}
              onChange={(event) => setTimeOnForm(event.target.value)}
              onBlur={() => setTimeLeft(true)}
            />
          </Field>
          {dayZero ? (
            <Field
              label="Date on form"
              id={`${baseId}-legal-forms-new-date`}
              help={
                <>
                  Leave blank for today
                  <SrOnly>. Use it for a form written before midnight.</SrOnly>
                </>
              }
            >
              <TextInput
                type="date"
                data-testid="ward-legal-forms-new-date"
                autoComplete="off"
                disabled={saving}
                value={dateOnForm}
                onChange={(event) => setDateOnForm(event.target.value)}
              />
            </Field>
          ) : null}
        </div>
        {/* Redesign: one line, so nobody reads a deadline into the time typed here (D5, D-70). */}
        <p className={own.asWritten} data-testid="ward-legal-forms-record-as-written">
          Only the written time is recorded. No expiry is calculated.
        </p>
        {saveRefusal ? (
          <p className={styles.note} role="alert" data-testid="ward-legal-forms-record-refusal">
            {saveRefusal}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
