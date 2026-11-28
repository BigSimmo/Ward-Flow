"use client";

// "Lists": the department's tabbed lists, Review, Medical clearance, Expects, Forms and Referred.
// Split out of `ed-screen.tsx` unchanged (fix list 2.5 and 9.6, 15 Oct 2026).
import { formatElapsed, formatInstantWithDay, splitDuration } from "@/components/ward-management/ward-clock";
import { typedTimeLine } from "@/components/ward-management/legal-forms/legal-time-as-typed";
import {
  currentLegalPosition,
  FORM_RECORDED_ENDED,
  legalFormNowWords,
} from "@/components/ward-management/ward-legal-form-progression";
import { OPERATIONAL_DEFAULT_LABEL } from "@/components/ward-management/ward-operational-defaults";
import { patientIdentityLine, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import {
  EXPECT_RECONSIDER_AFTER_MINUTES,
  referralPersonFacts,
  referralPurposeLabel,
} from "@/components/ward-management/ward-referrals";
import type { EdScreenContext } from "./ed-screen-context";
import { movementMedicalClearance, outstandingItem } from "./ed-screen-model";
import { edClearanceTime } from "./ed-clearance-time";
import { edStageLabel } from "./ed-referral-status";
import styles from "./ed.module.css";

/** Awaiting review: in the department without a recorded psychiatric review. Phone rows; the Lists tabs and My list both show them. */
export function EdReviewPhoneList({ ctx }: { ctx: EdScreenContext }) {
  const { now, movements, referrals, registryPatients, setSelectedPatientId, patientBay, awaitingReviewPatients } = ctx;
  return (
    <>
      {awaitingReviewPatients.length === 0 ? (
        <p className={styles.none}>Everyone on the list has a recorded review.</p>
      ) : (
        <ul className={styles.lst}>
          {awaitingReviewPatients.map((m) => {
            const mc = movementMedicalClearance(m, referrals);
            const patientInfo = resolveSubjectPatient(m, {
              patients: registryPatients,
              referrals,
              movements,
            });
            return (
              <li key={m.id} className={styles.lstRow} data-tone="quiet">
                <span className={styles.tick} data-tone="quiet" aria-hidden="true" />
                <span className={styles.lstMain}>
                  <span className={styles.lstTitle}>
                    <button type="button" className={styles.nameBtn} onClick={() => setSelectedPatientId(m.id)}>
                      {patientInfo.displayName}
                    </button>
                  </span>
                  <span className={styles.meta}>
                    {/* Owner, 26 Sept 2026: the id button duplicated the name button above it. */}
                    <span className={styles.umrnNote}>
                      UMRN: <strong>{patientInfo.umrn}</strong>
                    </span>
                    <span className={styles.bayNumber}>{patientBay(m.id)}</span>
                    <span>{m.cohort}</span>
                    <span>{m.sex}</span>
                  </span>
                  <span className={styles.lstWhy}>
                    {outstandingItem(m).label}.{" "}
                    {/* Medical clearance tracker (Josh sign-off, 9 Nov 2026): elapsed from arrival. */}
                    {edClearanceTime(m.openedAt, mc, now).words}.
                  </span>
                </span>
                <span className={styles.lstEnd}>
                  <span className={styles.stamp}>{splitDuration(Math.max(now - m.openedAt, 0))} here</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/** Medical clearance: marked medically cleared for psychiatric assessment. Phone rows; the Lists tabs and My list both show them. */
export function EdClearedPhoneList({ ctx }: { ctx: EdScreenContext }) {
  const { now, movements, referrals, registryPatients, setSelectedPatientId, patientBay, clearedPatients } = ctx;
  return (
    <>
      {clearedPatients.length === 0 ? (
        <p className={styles.none}>No medical clearance recorded.</p>
      ) : (
        <ul className={styles.lst}>
          {clearedPatients.map((m) => {
            const reviewed = !!m.examination;
            const mc = movementMedicalClearance(m, referrals);
            const patientInfo = resolveSubjectPatient(m, {
              patients: registryPatients,
              referrals,
              movements,
            });
            return (
              <li key={m.id} className={styles.lstRow} data-tone={reviewed ? "quiet" : "warn"}>
                <span className={styles.tick} data-tone={reviewed ? "quiet" : "warn"} aria-hidden="true" />
                <span className={styles.lstMain}>
                  <span className={styles.lstTitle}>
                    <button type="button" className={styles.nameBtn} onClick={() => setSelectedPatientId(m.id)}>
                      {patientInfo.displayName}
                    </button>
                  </span>
                  <span className={styles.meta}>
                    {/* Owner, 26 Sept 2026: the id button duplicated the name button above it. */}
                    <span className={styles.umrnNote}>
                      UMRN: <strong>{patientInfo.umrn}</strong>
                    </span>
                    <span className={styles.bayNumber}>{patientBay(m.id)}</span>
                    <span>{m.cohort}</span>
                    <span>{m.sex}</span>
                  </span>
                  <span className={styles.lstWhy}>
                    {reviewed ? "Reviewed by psychiatry. " : "Not seen by psychiatry yet. "}
                    {edStageLabel(m.stage)}. {edClearanceTime(m.openedAt, mc, now).words}.
                  </span>
                </span>
                <span className={styles.lstEnd}>
                  <span className={styles.stamp}>
                    {mc?.at ? `cleared ${formatInstantWithDay(mc.at, now)}` : "cleared"}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/** Expects: not yet in the department; an accepted referral stays until arrival is marked. Phone rows; the Lists tabs and My list both show them. */
export function EdExpectsPhoneList({ ctx }: { ctx: EdScreenContext }) {
  const { now, department, movements, referrals, registryPatients, recordEdStep, expects } = ctx;
  return (
    <>
      {expects.length === 0 ? (
        <p className={styles.placeholder} data-testid="ward-ed-expects-empty">
          No expects recorded for psychiatry at {department.name}.
        </p>
      ) : (
        <ul className={styles.cardList}>
          {expects.map(({ referral, destination }) => {
            const waiting = Math.max(0, now - referral.raisedAt);
            const reconsider = waiting >= EXPECT_RECONSIDER_AFTER_MINUTES;
            const eta = movements.find((m) => m.referralId === referral.id)?.transport?.estimatedAt;
            return (
              <li
                key={`${referral.id}-${destination.edId}`}
                className={styles.card}
                data-testid={`ward-ed-expects-row-${referral.id}`}
                data-minutes-waiting={waiting}
                data-reconsider={reconsider ? "true" : "false"}
              >
                <header className={styles.cardHeader}>
                  <strong>
                    {patientIdentityLine(
                      resolveSubjectPatient(referral, { patients: registryPatients, referrals, movements }),
                    )}
                  </strong>
                  <span className={styles.cardMeta}>{referralPurposeLabel(destination.purpose)}</span>
                </header>
                <p className={styles.cardMeta}>{referralPersonFacts(referral).join(" · ")}</p>
                <dl className={styles.clockGrid} data-testid={`ward-ed-expects-clock-${referral.id}`}>
                  {eta !== undefined ? (
                    <div className={styles.clockRow}>
                      <dt>Estimated arrival</dt>
                      <dd>{formatInstantWithDay(eta, now)}</dd>
                    </div>
                  ) : null}
                  <div className={styles.clockRow}>
                    <dt>Waiting since referral</dt>
                    <dd>{formatElapsed(waiting)}</dd>
                  </div>
                </dl>
                {reconsider ? (
                  <p
                    className={styles.placeholder}
                    data-testid={`ward-ed-expects-reconsider-${referral.id}`}
                    title={OPERATIONAL_DEFAULT_LABEL}
                  >
                    Referred over {EXPECT_RECONSIDER_AFTER_MINUTES / 60} hours ago and not arrived. Does it still stand?
                  </p>
                ) : null}
                <button
                  type="button"
                  className={styles.arrivedButton}
                  data-testid={`ward-ed-expects-arrived-${referral.id}`}
                  onClick={() =>
                    recordEdStep({
                      type: "RECORD_ARRIVED_IN_DEPARTMENT",
                      role: "ed",
                      now,
                      referralId: referral.id,
                    })
                  }
                >
                  Mark arrived in department
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/** Forms: a recorded form or held under the Act. Phone rows; the Lists tabs and My list both show them. */
export function EdFormsPhoneList({ ctx }: { ctx: EdScreenContext }) {
  const { now, movements, referrals, registryPatients, setSelectedPatientId, patientBay, underFormPatients } = ctx;
  return (
    <>
      {underFormPatients.length === 0 ? (
        <p className={styles.none}>No legal form recorded.</p>
      ) : (
        <ul className={styles.lst}>
          {underFormPatients.map((m) => {
            // 1.1 (K1): the one current legal position; a form a person recorded as ended has no
            // typed end in force and reads "Form 3B ended".
            const legal = currentLegalPosition(m);
            const due = legal.dueAt;
            const tone = due === null || due === undefined ? "quiet" : due < now ? "danger" : "good";
            const stamp = !legal.form
              ? "form not recorded"
              : legal.ended
                ? FORM_RECORDED_ENDED.toLowerCase()
                : due === null || due === undefined
                  ? "no deadline"
                  : due < now
                    ? `passed ${formatInstantWithDay(due, now)}`
                    : `due ${formatInstantWithDay(due, now)}`;
            const patientInfo = resolveSubjectPatient(m, {
              patients: registryPatients,
              referrals,
              movements,
            });
            return (
              <li key={m.id} className={styles.lstRow} data-tone={tone}>
                <span className={styles.tick} data-tone={tone} aria-hidden="true" />
                <span className={styles.lstMain}>
                  <span className={styles.lstTitle}>
                    <button type="button" className={styles.nameBtn} onClick={() => setSelectedPatientId(m.id)}>
                      {patientInfo.displayName}
                    </button>
                  </span>
                  <span className={styles.meta}>
                    {/* Owner, 26 Sept 2026: the id button duplicated the name button above it. */}
                    <span className={styles.umrnNote}>
                      UMRN: <strong>{patientInfo.umrn}</strong>
                    </span>
                    <span className={styles.bayNumber}>{patientBay(m.id)}</span>
                    <span>{m.cohort}</span>
                    <span>{m.sex}</span>
                  </span>
                  <span className={styles.lstWhy}>
                    {/* Legal times only as typed (31 Oct 2026): never "passed … ago" or "… away". */}
                    {legal.form
                      ? `${legalFormNowWords(m)}. ${legal.ended ? `${FORM_RECORDED_ENDED}.` : due === null || due === undefined ? "No deadline is recorded against it." : `${typedTimeLine(due, now, ctx.dayZero)}.`}`
                      : `${m.legalStatus}. Form not recorded.`}
                  </span>
                </span>
                <span className={styles.lstEnd}>
                  <span className={styles.stamp}>{stamp}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
