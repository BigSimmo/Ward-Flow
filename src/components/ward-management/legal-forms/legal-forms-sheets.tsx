"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useDirtyStateGuard } from "../use-dirty-state-guard";
import { draftSessionVersion, sessionDraftKey } from "../ward-session-drafts";
import { useOptionalWardFlowSelect } from "../ward-flow-provider";
import { ChevronLeft, Clock } from "lucide-react";

import {
  Badge,
  Button,
  DateField,
  ErrorSummary,
  Field,
  Select,
  Sheet,
  SrOnly,
  StatusGlyph,
  TextInput,
  cx,
  parseTypedDate,
  type ErrorSummaryItem,
} from "@/components/wf";
import { formatInstantWithDay, minuteOfDayFromClockText, type Instant } from "@/components/ward-management/ward-clock";
import { movementRefuses3C } from "@/components/ward-management/ward-legal-clock";
import { legalFormName, SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import type { Movement } from "@/components/ward-management/ward-model";
import { SupportNotificationChecklist } from "@/components/ward-management/movements/support-notification-checklist";
import {
  SUPPORT_NOTIFICATION_OCCASION_LABELS,
  SUPPORT_NOTIFICATION_PARTY_SHORT,
  type SupportNotificationParty,
} from "@/components/ward-management/ward-support-notifications";

import {
  CATALOGUE,
  STANDING_TONE,
  clockStanding,
  instantFromDateAndTimeInputs,
  receiptEventAccepts,
  isOwnedLegalFormCode,
  standingWord,
  type TellSubject,
} from "./legal-forms-view";
import styles from "./legal-forms.module.css";
import asWritten from "./legal-forms-add-time.module.css";
import { typedTimeLine } from "./legal-time-as-typed";

import { useDueSoonThresholds } from "@/components/ward-management/ward-flow-provider";
const MINUTES_PER_DAY = 1440;

/**
 * The time typed from the paper form, on the date typed beside it (blank date = today). A blank,
 * malformed, out-of-range or future time is refused (null): Ward Flow records only times a person
 * typed, never the save moment standing in for one, and a form cannot have been written after now.
 * The date lets a form written at 23:50 be recorded at 00:10 (audit 24-6 TC-03); it is read on the
 * Perth calendar through `instantFromDateAndTimeInputs`, the same reading the extend sheet uses.
 * The time is read by the shared clock rule, so "0930" from the iPhone number pad counts as 09:30.
 */
export function parseWrittenInstant(value: string, now: Instant, date = "", dayZero?: Date): Instant | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (date !== "") {
    if (!dayZero) return null;
    const dated = instantFromDateAndTimeInputs(date, trimmed, dayZero);
    return dated === undefined || dated > now ? null : dated;
  }
  const minuteOfDay = minuteOfDayFromClockText(trimmed);
  if (minuteOfDay === undefined) return null;
  const dayOffset = ((now % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const candidate = now - dayOffset + minuteOfDay;
  return candidate > now ? null : candidate;
}

/**
 * REQUIREMENTS. One place to read what each form is and what this prototype records for it. It
 * states nothing that the register or the engine does not already hold, and no Act period (owner,
 * 20 Oct 2026: the only due time is the one a person records from the form).
 */
export function RequirementsSheet({
  code,
  onCode,
  onClose,
}: {
  code: string | null;
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const current = CATALOGUE.find((entry) => entry.code === code) ?? CATALOGUE[0]!;
  const records = [
    ...(isOwnedLegalFormCode(current.code) ? ["Time written on the form"] : []),
    ...(receiptEventAccepts(current.code) ? ["Form received"] : []),
    ...(current.code === "1A" ? ["Examination, recorded on the emergency department screen"] : []),
  ];
  return (
    <Sheet
      open={code !== null}
      onClose={onClose}
      title="Form requirements"
      portal={false}
      testId="ward-legal-requirements"
      contentClassName={styles.wideSheet}
    >
      <div className={styles.reqBody}>
        <ul className={styles.reqList} aria-label="Forms">
          {CATALOGUE.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className={styles.reqItem}
                aria-pressed={entry.code === current.code}
                onClick={() => onCode(entry.code)}
              >
                <span className={styles.code}>{entry.code}</span>
                <span className={styles.reqTitle}>{entry.title}</span>
              </button>
            </li>
          ))}
        </ul>
        <section className={styles.reqDetail} aria-label={`Form ${current.code}`}>
          <span className={styles.eyebrow}>Form {current.code}</span>
          <h3 className={styles.reqHead}>{current.title}</h3>
          <p className={styles.note}>{current.tip}</p>
          <h4 className={styles.sectionHead}>Recorded in Ward Flow</h4>
          {records.length > 0 ? (
            <ul className={styles.checkList}>
              {records.map((label) => (
                <li key={label}>
                  <StatusGlyph tone="neutral" size={9} />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.note}>Nothing is recorded for this form in Ward Flow yet.</p>
          )}
          <h4 className={styles.sectionHead}>Due time</h4>
          <p className={styles.note} data-testid="ward-legal-requirements-due">
            Only the due time recorded from the form is shown. Ward Flow does not work out when a form ends.
          </p>
        </section>
      </div>
    </Sheet>
  );
}

export type RecordDraft = { form: string; movement: string };

/** RECORD A FORM. Attaches a selectable MHA 2014 form to an open movement. */
export function RecordFormSheet({
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
  // Text in the DD/MM/YYYY box that is not yet a real day. It never counts as blank (today).
  const [dateUnread, setDateUnread] = useState(false);
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
    isDirty: !!timeOnForm || !!dateOnForm || dateUnread || !!draft.movement,
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
      setRegion("");
      setSaving(false);
    }
    priorMovement.current = draft.movement;
  }, [draft.movement, clearDraft]);
  // Redesign (Josh, 31 Oct 2026): the movement first, then the form from the paper, then its time.
  const movementRef = useRef<HTMLSelectElement | null>(null);
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
            : dateUnread
              ? "Enter the date written on the form as DD/MM/YYYY, or leave it blank for today."
              : parsedWrittenAt === null
                ? dayZero && dateOnForm !== ""
                  ? "Enter the date and time written on the form, no later than now."
                  : "Enter the time written on the form as HH:MM, no later than now."
                : undefined);
  const typeId = `${baseId}-legal-forms-new-instrument`;
  const movementId = `${baseId}-legal-forms-new-movement`;
  const timeId = `${baseId}-legal-forms-new-time`;
  const dateId = `${baseId}-legal-forms-new-date`;
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
          ...(dateUnread
            ? [{ id: dateId, text: "Enter the date written on the form as DD/MM/YYYY, or leave it blank for today" }]
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
      initialFocusRef={movementRef}
      title="Record a form"
      description="Record the time written on the paper form"
      portal={false}
      testId="ward-legal-record"
      footer={
        <div className={styles.recordFoot}>
          <Button
            variant="ghost"
            onClick={() => {
              submissionVersion.current += 1;
              setSaving(false);
              clearDraft();
              onDraft({ form: "", movement: "" });
              setTimeOnForm("");
              setDateOnForm("");
              setDateUnread(false);
              setRegion("");
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
        <p role="status" className={styles.draftNote}>
          Draft restored · Clear removes it
        </p>
      ) : null}
      <div key={formKey} className={styles.recordForm}>
        {refusedSaves > 0 ? <ErrorSummary items={problems} action="before saving" focusKey={refusedSaves} /> : null}
        <Field label="Movement" id={movementId} error={problemFor(movementId)}>
          <Select
            ref={movementRef}
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
            {/* The HH:MM placeholder says it is a typed 24-hour time, so no clock icon. */}
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
              id={dateId}
              error={problemFor(dateId)}
              hint="DD/MM/YYYY"
              help={
                <>
                  Leave blank for today
                  <SrOnly>. Use it for a form written before midnight.</SrOnly>
                </>
              }
            >
              {/* The kit's typed DD/MM/YYYY box (bug list row 25), never the browser's date picker. */}
              <DateField
                data-testid="ward-legal-forms-new-date"
                disabled={saving}
                value={dateOnForm}
                onValueChange={setDateOnForm}
                onInput={(event) =>
                  setDateUnread(
                    parseTypedDate(event.currentTarget.value) === null && event.currentTarget.value.trim() !== "",
                  )
                }
              />
            </Field>
          ) : null}
        </div>
        {/* Redesign: one line, so nobody reads a deadline into the time typed here (D5, D-70). */}
        <p className={asWritten.asWritten} data-testid="ward-legal-forms-record-as-written">
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

/** EXTEND RECORDED FORM. Records the extended expiry typed from the form (not legally checked). */
type ExtendSheetProps = {
  target: Movement | null;
  label: string;
  now: Instant;
  onClose: () => void;
  extendUnavailable?: string;
  onExtendForm: (movement: Movement, dueAt: Instant) => boolean | Promise<boolean>;
  /** The provider's day zero, so a typed expiry date resolves to its Perth day (Audit 24-6 TC-01). */
  dayZero?: Date;
};

export function ExtendSheet(props: ExtendSheetProps) {
  return <ExtendSheetContent key={props.target?.id ?? "closed"} {...props} />;
}

function ExtendSheetContent({
  target,
  label,
  now,
  onClose,
  extendUnavailable,
  onExtendForm,
  dayZero,
}: ExtendSheetProps) {
  const thresholds = useDueSoonThresholds();
  const baseId = useId();
  const standing = target ? clockStanding(target, now, thresholds) : "none";
  const [expiryState, setExpiryState] = useState<{
    targetId: string | undefined;
    value: string;
    date?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const submissionVersion = useRef(0);
  useEffect(
    () => () => {
      submissionVersion.current += 1;
    },
    [],
  );
  const currentExpiry = expiryState && expiryState.targetId === target?.id ? expiryState : null;
  const expiryValue = currentExpiry?.value ?? "";
  const expiryDate = currentExpiry?.date ?? "";
  // Audit CS3-05 and TC2-01 (Josh, 26 Oct 2026, Part A 4): the date and time are both copied from
  // the form. Nothing is guessed from the time alone.
  const datedDueAt =
    expiryDate !== "" && dayZero
      ? (instantFromDateAndTimeInputs(expiryDate, expiryValue.trim(), dayZero) ?? null)
      : null;
  const parsedDueAt = target && datedDueAt !== null && datedDueAt > now ? datedDueAt : null;
  // Audit TC2-03: an extension earlier than the expiry already recorded is shown, not refused.
  const currentDueAt = target?.legalForm?.dueAt;
  const shortens = parsedDueAt !== null && currentDueAt !== undefined && parsedDueAt < currentDueAt;
  const extendBlockReason =
    (saving ? "Saving extension…" : undefined) ??
    extendUnavailable ??
    (datedDueAt !== null && datedDueAt <= now
      ? "The new expiry written on the form is already past. Check the date and time."
      : undefined) ??
    (parsedDueAt === null ? "Enter the new expiry date and time written on the form." : undefined);
  // Dismissing without saving drops the typed expiry, so it never greets the next patient's form.
  const dismiss = () => {
    if (pending.current) return;
    setExpiryState(null);
    onClose();
  };
  return (
    <Sheet
      open={target !== null}
      onClose={dismiss}
      title="Extend recorded form"
      description="Extension is recorded, not legally checked"
      portal={false}
      testId="ward-legal-extend"
      footer={
        <div className={styles.sheetFoot}>
          <Button variant="ghost" onClick={dismiss}>
            Cancel
          </Button>
          <span className={styles.footSpacer} />
          <Button
            variant="pri"
            data-testid="ward-legal-forms-renew-confirm"
            disabledReason={extendBlockReason}
            title={extendBlockReason}
            onClick={() => {
              if (extendBlockReason || pending.current || !target || parsedDueAt === null) return;
              const owner = draftSessionVersion();
              const submission = ++submissionVersion.current;
              pending.current = true;
              setSaving(true);
              const finish = (accepted: boolean) => {
                if (submission !== submissionVersion.current) return;
                pending.current = false;
                setSaving(false);
                if (owner !== draftSessionVersion()) return;
                if (accepted) {
                  setExpiryState(null);
                  onClose();
                }
              };
              try {
                const result = onExtendForm(target, parsedDueAt);
                if (typeof result === "boolean") finish(result);
                else void result.then(finish, () => finish(false));
              } catch {
                finish(false);
              }
            }}
          >
            Confirm extension
          </Button>
        </div>
      }
    >
      {target ? (
        <div className={styles.extendBody}>
          {target.legalForm?.dueAt !== undefined ? (
            <div className={styles.dueLine}>
              <Badge tone={STANDING_TONE[standing]}>{standingWord(standing, thresholds)}</Badge>
              {/* Legal times only as typed (31 Oct 2026): the typed time in words, never a countdown. */}
              <span className={styles.mono}>{typedTimeLine(target.legalForm.dueAt, now)}</span>
              <span className={styles.meta}>{target.legalForm ? legalFormName(target.legalForm) : ""}</span>
            </div>
          ) : null}
          <Field label="Target movement" id={`${baseId}-legal-forms-renew-movement`}>
            <TextInput locked readOnly value={label} />
          </Field>
          <div className={styles.fieldPair}>
            <Field label="New expiry date" id={`${baseId}-legal-forms-renew-date`} hint="DD/MM/YYYY">
              {/* The kit's typed DD/MM/YYYY box (bug list row 25), never the browser's date picker. */}
              <DateField
                data-testid="ward-legal-forms-renew-date"
                aria-required="true"
                disabled={saving}
                value={expiryDate}
                onValueChange={(date) => setExpiryState({ targetId: target.id, value: expiryValue, date })}
              />
            </Field>
            <Field label="New expiry time" id={`${baseId}-legal-forms-renew-expiry`}>
              <TextInput
                data-testid="ward-legal-forms-renew-expiry"
                icon={Clock}
                placeholder="HH:MM"
                inputMode="numeric"
                autoComplete="off"
                aria-required="true"
                disabled={saving}
                value={expiryValue}
                onChange={(event) =>
                  setExpiryState({ targetId: target.id, value: event.target.value, date: expiryDate })
                }
              />
            </Field>
          </div>
          {parsedDueAt !== null ? (
            // The resolved day is shown before Confirm records it.
            <p className={styles.note} role="status" data-testid="ward-legal-forms-renew-resolved">
              Records the new expiry as {formatInstantWithDay(parsedDueAt, now)}.
              {shortens && currentDueAt !== undefined
                ? ` This is earlier than the expiry already recorded (${formatInstantWithDay(currentDueAt, now)}). Check the form.`
                : null}
            </p>
          ) : null}
          <p className={styles.note}>Ward Flow does not notify the owner. Tell {target.owner} separately.</p>
        </div>
      ) : null}
    </Sheet>
  );
}

/**
 * TELL PEOPLE. Either the queue for one party (the header's Tell PSP), or one move's carer, PSP
 * and MHAS checklist from PR #159. The checklist is the existing component; this sheet only
 * chooses which move it shows.
 */
export function TellSheet({
  open,
  party,
  subjects,
  subjectKey,
  onSubject,
  onClose,
  now,
}: {
  open: boolean;
  /** The queue's party, or null when the sheet opened straight on one move. */
  party: SupportNotificationParty | null;
  subjects: TellSubject[];
  subjectKey: string | null;
  onSubject: (key: string | null) => void;
  onClose: () => void;
  now: Instant;
}) {
  const subject = subjects.find((entry) => entry.key === subjectKey) ?? null;
  const queue = party ? subjects.filter((entry) => entry.missing.includes(party)) : [];
  const title = party && !subject ? `Tell ${SUPPORT_NOTIFICATION_PARTY_SHORT[party]}` : "Tell people";
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description="Advisory only. Nothing is blocked."
      portal={false}
      testId="ward-legal-tell"
      footer={
        <div className={styles.sheetFoot}>
          {party && subject ? (
            <Button variant="ghost" icon={ChevronLeft} onClick={() => onSubject(null)}>
              Back to the list
            </Button>
          ) : null}
          <span className={styles.footSpacer} />
          <Button variant="sec" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      {subject ? (
        <div className={styles.tellBody}>
          <div className={styles.tellWho}>
            <strong>{subject.name}</strong>
            <span className={styles.meta}>
              <span className={styles.mono}>{subject.umrn}</span> ·{" "}
              {SUPPORT_NOTIFICATION_OCCASION_LABELS[subject.occasion]} · {subject.place} ·{" "}
              {formatInstantWithDay(subject.completedAt, now)}
            </span>
          </div>
          <SupportNotificationChecklist
            movementId={subject.occasion === "discharge" ? undefined : subject.movementId}
            admissionId={subject.occasion === "discharge" ? subject.admissionId : undefined}
            role="coordinator"
          />
        </div>
      ) : queue.length > 0 ? (
        <ul className={styles.queue} aria-label={title}>
          {queue.map((entry) => (
            <li key={entry.key} className={styles.queueRow}>
              <span className={styles.cellStack}>
                <span className={styles.name}>{entry.name}</span>
                <span className={styles.sub}>
                  <span className={styles.mono}>{entry.umrn}</span> ·{" "}
                  {SUPPORT_NOTIFICATION_OCCASION_LABELS[entry.occasion]} · {entry.place}
                </span>
              </span>
              <span className={cx(styles.sub, styles.mono)}>{formatInstantWithDay(entry.completedAt, now)}</span>
              <Button size="sm" variant="sec" onClick={() => onSubject(entry.key)}>
                Record
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.absent}>
          {party ? `Every recent move has a ${SUPPORT_NOTIFICATION_PARTY_SHORT[party]} record.` : "Nothing to record."}
        </p>
      )}
    </Sheet>
  );
}

/** The label a movement carries in pickers: name, UMRN and its form. */
export function movementPickerLabel(name: string, umrn: string, movement: Movement): string {
  return `${name} (${umrn}), ${movement.legalForm ? `Form ${movement.legalForm.code}` : "Voluntary"}`;
}
