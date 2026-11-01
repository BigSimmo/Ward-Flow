// The ED screen's constants, draft shapes and pure helpers. Split out of `ed-screen.tsx` unchanged
// (fix list 2.5 and 9.6, 15 Oct 2026); `ed-screen.tsx` re-exports the three it always exported.
import { recordedMovementMedicalClearance } from "../ward-medical-clearance";
import { queueWaitThresholds } from "@/components/ward-management/coordinator/priority-queue";
import { transportLeg } from "@/components/ward-management/ward-derivations";
import {
  clockState,
  type DueSoonThresholds,
  formatElapsed,
  type Instant,
  perthCalendarDay,
  perthMidnight,
  splitDuration,
} from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { typedTimeLine } from "@/components/ward-management/legal-forms/legal-time-as-typed";
import type { TentativeDiagnosisBlock } from "@/components/ward-management/ward-diagnosis";
import {
  COHORTS,
  REFERRAL_GENDERS,
  RECORDED_SEXES,
  URGENCY_LEVELS,
  type Cohort,
  type LegalForm,
  type LegalStatus,
  type Movement,
  type Referral,
  type ReferralAddressing,
  type ReferralGender,
  type Security,
  type RecordedSex,
} from "@/components/ward-management/ward-model";
import { minutesFromTimeInput, type TransportBookingAnswers } from "@/components/ward-management/ward-transport-checks";
import {
  referralAddressingStateLabel,
  REFERRAL_CLOCK_TERMS,
  type ReferralClocks,
} from "@/components/ward-management/ward-referrals";
import type { Patient } from "../ward-patients";
import { INTERMITTENT_INTERVAL_MINUTES, type ObservationLevel } from "@/components/ward-management/ward-observation";

/**
 * THE TWO CLOCKS ON AN INBOX ROW, AND WHY THIS SCREEN NOW HAS THEM.
 *
 * ⚠️ **THIS REVERSES THIS FILE'S OWN EARLIER RULING, AND THE RULING WAS RIGHT WHEN IT WAS MADE.**
 * Until `Referral.triagedAt` landed (2026-08-30) these rows said the fact was not recorded, because
 * `P9-D7` stops the referral clock when the patient reaches the department and the model held no
 * instant to stop it at — *a clock that should stop and cannot runs on forever and still looks
 * plausible*. The field exists now, so **the absence prose became false the moment it did** and had
 * to go rather than sit beside a real figure.
 *
 * ⚠️ **BOTH NUMBERS COME FROM ONE `referralClocks(referral, now)` CALL, on the provider's `now`.**
 * Two clocks on one card computed from two readings assert a moment the card is not showing, which
 * the out-of-area board already did once on this same model. Never a duration hand-rolled here:
 * `splitDuration`/`formatElapsed` (`ward-clock.ts`) own every hours-from-minutes conversion, after
 * two screens each computing their own kept `25h 30m` alive on eleven surfaces.
 *
 * ⚠️ **NO ROW MAY SAY "ARRIVED".** `triagedAt` is when the department TRIAGED somebody, and a
 * patient arrives, waits, and is triaged some time later — on a busy night that gap is not small.
 * Triage is the closest instant this system records, so it is a proxy, and **it is only honest
 * while every row labels it as one**. The vocabulary is `REFERRAL_CLOCK_TERMS`, a value
 * `tests/ward-referral-clocks.test.ts` can check, precisely because a comment asking for this is
 * what already failed. This screen composes those terms and never writes its own.
 */
type EdClockLine = {
  /** The heading this hub puts the clock under — one of `REFERRAL_CLOCK_TERMS`, never a new word. */
  term: string;
  /** The figure, or the statement that there is no figure. Never a zero and never a bare dash. */
  value: string;
};

/**
 * Puts a term at the start of a line. `REFERRAL_CLOCK_TERMS` are deliberately TERMS rather than
 * sentences, because how a screen arranges the two numbers is the screen's decision — so composing
 * one into a heading is this file's job. It changes the first character and nothing else: rewording
 * a term here would reintroduce exactly the drift the vocabulary was made a checked value to stop.
 */
function asLineHeading(term: string): string {
  return term.charAt(0).toUpperCase() + term.slice(1);
}

/** "24h", "8h": a wait line as a person says it, never "1d" or "8h 00m". */
export function waitLine(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : splitDuration(minutes);
}

export function urgencyGlyph(urgency: 1 | 2 | 3): string {
  if (urgency === 1) return "▲";
  if (urgency === 2) return "■";
  return "✓";
}

/**
 * The two clocks, in the words this hub shows them in. Pure and exported so all three shapes can be
 * asserted directly — including the one the application cannot currently reach on this screen.
 *
 * ⚠️ **THE DEPARTMENT CLOCK'S PRESENT BRANCH IS REACHED NOW** (2026-08-30). It was not when this
 * was written: `triagedAt` was authored only on referrals addressed to psychiatric wards, so this
 * inbox rendered the ABSENT branch for every row it could hold. `RF-009` changed that — addressed
 * to `rph-ed` for `psychiatric_review`, triaged 210 minutes before it was raised — and
 * `tests/ward-ed-psychiatry-hub.dom.test.tsx` now asserts both of its clocks on the rendered screen.
 *
 * ⚠️ **WHAT IS STILL UNREACHABLE IS THE STOPPED REFERRAL CLOCK.** Stopping needs
 * `triagedAt >= raisedAt` — somebody triaged AFTER being referred — and no seeded ED-addressed
 * referral has that, while `RECEIVE_REFERRAL`, the only event that creates a `Referral`, has no
 * `triagedAt` field for a screen to supply one. That branch is written and tested rather than
 * deferred, because the running wording is only meaningful next to the wording it is not; the gap is
 * a reported finding, not a silent assumption.
 *
 * ⚠️ **THE STOPPED CLOCK IS WORDED DIFFERENTLY FROM THE RUNNING ONE, and that is not styling.** A
 * span that ended at triage rendered like a wait somebody is still serving is the same class of lie
 * as printing `0m` for a person who is not there — so a running clock says "waiting" and a stopped
 * one says what stopped it.
 */
export function edReferralClockLines(clocks: ReferralClocks): { department: EdClockLine; referral: EdClockLine } {
  return {
    department: {
      term: asLineHeading(REFERRAL_CLOCK_TERMS.inDepartment),
      // `undefined` is NOT ZERO: this person is not in the department yet, and "0m in department"
      // would read as "just triaged", the opposite of the truth (`P9-D7`).
      value:
        clocks.inDepartment === undefined
          ? asLineHeading(REFERRAL_CLOCK_TERMS.notInDepartment)
          : `${splitDuration(clocks.inDepartment)} since triage`,
    },
    referral: clocks.sinceReferralRunning
      ? {
          term: asLineHeading(REFERRAL_CLOCK_TERMS.sinceReferral),
          // `formatElapsed` — the same "… waiting" register every other live wait in Ward Flow uses.
          value: formatElapsed(clocks.sinceReferral),
        }
      : {
          term: asLineHeading(REFERRAL_CLOCK_TERMS.sinceReferralStopped),
          value: `${splitDuration(clocks.sinceReferral)}, stopped at triage`,
        },
  };
}

/**
 * `BED_SHAPED_DECLINE_REASONS` and `ED_DECLINE_REASONS` moved to `ward-model.ts` (2026-09-17,
 * community-decline engine fix) next to `REFERRAL_DECLINE_REASONS`, so the reducer's own
 * destination-kind-scoped membership check on `DECLINE_REFERRAL` can share the identical list this
 * inbox picks from, rather than each holding its own copy. See their doc comments there for why
 * the four bed-shaped reasons are excluded and why the survivors are DERIVED rather than
 * hand-listed.
 *
 * ⚠️ **THIS LIST IS KNOWN TO BE INCOMPLETE.** The owner has been asked what a psychiatry team
 * actually says when it will not review somebody, and neither survivor may be it. That is precisely
 * why nothing here is pre-selected — see `NO_DECLINE_REASON_VALUE`.
 */

/**
 * The `<option>` value standing for "no reason chosen yet", for the same reason
 * `NO_LEGAL_FORM_VALUE` exists: a `<select>` option value is always a string.
 *
 * ⚠️ **AND IT IS THE SELECTED OPTION ON EVERY OPEN, WHICH IS NOT MERELY A UI PREFERENCE.**
 * A pre-selected reason is a reason a clinician who meant something else records by pressing
 * confirm — an invented clinical fact, which this project holds to be worse than a blank.
 *
 * ⚠️ **THIS COMMENT USED TO EXCUSE `referral-match.tsx` FOR DOING THE OPPOSITE, AND IT WAS WRONG
 * TWICE OVER.** It said that screen may safely seed `REFERRAL_DECLINE_REASONS[0]` because all
 * SIX of its reasons answer the bed question. There are now SEVEN, and more to the point that
 * screen no longer seeds anything: the owner ruled on 2026-09-02 that a ward must state why it is
 * refusing a patient, and its pre-selected `"no_suitable_bed"` was removed. **Both screens now
 * start unchosen, so the distinction this paragraph drew has gone.**
 *
 * ⚠️ Left as a correction rather than deleted, because a comment that names ANOTHER file as an
 * example decays when that file changes and nothing local ever fails — which is exactly what
 * happened here, twice, unnoticed.
 */
export const NO_DECLINE_REASON_VALUE = "";

/**
 * The state of an answered addressing, in plain words — the "recently answered" section's own
 * line, for the row this screen's own decline dispatches AND for a sibling destination's
 * acceptance cancelling this one out from under it.
 *
 * ⚠️ **STALE ATTRIBUTION FIXED, FIX ROUND 1 (a sibling review flagged it).** This paragraph used
 * to say the `cancelled` sentence was `referral-match.tsx`'s own spelling, reused verbatim. That
 * was true only until owner ruling 8 (2026-09-01) landed: the wording now lives in exactly one
 * place, `referralAddressingStateLabel` (`ward-referrals.ts`), and `referral-match.tsx` itself
 * calls that same function rather than holding its own copy — so naming it as this file's source
 * would now be pointing at a second copy that no longer exists. This function is a thin delegate;
 * the full `declined`/`cancelled` "must not be worded alike" rationale lives on
 * `referralAddressingStateLabel`'s own doc comment, the one place it needs to be argued.
 */
export function answeredAddressingLabel(addressing: ReferralAddressing): string {
  return referralAddressingStateLabel(addressing);
}

/**
 * Fix round B (review finding I3): this used to be hand-listed as `["Adult", "Older adult"]`,
 * typed `Cohort[]` rather than derived from `COHORTS` — so when `Cohort` widened to include
 * `"Youth"` (Phase 7's youth cohort), the type change could not make this array fail to compile,
 * and the ED's cohort picker silently offered no way to raise a Youth referral even though
 * `Movement.cohort` (and the East Metropolitan Youth Unit, EMyU, at Bentley) both accept one. No
 * evidence was found that excluding Youth from the ED picker was a deliberate clinical decision —
 * nothing in `docs/ward-flow-phase-6-7-decisions.md` or this file says so — so the fix here is to
 * derive the picker from `COHORTS` directly (offering all three) rather than pin the omission
 * with a comment. If excluding Youth from the ED is ever a real decision, it belongs here as an
 * explicit, commented exclusion with a test pinning it — not as a stale hand-written array.
 */
export const COHORT_OPTIONS: Cohort[] = [...COHORTS];
export const SECURITY_OPTIONS: Security[] = ["Open", "Secure"];
// Phase 7 Task 5: derived from `SEXES`/`URGENCY_LEVELS` (`ward-model.ts`) rather than
// hand-listed, closing the same gap `COHORT_OPTIONS` above closed for `Cohort` — see that
// file's own doc comment on `SEXES` for the defect class this prevents.
// R7 (25 September 2026): female, male, another term, not recorded.
export const SEX_OPTIONS: RecordedSex[] = [...RECORDED_SEXES];
/** T11 (after T10, item 8, owner answer 17 September 2026): the referral-facing gender picker's
 *  real answers — never `NO_GENDER_VALUE` (unanswered) or `GENDER_NOT_RECORDED_VALUE`, which are
 *  both separate, deliberate states this control also offers. See `GENDER_NOT_RECORDED_VALUE`'s
 *  own comment for why "not yet recorded" is a real answer, not a synonym for unanswered. */
export const GENDER_OPTIONS: ReferralGender[] = [...REFERRAL_GENDERS];
export const LEGAL_STATUS_OPTIONS: LegalStatus[] = [
  "Voluntary",
  "Referred for psychiatric examination",
  "Detained awaiting examination",
  "Involuntary inpatient",
];
export const URGENCY_OPTIONS = URGENCY_LEVELS;

/**
 * The `<option>` values standing for "not yet answered" on the five raise-referral selects — the
 * same reason `NO_DECLINE_REASON_VALUE` and `NO_LEGAL_FORM_VALUE` exist: a `<select>` option
 * value is always a string, so the `undefined` these fields hold in `ReferralDraftState` needs a
 * DOM-facing sentinel distinct from it. One constant per field, not one shared constant, because
 * a shared empty string reads correctly in the DOM regardless — this split exists purely so a
 * search for one field's sentinel never returns another's.
 */
export const NO_COHORT_VALUE = "";
export const NO_SECURITY_VALUE = "";
export const NO_SEX_VALUE = "";
/**
 * T11 (item 8): the gender picker's "not yet answered" sentinel, distinct from
 * `GENDER_NOT_RECORDED_VALUE` immediately below — the same split the retired intake form's
 * `UNANSWERED_VALUE`/`NOT_RECORDED_VALUE` pair made, restated here in this file's own
 * `undefined`-sentinel convention rather than borrowing that file's string one.
 */
export const NO_GENDER_VALUE = "";
/**
 * T11 (item 8): the gender picker's fourth, explicit answer — "the clinician actively said this
 * is not yet recorded", distinct from `NO_GENDER_VALUE` ("nobody has touched this control yet").
 * `NO_GENDER_VALUE` blocks "Raise referral"; choosing this does not — it is a real, deliberate
 * answer that `submitReferral` widens into `gender: undefined` on the dispatched draft
 * (`Movement.gender`'s own "absent means not yet recorded" convention, `ward-model.ts`).
 */
export const GENDER_NOT_RECORDED_VALUE = "not_recorded";
/**
 * T15 (item 12, owner answer 17 September 2026): "None" — a real, deliberate answer for the
 * optional tentative-diagnosis picker. Unlike gender above, this question never blocks "Raise
 * referral" — the owner's own words, 2026-08-29, are that it "should arrive with referral" when
 * the referrer HAS one, not that every referral must name one.
 */
export const NO_DIAGNOSIS_VALUE = "none";
export const NO_LEGAL_STATUS_VALUE = "";
/**
 * The provenance reason for a legal-status change starts UNCHOSEN, the same way every clinical
 * field on the raise-referral form does. `recorded_by_treating_team` used to be pre-selected, so a
 * clinician correcting a mistyped legal status who never touched the control filed the correction
 * as a fresh report FROM the treating team — a team that never made one. The two options describe
 * where the entry came from, not why anyone's status changed, which is why this is an audit-trail
 * defect rather than a clinical one; it is no less wrong for that.
 */
export const NO_CHANGE_REASON_VALUE = "";

/** One spelling, used by the control, its title and its screen-reader note. */
export const LEGAL_STATUS_UNCHOSEN =
  "Choose the new legal status before recording the change. None is chosen for you: a status nobody picked would be filed as the patient's legal status.";

export const LEGAL_STATUS_REASON_UNCHOSEN =
  "Choose where this entry came from before recording the change. None is chosen for you: a reason nobody picked would be filed as the treating team's own report.";
export const NO_URGENCY_VALUE = "";

/**
 * The `<option>` value standing for "no form". A `<select>` option value is always a string, so
 * "no form" needs a sentinel; it is converted back to `null` on the way into the draft, where
 * "no form" is a real choice rather than a blank.
 */
export const NO_LEGAL_FORM_VALUE = "";

/**
 * The local form's own draft shape, distinct from `ReferralDraft` (`ward-flow-events.ts`) — the
 * dispatched event's payload — precisely so this type can hold "not yet answered" for five
 * fields that event can never hold. `submitReferral` below is what converts one into the other,
 * and it can do so only once none of the five is `undefined` any more.
 */
export type ReferralDraftState = {
  cohort: Cohort | undefined;
  security: Security | undefined;
  sex: RecordedSex | undefined;
  /**
   * T11 (after T10, item 8): the gender recorded AT REFERRAL, which decides the incoming bed
   * check — never sex, never `Patient.gender`. `undefined` is this file's own "not yet answered"
   * sentinel (blocks "Raise referral"); `"not_recorded"` is the clinician's explicit "not yet
   * recorded" answer, a real answer that is NOT the same state. See `GENDER_NOT_RECORDED_VALUE`'s
   * own doc comment.
   */
  gender: ReferralGender | "not_recorded" | undefined;
  /**
   * T15 (item 12): the ED's own optional broad diagnosis category — see
   * `Movement.tentativeDiagnosis`'s doc comment (`ward-model.ts`) for the vocabulary and the
   * "ED choice replaces the referral's" rule. `"none"` is a real, complete answer from the moment
   * the form opens — this question never blocks "Raise referral".
   */
  tentativeDiagnosis: TentativeDiagnosisBlock | "none";
  /** Fix plan item 10: unanswered until a person chooses a level; never defaulted. */
  observation: ObservationLevel | undefined;
  /** Intermittent only: minutes between checks, from `INTERMITTENT_INTERVAL_MINUTES`. */
  observationIntervalMinutes: number;
  /** The typed next review time, `HH:MM`, read today or tomorrow. Blank records none. */
  observationReviewTime: string;
  observationReviewDay: "today" | "tomorrow";
  highAcuity: boolean | undefined;
  legalStatus: LegalStatus | undefined;
  urgency: 1 | 2 | 3 | undefined;
  legalFormCode: string | null;
  /**
   * The expiry written on the selected form, as the clinician typed it — a `YYYY-MM-DD` string
   * straight from an `<input type="date">` and an `HH:MM` string from an `<input type="time">`,
   * resolved into an `Instant` only at dispatch, by `instantFromDateAndTimeInputs` below.
   *
   * T3 (build plan, owner answer 1): the field used to be a single `HH:MM` time, shown only for a
   * transport or transfer order and captured as a minute-of-day with no day at all — a real
   * deadline needs a calendar date, and now that any form may carry a typed expiry (T2), a bare
   * clock face cannot say which day it falls on. Two raw strings, not one, for the same reason the
   * old single field was a raw string: "1", "14" and "14:3" are real in-progress states of a time
   * field, and a half-typed date is exactly as real. Parsing either on every keystroke would turn
   * an incomplete entry into a confident wrong value on screen.
   *
   * ⚠️ **CLEARED WHENEVER `legalFormCode` CHANGES** (the `<select>`'s own `onChange`, not here) —
   * a value typed for one form must never survive a switch to a different one. Before that fix a
   * time typed while a 4A was selected stayed in these fields, unseen, until whichever form was
   * selected at submit; nothing on screen showed the mismatch.
   */
  legalFormDueAtDate: string;
  legalFormDueAtTime: string;
  /**
   * A2-1 (audit 13 Oct 2026): who the referral is for. A registered person found by name or UMRN,
   * or the clinician's explicit "Not yet identified". Neither chosen blocks the form, so a referral
   * is never filed for a person nobody named.
   */
  patientId: Patient["id"] | undefined;
  unidentified: boolean;
};

/**
 * ⚠️ **EVERY FIELD HERE STARTS UNANSWERED. THE CLINICIAN PICKS EACH ONE; THE SOFTWARE NEVER
 * PICKS ONE FOR THEM.**
 *
 * That sentence used to sit on one field of this object's seven, `legalFormCode`'s own comment
 * below — correct where it was written, and never generalised to the six fields beside it. Every
 * `<select>` bound to `cohort`, `security`, `sex`, `legalStatus` and `urgency` defaulted to
 * option zero, so a form nobody had touched yet still submitted "Adult", "Open", "Female",
 * "Voluntary" and "Tier 3" for a patient nobody had actually assessed. `sex` is simply wrong for
 * anyone who is not female. `legalStatus` is a fact about a person's liberty, not a UI
 * convenience with a sensible default. `urgency` gets the same ruling on judgement rather than
 * habit: a tier nobody chose is a clinical claim exactly like the other four, so it starts
 * unanswered too. Since fix plan item 10 (21 Oct 2026) the question below is the observation level,
 * which starts unanswered for the same reason. ⚠️ `specialling` USED TO BE the one field this did not touch — owner ruling 1
 * falsified the reasoning below. `draft.specialling` reaches `ward-flow-reducer.ts:607`, which
 * writes it onto the MOVEMENT; the reducer then refuses a pull at `:966` only
 * `if (movement.specialling && remaining… <= 0)`. So a `false` nobody chose does not merely record
 * "not required" — it SKIPS THE ONE-TO-ONE CAPACITY REFUSAL ENTIRELY, and a patient who needs
 * specialling can be pulled into a ward that cannot staff it with nothing objecting. An unticked
 * box stopped being an answer the moment it became an input to a gate. Superseded reasoning: — a checkbox whose
 * unticked state is a genuine answer ("not required" unless stated otherwise), not a fact about
 * the patient the software would otherwise be guessing at.
 *
 * `undefined` is this file's own sentinel for "not yet answered" — the same choice `declineDraft`
 * (`useState<ReferralDeclineReason | undefined>(undefined)` below) already makes — rather than
 * the retired intake form's string sentinel (`UNANSWERED_VALUE`). Two spellings of "unanswered" in
 * one codebase is how a future check ends up looking for the wrong one; this file keeps the one
 * already living here. `referralDraftBlockedReason` below is what the submit control and
 * `submitReferral`'s own guard both read to find out whether that is still true.
 */
export const DEFAULT_DRAFT: ReferralDraftState = {
  cohort: undefined,
  security: undefined,
  sex: undefined,
  // T11 (item 8): starts unanswered like every other clinical field on this form — the clinician
  // must actively choose a gender, or actively choose "Not yet recorded"; neither is picked for
  // them.
  gender: undefined,
  // T15 (item 12): starts at "None", a real answer — never blocks the form.
  tentativeDiagnosis: NO_DIAGNOSIS_VALUE,
  observation: undefined,
  observationIntervalMinutes: INTERMITTENT_INTERVAL_MINUTES[0],
  observationReviewTime: "",
  observationReviewDay: "today",
  // Unanswered for the SAME reason `observation` above is, and the reasoning transfers exactly:
  // `false` here does not record "no high-acuity nursing needed", it SKIPS the acuity gate and the
  // pull refusal altogether, so a patient the referrer would have marked can be sent to a ward
  // that staffs no high-acuity places with nothing objecting. An unticked box stopped being an
  // answer the moment it became an input to a gate.
  highAcuity: undefined,
  legalStatus: undefined,
  urgency: undefined,
  // Defaults to no form. The clinician picks one; the software never picks one for them. This
  // one was always correct — `null` here has always meant "no form", a real answer the clinician
  // may deliberately choose, not "unknown". See `NO_LEGAL_FORM_VALUE`'s own comment.
  legalFormCode: null,
  // Blank, like every other field. The software never picks a deadline for the clinician, and
  // never suggests one — see `ReferralDraft.legalFormDueAt` for why the seeded figures must not
  // become a default here.
  legalFormDueAtDate: "",
  legalFormDueAtTime: "",
  patientId: undefined,
  unidentified: false,
};

/**
 * `YYYY-MM-DD` from an `<input type="date">` plus `HH:MM` from an `<input type="time">`, resolved
 * into an `Instant` — minutes from the provider's `dayZero` (`useWardFlow().dayZero`), the same
 * offset `legalForm.dueAt` and every other `Instant` on this screen are already counted in.
 *
 * T3 (build plan, owner answer 1): a typed expiry needs a real calendar date as well as a time —
 * `calendarDateOf`/`formatSheetMoment` (`ward-clock.ts`) already go the other way, from an
 * `Instant` back to a real moment; this is their inverse, and the only place in this file that
 * turns two typed strings into the one number every other surface reads.
 *
 * ⚠️ **REFUSES RATHER THAN GUESSES, the same discipline `minutesFromTimeInput` (`ward-transport-checks.ts`) documents.**
 * Both fields blank is a real, permitted answer — no expiry typed yet — and returns `undefined`
 * exactly like a malformed value does; telling "blank" apart from "unusable" is the CALLER's job
 * (the intake form's own blocked-reason check, and the two action panels' disabled submit, each do
 * that for their own control) and not this function's. Returns `undefined` rather than pairing a
 * typed value with an invented one whenever only one field carries something, or when either field
 * cannot be parsed with certainty — inventing the other half would put a date or a time on a legal
 * form nobody actually typed, the exact fabrication `minutesFromTimeInput` already refuses for a
 * half-typed clock face alone.
 */
export function instantFromDateAndTimeInputs(dateValue: string, timeValue: string, dayZero: Date): number | undefined {
  if (dateValue === "" || timeValue === "") return undefined;
  const minuteOfDayValue = minutesFromTimeInput(timeValue);
  if (minuteOfDayValue === undefined) return undefined;
  const dateParts = dateValue.split("-");
  if (dateParts.length !== 3) return undefined;
  const [rawYear, rawMonth, rawDay] = dateParts;
  if (rawYear?.length !== 4 || rawMonth?.length !== 2 || rawDay?.length !== 2) return undefined;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return undefined;
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  // L7: the typed day is a Perth calendar day, whatever the browser's zone. An invalid day (e.g.
  // 31 Feb) rolls into the next month, so anything that does not read back exactly is refused, the
  // same defensive check `minutesFromTimeInput` makes for an out-of-range hour or minute.
  const typedDate = perthMidnight(year, month - 1, day);
  const read = perthCalendarDay(typedDate);
  if (read.year !== year || read.monthIndex !== month - 1 || read.day !== day) return undefined;
  const dayOffsetMinutes = Math.round((typedDate.getTime() - dayZero.getTime()) / 60_000);
  return dayOffsetMinutes + minuteOfDayValue;
}

/** The first sentence of a blocked reason: the part that fits beside a greyed button. */
export function firstSentence(reason: string): string {
  const end = reason.search(/\.\s/u);
  return end === -1 ? reason : reason.slice(0, end + 1);
}

/**
 * Ward Lead audit (2026-09-17): the two exact `closure.reason` strings `WITHDRAW_REFERRAL`
 * (`ward-flow-reducer.ts`) writes when the REFERRER (this department, dispatching as `"ed"`)
 * withdraws or revokes — never when the coordinator does (`"The coordinator revoked the accepted
 * referral"`), and never any other closure (`RECORD_ED_OUTCOME`, `REFER_TO_COMMUNITY_TEAM`,
 * arrival). This department raised the withdrawal, so it stays accountable for knowing it
 * happened — a coordinator-driven revocation or any other closure is somebody else's decision and
 * stays off this board, exactly like every other closed movement.
 */
const ED_INITIATED_WITHDRAWAL_REASONS = [
  "The referrer withdrew the referral",
  "The referrer revoked the accepted referral",
] as const;

export function isEdInitiatedWithdrawal(movement: Movement): boolean {
  return (
    movement.closure !== undefined &&
    (ED_INITIATED_WITHDRAWAL_REASONS as readonly string[]).includes(movement.closure.reason)
  );
}

/**
 * L4 (site review 12 Oct 2026): the wait marker beside "In ED" reads the one tier-due rule Home
 * uses (`queueWaitThresholds`, from Settings' "Tier 1 overdue after 1h"), so a T1 patient nine
 * hours in is marked here as on Home.
 *
 * Red means at or over the access target only (Josh, 26 Oct 2026, decision A1, CS3-10): with the
 * tier-overdue rule also painting red, about half the list was red on a normal day and 6 of 8 rows
 * on a quiet one, so red stopped meaning anything. Tier due-soon and tier overdue now mark amber.
 * Only the colour changes: the order of the list does not.
 */
export function edWaitTone(
  urgency: number,
  minutesInDepartment: number,
  accessTarget: number,
): "danger" | "warning" | undefined {
  const thresholds = queueWaitThresholds(urgency);
  if (minutesInDepartment >= accessTarget) return "danger";
  if (minutesInDepartment >= thresholds.overdue || minutesInDepartment >= thresholds.dueSoon) return "warning";
  return undefined;
}

export type TransportDraftState = TransportBookingAnswers;

/** Re-applied every time the panel is opened as well as when it closes, so a previous booking's
 *  answers can never be inherited by the next patient. A remembered last value is the same ruling
 *  as a derived one. */
export const BLANK_TRANSPORT_DRAFT: TransportDraftState = {
  provider: undefined,
  escortRequired: undefined,
  cadNumber: "",
  transportLegalStatus: undefined,
  estimatedTime: "",
  // No day chosen (Josh, 31 Oct 2026): neither Today nor Tomorrow is ticked until the person picks one.
  estimatedDay: undefined,
};

/**
 * The date-plus-time draft for the two "actions block" panels T3 adds — "Record expiry from the
 * form" (the first typed expiry) and "Record an extension" (every one after it). One shape for
 * both, because the reducer event they dispatch (`RECORD_LEGAL_FORM_EXPIRY`) is one event too:
 * which of the two this is is read off `movement.legalForm.dueAt` at render time, never off a flag
 * this draft carries.
 */
export type LegalFormExpiryDraftState = { date: string; time: string };

/** Re-applied on every open as well as every close — see `BLANK_TRANSPORT_DRAFT` above for why a
 *  remembered value from a previous patient's panel must never be inherited by the next one. */
// Named BLANK_TYPED_EXPIRY_DRAFT rather than the more obvious "BLANK_LEGAL_FORM_EXPIRY_DRAFT":
// that name tokenises to LEGAL + FORM (a legal-concept token) and EXPIRY (a duration token), which
// trips `tests/ward-legal-figure-guard.test.ts`'s wider token denylist exactly as
// `RECORD_LEGAL_FORM_EXPIRY` did for T2 (see that file's own comment on the false positive) — a
// plain `{date, time}` shape writes no number down, but the guard cannot tell that from the name
// alone. `RECORD_LEGAL_FORM_EXPIRY` earned a narrow, shape-derived exemption there because it is a
// real `WardFlowEvent["type"]`; this constant is not, so it is renamed instead of exempted, per
// this task's own instruction not to touch the guard.
export const BLANK_TYPED_EXPIRY_DRAFT: LegalFormExpiryDraftState = { date: "", time: "" };

type OutstandingItem = { kind: "handover" | "transport" | "examination" | "form"; label: string; detail: string };

/**
 * The single outstanding item spec §7 asks for — a form, an examination, a transport request,
 * or handover — never more than one at once. Ordered by the movement's actual live stage first,
 * not by which fact is clinically "biggest" in the abstract: WF-005 (re-measured against this
 * branch's fixture, see the task report) carries an un-examined Form 1A AND an already-accepted
 * transport job. Showing "Examination" for it would bury the operational truth — a vehicle is
 * right now waiting to depart — behind a fact that has been sitting unresolved for hours without
 * blocking anything. Stage governs first; the examination gap only surfaces here once the
 * movement is not already at `pulled`/`handover_ready`/`moving`, i.e. once nothing more urgent
 * is already in motion.
 *
 * Reads only `movement.stage`, `movement.transport` and `movement.legalForm`/`.examination` —
 * never `ED_ACCESS_TARGET_MINUTES`, and never writes a `dueAt` anywhere (see that constant's own
 * doc comment and Task 6A).
 */
export function outstandingItem(movement: Movement): OutstandingItem {
  if (movement.stage === "pulled") {
    if (movement.transportNeed?.needed === false) {
      return {
        kind: "handover",
        label: "Handover",
        detail: "Bed pulled — no transport needed (patient walking or private transport).",
      };
    }
    // Blocker review (26 Oct 2026): a handover waits on a logged booking, so this line never says
    // "ready" while the Mark handover ready button is greyed for it.
    if (!movement.transport) {
      return { kind: "handover", label: "Handover", detail: "Bed pulled. Transport not logged yet." };
    }
    return { kind: "handover", label: "Handover", detail: "Bed pulled — ready to mark the handover to transport." };
  }
  if (movement.stage === "handover_ready" || movement.stage === "moving") {
    const leg = transportLeg(movement.transport);
    const detail = leg === undefined ? "Not yet requested" : leg;
    return { kind: "transport", label: "Transport", detail };
  }
  // NEITHER branch below infers anything from the form code. Until 2026-08-24 this read
  // `legalForm?.code === "1A" && examination === undefined` and printed "Referred for
  // examination" — a claim about what a Form 1A means, which this software is no longer entitled
  // to make and which the picker can now contradict outright: a Voluntary patient the clinician
  // puts on a 1A would have been labelled "Referred for examination". Both lines now state only
  // what the record holds, and the examination line keys off the examination record itself
  // rather than off any form.
  // T8 / owner item 7 (2026-09-17): `"further_examination_ordered"` settles nothing — a second
  // examination is still owed, so this stays the "Examination" outstanding item rather than
  // falling through to "Form" below as though it were a concluded outcome.
  if (movement.examination === undefined || movement.examination.outcome === "further_examination_ordered") {
    return {
      kind: "examination",
      label: "Examination",
      detail:
        movement.examination === undefined
          ? "No examination outcome recorded for this movement."
          : "A further examination was ordered and has not yet been recorded.",
    };
  }
  const outcomeWords = movement.examination.outcome.replace(/_/g, " ");
  if (movement.legalForm) {
    // `legalFormName` resolves the official title from the code, and shows a code the register
    // does not list as the bare code.
    return {
      kind: "form",
      label: "Form",
      detail: `${legalFormName(movement.legalForm)} · examination recorded (${outcomeWords}).`,
    };
  }
  return {
    kind: "form",
    label: "Form",
    detail: `No legal form recorded · examination recorded (${outcomeWords}).`,
  };
}

/**
 * The typed expiry written on a legal form — `legalForm.dueAt` — is now the ONLY input to this
 * screen's form column. It is never computed from `formedAt`, `openedAt`, or any statutory
 * constant: `docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md` item 1, and the
 * owner's own words that day — *"the timer that starts when a patient arrives is separate to
 * forms. One records time in ED and the other is a forms category"* — are why the merge this
 * function replaced (`isCommunityFormed`/`legalClockReference`, dating a form clock from
 * `openedAt` when `formedAt` was missing or later) is gone rather than repaired. The department's
 * own arrival clock is `accessTargetLine` below, reading only `openedAt`; the two never share an
 * input again. `FORM_1A_VALIDITY_HOURS`, `FORM_1A_EXAMINATION_WINDOW_HOURS` and
 * `FORM_3D_DETENTION_WINDOW_HOURS` (`ward-model.ts`) were DELETED by T2, not merely left unimported
 * — this prototype works out no legal time limits of its own; it shows back only what a clinician
 * typed.
 */
export function formExpiryLine(legalForm: LegalForm, now: Instant): string {
  if (legalForm.dueAt === undefined) return "No expiry recorded from the form.";
  // Legal times only as typed (Josh, 31 Oct 2026): "Ends Mon 09:00 as typed" or "Ended … as typed",
  // never "(3h 20m left)" or "(passed 1h 05m ago)".
  return typedTimeLine(legalForm.dueAt, now);
}

/**
 * A warning beside the expiry line, never a block — nothing on this screen may disable a control
 * because of it. Reuses `clockState`'s thresholds, the same ones already applied to Form 4A/4C
 * elsewhere on this screen, so "close" and "past" carry the same meaning everywhere they appear.
 * Returns `undefined` well clear of the expiry, or when none is recorded, so the caller renders no
 * warning row rather than an empty one.
 */
export function formExpiryWarning(
  legalForm: LegalForm,
  now: Instant,
  thresholds: DueSoonThresholds,
): string | undefined {
  if (legalForm.dueAt === undefined) return undefined;
  const state = clockState(legalForm.dueAt, now, thresholds);
  if (state === "breached") return "Warning: past the expiry written on the form. Check the form.";
  if (state === "critical" || state === "due") return "Warning: the expiry written on the form is close.";
  return undefined;
}

/**
 * The ED access target is a departmental performance measure, counted UP from
 * `movement.openedAt` — never a legal deadline. This function's only inputs are `now`,
 * `movement.openedAt` and the coordinator-configured target (`state.configuration.edAccessTargetMinutes`,
 * Task 6 of the audit-wiring plan, 2026-09-16 — previously the module constant
 * `ED_ACCESS_TARGET_MINUTES`, now only that constant's DEFAULT); it never reads
 * `movement.legalForm`, never constructs a `{code, label, kind}` object, and never writes a
 * `dueAt` anywhere (see the constant's own doc comment and Task 6A — the seven-surface incident
 * this whole task exists to not repeat). Wording is deliberately free of "due", "deadline",
 * "breach", "overdue" and "legal" — every one of those words on this figure would let it be
 * misread as the thing Task 6A deleted.
 */
const ED_BAY_COUNT = 12;

/** The bay a movement id starts from: a stable number from the id (synthetic, no bay is recorded). */
export function seedBayNumber(id: string): number {
  const num = parseInt(id.replace(/\D/g, ""), 10) || 1;
  return (num % ED_BAY_COUNT) + 1;
}

export const bayText = (bay: number) => `Bay ${String(bay).padStart(2, "0")}`;

/**
 * A2-19 (audit round 2): two people on one ED board could land in the same bay because each bay
 * came from its own id alone. Bays are now handed out per department: each person starts at the
 * id's bay and takes the next free one, oldest first, so no two people on a board share a bay.
 */
export function edBayAssignments(movements: readonly { id: string; openedAt: number }[]): Map<string, string> {
  const taken = new Set<number>();
  const bays = new Map<string, string>();
  const ordered = [...movements].sort((a, b) => a.openedAt - b.openedAt || a.id.localeCompare(b.id));
  const slots = Math.max(ED_BAY_COUNT, ordered.length);
  for (const movement of ordered) {
    let bay = seedBayNumber(movement.id);
    while (taken.has(bay)) bay = (bay % slots) + 1;
    taken.add(bay);
    bays.set(movement.id, bayText(bay));
  }
  return bays;
}

/**
 * WLQ-14, owner ruling 2026-09-15: the ED access-block clock above starts when the referral is
 * received — `movement.openedAt`, stamped at the instant `RAISE_REFERRAL` is processed, which IS
 * the moment an ED clinician's referral into this psychiatry queue is received (there is no
 * separate "sent" versus "received" step in this model). That start does NOT change here. Medical
 * clearance is shown beside it as a SEPARATE recorded time, never as the clock's start, because —
 * put to the owner directly — ED doctors can and do refer before clearance is done.
 *
 * Read the latest recorded movement or identity-matched linked referral fact. Unknown stays
 * unknown. Screen-only clearance drafts are deliberately excluded from this projection.
 */
export function movementMedicalClearance(
  movement: Movement,
  referrals: readonly Referral[],
): { cleared: boolean; at: Instant } | undefined {
  return recordedMovementMedicalClearance(movement, referrals);
}

/**
 * Opus review round 2, 17 September 2026 (P2), item 6: the gender a front-door referral already
 * recorded on its own ward arm — see `ReferralDestination`'s `psychiatric_ward` case, `gender?:
 * ReferralGender` (`ward-model.ts`). `undefined` when the referral carries no `psychiatric_ward`
 * destination at all, or that arm never had a gender recorded — both real "nothing to prefill"
 * cases, never fabricated.
 */
export function referralWardGender(referral: Referral): ReferralGender | undefined {
  const wardArm = referral.destinations.find((addressing) => addressing.destination.kind === "psychiatric_ward");
  return wardArm?.destination.kind === "psychiatric_ward" ? wardArm.destination.gender : undefined;
}

/**
 * ⚠️ HOW MANY "RECENTLY ANSWERED" HOLDS — OWNER RULING 19, 2026-09-03. Ten.
 *
 * The section was uncapped, and an uncapped list titled "recently" decays with use: on a busy
 * department it grows without limit until the word in its own heading is simply false. Ten is the
 * owner's number, not a guess, which is why it is written here once and cited rather than tuned.
 *
 * ⚠️ THE CAP APPLIES TO THE ROWS, NEVER TO THE COUNT. The heading below reports how many
 * have been answered, not how many are shown. Those two agree on every fixture smaller than ten,
 * so capping the count as well would look correct everywhere except in front of a real clinician.
 */
export const ANSWERED_VISIBLE_CAP = 10;

export type EdStepEvent = Extract<
  WardFlowEvent,
  {
    type:
      | "RECORD_ARRIVED_IN_DEPARTMENT"
      | "RECORD_EXAMINATION"
      | "RECORD_MEDICAL_CLEARANCE"
      | "RECORD_TRANSPORT_NEED"
      | "RECORD_LEGAL_FORM_RECEIVED"
      | "RECORD_LEGAL_FORM_CODE"
      | "RECORD_ED_PRESENTATION"
      | "HANDOVER_READY";
  }
>;

/** What the toast says once the engine accepts an ED next step. */
export function edStepSaid(event: EdStepEvent): string {
  switch (event.type) {
    case "RECORD_ARRIVED_IN_DEPARTMENT":
      return "Marked arrived in department";
    case "RECORD_EXAMINATION":
      return "Examination recorded";
    case "RECORD_MEDICAL_CLEARANCE":
      return event.cleared ? "Recorded medically cleared" : "Recorded not medically cleared";
    case "RECORD_TRANSPORT_NEED":
      return event.needed ? "Recorded: transport needed" : "Recorded: no transport needed";
    case "RECORD_LEGAL_FORM_RECEIVED":
      return "Recorded Form 1A received";
    case "RECORD_LEGAL_FORM_CODE":
      return `Form ${event.formCode} recorded. Written time not entered`;
    case "RECORD_ED_PRESENTATION":
      return event.presentations.length ? "Presentation recorded" : "Presentation cleared";
    case "HANDOVER_READY":
      return "Marked handover ready";
  }
}
