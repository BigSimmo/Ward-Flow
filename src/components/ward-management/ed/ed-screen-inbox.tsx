"use client";

// "Referrals": psychiatry review requests addressed to this department whose patient is here, with
// both clocks, medical clearance, raise and decline. Split out of `ed-screen.tsx` unchanged (fix
// list 2.5 and 9.6, 15 Oct 2026).
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { ED_DECLINE_REASONS, type ReferralDeclineReason } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import {
  DECLINE_REASON_LABELS,
  referralClocks,
  referralPersonFacts,
  referralPurposeLabel,
} from "@/components/ward-management/ward-referrals";
import { ReferralIntakeSummary } from "../referrals/referral-intake-summary";
import { declineReasonBlockedReason } from "./ed-blocked-reasons";
import type { EdScreenContext } from "./ed-screen-context";
import {
  COHORT_OPTIONS,
  DEFAULT_DRAFT,
  edReferralClockLines,
  NO_DECLINE_REASON_VALUE,
  NO_DIAGNOSIS_VALUE,
  referralWardGender,
  SEX_OPTIONS,
  URGENCY_OPTIONS,
} from "./ed-screen-model";
import styles from "./ed.module.css";

export function EdInboxReferrals({ ctx }: { ctx: EdScreenContext }) {
  const {
    now,
    department,
    movements,
    referrals,
    registryPatients,
    recordEdStep,
    inbox,
    referralDetailsOpenFor,
    setReferralDetailsOpenFor,
  } = ctx;
  return (
    <section aria-label="Referrals" className={styles.inboxSection} data-testid="ward-ed-inbox">
      <h3 className={styles.inboxSubheading}>
        Referrals &middot; {inbox.length} patient{inbox.length === 1 ? "" : "s"}
      </h3>
      <p className={styles.inboxMeta}>Oldest first</p>
      {inbox.length === 0 ? (
        <p className={styles.placeholder} data-testid="ward-ed-inbox-empty">
          No referral for psychiatric review is addressed to {department.name}.
        </p>
      ) : (
        <ul className={styles.inboxList}>
          {inbox.map(({ referral, destination, addressing }) => {
            const clocks = referralClocks(referral, now);
            const lines = edReferralClockLines(clocks);
            const hasLinkedMovement = movements.some((movement) => movement.referralId === referral.id);
            const referralPatient = resolveSubjectPatient(referral, {
              patients: registryPatients,
              referrals,
            });
            return (
              <li
                key={`${referral.id}-${destination.edId}-${destination.purpose}`}
                className={styles.inboxItem}
                data-testid={`ward-ed-inbox-row-${referral.id}`}
                data-held-form={`referral:${referral.id}`}
                data-purpose={destination.purpose}
                data-ed-id={destination.edId}
                data-minutes-since-referral={clocks.sinceReferral}
                data-since-referral-running={clocks.sinceReferralRunning ? "true" : "false"}
                data-minutes-in-department={clocks.inDepartment}
              >
                <header className={styles.inboxItemHeader}>
                  <span className={styles.inboxName}>{referralPatient.displayName}</span>
                  <span className={styles.umrnNote}>
                    (UMRN: <strong>{referralPatient.umrn}</strong>)
                  </span>
                  <span className={styles.inboxPurpose} data-testid={`ward-ed-inbox-purpose-${referral.id}`}>
                    {referralPurposeLabel(destination.purpose)}
                  </span>
                </header>
                <p className={styles.inboxFacts}>{referralPersonFacts(referral).join(" · ")}</p>
                <dl className={styles.inboxClocks} data-testid={`ward-ed-inbox-clocks-${referral.id}`}>
                  <div className={styles.inboxClockRow} data-testid={`ward-ed-inbox-department-clock-${referral.id}`}>
                    <dt>{lines.department.term}</dt>
                    <dd>{lines.department.value}</dd>
                  </div>
                  <div className={styles.inboxClockRow} data-testid={`ward-ed-inbox-referral-clock-${referral.id}`}>
                    <dt>{lines.referral.term}</dt>
                    <dd>{lines.referral.value}</dd>
                  </div>
                </dl>
                <div className={styles.inboxClearance} data-testid={`ward-ed-inbox-clearance-${referral.id}`}>
                  <span className={styles.inboxClearanceLabel}>Medically cleared</span>
                  <span>
                    {referral.medicalClearance === undefined
                      ? "Not assessed"
                      : referral.medicalClearance.cleared
                        ? `Yes — recorded ${formatInstantWithDay(referral.medicalClearance.at, now)}`
                        : `No — recorded ${formatInstantWithDay(referral.medicalClearance.at, now)}`}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.referralDetailsTrigger}
                  aria-expanded={referralDetailsOpenFor === referral.id}
                  onClick={() =>
                    setReferralDetailsOpenFor((current) => (current === referral.id ? undefined : referral.id))
                  }
                >
                  View referral <span aria-hidden="true">›</span>
                </button>
                <div className={styles.referralDetails} hidden={referralDetailsOpenFor !== referral.id}>
                  <ReferralIntakeSummary intake={referral.intake} />
                  <div className={styles.inboxActionRow}>
                    <button
                      type="button"
                      className={styles.inboxBtn}
                      data-testid={`ward-ed-inbox-clearance-yes-${referral.id}`}
                      onClick={() =>
                        recordEdStep({
                          type: "RECORD_MEDICAL_CLEARANCE",
                          role: "ed",
                          now,
                          referralId: referral.id,
                          cleared: true,
                        })
                      }
                    >
                      Record medically cleared
                    </button>
                    <button
                      type="button"
                      className={styles.inboxBtn}
                      data-testid={`ward-ed-inbox-clearance-no-${referral.id}`}
                      onClick={() =>
                        recordEdStep({
                          type: "RECORD_MEDICAL_CLEARANCE",
                          role: "ed",
                          now,
                          referralId: referral.id,
                          cleared: false,
                        })
                      }
                    >
                      Record not medically cleared
                    </button>
                  </div>
                  {hasLinkedMovement ? null : (
                    <button
                      type="button"
                      className={`${styles.inboxBtn} ${styles.inboxBtnPrimary}`}
                      data-testid={`ward-ed-inbox-raise-${referral.id}`}
                      onClick={() => askForBedFromReferral(ctx, referral)}
                    >
                      Ask for a bed
                    </button>
                  )}
                  <EdInboxDecline ctx={ctx} referralId={referral.id} queued={addressing.state === "queued"} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Opens Ask for a bed from a referral, filled only with facts the referral or the record hold. */
export function askForBedFromReferral(ctx: EdScreenContext, referral: EdScreenContext["inbox"][number]["referral"]) {
  const { registryPatients, setRaisingFromReferralId, setDraft, setReferralOpen } = ctx;
  setRaisingFromReferralId(referral.id);
  const record =
    referral.patientId === undefined
      ? undefined
      : registryPatients.find((candidate) => candidate.id === referral.patientId);
  // Every raise starts from the blank draft, so one person's answers never
  // carry onto the next. Only facts this referral or the person's record
  // already hold are filled in, and each stays editable. Legal status is
  // never filled in here.
  setDraft({
    ...DEFAULT_DRAFT,
    gender: referralWardGender(referral),
    // A2-1: the referral already says who it is for: its person, or
    // nobody yet identified. Either stays editable on the form.
    patientId: referral.patientId,
    unidentified: referral.patientId === undefined,
    cohort: COHORT_OPTIONS.find((option) => option === referral.ageBand),
    urgency: URGENCY_OPTIONS.find((option) => option === referral.urgency),
    tentativeDiagnosis: referral.tentativeDiagnosis ?? NO_DIAGNOSIS_VALUE,
    sex: SEX_OPTIONS.find((option) => option === record?.sex),
  });
  setReferralOpen(true);
}

/** The ED's own decline of a referral addressed to it, with its reason and any refusal (Q128: also shown inside the opened referral on the desktop Lists card). */
export function EdInboxDecline({
  ctx,
  referralId,
  queued,
}: {
  ctx: EdScreenContext;
  referralId: string;
  queued: boolean;
}) {
  const { declineOpenFor, declineDraft, setDeclineDraft, declineRejection, toggleDecline, submitDecline } = ctx;
  const referral = { id: referralId };
  const declineOpen = declineOpenFor === referralId;
  const declineBlocked = declineReasonBlockedReason(declineDraft);
  return (
    <>
      {queued ? (
        <>
          <button
            type="button"
            className={styles.inboxBtn}
            data-testid={`ward-ed-inbox-decline-${referral.id}`}
            aria-expanded={declineOpen}
            onClick={() => toggleDecline(referral.id)}
          >
            Decline
          </button>
          {declineOpen ? (
            <div className={styles.declineForm} data-testid={`ward-ed-inbox-decline-panel-${referral.id}`}>
              <label className={styles.referralField} htmlFor={`ward-ed-inbox-decline-reason-${referral.id}`}>
                Why is this referral being declined?
                <select
                  id={`ward-ed-inbox-decline-reason-${referral.id}`}
                  data-testid={`ward-ed-inbox-decline-reason-${referral.id}`}
                  value={declineDraft ?? NO_DECLINE_REASON_VALUE}
                  onChange={(event) =>
                    setDeclineDraft(
                      event.target.value === NO_DECLINE_REASON_VALUE
                        ? undefined
                        : (event.target.value as ReferralDeclineReason),
                    )
                  }
                >
                  <option value={NO_DECLINE_REASON_VALUE}>Choose a reason</option>
                  {ED_DECLINE_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {DECLINE_REASON_LABELS[reason] ?? reason}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                data-testid={`ward-ed-inbox-decline-confirm-${referral.id}`}
                className={styles.declineSubmit}
                aria-disabled={declineBlocked ? "true" : undefined}
                aria-describedby={declineBlocked ? `ward-ed-inbox-decline-blocked-${referral.id}` : undefined}
                title={declineBlocked ?? undefined}
                onClick={declineBlocked ? ignoreUnavailableActivation : () => submitDecline(referral.id)}
              >
                Record decline
              </button>
              {declineBlocked ? (
                <span id={`ward-ed-inbox-decline-blocked-${referral.id}`} className="sr-only">
                  {declineBlocked}
                </span>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
      {declineRejection?.referralId === referral.id ? (
        <p className={styles.rejection} role="alert" data-testid={`ward-ed-inbox-decline-rejection-${referral.id}`}>
          Decline not recorded: {declineRejection.rejection.reason}
        </p>
      ) : null}
    </>
  );
}
