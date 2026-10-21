"use client";

// "Raise into a movement": the form that raises a movement from a referral in this department's
// inbox. Split out of `ed-screen.tsx` unchanged (fix list 2.5 and 9.6, 15 Oct 2026).
import { useRef, useState } from "react";
import { DisabledReason } from "@/components/wf";
import { legalFormName, SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
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
  NO_GENDER_VALUE,
  NO_LEGAL_FORM_VALUE,
  NO_LEGAL_STATUS_VALUE,
  NO_SECURITY_VALUE,
  NO_SEX_VALUE,
  NO_URGENCY_VALUE,
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

/** The observation picker's "nothing chosen yet" value: unanswered, never a level. */
const NO_OBSERVATION_VALUE = "";

export function EdRaiseIntoMovementSection({ ctx }: { ctx: EdScreenContext }) {
  const { referralOpen, setReferralOpen, setRaisingFromReferralId } = ctx;
  return (
    <section
      id="ward-ed-referral-intake"
      aria-label="Raise into a movement"
      hidden={!referralOpen}
      className={`${styles.panel} ${styles.full} ${styles.listSection} ${styles.referralBarSection}`}
    >
      <div className={styles.ph}>
        <h2>Raise into a movement</h2>
        <button
          type="button"
          className={styles.inboxBtn}
          onClick={() => {
            setReferralOpen(false);
            setRaisingFromReferralId(undefined);
          }}
        >
          Close
        </button>
      </div>
      {referralOpen && <EdRaiseIntoMovementForm ctx={ctx} />}
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
  const { setReferralOpen, setRaisingFromReferralId, draft, setDraft, registryPatients, submitReferral } = ctx;
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
    formRef.current?.querySelector<HTMLElement>(`[data-testid="${MISSING_FIELD_TEST_IDS[first]}"]`)?.focus();
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
        <div className={styles.referralGrid}>
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
          <label className={fieldClass("cohort", styles.referralField)}>
            Cohort
            <select
              data-testid="ward-ed-referral-cohort"
              aria-invalid={isMissing("cohort") || undefined}
              value={draft.cohort ?? NO_COHORT_VALUE}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  cohort: event.target.value === NO_COHORT_VALUE ? undefined : (event.target.value as Cohort),
                }))
              }
            >
              {/* Nothing chosen, first and selected — never a cohort standing in for a
                            decision nobody made. Same idiom as `NO_DECLINE_REASON_VALUE` below. */}
              <option value={NO_COHORT_VALUE}>Choose a cohort</option>
              {COHORT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {missingNote("cohort")}
          </label>
          <label className={fieldClass("security", styles.referralField)}>
            Security
            <select
              data-testid="ward-ed-referral-security"
              aria-invalid={isMissing("security") || undefined}
              value={draft.security ?? NO_SECURITY_VALUE}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  security: event.target.value === NO_SECURITY_VALUE ? undefined : (event.target.value as Security),
                }))
              }
            >
              <option value={NO_SECURITY_VALUE}>Choose a security level</option>
              {SECURITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {missingNote("security")}
          </label>
          <label className={fieldClass("sex", styles.referralField)}>
            Sex
            <select
              data-testid="ward-ed-referral-sex"
              aria-invalid={isMissing("sex") || undefined}
              value={draft.sex ?? NO_SEX_VALUE}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  sex: event.target.value === NO_SEX_VALUE ? undefined : (event.target.value as RecordedSex),
                }))
              }
            >
              <option value={NO_SEX_VALUE}>Choose a sex</option>
              {SEX_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {missingNote("sex")}
          </label>
          {/* T11 (after T10, item 8, owner answer 17 September 2026): "Gender (decides
                    which bed)" — the exact label build plan §2 gives, so a clinician never
                    confuses this with the "Sex" question above it, which the gate no longer
                    reads at all. */}
          <label className={fieldClass("gender", styles.referralField)}>
            Gender (decides which bed)
            <select
              data-testid="ward-ed-referral-gender"
              aria-invalid={isMissing("gender") || undefined}
              value={draft.gender ?? NO_GENDER_VALUE}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  gender:
                    event.target.value === NO_GENDER_VALUE
                      ? undefined
                      : (event.target.value as ReferralGender | typeof GENDER_NOT_RECORDED_VALUE),
                }))
              }
            >
              <option value={NO_GENDER_VALUE}>Choose a gender</option>
              {GENDER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
              <option value={GENDER_NOT_RECORDED_VALUE}>Not yet recorded</option>
            </select>
            {missingNote("gender")}
          </label>
          {/* T15 (item 12, owner answer 17 September 2026): "An admission from a
                    referral carries the referral's broad diagnosis category, marked tentative."
                    OPTIONAL, and never blocks "Raise referral" — a clinician with no diagnosis to
                    record is not made to invent one. */}
          <label className={styles.referralField}>
            Broad diagnosis category (tentative)
            <select
              data-testid="ward-ed-referral-tentative-diagnosis"
              value={draft.tentativeDiagnosis}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  tentativeDiagnosis: event.target.value as TentativeDiagnosisBlock | "none",
                }))
              }
            >
              <option value={NO_DIAGNOSIS_VALUE}>Not recorded</option>
              {TENTATIVE_DIAGNOSIS_BLOCKS.map((block) => (
                <option key={block.code} value={block.code}>
                  {tentativeDiagnosisPhrase(block.code)}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldClass("legalStatus", styles.referralField)}>
            Legal status
            <select
              data-testid="ward-ed-referral-legal-status"
              aria-invalid={isMissing("legalStatus") || undefined}
              value={draft.legalStatus ?? NO_LEGAL_STATUS_VALUE}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  legalStatus:
                    event.target.value === NO_LEGAL_STATUS_VALUE ? undefined : (event.target.value as LegalStatus),
                }))
              }
            >
              <option value={NO_LEGAL_STATUS_VALUE}>Choose a legal status</option>
              {LEGAL_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {missingNote("legalStatus")}
          </label>
          <label className={styles.referralField}>
            Legal form
            <select
              data-testid="ward-ed-referral-legal-form"
              value={draft.legalFormCode ?? NO_LEGAL_FORM_VALUE}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  legalFormCode: event.target.value === NO_LEGAL_FORM_VALUE ? null : event.target.value,
                  legalFormDueAtDate: "",
                  legalFormDueAtTime: "",
                }))
              }
            >
              <option value={NO_LEGAL_FORM_VALUE}>No form</option>
              {SELECTABLE_LEGAL_FORMS.map((form) => (
                <option key={form.code} value={form.code}>
                  {legalFormName(form)}
                </option>
              ))}
            </select>
          </label>
          {draft.legalFormCode !== null ? (
            <fieldset className={styles.declineFieldset}>
              <legend className={styles.declineLegend}>Expiry written on the form (optional)</legend>
              <p className={styles.cardMeta}>Leave blank if the form has no expiry or you do not have it yet.</p>
              <label className={fieldClass("legalFormDueAtDate", styles.referralField)}>
                Date
                <input
                  type="date"
                  data-testid="ward-ed-referral-legal-form-due-at-date"
                  aria-invalid={isMissing("legalFormDueAtDate") || undefined}
                  value={draft.legalFormDueAtDate}
                  onChange={(event) => setDraft((current) => ({ ...current, legalFormDueAtDate: event.target.value }))}
                />
                {missingNote("legalFormDueAtDate")}
              </label>
              <label className={fieldClass("legalFormDueAtTime", styles.referralField)}>
                Time
                <input
                  type="time"
                  data-testid="ward-ed-referral-legal-form-due-at-time"
                  aria-invalid={isMissing("legalFormDueAtTime") || undefined}
                  value={draft.legalFormDueAtTime}
                  onChange={(event) => setDraft((current) => ({ ...current, legalFormDueAtTime: event.target.value }))}
                />
                {missingNote("legalFormDueAtTime")}
              </label>
            </fieldset>
          ) : null}
          <label className={fieldClass("urgency", styles.referralField)}>
            Urgency
            <select
              data-testid="ward-ed-referral-urgency"
              aria-invalid={isMissing("urgency") || undefined}
              value={draft.urgency ?? NO_URGENCY_VALUE}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  urgency:
                    event.target.value === NO_URGENCY_VALUE ? undefined : (Number(event.target.value) as 1 | 2 | 3),
                }))
              }
            >
              <option value={NO_URGENCY_VALUE}>Choose an urgency tier</option>
              {URGENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {urgencyTierLabel(option)}
                </option>
              ))}
            </select>
            {missingNote("urgency")}
          </label>
          <label className={fieldClass("observation", styles.referralField)}>
            Observation level
            <select
              data-testid="ward-ed-referral-observation"
              aria-invalid={isMissing("observation") || undefined}
              value={draft.observation ?? NO_OBSERVATION_VALUE}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  observation:
                    event.target.value === NO_OBSERVATION_VALUE ? undefined : (event.target.value as ObservationLevel),
                }))
              }
            >
              <option value={NO_OBSERVATION_VALUE}>Choose an observation level</option>
              {OBSERVATION_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {observationRatio(level)
                    ? `${observationLevelName(level)} (${observationRatio(level)})`
                    : observationLevelName(level)}
                </option>
              ))}
            </select>
            {missingNote("observation")}
          </label>
          {draft.observation === "intermittent" ? (
            <label className={styles.referralField}>
              Check every
              <select
                data-testid="ward-ed-referral-observation-interval"
                value={draft.observationIntervalMinutes}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, observationIntervalMinutes: Number(event.target.value) }))
                }
              >
                {INTERMITTENT_INTERVAL_MINUTES.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </select>
            </label>
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
              onChange={(event) => setDraft((current) => ({ ...current, observationReviewTime: event.target.value }))}
            />
            {missingNote("observationReviewTime")}
          </label>
          {draft.observationReviewTime.trim() !== "" ? (
            <label className={styles.referralField}>
              Review day
              <select
                data-testid="ward-ed-referral-observation-review-day"
                value={draft.observationReviewDay}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    observationReviewDay: event.target.value as "today" | "tomorrow",
                  }))
                }
              >
                <option value="today">Today</option>
                <option value="tomorrow">Tomorrow</option>
              </select>
            </label>
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
        </div>
        <div className={styles.actionRow}>
          <button
            type="submit"
            data-testid="ward-ed-referral-submit"
            className={styles.acceptButton}
            aria-disabled={referralBlocked ? "true" : undefined}
            aria-describedby={referralBlocked ? "ward-ed-referral-blocked" : undefined}
            title={referralBlocked ?? undefined}
            onClick={
              referralBlocked
                ? (event) => {
                    // Greyed, so nothing is filed: the click shows what is still unanswered.
                    event.preventDefault();
                    showMissingFields();
                  }
                : undefined
            }
          >
            Raise into a movement
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
