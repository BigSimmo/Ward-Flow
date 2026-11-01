import { stageCopy } from "@/components/ward-management/ward-stage-copy";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type {
  Cohort,
  LegalStatus,
  Movement,
  RecordedSex,
  ReferralDeclineReason,
  ReferralGender,
  Security,
} from "@/components/ward-management/ward-model";
import type { ObservationLevel } from "@/components/ward-management/ward-observation";
import { minuteOfDayFromClockText } from "@/components/ward-management/ward-clock";

/**
 * THE ED SCREEN'S BLOCKED-REASON RULES — why a control on the ED screen is unavailable, or why an
 * action would be refused, computed from explicit inputs only (a movement, a draft, a name).
 *
 * Moved out of `ed-screen.tsx` unchanged (fix list 1.3, 15 Oct 2026) so the same rules can run
 * without React, and later on the server. Each function is pure: no clock reading, no store
 * access, no hard-coded timing. The wording is the screen's own, word for word; the screen calls
 * these functions and renders exactly what they return. Pinned by
 * `tests/ward-ed-blocked-reasons.test.ts`.
 *
 * The transport-booking answers check, shared with the community screen, lives in
 * `ward-transport-checks.ts`.
 */

/**
 * The answers `referralDraftBlockedReason` reads from the ED referral form's draft
 * (`ReferralDraftState` in `ed-screen.tsx`). `undefined` is that draft's own "not yet answered"
 * sentinel for every field below; see the draft type's own comments.
 *
 * `patientFound` stands for "the draft names a registered person" (`draft.patientId` is set). The
 * screen passes that one fact rather than the patient link itself, so this module never reads the
 * link and stays outside the D-14 allowlist (`tests/ward-patient-link-default-deny.test.ts`).
 */
export type ReferralDraftAnswers = {
  patientFound: boolean;
  unidentified: boolean;
  cohort: Cohort | undefined;
  security: Security | undefined;
  sex: RecordedSex | undefined;
  gender: ReferralGender | "not_recorded" | undefined;
  legalStatus: LegalStatus | undefined;
  urgency: 1 | 2 | 3 | undefined;
  /** Fix plan item 10: the observation level, unanswered until a person chooses one. */
  observation: ObservationLevel | undefined;
  /** The typed next review time, `HH:MM`. Blank is a complete answer (none recorded). */
  observationReviewTime?: string;
  highAcuity: boolean | undefined;
  legalFormDueAtDate: string;
  legalFormDueAtTime: string;
};

/**
 * Why the decline confirm is unavailable, or `undefined` once a reason has been chosen. Pure and
 * module-level so the wording lives in one place rather than being spelled twice inside JSX.
 *
 * Exported since fix list 1.3 (15 Oct 2026), so both states are now asserted directly in
 * `tests/ward-ed-blocked-reasons.test.ts` as well as through the rendered control.
 */
export function declineReasonBlockedReason(reason: ReferralDeclineReason | undefined): string | undefined {
  if (reason !== undefined) return undefined;
  return "Choose a reason before recording this decline. None is chosen for you.";
}

/**
 * Why "Raise referral" is unavailable, or `undefined` once every field a clinician must decide
 * has been decided — the same role `declineReasonBlockedReason` above plays for the decline
 * confirm, checked in the same fixed order the forms renders its fields. A form that fired with
 * any of these five still `undefined` would go on to file a fabricated cohort, security level,
 * sex, legal status or urgency tier for a patient nobody looked at — the defect this function,
 * the five placeholder options, and `submitReferral`'s own guard all exist to close together.
 */
export function referralDraftBlockedReason(draft: ReferralDraftAnswers): string | undefined {
  if (!draft.patientFound && !draft.unidentified) {
    return 'Find the patient by name or UMRN, or choose "Not yet identified".';
  }
  if (draft.cohort === undefined) {
    return "Choose a cohort before raising this referral. None is chosen for you.";
  }
  if (draft.security === undefined) {
    return "Choose a security level before raising this referral. None is chosen for you.";
  }
  if (draft.sex === undefined) {
    return "Choose a sex before raising this referral. None is chosen for you.";
  }
  // T11 (item 8): blocked ONLY by the "not yet answered" sentinel, never by the explicit
  // "not_recorded" answer — see `ReferralDraftState.gender`'s own doc comment.
  if (draft.gender === undefined) {
    return 'Choose a gender, or "Not yet recorded". None is chosen for you.';
  }
  if (draft.legalStatus === undefined) {
    return "Choose a legal status before raising this referral. None is chosen for you.";
  }
  if (draft.urgency === undefined) {
    return "Choose an urgency tier before raising this referral. None is chosen for you.";
  }
  if (draft.observation === undefined) {
    return "Choose an observation level before raising this referral. None is chosen for you.";
  }
  if (draft.highAcuity === undefined) {
    return "State whether high-acuity nursing is required before raising this referral. None is chosen for you.";
  }
  // T3 (build plan §2): the expiry field is two inputs, and a half-typed pair is neither a
  // finished answer nor the permitted "blank" one — `instantFromDateAndTimeInputs` (`ed-screen.tsx`) refuses
  // to guess the other half, so this is the only place that refusal becomes visible to whoever
  // typed it. Checked last, after every field that is never optional: a clinician who has typed
  // only a date or only a time is partway through answering a question nobody is required to
  // answer at all, so this must never fire before the seven fields above that are.
  if ((draft.legalFormDueAtDate !== "") !== (draft.legalFormDueAtTime !== "")) {
    return "Enter both the date and the time written on the form, or leave both blank.";
  }
  if (observationReviewTimeUnreadable(draft)) {
    return "Type the observation review time as a clock time, for example 14:30, or leave it blank.";
  }
  return undefined;
}

/** A typed review time that is not a readable 24 hour time. Blank is fine: none recorded. */
function observationReviewTimeUnreadable(draft: ReferralDraftAnswers): boolean {
  const typed = draft.observationReviewTime?.trim() ?? "";
  return typed !== "" && minuteOfDayFromClockText(typed) === undefined;
}

/** A question on the ED "Ask for a bed" form that can still be unanswered. */
export type ReferralDraftField =
  | "patient"
  | "cohort"
  | "security"
  | "sex"
  | "gender"
  | "legalStatus"
  | "urgency"
  | "observation"
  | "observationReviewTime"
  | "highAcuity"
  | "legalFormDueAtDate"
  | "legalFormDueAtTime";

/**
 * Every question `referralDraftBlockedReason` would still stop on, in the order the form shows
 * them (overall review, 20 Oct 2026). After a blocked Send the form marks each one and moves focus
 * to the first, as the registration form does (DA-12). Empty exactly when that function returns
 * `undefined`. A half-typed expiry names only its blank half.
 */
export function referralDraftMissingFields(draft: ReferralDraftAnswers): ReferralDraftField[] {
  const missing: ReferralDraftField[] = [];
  if (!draft.patientFound && !draft.unidentified) missing.push("patient");
  if (draft.cohort === undefined) missing.push("cohort");
  if (draft.security === undefined) missing.push("security");
  if (draft.sex === undefined) missing.push("sex");
  if (draft.gender === undefined) missing.push("gender");
  if (draft.legalStatus === undefined) missing.push("legalStatus");
  if (draft.urgency === undefined) missing.push("urgency");
  if (draft.observation === undefined) missing.push("observation");
  if (draft.highAcuity === undefined) missing.push("highAcuity");
  if ((draft.legalFormDueAtDate !== "") !== (draft.legalFormDueAtTime !== "")) {
    missing.push(draft.legalFormDueAtDate === "" ? "legalFormDueAtDate" : "legalFormDueAtTime");
  }
  if (observationReviewTimeUnreadable(draft)) missing.push("observationReviewTime");
  return missing;
}

/**
 * `RECORD_EXAMINATION`'s own preconditions (`ward-flow-reducer.ts`'s `case "RECORD_EXAMINATION"`),
 * named here in the same order so the control can never advertise an action the reducer would
 * refuse — the same discipline `ward-screen.tsx`'s `referralAnswerBlocked`/`pullBlockedReason` and
 * `officer-screen.tsx`'s four `*BlockedReason` functions already hold to.
 */
export function examinationBlockedReason(movement: Movement, who?: string): string | undefined {
  // There is deliberately no form check here. The reducer's "form must be 1A" rejection was
  // deleted on 2026-08-24 — an examination may be recorded for any patient, on any form or on
  // none — so a form check here would advertise a refusal the reducer would not make, which is
  // the exact drift this function exists to prevent.
  //
  // T8 / owner item 7 (2026-09-17): mirrors `RECORD_EXAMINATION`'s own repeat-examination guard —
  // a second examination is refused UNLESS the current record's own outcome is
  // `"further_examination_ordered"`, the one outcome that settles nothing and exists only to say
  // a repeat is coming.
  if (movement.examination && movement.examination.outcome !== "further_examination_ordered") {
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    return `${who ?? "This patient"} was already examined.`;
  }
  return undefined;
}

/**
 * Owner ruling 14 (2026-09-17) / Task RB4: a patient on a legal form cannot be referred to a
 * community team until a psychiatric examination outcome has been recorded. If "further
 * examination ordered" is recorded, the referral remains locked until a conclusive outcome is
 * reached. Voluntary patients are not blocked.
 */
export function communityReferralBlockedReason(movement: Movement): string | undefined {
  if (movement.closure) {
    return `Cannot refer a closed movement (${movement.closure.reason}).`;
  }
  if (movement.transport?.collectedAt !== undefined) {
    // P2-5 (Ward Lead audit, 2026-09-17): no internal event name in user-facing text. The stop
    // control itself waits on an owner question (see the build plan), so this names who to
    // contact rather than a control this screen does not offer.
    return `The patient has been collected. Ask the coordinator to stop the journey, using the "Stop transport" control on the console; the bed stays pulled until it is released.`;
  }
  const isOnForm = !!movement.legalForm || (movement.legalStatus !== undefined && movement.legalStatus !== "Voluntary");
  if (isOnForm) {
    if (!movement.examination || movement.examination.outcome === "further_examination_ordered") {
      return "Not offered until the examination outcome is recorded.";
    }
  }
  return undefined;
}

/**
 * RB3, item 19: `RECORD_ED_OUTCOME`'s own preconditions (`ward-flow-reducer.ts`'s
 * `case "RECORD_ED_OUTCOME"`), named here in the same order for the same reason
 * `examinationBlockedReason` above states. This gate is only closure/collection — it opens the
 * whole "Record outcome" control, both choices. It carried no form/examination gate at all until
 * owner answer 1 (second round, 2026-09-17); that gate exists now, but only on the "for discharge"
 * choice, and lives in `dischargeChoiceBlockedReason` below rather than here, because "for
 * community follow-up" is still never blocked by it — see that function's own doc comment.
 */
export function edOutcomeBlockedReason(movement: Movement): string | undefined {
  if (movement.closure) {
    return `Cannot record an outcome for a closed movement (${movement.closure.reason}).`;
  }
  if (movement.transport?.collectedAt !== undefined) {
    // P2-5 (Ward Lead audit, 2026-09-17): no internal event name in user-facing text — see
    // `communityReferralBlockedReason`'s own identical fix immediately above.
    return `The patient has been collected. Ask the coordinator to stop the journey, using the "Stop transport" control on the console; the bed stays pulled until it is released.`;
  }
  return undefined;
}

/**
 * Owner answer 1 (second round, 2026-09-17): the same gate `communityReferralBlockedReason` (and
 * the reducer's F4 refusal on `REFER_TO_COMMUNITY_TEAM`) already enforces, mirrored onto
 * `RECORD_ED_OUTCOME`'s "for_discharge" outcome and enforced identically in the reducer's own
 * `case "RECORD_ED_OUTCOME"`. A patient on a legal form cannot be recorded "for discharge" until a
 * conclusive examination outcome is recorded; "further examination ordered" settles nothing, so it
 * does not unlock this either. Deliberately narrower than `edOutcomeBlockedReason` above: it gates
 * only the "For discharge" choice inside the open control, never "For community follow-up", which
 * the reducer's own case comment already states carries no such restriction — a patient who still
 * needs a community follow-up is not being found fit to simply go home.
 */
export function dischargeChoiceBlockedReason(movement: Movement): string | undefined {
  const isOnForm = !!movement.legalForm || (movement.legalStatus !== undefined && movement.legalStatus !== "Voluntary");
  if (isOnForm && (!movement.examination || movement.examination.outcome === "further_examination_ordered")) {
    return "Not offered until the examination outcome is recorded.";
  }
  return undefined;
}

/**
 * Mirrors `case "HANDOVER_READY"` exactly, in the reducer's own order.
 *
 * ⚠️ **THE SECOND PRECONDITION ARRIVED 2026-08-31 and this comment said "the ONLY precondition is
 * stage `pulled`" until it did.** `HANDOVER_READY` used to fabricate a transport job on the spot,
 * inventing the provider and deriving the escort answer from legal status; it now REQUIRES a booked
 * one — except when a "no transport needed" answer is recorded (`transportNeed?.needed === false`),
 * which the reducer admits and this function must mirror so such a patient is not told to book.
 * Without the second check here the button would offer a handover the reducer refuses — a
 * control advertising an action it cannot perform, which is the wiring convention this repository
 * enforces, and the reason a mirror function has to be updated in the same change as the rule it
 * mirrors rather than the next time somebody reads it.
 */
export function handoverBlockedReason(movement: Movement, who?: string): string | undefined {
  // Mirrors the reducer's `noTransportNeeded` exception (`HANDOVER_READY`): a movement with no
  // transport job may still be marked handover-ready when a "no transport needed" answer is
  // recorded (`transportNeed.needed === false`, or a job whose own `needed` is false), so it must
  // not be told to book transport first.
  const noTransportNeeded = movement.transportNeed?.needed === false || movement.transport?.needed === false;
  if (!movement.transport && !noTransportNeeded && movement.stage === "pulled") {
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    return `${who ?? "This patient"} has no transport booked — book it first, then mark the handover ready.`;
  }
  // Blocker review (26 Oct 2026): already ready is not "not bed pulled", so it is named as it is.
  if (movement.stage === "handover_ready") {
    return `${who ?? "This patient"} is already marked handover ready.`;
  }
  if (movement.stage !== "pulled") {
    return `${who ?? "This patient"} is ${stageCopy[movement.stage].label.toLowerCase()}, not bed pulled — a handover can only be marked ready once a bed is pulled.`;
  }
  return undefined;
}

/**
 * Mirrors `case "BOOK_TRANSPORT"` in the reducer, in the reducer's own order, so this control can
 * never advertise a booking the reducer would refuse — the same discipline `handoverBlockedReason`
 * above and `ward-screen.tsx`'s `*BlockedReason` functions already hold to. The closure check the
 * reducer makes first has no counterpart here because `patients` has already excluded every closed
 * movement before a card is rendered.
 *
 * ⚠️ **THE ESCORT ANSWER IS DELIBERATELY NOT CHECKED HERE.** This function answers "may this
 * movement be booked at all", which is a fact about the MOVEMENT. Whether the person has answered
 * the escort question is a fact about a half-filled form, and is checked by
 * `transportAnswersBlockedReason` at the confirm control instead. One message standing for both
 * would tell somebody a patient cannot be transported when in truth they have not finished asking.
 */
export function bookTransportBlockedReason(movement: Movement, who?: string): string | undefined {
  // Owner answer 30 (2026-09-17), build plan item 30: cancelling a booked transport no longer
  // leaves a replacement job standing while a bed is held, so a person must be able to book again
  // from `handover_ready` as well as `pulled` — before this ruling nobody needed to, because a job
  // was always already there. The message still says "not bed pulled" when it fires, which stays
  // true: every stage this guard now refuses genuinely is earlier than `pulled`.
  if (movement.stage !== "pulled" && movement.stage !== "handover_ready") {
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    return `${who ?? "This patient"} is ${stageCopy[movement.stage].label.toLowerCase()}, not bed pulled — transport can only be booked once a bed is pulled, or after handover is marked ready.`;
  }
  // The reducer refuses a second booking because it would replace a job a provider may already
  // have accepted and take the acceptance timestamps with it. Reachable on this screen the moment
  // a booking succeeds: `BOOK_TRANSPORT` leaves the movement at `pulled`, so the card that just
  // booked re-renders with the control unavailable rather than offering a replacement.
  if (movement.transport) {
    return `${who ?? "This patient"} already has transport booked. Cancel that job before booking a new one.`;
  }
  return undefined;
}

/**
 * WLQ-5, owner ruling 2026-09-15: a WARNING beside the booking control, never a block, when
 * transport is about to be booked for an involuntary patient with no Form 4A recorded.
 *
 * States only the fact the record holds — that no Form 4A is recorded — and nothing else. Never a
 * duration, never a claim about what the Mental Health Act requires: see `ward-legal-figure-guard`
 * and `ED_ACCESS_TARGET_MINUTES`'s own comment for why this file is careful about that distinction.
 * `legalFormName` resolves the title from the Chief Psychiatrist register the same way every other
 * form mention on this screen does, rather than a locally invented label.
 *
 * A Voluntary patient gets no sentence at all — there is no legal form question for them — and
 * neither does a patient who already carries a 4A: the fact the record holds in that case is that
 * the form IS recorded, which is not a warning. `bookTransportBlockedReason` above decides whether
 * booking may happen at all; this decides only whether this sentence accompanies it, and the
 * booking stays fully possible in every case.
 */
export function transportLegalFormNotice(movement: Movement): string | undefined {
  if (movement.legalStatus === "Voluntary") return undefined;
  if (movement.legalForm?.code === "4A") return undefined;
  return `No ${legalFormName({ code: "4A" })} is recorded for this patient.`;
}

/**
 * WHY A REFERRAL CANNOT BE WITHDRAWN — the reducer's own guards, restated so the control is absent
 * rather than bouncing.
 *
 * ⚠️ **These conditions are `WITHDRAW_REFERRAL`'s own guards and must not drift from them.** A
 * control that offers an action the reducer will refuse teaches a clinician that this screen's
 * buttons are decorative, which is the one lesson a prototype must never teach. Each branch below
 * is the same rule as the reducer's, worded for the person holding the mouse rather than for a log.
 *
 * 🔴 **CORRECTED, Ward Lead audit (2026-09-17) — "a ward that pulled a bed has already acted...
 * collapsing the two would let a referrer silently release a bed somebody else is keeping free" IS
 * NOW FALSE.** Struck in place rather than deleted, because the reading that made it true is what a
 * reader will otherwise re-derive. WLQ-38 (owner, 2026-09-15) let the referrer (`ed`, which is the
 * only role this screen ever dispatches `WITHDRAW_REFERRAL` as — `confirmWithdrawReferral` in
 * `ed-screen.tsx` hardcodes `role: "ed"`) revoke an ACCEPTED referral too, once, up until the patient is collected —
 * the reducer's own post-acceptance branch (`ward-flow-reducer.ts`) permits it directly. This
 * helper went on blocking it regardless, which is the same "control offers less than the reducer
 * allows" defect this file's own doc comment warns against, just in the opposite direction from the
 * usual one: not a button the reducer refuses, but a button withheld from an action the reducer
 * accepts.
 */
export function withdrawReferralBlockedReason(movement: Movement, who?: string): string | undefined {
  if (movement.closure) {
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    return `${who ?? "This patient"} has already closed (${movement.closure.reason}). A withdrawal cannot be added to a movement that has ended.`;
  }
  // P2-5 (Ward Lead audit, 2026-09-17): no internal event name — see
  // `communityReferralBlockedReason`'s identical fix above.
  if (movement.transport?.collectedAt !== undefined) {
    return `The patient has been collected. Ask the coordinator to stop the journey, using the "Stop transport" control on the console; the bed stays pulled until it is released.`;
  }
  if (!movement.acceptedUnitId && movement.referredUnitIds.length === 0) {
    return `${who ?? "This patient"} holds no live referral to withdraw.`;
  }
  return undefined;
}
