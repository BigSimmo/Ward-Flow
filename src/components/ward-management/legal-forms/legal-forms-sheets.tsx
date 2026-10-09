"use client";

import { useRef, useState } from "react";
import { ChevronLeft, Clock } from "lucide-react";

import {
  Badge,
  Button,
  Checkbox,
  Field,
  Select,
  Sheet,
  StatusGlyph,
  TextInput,
  Textarea,
  Timer,
  cx,
} from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { legalFormName, SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import type { Movement } from "@/components/ward-management/ward-model";
import { SupportNotificationChecklist } from "@/components/ward-management/movements/support-notification-checklist";
import {
  SUPPORT_NOTIFICATION_OCCASION_LABELS,
  SUPPORT_NOTIFICATION_PARTY_SHORT,
  type SupportNotificationParty,
} from "@/components/ward-management/ward-support-notifications";

import { actPeriodFor, actPeriodSentence } from "./act-periods-demo";
import {
  CATALOGUE,
  NOT_WIRED,
  STANDING_TONE,
  clockStanding,
  needsExamination,
  receiptEventAccepts,
  isOwnedLegalFormCode,
  standingWord,
  type TellSubject,
} from "./legal-forms-view";
import styles from "./legal-forms.module.css";

const MS_PER_MINUTE = 60_000;

/**
 * REQUIREMENTS. One place to read what each form is, what this prototype records for it, and the
 * labelled Act-period demo (D-29). It states nothing that the register, the demo file or the
 * engine does not already hold.
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
  const period = actPeriodFor(current.code);
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
          <h4 className={styles.sectionHead}>Period</h4>
          {period ? (
            <p className={styles.demoNote} data-testid="ward-legal-requirements-period">
              {actPeriodSentence(period)}
            </p>
          ) : (
            <p className={styles.note}>No period is held for this form in the demo.</p>
          )}
        </section>
      </div>
    </Sheet>
  );
}

export type RecordDraft = { form: string; movement: string };

/** RECORD A FORM. The picker is real; saving is not wired (D4) and says so. */
export function RecordFormSheet({
  open,
  onClose,
  draft,
  onDraft,
  openMovements,
  labelOf,
}: {
  open: boolean;
  onClose: () => void;
  draft: RecordDraft;
  onDraft: (draft: RecordDraft) => void;
  openMovements: Movement[];
  labelOf: (movement: Movement) => string;
}) {
  // Bumped by Clear to remount the uncontrolled clinician, time and notes fields.
  const [formKey, setFormKey] = useState(0);
  const typeRef = useRef<HTMLSelectElement | null>(null);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      initialFocusRef={typeRef}
      title="Record a form"
      description="Saving a new form is not wired in this prototype"
      portal={false}
      testId="ward-legal-record"
      footer={
        <div className={styles.sheetFoot}>
          <Button
            variant="ghost"
            onClick={() => {
              onDraft({ form: SELECTABLE_LEGAL_FORMS[0]?.code ?? "", movement: "" });
              setFormKey((key) => key + 1);
            }}
          >
            Clear
          </Button>
          <span className={styles.footSpacer} />
          <Button
            variant="pri"
            data-testid="ward-legal-forms-register-confirm"
            disabledReason={NOT_WIRED}
            title={NOT_WIRED}
          >
            Save form
          </Button>
        </div>
      }
    >
      <div key={formKey} className={styles.recordForm}>
        <Field label="Form type" id="legal-forms-new-instrument">
          <Select
            ref={typeRef}
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
        <Field label="Movement" id="legal-forms-new-movement">
          <Select value={draft.movement} onChange={(event) => onDraft({ ...draft, movement: event.target.value })}>
            <option value="">Choose a movement</option>
            {openMovements.map((movement) => (
              <option key={movement.id} value={movement.id}>
                {labelOf(movement)}
              </option>
            ))}
          </Select>
        </Field>
        <div className={styles.fieldPair}>
          <Field label="Clinician" id="legal-forms-new-clinician">
            <TextInput placeholder="Name and role" autoComplete="off" />
          </Field>
          <Field label="Time on form" id="legal-forms-new-time">
            <TextInput icon={Clock} placeholder="HH:MM" inputMode="numeric" autoComplete="off" />
          </Field>
        </div>
        <Field label="Notes" id="legal-forms-new-notes">
          <Textarea
            maxLength={280}
            rows={2}
            placeholder="Grounds as written on the form"
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

/** EXTEND RECORDED FORM. Recorded, not legally checked, and not wired (D4). */
export function ExtendSheet({
  target,
  label,
  now,
  onClose,
}: {
  target: Movement | null;
  label: string;
  now: Instant;
  onClose: () => void;
}) {
  const standing = target ? clockStanding(target, now) : "none";
  return (
    <Sheet
      open={target !== null}
      onClose={onClose}
      title="Extend recorded form"
      description="Extension is recorded, not legally checked"
      portal={false}
      testId="ward-legal-extend"
      footer={
        <div className={styles.sheetFoot}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <span className={styles.footSpacer} />
          <Button
            variant="pri"
            data-testid="ward-legal-forms-renew-confirm"
            disabledReason={NOT_WIRED}
            title={NOT_WIRED}
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
              <Badge tone={STANDING_TONE[standing]}>{standingWord(standing)}</Badge>
              <Timer
                at={target.legalForm.dueAt * MS_PER_MINUTE}
                now={now * MS_PER_MINUTE}
                direction="left"
                hideFlagWord
              />
              <span className={styles.meta}>{target.legalForm ? legalFormName(target.legalForm) : ""}</span>
            </div>
          ) : null}
          <Field label="Target movement" id="legal-forms-renew-movement">
            <TextInput locked readOnly value={label} />
          </Field>
          <Field label="Authorising specialist" id="legal-forms-renew-specialist">
            <TextInput placeholder="Specialist name and role" autoComplete="off" />
          </Field>
          <Field label="Justification" id="legal-forms-renew-justification">
            <Textarea
              maxLength={280}
              rows={3}
              placeholder="Clinical justification for the recorded extension"
              data-gramm="false"
              data-enable-grammarly="false"
              spellCheck={false}
              autoComplete="off"
            />
          </Field>
          <Checkbox label={`Tell the owner, ${target.owner}`} defaultChecked />
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

/** True when this movement offers any recorded fact on this page. */
export function offersRecording(movement: Movement): boolean {
  return (
    isOwnedLegalFormCode(movement.legalForm?.code) ||
    receiptEventAccepts(movement.legalForm?.code) ||
    needsExamination(movement)
  );
}
