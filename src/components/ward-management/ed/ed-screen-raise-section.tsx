"use client";

// "Ask for a bed": the form that raises a movement from a referral in this department's
// inbox. Split out of `ed-screen.tsx` unchanged (fix list 2.5 and 9.6, 15 Oct 2026).
import { securityWord } from "@/components/ward-management/ward-model-vocabulary";
import { useRef, useState } from "react";
import { DateField, DisabledReason, type ChoiceItem, type ListPickerOption } from "@/components/wf";
import { legalFormName, SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import { legalFormStatusWarning } from "@/components/ward-management/ward-legal-form-fit";
import {
  TENTATIVE_DIAGNOSIS_BLOCKS,
  tentativeDiagnosisPhrase,
  type TentativeDiagnosisBlock,
} from "@/components/ward-management/ward-diagnosis";
import type {
  Cohort,
  LegalStatus,
  RecordedSex,
  ReferralGender,
  Security,
} from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { referralDraftBlockedReason, referralDraftMissingFields, type ReferralDraftField } from "./ed-blocked-reasons";
import missingStyles from "./ed-raise-missing.module.css";
import { EdPickerField, EdSegmentedField, EdTimeBox } from "./ed-referral-choices";
import { EdReferralPatientField } from "./ed-referral-patient-field";
import type { EdScreenContext } from "./ed-screen-context";
import {
  COHORT_OPTIONS,
  DEFAULT_DRAFT,
  firstSentence,
  GENDER_NOT_RECORDED_VALUE,
  GENDER_OPTIONS,
  LEGAL_STATUS_OPTIONS,
  NO_COHORT_VALUE,
  NO_DIAGNOSIS_VALUE,
  NO_SECURITY_VALUE,
  SECURITY_OPTIONS,
  SEX_OPTIONS,
  URGENCY_OPTIONS,
} from "./ed-screen-model";
import styles from "./ed.module.css";
import {
  INTERMITTENT_INTERVAL_MINUTES,
  OBSERVATION_LEVELS,
  observationLevelName,
  observationRatio,
  type ObservationLevel,
} from "@/components/ward-management/ward-observation";

// L31 (Josh, 3 Nov 2026): kit choices in place of the browser's drop-downs. A few answers are a
// segmented control, a longer list the kit list picker. Nothing is chosen for the person.
const COHORT_ITEMS: ChoiceItem<Cohort>[] = COHORT_OPTIONS.map((option) => ({ id: option, label: option }));
const SECURITY_ITEMS: ChoiceItem<Security>[] = SECURITY_OPTIONS.map((option) => ({
  id: option,
  label: securityWord(option),
}));
const SEX_PICKER_OPTIONS: ListPickerOption[] = SEX_OPTIONS.map((option) => ({ value: option, label: option }));
const GENDER_PICKER_OPTIONS: ListPickerOption[] = [
  ...GENDER_OPTIONS.map((option) => ({ value: option, label: option })),
  { value: GENDER_NOT_RECORDED_VALUE, label: "Not yet recorded" },
];
const DIAGNOSIS_PICKER_OPTIONS: ListPickerOption[] = TENTATIVE_DIAGNOSIS_BLOCKS.map((block) => ({
  value: block.code,
  label: tentativeDiagnosisPhrase(block.code) ?? block.label,
}));
const LEGAL_STATUS_PICKER_OPTIONS: ListPickerOption[] = LEGAL_STATUS_OPTIONS.map((option) => ({
  value: option,
  label: option,
}));
const LEGAL_FORM_PICKER_OPTIONS: ListPickerOption[] = SELECTABLE_LEGAL_FORMS.map((form) => ({
  value: form.code,
  label: legalFormName(form),
}));
const URGENCY_PICKER_OPTIONS: ListPickerOption[] = URGENCY_OPTIONS.map((option) => ({
  value: String(option),
  label: urgencyTierLabel(option),
}));
const OBSERVATION_PICKER_OPTIONS: ListPickerOption[] = OBSERVATION_LEVELS.map((level) => ({
  value: level,
  label: observationRatio(level)
    ? `${observationLevelName(level)} (${observationRatio(level)})`
    : observationLevelName(level),
}));
const INTERVAL_ITEMS: ChoiceItem<string>[] = INTERMITTENT_INTERVAL_MINUTES.map((minutes) => ({
  id: String(minutes),
  label: `${minutes} minutes`,
}));
const REVIEW_DAY_ITEMS: ChoiceItem<"today" | "tomorrow">[] = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
];

export function EdRaiseIntoMovementSection({ ctx }: { ctx: EdScreenContext }) {
  const { referralOpen, setReferralOpen, setRaisingFromReferralId, setDraft } = ctx;
  return (
    <section
      id="ward-ed-referral-intake"
      aria-label="Ask for a bed"
      hidden={!referralOpen}
      className={`${styles.panel} ${styles.full} ${styles.listSection} ${styles.referralBarSection}`}
    >
      <div className={styles.ph}>
        <h2>Ask for a bed</h2>
        <button
          type="button"
          className={styles.inboxBtn}
          onClick={() => {
            // Close discards the draft, as Cancel does, so nothing answered for this person is
            // waiting on the form when it next opens for someone else.
            setReferralOpen(false);
            setDraft(DEFAULT_DRAFT);
            setRaisingFromReferralId(undefined);
          }}
        >
          Close
        </button>
      </div>
      {/* Keyed to the referral it was opened for: "Ask for a bed" on another referral while the
          form is open starts a fresh form for that person, never the last one's (audit, 1 Nov 2026). */}
      {referralOpen && <EdRaiseIntoMovementForm key={ctx.raisingFromReferralId ?? "no-referral"} ctx={ctx} />}
    </section>
  );
}

/** What each unanswered question is called in the "Still to answer" list. */
const MISSING_FIELD_LABELS: Record<ReferralDraftField, string> = {
  patient: "Patient",
  cohort: "Cohort",
  security: "Security",
  sex: "Sex",
  gender: "Gender",
  legalStatus: "Legal status",
  urgency: "Urgency",
  observation: "Observation level",
  observationReviewTime: "Observation review time",
  highAcuity: "High-acuity nursing",
  legalFormDueAtDate: "Expiry date",
  legalFormDueAtTime: "Expiry time",
};

/** The control that takes focus for each unanswered question (the first radio of a pair). */
const MISSING_FIELD_TEST_IDS: Record<ReferralDraftField, string> = {
  patient: "ward-ed-referral-patient",
  cohort: "ward-ed-referral-cohort",
  security: "ward-ed-referral-security",
  sex: "ward-ed-referral-sex",
  gender: "ward-ed-referral-gender",
  legalStatus: "ward-ed-referral-legal-status",
  urgency: "ward-ed-referral-urgency",
  observation: "ward-ed-referral-observation",
  observationReviewTime: "ward-ed-referral-observation-review-time",
  highAcuity: "ward-ed-referral-high-acuity-required",
  legalFormDueAtDate: "ward-ed-referral-legal-form-due-at-date",
  legalFormDueAtTime: "ward-ed-referral-legal-form-due-at-time",
};

/**
 * The form itself, mounted only while open, so a closed and reopened form starts unmarked.
 *
 * Overall review (20 Oct 2026, DA-12 follow-up): a blocked Send, by click or by Enter, now marks
 * every unanswered question (`aria-invalid`, a red edge and "Not answered"), lists them under the
 * button and moves focus to the first, as the registration form does. Nothing is filed.
 */
function EdRaiseIntoMovementForm({ ctx }: { ctx: EdScreenContext }) {
  const {
    setReferralOpen,
    setRaisingFromReferralId,
    draft,
    setDraft,
    registryPatients,
    submitReferral,
    referralFieldsDisabled,
    referralSaveMessage,
  } = ctx;
  const formRef = useRef<HTMLFormElement>(null);
  const [attempted, setAttempted] = useState(false);
  const answers = { ...draft, patientFound: draft.patientId !== undefined };
  const referralBlocked = referralDraftBlockedReason(answers);
  const missing = attempted ? referralDraftMissingFields(answers) : [];
  const isMissing = (field: ReferralDraftField) => missing.includes(field);
  const fieldClass = (field: ReferralDraftField, base: string) =>
    isMissing(field) ? `${base} ${missingStyles.missing}` : base;
  const missingNote = (field: ReferralDraftField) =>
    isMissing(field) ? (
      <span className={missingStyles.note} aria-hidden="true">
        Not answered
      </span>
    ) : null;

  // A pair of radios cannot carry \`aria-invalid\`, so its group is described by the note instead.
  const missingNoteId = (field: ReferralDraftField) => `ward-ed-referral-missing-${field}`;
  const groupMissingNote = (field: ReferralDraftField) =>
    isMissing(field) ? (
      <span className={missingStyles.note} id={missingNoteId(field)}>
        Not answered
      </span>
    ) : null;

  function showMissingFields() {
    setAttempted(true);
    const first = referralDraftMissingFields(answers)[0];
    if (!first) return;
    const target = formRef.current?.querySelector<HTMLElement>(`[data-testid="${MISSING_FIELD_TEST_IDS[first]}"]`);
    // A segmented question's test id is on its wrapper, so focus goes to its tab stop.
    const focusable = target?.matches("button, input, select, textarea")
      ? target
      : target?.querySelector<HTMLElement>('[tabindex="0"]');
    focusable?.focus();
  }

  return (
    <div className={styles.referralPanelBody}>
      <form
        ref={formRef}
        className={styles.referralForm}
        onSubmit={(event) => {
          if (referralBlocked) {
            event.preventDefault();
            showMissingFields();
            return;
          }
          submitReferral(event);
        }}
        data-testid="ward-ed-referral-form"
      >
        <fieldset
          className={`${styles.declineFieldset} ${styles.referralGrid} ${missingStyles.saveFields}`}
          disabled={referralFieldsDisabled}
          aria-label="Referral details"
        >
          <EdReferralPatientField
            patients={registryPatients}
            patientId={draft.patientId}
            unidentified={draft.unidentified}
            invalid={isMissing("patient")}
            className={isMissing("patient") ? missingStyles.missing : undefined}
            onChange={(next) =>
              setDraft((current) => {
                const record = registryPatients.find((candidate) => candidate.id === next.patientId);
                const recordSex = SEX_OPTIONS.find((option) => option === record?.sex);
                const recordGender = GENDER_OPTIONS.find((option) => option === record?.gender);
                // A value that still matches the previous person's record was prefilled, not
                // chosen, so it follows the person; a value the clinician changed is kept.
                const previous = registryPatients.find((candidate) => candidate.id === current.patientId);
                const sexPrefilled = current.sex === undefined || current.sex === previous?.sex;
                const genderPrefilled = current.gender === undefined || current.gender === previous?.gender;
                return {
                  ...current,
                  ...next,
                  sex: sexPrefilled ? recordSex : current.sex,
                  gender: genderPrefilled ? recordGender : current.gender,
                };
              })
            }
          />
          <EdSegmentedField<Cohort>
            label="Cohort"
            testId="ward-ed-referral-cohort"
            items={COHORT_ITEMS}
            value={draft.cohort ?? NO_COHORT_VALUE}
            missing={isMissing("cohort")}
            onChange={(cohort) => setDraft((current) => ({ ...current, cohort }))}
          />
          <EdSegmentedField<Security>
            label="Security"
            testId="ward-ed-referral-security"
            items={SECURITY_ITEMS}
            value={draft.security ?? NO_SECURITY_VALUE}
            missing={isMissing("security")}
            onChange={(security) => setDraft((current) => ({ ...current, security }))}
          />
          <EdPickerField
            label="Sex"
            testId="ward-ed-referral-sex"
            name="ward-ed-referral-sex"
            options={SEX_PICKER_OPTIONS}
            placeholder="Choose"
            value={draft.sex ?? null}
            missing={isMissing("sex")}
            onChange={(sex) =>
              setDraft((current) => ({ ...current, sex: sex === null ? undefined : (sex as RecordedSex) }))
            }
            note={missingNote("sex")}
          />
          {/* T11 (after T10, item 8, owner answer 17 September 2026): "Gender (decides which bed)",
              so a clinician never confuses this with the "Sex" question above it. */}
          <EdPickerField
            label="Gender (decides which bed)"
            testId="ward-ed-referral-gender"
            name="ward-ed-referral-gender"
            options={GENDER_PICKER_OPTIONS}
            placeholder="Choose"
            value={draft.gender ?? null}
            missing={isMissing("gender")}
            onChange={(gender) =>
              setDraft((current) => ({
                ...current,
                gender: gender === null ? undefined : (gender as ReferralGender | typeof GENDER_NOT_RECORDED_VALUE),
              }))
            }
            note={missingNote("gender")}
          />
          {/* T15 (item 12, owner answer 17 September 2026): optional, and never blocks the send. */}
          <EdPickerField
            label="Broad diagnosis (tentative)"
            testId="ward-ed-referral-tentative-diagnosis"
            name="ward-ed-referral-tentative-diagnosis"
            options={DIAGNOSIS_PICKER_OPTIONS}
            placeholder="Not recorded"
            value={draft.tentativeDiagnosis === NO_DIAGNOSIS_VALUE ? null : draft.tentativeDiagnosis}
            onChange={(code) =>
              setDraft((current) => ({
                ...current,
                tentativeDiagnosis: code === null ? NO_DIAGNOSIS_VALUE : (code as TentativeDiagnosisBlock),
              }))
            }
          />
          <EdPickerField
            label="Legal status"
            testId="ward-ed-referral-legal-status"
            name="ward-ed-referral-legal-status"
            options={LEGAL_STATUS_PICKER_OPTIONS}
            placeholder="Choose"
            value={draft.legalStatus ?? null}
            missing={isMissing("legalStatus")}
            onChange={(legalStatus) =>
              setDraft((current) => ({
                ...current,
                legalStatus: legalStatus === null ? undefined : (legalStatus as LegalStatus),
              }))
            }
            note={missingNote("legalStatus")}
          />
          <EdPickerField
            label="Legal form"
            testId="ward-ed-referral-legal-form"
            name="ward-ed-referral-legal-form"
            options={LEGAL_FORM_PICKER_OPTIONS}
            placeholder="No form"
            value={draft.legalFormCode ?? null}
            onChange={(code) =>
              setDraft((current) =>
                // The kit picker reports a pick of the form already chosen, so keep its expiry then.
                code === current.legalFormCode
                  ? current
                  : { ...current, legalFormCode: code, legalFormDueAtDate: "", legalFormDueAtTime: "" },
              )
            }
            note={(() => {
              // Finding 6 (Josh, 27 Oct 2026): a form that contradicts the status warns, never blocks.
              const formMismatch = legalFormStatusWarning(draft.legalStatus, draft.legalFormCode);
              return formMismatch ? (
                <span role="status" className={styles.accessWarning} data-testid="ward-ed-referral-legal-form-mismatch">
                  {formMismatch} You can still ask for a bed.
                </span>
              ) : null;
            })()}
          />
          {draft.legalFormCode !== null ? (
            <fieldset className={styles.declineFieldset}>
              <legend className={styles.declineLegend}>Expiry written on the form (optional)</legend>
              <p className={styles.cardMeta}>Leave blank if the form has no expiry or you do not have it yet.</p>
              <label className={fieldClass("legalFormDueAtDate", styles.referralField)}>
                Date
                <DateField
                  data-testid="ward-ed-referral-legal-form-due-at-date"
                  invalid={isMissing("legalFormDueAtDate") || undefined}
                  value={draft.legalFormDueAtDate}
                  onValueChange={(legalFormDueAtDate) => setDraft((current) => ({ ...current, legalFormDueAtDate }))}
                />
                {missingNote("legalFormDueAtDate")}
              </label>
              <div className={fieldClass("legalFormDueAtTime", styles.referralField)}>
                <span aria-hidden="true">Time</span>
                <EdTimeBox
                  label="Expiry time"
                  testId="ward-ed-referral-legal-form-due-at-time"
                  invalid={isMissing("legalFormDueAtTime")}
                  value={draft.legalFormDueAtTime}
                  onChange={(legalFormDueAtTime) => setDraft((current) => ({ ...current, legalFormDueAtTime }))}
                />
                {missingNote("legalFormDueAtTime")}
              </div>
            </fieldset>
          ) : null}
          <EdPickerField
            label="Urgency"
            testId="ward-ed-referral-urgency"
            name="ward-ed-referral-urgency"
            options={URGENCY_PICKER_OPTIONS}
            placeholder="Choose"
            value={draft.urgency === undefined ? null : String(draft.urgency)}
            missing={isMissing("urgency")}
            onChange={(urgency) =>
              setDraft((current) => ({
                ...current,
                urgency: urgency === null ? undefined : (Number(urgency) as 1 | 2 | 3),
              }))
            }
            note={missingNote("urgency")}
          />
          <EdPickerField
            label="Observation level"
            testId="ward-ed-referral-observation"
            name="ward-ed-referral-observation"
            options={OBSERVATION_PICKER_OPTIONS}
            placeholder="Choose"
            value={draft.observation ?? null}
            missing={isMissing("observation")}
            onChange={(observation) =>
              setDraft((current) => ({
                ...current,
                observation: observation === null ? undefined : (observation as ObservationLevel),
              }))
            }
            note={missingNote("observation")}
          />
          {draft.observation === "intermittent" ? (
            <EdSegmentedField<string>
              label="Check every"
              testId="ward-ed-referral-observation-interval"
              items={INTERVAL_ITEMS}
              value={String(draft.observationIntervalMinutes)}
              onChange={(minutes) =>
                setDraft((current) => ({ ...current, observationIntervalMinutes: Number(minutes) }))
              }
            />
          ) : null}
          <label className={fieldClass("observationReviewTime", styles.referralField)}>
            Review time (optional)
            <input
              data-testid="ward-ed-referral-observation-review-time"
              type="text"
              inputMode="numeric"
              placeholder="For example 14:30"
              aria-invalid={isMissing("observationReviewTime") || undefined}
              value={draft.observationReviewTime}
              onChange={({ target: { value } }) =>
                setDraft((current) => ({ ...current, observationReviewTime: value }))
              }
            />
            {missingNote("observationReviewTime")}
          </label>
          {draft.observationReviewTime.trim() !== "" ? (
            <EdSegmentedField<"today" | "tomorrow">
              label="Review day"
              testId="ward-ed-referral-observation-review-day"
              items={REVIEW_DAY_ITEMS}
              value={draft.observationReviewDay}
              onChange={(observationReviewDay) => setDraft((current) => ({ ...current, observationReviewDay }))}
            />
          ) : null}
          <fieldset
            className={fieldClass("highAcuity", styles.referralCheckbox)}
            aria-describedby={isMissing("highAcuity") ? missingNoteId("highAcuity") : undefined}
          >
            <legend>High-acuity nursing</legend>
            <label>
              <input
                type="radio"
                name="ward-ed-referral-high-acuity"
                data-testid="ward-ed-referral-high-acuity-required"
                checked={draft.highAcuity === true}
                onChange={() => setDraft((current) => ({ ...current, highAcuity: true }))}
              />
              Required
            </label>
            <label>
              <input
                type="radio"
                name="ward-ed-referral-high-acuity"
                data-testid="ward-ed-referral-high-acuity-not-required"
                checked={draft.highAcuity === false}
                onChange={() => setDraft((current) => ({ ...current, highAcuity: false }))}
              />
              Not required
            </label>
            {groupMissingNote("highAcuity")}
          </fieldset>
        </fieldset>
        <div className={styles.actionRow}>
          <button
            type="submit"
            data-testid="ward-ed-referral-submit"
            className={styles.acceptButton}
            aria-disabled={referralBlocked || referralFieldsDisabled ? "true" : undefined}
            aria-describedby={
              referralSaveMessage
                ? "ward-ed-referral-save-message"
                : referralBlocked
                  ? "ward-ed-referral-blocked"
                  : undefined
            }
            title={
              referralFieldsDisabled
                ? "Wait for confirmation or use Retry before submitting again."
                : (referralBlocked ?? undefined)
            }
            onClick={
              referralBlocked || referralFieldsDisabled
                ? (event) => {
                    // Greyed, so nothing is filed: the click shows what is still unanswered.
                    event.preventDefault();
                    if (!referralFieldsDisabled) showMissingFields();
                  }
                : undefined
            }
          >
            Ask for a bed
          </button>
          <button
            type="button"
            className={styles.declineButton}
            onClick={() => {
              setReferralOpen(false);
              setDraft(DEFAULT_DRAFT);
              setRaisingFromReferralId(undefined);
            }}
          >
            Cancel
          </button>
          {referralSaveMessage ? (
            <p role="status" id="ward-ed-referral-save-message">
              {referralSaveMessage}
            </p>
          ) : null}
          {referralBlocked ? (
            // A2-10 (audit 13 Oct 2026): the reason shows beside the greyed button, not
            // only to a screen reader or on hover; its first sentence fits one line.
            <DisabledReason id="ward-ed-referral-blocked">{firstSentence(referralBlocked)}</DisabledReason>
          ) : null}
          {missing.length > 0 ? (
            <p className={missingStyles.list} role="alert" data-testid="ward-ed-referral-missing">
              Still to answer: {missing.map((field) => MISSING_FIELD_LABELS[field]).join(", ")}.
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
