"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useDirtyStateGuard } from "../use-dirty-state-guard";
import { draftSessionVersion, sessionDraftKey } from "../ward-session-drafts";
import { useOptionalWardFlowSelect } from "../ward-flow-provider";
import { ChevronLeft, Clock } from "lucide-react";

import {
  Badge,
  Button,
  ErrorSummary,
  Field,
  Select,
  Sheet,
  StatusGlyph,
  TextInput,
  Textarea,
  Timer,
  cx,
  type ErrorSummaryItem,
} from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
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

import { useDueSoonThresholds } from "@/components/ward-management/ward-flow-provider";
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 1440;

/**
 * The time typed from the paper form, on the date typed beside it (blank date = today). A blank,
 * malformed, out-of-range or future time is refused (null): Ward Flow records only times a person
 * typed, never the save moment standing in for one, and a form cannot have been written after now.
 * The date lets a form written at 23:50 be recorded at 00:10 (audit 24-6 TC-03); it is read on the
 * Perth calendar through `instantFromDateAndTimeInputs`, the same reading the extend sheet uses.
 */
export function parseWrittenInstant(value: string, now: Instant, date = "", dayZero?: Date): Instant | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (date !== "") {
    if (!dayZero || !/^\d{1,2}:\d{2}$/.test(trimmed)) return null;
    const dated = instantFromDateAndTimeInputs(date, trimmed, dayZero);
    return dated === undefined || dated > now ? null : dated;
  }
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  const dayOffset = ((now % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const startOfDay = now - dayOffset;
  const candidate = startOfDay + hours * 60 + minutes;
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
      description="What each form is and what Ward Flow records for it"
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
            Only the due time someone records from the form is shown. Ward Flow does not work out when a form ends.
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
  onSaveForm?: (input: { movementId: string; formCode: string; writtenAt: Instant }) => boolean | Promise<boolean>;
  /** The movement a patient record's "Record a form" link opened the sheet for (&record=1). */
  targetMovement?: string;
}) {
  // Bumped by Clear to remount the uncontrolled clinician, time and notes fields.
  const [formKey, setFormKey] = useState(0);
  const [timeOnForm, setTimeOnForm] = useState("");
  const [dateOnForm, setDateOnForm] = useState("");
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
          ...(typeProblem ? [{ id: typeId, text: typeProblem }] : []),
          ...(!draft.movement ? [{ id: movementId, text: "Choose a movement" }] : []),
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
      description="Attach a form to an open movement and record the time written on the paper"
      portal={false}
      testId="ward-legal-record"
      footer={
        <div className={styles.sheetFoot}>
          <Button
            variant="ghost"
            onClick={() => {
              submissionVersion.current += 1;
              setSaving(false);
              clearDraft();
              onDraft({ form: SELECTABLE_LEGAL_FORMS[0]?.code ?? "", movement: "" });
              setTimeOnForm("");
              setDateOnForm("");
              setRefusedSaves(0);
              setFormKey((key) => key + 1);
            }}
          >
            Clear
          </Button>
          <span className={styles.footSpacer} />
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
              const finish = (accepted: boolean) => {
                if (submission !== submissionVersion.current) return;
                // Release this request's spinner even if its session has ended. The owner fence
                // still prevents an old acceptance from clearing or closing a newer draft.
                setSaving(false);
                if (owner !== draftSessionVersion()) return;
                if (accepted) {
                  clearDraft();
                  setTimeOnForm("");
                  setDateOnForm("");
                  setRefusedSaves(0);
                  onDraft({ form: SELECTABLE_LEGAL_FORMS[0]?.code ?? "", movement: "" });
                  onClose();
                }
              };
              try {
                const result =
                  onSaveForm?.({ movementId: draft.movement, formCode: draft.form, writtenAt: parsedWrittenAt }) ??
                  false;
                if (typeof result === "boolean") finish(result);
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
      {draftRestored ? <p role="status">Draft restored from this session — use Clear to remove it.</p> : null}
      <div key={formKey} className={styles.recordForm}>
        {refusedSaves > 0 ? <ErrorSummary items={problems} action="before saving" focusKey={refusedSaves} /> : null}
        <Field label="Form type" id={typeId} error={problemFor(typeId)}>
          <Select
            ref={typeRef}
            disabled={saving}
            value={draft.form}
            onChange={(event) => onDraft({ ...draft, form: event.target.value })}
          >
            {SELECTABLE_LEGAL_FORMS.map((form) => (
              <option key={form.code} value={form.code}>
                {legalFormName(form)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Movement" id={movementId} error={problemFor(movementId)}>
          <Select
            disabled={saving}
            value={draft.movement}
            onChange={(event) => {
              clearDraft();
              setTimeOnForm("");
              setDateOnForm("");
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
        <div className={styles.fieldPair}>
          <Field label="Clinician" id={`${baseId}-legal-forms-new-clinician`}>
            <TextInput locked readOnly placeholder="Not stored in prototype (D6)" autoComplete="off" />
          </Field>
          <Field label="Time on form" id={timeId} error={problemFor(timeId)}>
            <TextInput
              icon={Clock}
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
        </div>
        {dayZero ? (
          <Field
            label="Date on form"
            id={`${baseId}-legal-forms-new-date`}
            help="Leave blank for today. Use it for a form written before midnight."
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
        <Field label="Notes" id={`${baseId}-legal-forms-new-notes`}>
          <Textarea
            readOnly
            disabled
            maxLength={280}
            rows={2}
            placeholder="Free-text grounds are not stored in prototype (D6)"
            data-gramm="false"
            data-enable-grammarly="false"
            spellCheck={false}
            autoComplete="off"
          />
        </Field>
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
              <Timer
                at={target.legalForm.dueAt * MS_PER_MINUTE}
                now={now * MS_PER_MINUTE}
                direction="left"
                hideFlagWord
              />
              <span className={styles.meta}>{target.legalForm ? legalFormName(target.legalForm) : ""}</span>
            </div>
          ) : null}
          <Field label="Target movement" id={`${baseId}-legal-forms-renew-movement`}>
            <TextInput locked readOnly value={label} />
          </Field>
          <Field label="Authorising specialist" id={`${baseId}-legal-forms-renew-specialist`}>
            <TextInput locked readOnly placeholder="Not stored in prototype (D6)" autoComplete="off" />
          </Field>
          <div className={styles.fieldPair}>
            <Field label="New expiry date" id={`${baseId}-legal-forms-renew-date`}>
              <TextInput
                type="date"
                data-testid="ward-legal-forms-renew-date"
                autoComplete="off"
                aria-required="true"
                disabled={saving}
                value={expiryDate}
                onChange={(event) =>
                  setExpiryState({ targetId: target.id, value: expiryValue, date: event.target.value })
                }
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
          <Field label="Justification" id={`${baseId}-legal-forms-renew-justification`}>
            <Textarea
              readOnly
              disabled
              maxLength={280}
              rows={3}
              placeholder="Free-text justification is not stored in prototype (D6)"
              data-gramm="false"
              data-enable-grammarly="false"
              spellCheck={false}
              autoComplete="off"
            />
          </Field>
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
      description="Records who was told and when. Advisory only, nothing is blocked."
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
