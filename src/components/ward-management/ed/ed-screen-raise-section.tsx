"use client";

// "Raise into a movement": the form that raises a movement from a referral in this department's
// inbox. Split out of `ed-screen.tsx` unchanged (fix list 2.5 and 9.6, 15 Oct 2026).
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
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
import { referralDraftBlockedReason } from "./ed-blocked-reasons";
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

export function EdRaiseIntoMovementSection({ ctx }: { ctx: EdScreenContext }) {
  const { referralOpen, setReferralOpen, setRaisingFromReferralId, draft, setDraft, registryPatients, submitReferral } =
    ctx;
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
      {referralOpen && (
        <div className={styles.referralPanelBody}>
          {(() => {
            const referralBlocked = referralDraftBlockedReason({
              ...draft,
              patientFound: draft.patientId !== undefined,
            });
            return (
              <form className={styles.referralForm} onSubmit={submitReferral} data-testid="ward-ed-referral-form">
                <div className={styles.referralGrid}>
                  <EdReferralPatientField
                    patients={registryPatients}
                    patientId={draft.patientId}
                    unidentified={draft.unidentified}
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
                  <label className={styles.referralField}>
                    Cohort
                    <select
                      data-testid="ward-ed-referral-cohort"
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
                  </label>
                  <label className={styles.referralField}>
                    Security
                    <select
                      data-testid="ward-ed-referral-security"
                      value={draft.security ?? NO_SECURITY_VALUE}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          security:
                            event.target.value === NO_SECURITY_VALUE ? undefined : (event.target.value as Security),
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
                  </label>
                  <label className={styles.referralField}>
                    Sex
                    <select
                      data-testid="ward-ed-referral-sex"
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
                  </label>
                  {/* T11 (after T10, item 8, owner answer 17 September 2026): "Gender (decides
                    which bed)" — the exact label build plan §2 gives, so a clinician never
                    confuses this with the "Sex" question above it, which the gate no longer
                    reads at all. */}
                  <label className={styles.referralField}>
                    Gender (decides which bed)
                    <select
                      data-testid="ward-ed-referral-gender"
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
                  <label className={styles.referralField}>
                    Legal status
                    <select
                      data-testid="ward-ed-referral-legal-status"
                      value={draft.legalStatus ?? NO_LEGAL_STATUS_VALUE}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          legalStatus:
                            event.target.value === NO_LEGAL_STATUS_VALUE
                              ? undefined
                              : (event.target.value as LegalStatus),
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
                      <p className={styles.cardMeta}>
                        Leave blank if the form has no expiry or you do not have it yet.
                      </p>
                      <label className={styles.referralField}>
                        Date
                        <input
                          type="date"
                          data-testid="ward-ed-referral-legal-form-due-at-date"
                          value={draft.legalFormDueAtDate}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, legalFormDueAtDate: event.target.value }))
                          }
                        />
                      </label>
                      <label className={styles.referralField}>
                        Time
                        <input
                          type="time"
                          data-testid="ward-ed-referral-legal-form-due-at-time"
                          value={draft.legalFormDueAtTime}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, legalFormDueAtTime: event.target.value }))
                          }
                        />
                      </label>
                    </fieldset>
                  ) : null}
                  <label className={styles.referralField}>
                    Urgency
                    <select
                      data-testid="ward-ed-referral-urgency"
                      value={draft.urgency ?? NO_URGENCY_VALUE}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          urgency:
                            event.target.value === NO_URGENCY_VALUE
                              ? undefined
                              : (Number(event.target.value) as 1 | 2 | 3),
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
                  </label>
                  <fieldset className={styles.referralCheckbox}>
                    <legend>One-to-one nursing</legend>
                    <label>
                      <input
                        type="radio"
                        name="ward-ed-referral-specialling"
                        data-testid="ward-ed-referral-specialling-required"
                        checked={draft.specialling === true}
                        onChange={() => setDraft((current) => ({ ...current, specialling: true }))}
                      />
                      Required
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="ward-ed-referral-specialling"
                        data-testid="ward-ed-referral-specialling-not-required"
                        checked={draft.specialling === false}
                        onChange={() => setDraft((current) => ({ ...current, specialling: false }))}
                      />
                      Not required
                    </label>
                  </fieldset>
                  <fieldset className={styles.referralCheckbox}>
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
                    onClick={referralBlocked ? ignoreUnavailableActivation : undefined}
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
                </div>
              </form>
            );
          })()}
        </div>
      )}
    </section>
  );
}
