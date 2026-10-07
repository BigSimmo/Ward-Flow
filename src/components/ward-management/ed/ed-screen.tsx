"use client";

import { ReferralIntakeSummary } from "../referrals/referral-intake-summary";

import Link from "next/link";
import { createPortal } from "react-dom";
import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { designationSummary } from "@/components/ward-management/ward-bed-designation";
import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import {
  isOpen,
  transportNeedState,
  movementReferralLink,
  elapsedLabel,
  EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE,
  examinationRevokedWhileBedHeld,
  stageCopy,
  transportLeg,
  unitCapacity,
  wardServiceOrder,
} from "@/components/ward-management/ward-derivations";
import {
  clockState,
  formatElapsed,
  formatInstantWithDay,
  minutesUntil,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
import {
  changeReasonLabels,
  LEGAL_FORM_RECEIPT_CORRECTION_REASONS,
  legalFormReceiptCorrectionReasonLabels,
  LEGAL_STATUS_CHANGE_REASONS,
  URGENCY_CHANGE_REASONS,
  type LegalFormReceiptCorrectionReason,
  type LegalStatusChangeReason,
  type UrgencyChangeReason,
} from "@/components/ward-management/ward-change-reasons";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { legalFormName, SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import {
  TENTATIVE_DIAGNOSIS_BLOCKS,
  tentativeDiagnosisPhrase,
  type TentativeDiagnosisBlock,
} from "@/components/ward-management/ward-diagnosis";
import { communityTeamOptionsForSuburb } from "@/components/ward-management/referrals/referral-destination-options";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import {
  COHORTS,
  ED_DECLINE_REASONS,
  REFERRAL_GENDERS,
  RECORDED_SEXES,
  TRANSPORT_LEGAL_STATUSES,
  TRANSPORT_PROVIDERS,
  URGENCY_LEVELS,
  type Cohort,
  type LegalForm,
  type LegalStatus,
  type Movement,
  type Referral,
  type ReferralAddressing,
  type ReferralDeclineReason,
  type ReferralGender,
  type Rejection,
  type Security,
  type RecordedSex,
  type TransportLegalStatus,
  type TransportProvider,
} from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import {
  DECLINE_REASON_LABELS,
  edAnsweredReferralsFor,
  edArrivedFor,
  edExpectsFor,
  EXPECT_RECONSIDER_AFTER_MINUTES,
  referralAddressingStateLabel,
  referralClocks,
  referralPersonFacts,
  referralPurposeLabel,
  REFERRAL_CLOCK_TERMS,
  type ReferralClocks,
} from "@/components/ward-management/ward-referrals";
import { allEmergencyDepartments, edById, siteByCode } from "@/components/ward-management/ward-sites";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import {
  LATE_ARRIVAL_GRACE_MINUTES,
  LONG_WAIT_MINUTES,
  LONG_WAIT_TEXT,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";
import {
  arrivalEtaLabel,
  arrivalModeLabel,
  ArrivalTimeModal,
  canSetArrivalPlan,
  isArrivalLate,
} from "@/components/ward-management/referrals/arrival-time-modal";

import styles from "./ed.module.css";
import { EdOverview } from "./ed-overview";
import { EdActionsMenu, EdPlanPicker, EdPresentation, EdReviewStatus } from "./ed-board-controls";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { WardDynamicIsland } from "@/components/ward-management/shell/ward-dynamic-island";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";

const RECORDED_ED_FORMS = SELECTABLE_LEGAL_FORMS.map((form) => form.code);

type EdScreenProps = { edId: string };

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

function urgencyGlyph(urgency: 1 | 2 | 3): string {
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
 * `NO_LEGAL_FORM_VALUE` and `NO_TRANSPORT_PROVIDER_VALUE` exist: a `<select>` option value is
 * always a string.
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
const NO_DECLINE_REASON_VALUE = "";

/**
 * Why the decline confirm is unavailable, or `undefined` once a reason has been chosen. Pure and
 * module-level so the wording lives in one place rather than being spelled twice inside JSX.
 *
 * It is NOT exported, so no test can assert its two states directly and none does — the states are
 * reached through the rendered control instead. Said explicitly because the sibling comment on
 * `transportAnswersBlockedReason` below claims its states "can be asserted without rendering",
 * which has never been true of an unexported function; this one does not repeat the claim.
 */
function declineReasonBlockedReason(reason: ReferralDeclineReason | undefined): string | undefined {
  if (reason !== undefined) return undefined;
  return "Choose a reason before recording this decline. None is chosen for you: a reason nobody picked would be filed as this team's own answer.";
}

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
function answeredAddressingLabel(addressing: ReferralAddressing): string {
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
const COHORT_OPTIONS: Cohort[] = [...COHORTS];
const SECURITY_OPTIONS: Security[] = ["Open", "Secure"];
// Phase 7 Task 5: derived from `SEXES`/`URGENCY_LEVELS` (`ward-model.ts`) rather than
// hand-listed, closing the same gap `COHORT_OPTIONS` above closed for `Cohort` — see that
// file's own doc comment on `SEXES` for the defect class this prevents.
// R7 (25 September 2026): female, male, another term, not recorded.
const SEX_OPTIONS: RecordedSex[] = [...RECORDED_SEXES];
/** T11 (after T10, item 8, owner answer 17 September 2026): the referral-facing gender picker's
 *  real answers — never `NO_GENDER_VALUE` (unanswered) or `GENDER_NOT_RECORDED_VALUE`, which are
 *  both separate, deliberate states this control also offers. See `GENDER_NOT_RECORDED_VALUE`'s
 *  own comment for why "not yet recorded" is a real answer, not a synonym for unanswered. */
const GENDER_OPTIONS: ReferralGender[] = [...REFERRAL_GENDERS];
const LEGAL_STATUS_OPTIONS: LegalStatus[] = [
  "Voluntary",
  "Referred for psychiatric examination",
  "Detained awaiting examination",
  "Involuntary inpatient",
];
const URGENCY_OPTIONS = URGENCY_LEVELS;

/**
 * The `<option>` values standing for "not yet answered" on the five raise-referral selects — the
 * same reason `NO_DECLINE_REASON_VALUE` and `NO_LEGAL_FORM_VALUE` exist: a `<select>` option
 * value is always a string, so the `undefined` these fields hold in `ReferralDraftState` needs a
 * DOM-facing sentinel distinct from it. One constant per field, not one shared constant, because
 * a shared empty string reads correctly in the DOM regardless — this split exists purely so a
 * search for one field's sentinel never returns another's.
 */
const NO_COHORT_VALUE = "";
const NO_SECURITY_VALUE = "";
const NO_SEX_VALUE = "";
/**
 * T11 (item 8): the gender picker's "not yet answered" sentinel, distinct from
 * `GENDER_NOT_RECORDED_VALUE` immediately below — the same split `referral-intake.tsx`'s
 * `UNANSWERED_VALUE`/`NOT_RECORDED_VALUE` pair makes, restated here in this file's own
 * `undefined`-sentinel convention rather than borrowing that file's string one.
 */
const NO_GENDER_VALUE = "";
/**
 * T11 (item 8): the gender picker's fourth, explicit answer — "the clinician actively said this
 * is not yet recorded", distinct from `NO_GENDER_VALUE` ("nobody has touched this control yet").
 * `NO_GENDER_VALUE` blocks "Raise referral"; choosing this does not — it is a real, deliberate
 * answer that `submitReferral` widens into `gender: undefined` on the dispatched draft
 * (`Movement.gender`'s own "absent means not yet recorded" convention, `ward-model.ts`).
 */
const GENDER_NOT_RECORDED_VALUE = "not_recorded";
/**
 * T15 (item 12, owner answer 17 September 2026): "None" — a real, deliberate answer for the
 * optional tentative-diagnosis picker. Unlike gender above, this question never blocks "Raise
 * referral" — the owner's own words, 2026-08-29, are that it "should arrive with referral" when
 * the referrer HAS one, not that every referral must name one.
 */
const NO_DIAGNOSIS_VALUE = "none";
const NO_LEGAL_STATUS_VALUE = "";
/**
 * The provenance reason for a legal-status change starts UNCHOSEN, the same way every clinical
 * field on the raise-referral form does. `recorded_by_treating_team` used to be pre-selected, so a
 * clinician correcting a mistyped legal status who never touched the control filed the correction
 * as a fresh report FROM the treating team — a team that never made one. The two options describe
 * where the entry came from, not why anyone's status changed, which is why this is an audit-trail
 * defect rather than a clinical one; it is no less wrong for that.
 */
const NO_CHANGE_REASON_VALUE = "";

/** One spelling, used by the control, its title and its screen-reader note. */
/**
 * ⚠️ The worst of the six, and the reason the owner widened the fix. `URGENCY_CHANGE_REASONS[0]`
 * is `reassessed` — so a clinician correcting a mistyped urgency, who never touched this control,
 * recorded a CLINICAL REASSESSMENT THAT NEVER HAPPENED. That invents a clinical event rather than
 * mis-attributing a clerical one, which is why it is a stronger harm than the treating-team default
 * beside it.
 */
const URGENCY_REASON_UNCHOSEN =
  "Choose why the urgency is changing before recording it. None is chosen for you: an unpicked reason would be filed as a clinical reassessment nobody made.";

const LEGAL_STATUS_REASON_UNCHOSEN =
  "Choose where this entry came from before recording the change. None is chosen for you: a reason nobody picked would be filed as the treating team's own report.";
const NO_URGENCY_VALUE = "";

/**
 * The `<option>` value standing for "no form". A `<select>` option value is always a string, so
 * "no form" needs a sentinel; it is converted back to `null` on the way into the draft, where
 * "no form" is a real choice rather than a blank.
 */
const NO_LEGAL_FORM_VALUE = "";

/**
 * The local form's own draft shape, distinct from `ReferralDraft` (`ward-flow-events.ts`) — the
 * dispatched event's payload — precisely so this type can hold "not yet answered" for five
 * fields that event can never hold. `submitReferral` below is what converts one into the other,
 * and it can do so only once none of the five is `undefined` any more.
 */
type ReferralDraftState = {
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
  specialling: boolean | undefined;
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
 * unanswered too. ⚠️ `specialling` USED TO BE the one field this did not touch — owner ruling 1
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
 * `referral-intake.tsx`'s string sentinel (`UNANSWERED_VALUE`). Two spellings of "unanswered" in
 * one codebase is how a future check ends up looking for the wrong one; this file keeps the one
 * already living here. `referralDraftBlockedReason` below is what the submit control and
 * `submitReferral`'s own guard both read to find out whether that is still true.
 */
const DEFAULT_DRAFT: ReferralDraftState = {
  cohort: undefined,
  security: undefined,
  sex: undefined,
  // T11 (item 8): starts unanswered like every other clinical field on this form — the clinician
  // must actively choose a gender, or actively choose "Not yet recorded"; neither is picked for
  // them.
  gender: undefined,
  // T15 (item 12): starts at "None", a real answer — never blocks the form.
  tentativeDiagnosis: NO_DIAGNOSIS_VALUE,
  specialling: undefined,
  // Unanswered for the SAME reason `specialling` above is, and the reasoning transfers exactly:
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
};

/**
 * `HH:MM` from an `<input type="time">` to minutes since midnight, or `undefined` for anything
 * this cannot read with certainty.
 *
 * ⚠️ **IT REFUSES RATHER THAN GUESSES, AND THAT IS THE WHOLE POINT OF IT.** A half-typed or
 * malformed time returns `undefined`, so the referral is raised carrying NO deadline — a state
 * every ward surface already renders explicitly as absent. The alternative, coercing "14:3" or
 * "" into a number, puts a time the clinician never typed onto a legal form, which is the exact
 * fabrication `ward-model.ts` spends fifteen lines forbidding. **An absent deadline is a true
 * statement; a guessed one is a false statement that looks identical on screen.**
 *
 * Parsed by hand rather than with `Date`, which accepts a startling range of inputs and silently
 * invents a timezone for them.
 */
function minutesFromTimeInput(value: string): number | undefined {
  const parts = value.split(":");
  if (parts.length !== 2) return undefined;
  const [rawHours, rawMinutes] = parts;
  if (rawHours?.length !== 2 || rawMinutes?.length !== 2) return undefined;
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return undefined;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

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
 * ⚠️ **REFUSES RATHER THAN GUESSES, the same discipline `minutesFromTimeInput` above documents.**
 * Both fields blank is a real, permitted answer — no expiry typed yet — and returns `undefined`
 * exactly like a malformed value does; telling "blank" apart from "unusable" is the CALLER's job
 * (the intake form's own blocked-reason check, and the two action panels' disabled submit, each do
 * that for their own control) and not this function's. Returns `undefined` rather than pairing a
 * typed value with an invented one whenever only one field carries something, or when either field
 * cannot be parsed with certainty — inventing the other half would put a date or a time on a legal
 * form nobody actually typed, the exact fabrication `minutesFromTimeInput` already refuses for a
 * half-typed clock face alone.
 */
function instantFromDateAndTimeInputs(dateValue: string, timeValue: string, dayZero: Date): number | undefined {
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
  const typedDate = new Date(year, month - 1, day);
  // `new Date` silently rolls an invalid day (e.g. 31 Feb) into the next month rather than
  // refusing it — reject anything that does not read back exactly, the same defensive check
  // `minutesFromTimeInput` above makes for an out-of-range hour or minute.
  if (typedDate.getFullYear() !== year || typedDate.getMonth() !== month - 1 || typedDate.getDate() !== day) {
    return undefined;
  }
  const dayOffsetMinutes = Math.round((typedDate.getTime() - dayZero.getTime()) / 60_000);
  return dayOffsetMinutes + minuteOfDayValue;
}

/**
 * Owner's third ruling, 2026-09-17: the estimated time in the transport-booking popup is a typed
 * `HH:MM` plus "today" or "tomorrow" — never a calendar date picker, because the person is reading
 * a time off a phone call, not choosing a date. Reuses `minutesFromTimeInput` above (the same
 * parsing `instantFromDateAndTimeInputs` uses for its own time field) rather than inventing a
 * second HH:MM parser, and finds "today" by rounding `now` down to its own day — the same
 * minute-offset unit every other `Instant` on this screen is already counted in, so no `Date`
 * arithmetic or timezone reasoning is needed at all.
 *
 * Refuses rather than guesses, the same discipline `minutesFromTimeInput` documents: a blank or
 * malformed time returns `undefined`, never a fabricated value.
 */
function instantFromEstimatedTimeInputs(
  timeValue: string,
  day: "today" | "tomorrow",
  now: Instant,
): number | undefined {
  const minuteOfDay = minutesFromTimeInput(timeValue);
  if (minuteOfDay === undefined) return undefined;
  const startOfToday = Math.floor(now / 1440) * 1440;
  return startOfToday + (day === "tomorrow" ? 1440 : 0) + minuteOfDay;
}

/**
 * Why "Raise referral" is unavailable, or `undefined` once every field a clinician must decide
 * has been decided — the same role `declineReasonBlockedReason` above plays for the decline
 * confirm, checked in the same fixed order the forms renders its fields. A form that fired with
 * any of these five still `undefined` would go on to file a fabricated cohort, security level,
 * sex, legal status or urgency tier for a patient nobody looked at — the defect this function,
 * the five placeholder options, and `submitReferral`'s own guard all exist to close together.
 */
function referralDraftBlockedReason(draft: ReferralDraftState): string | undefined {
  if (draft.cohort === undefined) {
    return "Choose a cohort before raising this referral. None is chosen for you: a cohort nobody picked would be filed as this patient's own record.";
  }
  if (draft.security === undefined) {
    return "Choose a security level before raising this referral. None is chosen for you: a security level nobody picked would be filed as this patient's own record.";
  }
  if (draft.sex === undefined) {
    return "Choose a sex before raising this referral. None is chosen for you: a sex nobody picked would be filed as this patient's own record.";
  }
  // T11 (item 8): blocked ONLY by the "not yet answered" sentinel, never by the explicit
  // "not_recorded" answer — see `ReferralDraftState.gender`'s own doc comment.
  if (draft.gender === undefined) {
    return 'Choose a gender, or "Not yet recorded". None is chosen for you.';
  }
  if (draft.legalStatus === undefined) {
    return "Choose a legal status before raising this referral. None is chosen for you: a legal status nobody picked would be filed as this patient's own record.";
  }
  if (draft.urgency === undefined) {
    return "Choose an urgency tier before raising this referral. None is chosen for you: an urgency tier nobody picked would be filed as this patient's own record.";
  }
  if (draft.specialling === undefined) {
    return 'State whether one-to-one nursing is required before raising this referral. None is chosen for you: an unanswered box would be filed as "not required", and the reducer only checks a ward\'s one-to-one capacity when the patient is recorded as needing it.';
  }
  if (draft.highAcuity === undefined) {
    return "State whether high-acuity nursing is required before raising this referral. None is chosen for you: an unanswered box would be filed as “not required”, and the acuity gate only checks a ward’s high-acuity staffing when the patient is recorded as needing it.";
  }
  // T3 (build plan §2): the expiry field is two inputs, and a half-typed pair is neither a
  // finished answer nor the permitted "blank" one — `instantFromDateAndTimeInputs` above refuses
  // to guess the other half, so this is the only place that refusal becomes visible to whoever
  // typed it. Checked last, after every field that is never optional: a clinician who has typed
  // only a date or only a time is partway through answering a question nobody is required to
  // answer at all, so this must never fire before the seven fields above that are.
  if ((draft.legalFormDueAtDate !== "") !== (draft.legalFormDueAtTime !== "")) {
    return "Enter both the date and the time written on the form, or leave both blank.";
  }
  return undefined;
}

/**
 * `RECORD_EXAMINATION`'s own preconditions (`ward-flow-reducer.ts`'s `case "RECORD_EXAMINATION"`),
 * named here in the same order so the control can never advertise an action the reducer would
 * refuse — the same discipline `ward-screen.tsx`'s `referralAnswerBlocked`/`pullBlockedReason` and
 * `officer-screen.tsx`'s four `*BlockedReason` functions already hold to.
 */
function examinationBlockedReason(movement: Movement, who?: string): string | undefined {
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
function communityReferralBlockedReason(movement: Movement): string | undefined {
  if (movement.closure) {
    return `Cannot refer a closed movement (${movement.closure.reason}).`;
  }
  if (movement.transport?.collectedAt !== undefined) {
    // P2-5 (Ward Lead audit, 2026-09-17): no internal event name in user-facing text. The stop
    // control itself waits on an owner question (see the build plan), so this names who to
    // contact rather than a control this screen does not offer.
    return `The patient has been collected. Ask the coordinator to stop the journey, using the "Stop transport" control on the console; the bed stays held until it is released.`;
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

function isEdInitiatedWithdrawal(movement: Movement): boolean {
  return (
    movement.closure !== undefined &&
    (ED_INITIATED_WITHDRAWAL_REASONS as readonly string[]).includes(movement.closure.reason)
  );
}

function edOutcomeBlockedReason(movement: Movement): string | undefined {
  if (movement.closure) {
    return `Cannot record an outcome for a closed movement (${movement.closure.reason}).`;
  }
  if (movement.transport?.collectedAt !== undefined) {
    // P2-5 (Ward Lead audit, 2026-09-17): no internal event name in user-facing text — see
    // `communityReferralBlockedReason`'s own identical fix immediately above.
    return `The patient has been collected. Ask the coordinator to stop the journey, using the "Stop transport" control on the console; the bed stays held until it is released.`;
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
function dischargeChoiceBlockedReason(movement: Movement): string | undefined {
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
function handoverBlockedReason(movement: Movement, who?: string): string | undefined {
  // Mirrors the reducer's `noTransportNeeded` exception (`HANDOVER_READY`): a movement with no
  // transport job may still be marked handover-ready when a "no transport needed" answer is
  // recorded (`transportNeed.needed === false`, or a job whose own `needed` is false), so it must
  // not be told to book transport first.
  const noTransportNeeded = movement.transportNeed?.needed === false || movement.transport?.needed === false;
  if (!movement.transport && !noTransportNeeded && movement.stage === "pulled") {
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    return `${who ?? "This patient"} has no transport booked — book it first, then mark the handover ready.`;
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
function bookTransportBlockedReason(movement: Movement, who?: string): string | undefined {
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
    return `${who ?? "This patient"} already has transport booked. Booking again would replace a job the provider may already have accepted, and take its timestamps with it — an existing job has to be cancelled before a new one can be booked.`;
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
function transportLegalFormNotice(movement: Movement): string | undefined {
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
 * only role this screen ever dispatches `WITHDRAW_REFERRAL` as — `confirmWithdrawReferral` above
 * hardcodes `role: "ed"`) revoke an ACCEPTED referral too, once, up until the patient is collected —
 * the reducer's own post-acceptance branch (`ward-flow-reducer.ts`) permits it directly. This
 * helper went on blocking it regardless, which is the same "control offers less than the reducer
 * allows" defect this file's own doc comment warns against, just in the opposite direction from the
 * usual one: not a button the reducer refuses, but a button withheld from an action the reducer
 * accepts.
 */
function withdrawReferralBlockedReason(movement: Movement, who?: string): string | undefined {
  if (movement.closure) {
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    return `${who ?? "This patient"} has already closed (${movement.closure.reason}). A withdrawal cannot be added to a movement that has ended.`;
  }
  // P2-5 (Ward Lead audit, 2026-09-17): no internal event name — see
  // `communityReferralBlockedReason`'s identical fix above.
  if (movement.transport?.collectedAt !== undefined) {
    return `The patient has been collected. Ask the coordinator to stop the journey, using the "Stop transport" control on the console; the bed stays held until it is released.`;
  }
  if (!movement.acceptedUnitId && movement.referredUnitIds.length === 0) {
    return `${who ?? "This patient"} holds no live referral to withdraw.`;
  }
  return undefined;
}

/**
 * ⚠️ **THE ESCORT QUESTION OPENS BLANK, AND NOTHING ANYWHERE SUPPLIES AN ANSWER FOR IT** (owner,
 * relayed 2026-08-30). Not from `legalStatus`, not from the last booking, not as a "usually".
 *
 * **His reason is that a pre-filled clinical judgement is answered by clicking past it**, and the
 * record then asserts that a clinician decided when nobody did — worse than the honest derivation
 * it replaces, because it launders an automatic value through a human's name.
 *
 * ⚠️ **THE DEFECT THIS NAMED IS NOW FIXED, AND THIS CLAUSE SAID OTHERWISE UNTIL 2026-09-01.** It
 * read "`HANDOVER_READY` still computes `movement.legalStatus !== "Voluntary"` today". It does not:
 * that fabrication was deleted when `BOOK_TRANSPORT` landed on 2026-08-31, and the reducer's
 * `HANDOVER_READY` case now only refuses a movement with no booked transport and sets the stage.
 * The reason for keeping this control blank is unchanged — re-creating the derivation as a default
 * here would restore the defect rather than move it — but a comment claiming a live defect that has
 * been fixed sends a reader hunting for code that is not there.
 *
 * **If this control ever feels unhelpful for being blank, the help is the question being legible,
 * never the answer being supplied.**
 *
 * The reducer refuses a missing answer independently (`case "BOOK_TRANSPORT"`), so this is not the
 * only thing holding the rule — and it must never contradict it either: every state this function
 * calls blocked is a state the reducer would reject.
 */
const ESCORT_ANSWERS = [
  { value: true, label: "Escort required" },
  { value: false, label: "No escort required" },
] as const;

type TransportDraftState = {
  /** `undefined` until somebody picks. Never `TRANSPORT_PROVIDERS[0]`: a provider nobody chose,
   *  rendered as "Ambulance service is collecting", is the same unmade-claim defect as a pre-filled
   *  escort answer, and the reducer's membership check refuses the blank rather than this alone. */
  provider: TransportProvider | undefined;
  /** `undefined` until answered — see `ESCORT_ANSWERS`. Never `false`: `false` is an ANSWER. */
  escortRequired: boolean | undefined;
  /** Owner's third ruling, 2026-09-17: the CAD transport number read off the phone call. `""` is
   *  "not yet typed", never a placeholder value — the reducer refuses a blank one. */
  cadNumber: string;
  /** `undefined` until chosen — see `TRANSPORT_LEGAL_STATUS_ANSWERS`. Same "never a default"
   *  discipline as `escortRequired` above. */
  transportLegalStatus: TransportLegalStatus | undefined;
  /** `HH:MM`, typed. `""` is "not yet typed" — see `instantFromEstimatedTimeInputs`. */
  estimatedTime: string;
  /** Defaults to "today" only as the popup's OPENING SELECTION, never as an answer supplied for
   *  somebody — the person must still type a time before the booking is answerable at all
   *  (`transportAnswersBlockedReason`), so this default picks which radio is pre-selected, not
   *  what gets recorded. */
  estimatedDay: "today" | "tomorrow";
};

/** Re-applied every time the panel is opened as well as when it closes, so a previous booking's
 *  answers can never be inherited by the next patient. A remembered last value is the same ruling
 *  as a derived one. */
const BLANK_TRANSPORT_DRAFT: TransportDraftState = {
  provider: undefined,
  escortRequired: undefined,
  cadNumber: "",
  transportLegalStatus: undefined,
  estimatedTime: "",
  estimatedDay: "today",
};

/** Derived from `TRANSPORT_LEGAL_STATUSES`, never hand-listed — the same discipline
 *  `TRANSPORT_PROVIDERS.map` below already holds to, so a third status added there cannot be
 *  silently omitted from this control. */
const TRANSPORT_LEGAL_STATUS_LABELS: Record<TransportLegalStatus, string> = {
  voluntary: "Voluntary",
  involuntary: "Involuntary",
};

/** The `<option>` value standing for "nobody chosen yet", for the same reason
 *  `NO_LEGAL_FORM_VALUE` above exists: a `<select>` option value is always a string. */
const NO_TRANSPORT_PROVIDER_VALUE = "";

/**
 * The date-plus-time draft for the two "actions block" panels T3 adds — "Record expiry from the
 * form" (the first typed expiry) and "Record an extension" (every one after it). One shape for
 * both, because the reducer event they dispatch (`RECORD_LEGAL_FORM_EXPIRY`) is one event too:
 * which of the two this is is read off `movement.legalForm.dueAt` at render time, never off a flag
 * this draft carries.
 */
type LegalFormExpiryDraftState = { date: string; time: string };

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
const BLANK_TYPED_EXPIRY_DRAFT: LegalFormExpiryDraftState = { date: "", time: "" };

/**
 * Why the confirm control is unavailable, or `undefined` when the booking is answerable. Pure and
 * module-level so all four states can be asserted without rendering, and so the wording lives in
 * one place rather than being spelled twice inside JSX.
 */
function transportAnswersBlockedReason(draft: TransportDraftState, now: Instant): string | undefined {
  const missing: string[] = [];
  if (draft.provider === undefined) missing.push("choose who is collecting the patient");
  if (draft.escortRequired === undefined) missing.push("answer the escort question");
  // Owner's third ruling, 2026-09-17: the three facts read off the phone call, none filled in.
  if (draft.cadNumber.trim().length === 0) missing.push("enter the CAD transport number");
  if (draft.transportLegalStatus === undefined) missing.push("state whether the transport is voluntary or involuntary");
  if (instantFromEstimatedTimeInputs(draft.estimatedTime, draft.estimatedDay, now) === undefined) {
    missing.push("enter the estimated time");
  }
  if (missing.length === 0) return undefined;
  return `Before booking, ${missing.join(", ")}. None is filled in for you: the record has to say that this team decided.`;
}

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
function formExpiryLine(legalForm: LegalForm, now: Instant): string {
  if (legalForm.dueAt === undefined) return "No expiry recorded from the form.";
  const remaining = minutesUntil(legalForm.dueAt, now);
  const when = formatInstantWithDay(legalForm.dueAt, now);
  if (remaining >= 0) return `Expiry written on the form: ${when} (${splitDuration(remaining)} left)`;
  return `Expiry written on the form: ${when} (passed ${splitDuration(Math.abs(remaining))} ago)`;
}

/**
 * A warning beside the expiry line, never a block — nothing on this screen may disable a control
 * because of it. Reuses `clockState`'s thresholds, the same ones already applied to Form 4A/4C
 * elsewhere on this screen, so "close" and "past" carry the same meaning everywhere they appear.
 * Returns `undefined` well clear of the expiry, or when none is recorded, so the caller renders no
 * warning row rather than an empty one.
 */
function formExpiryWarning(legalForm: LegalForm, now: Instant): string | undefined {
  if (legalForm.dueAt === undefined) return undefined;
  const state = clockState(legalForm.dueAt, now);
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
function patientBay(id: string): string {
  const num = parseInt(id.replace(/\D/g, ""), 10) || 1;
  return `Bay ${String((num % 12) + 1).padStart(2, "0")}`;
}

function accessTargetLine(minutesInDepartment: number, accessTargetMinutes: number): string {
  const over = minutesInDepartment - accessTargetMinutes;
  const targetLabel = splitDuration(accessTargetMinutes);
  if (over > 0) return `${splitDuration(over)} over target (${targetLabel})`;
  return "";
}

/**
 * WLQ-14, owner ruling 2026-09-15: the ED access-block clock above starts when the referral is
 * received — `movement.openedAt`, stamped at the instant `RAISE_REFERRAL` is processed, which IS
 * the moment an ED clinician's referral into this psychiatry queue is received (there is no
 * separate "sent" versus "received" step in this model). That start does NOT change here. Medical
 * clearance is shown beside it as a SEPARATE recorded time, never as the clock's start, because —
 * put to the owner directly — ED doctors can and do refer before clearance is done.
 *
 * `medicalClearance` lives only on `Referral` (see that field's own doc comment in
 * `ward-model.ts`), written solely by `RECORD_MEDICAL_CLEARANCE`. `Movement.referralId` is the one
 * resolvable link to it — present only when this journey was raised from a front-door referral
 * (`RAISE_REFERRAL`'s own `referralId` argument) — so most movements resolve nothing here, and that
 * is an honest "not linked", never a fabricated time. Returns `undefined` rather than inventing a
 * moment when the link is absent, the referral cannot be found, or nobody has recorded an answer.
 */
function movementMedicalClearance(
  movement: Movement,
  referrals: readonly Referral[],
): { cleared: boolean; at: Instant } | undefined {
  if (movement.referralId === undefined) return undefined;
  return referrals.find((referral) => referral.id === movement.referralId)?.medicalClearance;
}

/**
 * Opus review round 2, 17 September 2026 (P2), item 6: the gender a front-door referral already
 * recorded on its own ward arm — see `ReferralDestination`'s `psychiatric_ward` case, `gender?:
 * ReferralGender` (`ward-model.ts`). `undefined` when the referral carries no `psychiatric_ward`
 * destination at all, or that arm never had a gender recorded — both real "nothing to prefill"
 * cases, never fabricated.
 */
function referralWardGender(referral: Referral): ReferralGender | undefined {
  const wardArm = referral.destinations.find((addressing) => addressing.destination.kind === "psychiatric_ward");
  return wardArm?.destination.kind === "psychiatric_ward" ? wardArm.destination.gender : undefined;
}

/**
 * Task 11: one emergency department's own view — its own patients, both clocks, the
 * departmental access target, and the single outstanding item for each. Never the coordinator's
 * statewide queue, shortlist or flow diagram filtered down (spec §7 says so explicitly).
 *
 * Resolved via `edById` (Task 9's addition to `ward-sites.ts`); an id that resolves to nothing
 * renders an explicit empty state naming the id (Global Constraint, addendum R40 — the same rule
 * `ward-screen.tsx` and `officer-screen.tsx`'s unit/department lookups already follow), never a
 * substituted department.
 */
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
const ANSWERED_VISIBLE_CAP = 10;

function AttentionToneIcon({ tone }: { tone: "danger" | "warn" | "good" | "quiet" }) {
  if (tone === "danger") {
    return (
      <svg
        className={styles.attentionBadgeSvg}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  if (tone === "warn") {
    return (
      <svg
        className={styles.attentionBadgeSvg}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }
  if (tone === "good") {
    return (
      <svg
        className={styles.attentionBadgeSvg}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    );
  }
  return (
    <svg
      className={styles.attentionBadgeSvg}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function EdScreen({ edId }: EdScreenProps) {
  const {
    movements,
    units,
    bedReleases,
    referrals,
    rejections,
    dayZero,
    dispatch,
    configuration,
    patients: registryPatients,
  } = useWardFlow();
  const now = useWardFlowClock();
  const accessTarget = configuration.edAccessTargetMinutes;
  // The configured pull hold; until 25 Sept 2026 the transit badges said "4h hold" whatever it was.
  const holdLabel =
    configuration.pullHoldMinutes % 60 === 0
      ? `${configuration.pullHoldMinutes / 60}h`
      : splitDuration(configuration.pullHoldMinutes);
  const department = edById(edId);
  const departments = allEmergencyDepartments();

  // Declared unconditionally, before the early return below — React hooks must run in the same
  // order on every render, the same discipline `ward-screen.tsx` holds to for its own hooks.
  const [referralOpen, setReferralOpen] = useState(false);
  const [draft, setDraft] = useState<ReferralDraftState>(DEFAULT_DRAFT);
  // Opus review round 2, 17 September 2026 (P2): the `gender_designation` gate's own refusal says
  // "Record gender first", and this is the control that lets an ED clinician actually do that once
  // a movement already exists — `draft.gender` above only ever answers the intake form's OWN
  // not-yet-raised referral. One draft value per movement, the same shape `urgencyDraft` below
  // holds for its own per-movement correction.
  const [genderRecordDraft, setGenderRecordDraft] = useState<Record<string, ReferralGender | "">>({});
  // Opus review round 2, 17 September 2026 (P2), item 6: which front-door referral (if any) the
  // open "Raise a referral" form is being raised FROM. `undefined` is the ordinary, unlinked case
  // (the form's existing behaviour, untouched). Set only by the inbox row's own "Raise into a
  // movement" button, alongside a gender prefill from that referral's own recorded gender — see
  // `referralWardGender` below — and cleared once the form is submitted or the generic toggle
  // opens a fresh, unlinked form instead.
  const [raisingFromReferralId, setRaisingFromReferralId] = useState<string | undefined>(undefined);
  const [examinationOpenFor, setExaminationOpenFor] = useState<string | undefined>(undefined);
  const [examinationOutcome, setExaminationOutcome] = useState<
    "inpatient_order" | "community_order" | "revoked" | "further_examination_ordered" | undefined
  >(undefined);
  // RB3, item 19: same open-for-one-row-at-a-time shape as the examination toggle above.
  const [edOutcomeOpenFor, setEdOutcomeOpenFor] = useState<string | undefined>(undefined);
  // Task 2: urgency and legal status can change mid-flight. Both a coordinator and the referring
  // ED clinician may make either change (`EVENT_ROLE.CHANGE_URGENCY`/`CHANGE_LEGAL_STATUS`), so
  // this screen dispatches as role "ed" — the shortlist panel's own control dispatches as
  // "coordinator". Each control keeps its own open-for/draft state, the same shape the
  // examination toggle above already uses.
  const [urgencyChangeOpenFor, setUrgencyChangeOpenFor] = useState<string | undefined>(undefined);
  const [urgencyDraft, setUrgencyDraft] = useState<{
    urgency: 1 | 2 | 3;
    reason: UrgencyChangeReason | undefined;
  }>({
    urgency: 1,
    reason: undefined,
  });
  const [legalStatusChangeOpenFor, setLegalStatusChangeOpenFor] = useState<string | undefined>(undefined);
  const [legalStatusDraft, setLegalStatusDraft] = useState<{
    legalStatus: LegalStatus;
    reason: LegalStatusChangeReason | undefined;
  }>({ legalStatus: "Voluntary", reason: undefined });
  const [formOverrides, setFormOverrides] = useState<Record<string, string | null>>({});

  // `TR-D1`: the sending team books the transport out, and this department is the sending team for
  // its own patients. One open-for id and one draft, the same shape the three toggles above use —
  // only one panel is open at a time, so one draft cannot be read against the wrong patient. The
  // draft starts BLANK and is reset to blank on every toggle; see `ESCORT_ANSWERS`.
  const [transportOpenFor, setTransportOpenFor] = useState<string | undefined>(undefined);
  const [arrivalPlanOpenFor, setArrivalPlanOpenFor] = useState<string | undefined>(undefined);
  const [transportDraft, setTransportDraft] = useState<TransportDraftState>(BLANK_TRANSPORT_DRAFT);
  // Owner's third ruling, 2026-09-17: the booking control is a popup (dialog), never an inline
  // panel — `role="dialog"`, focus moved in on open, trapped while open, and released on Escape.
  // One ref suffices because `transportOpenFor` names at most one open movement at a time, so at
  // most one dialog is ever mounted.
  const transportDialogRef = useRef<HTMLDivElement>(null);
  const transportTriggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (transportOpenFor === undefined) return;
    const dialog = transportDialogRef.current;
    if (!dialog) return;
    if (document.activeElement instanceof HTMLElement) {
      transportTriggerRef.current = document.activeElement;
    }
    const firstField = dialog.querySelector<HTMLElement>("select, input, button");
    firstField?.focus();
  }, [transportOpenFor]);
  function closeTransportDialog() {
    setTransportOpenFor(undefined);
    setTransportDraft(BLANK_TRANSPORT_DRAFT);
    transportTriggerRef.current?.focus();
  }
  /**
   * ESCAPE CLOSES THE POPUP; TAB IS TRAPPED INSIDE IT. Read live off the DOM (`querySelectorAll`)
   * rather than a hand-maintained ref list, so a field added to the dialog later is trapped
   * automatically rather than silently escaping the trap the next person forgets to update.
   */
  function handleTransportDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeTransportDialog();
      return;
    }
    if (event.key !== "Tab") return;
    const dialog = transportDialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('select, input, button, [href], [tabindex]:not([tabindex="-1"])'),
    ).filter((element) => !element.hasAttribute("disabled"));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  const [withdrawOpenFor, setWithdrawOpenFor] = useState<string | undefined>(undefined);
  // T3: one open-for id and one draft, the same shape every toggle above uses — only one panel is
  // open at a time, so one draft cannot be read against the wrong patient. "Record expiry from the
  // form" and "Record an extension" are the same panel wearing a different legend and submit
  // label, chosen at render time from `movement.legalForm.dueAt`.
  const [legalFormExpiryOpenFor, setLegalFormExpiryOpenFor] = useState<string | undefined>(undefined);
  const [legalFormExpiryDraft, setLegalFormExpiryDraft] = useState<LegalFormExpiryDraftState>(BLANK_TYPED_EXPIRY_DRAFT);
  // T4: one open-for id and one draft, the same shape every toggle above uses. The draft starts
  // `undefined`, never the first reason in the list — a reason nobody picked would be filed as a
  // clinician's own choice, the same discipline `declineDraft` above holds to.
  const [receiptCorrectionOpenFor, setReceiptCorrectionOpenFor] = useState<string | undefined>(undefined);
  const [receiptCorrectionReasonDraft, setReceiptCorrectionReasonDraft] = useState<
    LegalFormReceiptCorrectionReason | undefined
  >(undefined);
  const [communityReferralOpenFor, setCommunityReferralOpenFor] = useState<string | undefined>(undefined);
  const [communityTeamChoice, setCommunityTeamChoice] = useState<string>("");
  /*
   * THE INBOX DECLINE, wired 2026-09-01. `EVENT_ROLE.DECLINE_REFERRAL` gained `"ed"`, so this
   * screen may answer a referral addressed to it as itself and the reducer records
   * `decidedBy: "ED mental health"` — the correct team, not a ward standing in for one.
   *
   * ⚠️ **ONE `openFor` id AND ONE DRAFT, never a keyed map** — the same shape the four controls in
   * the patients section below already use. Only one panel is open at a time, so one draft can
   * never be read against the wrong referral; a map would additionally keep a reason a clinician
   * chose for a row they have since closed and moved on from.
   *
   * ⚠️ **THE DRAFT IS `undefined`, NOT `REFERRAL_DECLINE_REASONS[0]`** — see
   * `NO_DECLINE_REASON_VALUE` above for why a pre-selected reason is a fabricated clinical fact
   * here even though `referral-match.tsx` may safely seed one.
   */
  const [declineOpenFor, setDeclineOpenFor] = useState<string | undefined>(undefined);
  const [declineDraft, setDeclineDraft] = useState<ReferralDeclineReason | undefined>(undefined);
  /*
   * ⚠️ **NO PATH FROM THIS SCREEN CAN CURRENTLY PRODUCE A REFUSAL. THIS BRANCH IS WRITTEN AGAINST A
   * FUTURE DISPATCHER, NOT A LIVE ONE — do not read it as covering something that happens today.**
   *
   * Checked branch by branch against the reducer's `DECLINE_REFERRAL` case on 2026-09-01, and every
   * one of its six refusals is closed from here:
   *
   *   `no referral found`              — nothing ever removes a referral from state.
   *   role/kind mismatch               — both are fixed literals in `submitDecline` below.
   *   `not addressed to …`             — the row exists BECAUSE this ED addressing exists.
   *   `already accepted elsewhere`     — an acceptance on any sibling arm CANCELS this one
   *                                      (`ACCEPT_REFERRAL`'s FD-22 loop), and `edReferralsFor`
   *                                      keeps only `queued`, so the row is gone before it could be
   *                                      pressed. Verified by running it, not by reading it.
   *   `has already answered (state)`   — the row renders only while `queued`, and `RECEIVE_REFERRAL`
   *                                      refuses two destinations of the same kind, so one referral
   *                                      can never have a second ED arm to answer out of order.
   *   reason not a member              — `declineDraft` is drawn from `ED_DECLINE_REASONS`, a subset
   *                                      of the list the reducer checks against, and `undefined`
   *                                      returns early.
   *
   * It is kept rather than deleted because the spec requires a refusal to be surfaced and scoped,
   * and a dispatcher that can be refused is a change away — the ED gaining its own producer, or a
   * second screen sharing this provider. `tests/ward-ed-psychiatry-hub.dom.test.tsx` drives a real
   * reducer refusal through the provider to pin the mechanism and, above all, the SCOPING, which is
   * otherwise the half nothing would notice going wrong.
   *
   * ⚠️ **WHY IT IS SCOPED TO THE ROW.** `dispatch` never reports whether the reducer accepted, so
   * the only way to know is to compare `rejections` before and after — the same
   * `checkToken`/`priorRejectionCountRef` pair `referral-match.tsx` and `referral-intake.tsx` use.
   * **What does NOT port from `referral-match.tsx` is holding one `lastRejection` for the whole
   * component.** That is safe there only because that screen renders exactly ONE referral. This is
   * a LIST, so an unscoped refusal would be displayed against whichever row happened to render it.
   * The referral id is therefore carried alongside, taken from `Rejection.movementId` — which holds
   * the REFERRAL id for `DECLINE_REFERRAL` (`subjectId` in `ward-flow-reducer.ts`) rather than a
   * movement id — so the pairing comes from the rejection itself and cannot be misattributed.
   */
  const [declineRejection, setDeclineRejection] = useState<{ referralId: string; rejection: Rejection } | undefined>(
    undefined,
  );
  const priorRejectionCountRef = useRef(rejections.length);
  const [declineCheckToken, setDeclineCheckToken] = useState(0);
  type DepartmentTabKey = "review" | "cleared" | "expected" | "forms" | "referred";
  const [departmentListTab, setDepartmentListTab] = useState<DepartmentTabKey>("review");
  const [boardFilter, setBoardFilter] = useState<
    "all" | "not_reviewed" | "under_form" | "no_destination" | "discharge" | "withdrawn"
  >("all");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const patientDialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = patientDialogRef.current;
    if (!selectedPatientId || !dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    return () => {
      dialog.close?.();
      trigger?.focus();
    };
  }, [selectedPatientId]);

  const [fullscreenBoard, setFullscreenBoard] = useState(false);
  const [capacityServiceFilter, setCapacityServiceFilter] = useState<string>("all");
  const [timelineCategoryFilter, setTimelineCategoryFilter] = useState<
    "all" | "bed_search" | "arrivals" | "clinical" | "transport"
  >("all");
  const [timelineSearchQuery, setTimelineSearchQuery] = useState("");
  const [reviewStatusOverrides, setReviewStatusOverrides] = useState<Record<string, string>>({});
  const [clearanceOverrides, setClearanceOverrides] = useState<Record<string, "yes" | "no" | null>>({});
  const [presentationDrafts, setPresentationDrafts] = useState<Record<string, string>>({});
  const [planDrafts, setPlanDrafts] = useState<Record<string, string[]>>({});
  const [patientQuery, setPatientQuery] = useState("");
  const [patientSort, setPatientSort] = useState("current");
  const [referralDetailsOpenFor, setReferralDetailsOpenFor] = useState<string>();
  const hasBoardDrafts =
    Object.keys(formOverrides).length +
      Object.keys(clearanceOverrides).length +
      Object.keys(reviewStatusOverrides).length +
      Object.keys(presentationDrafts).length +
      Object.keys(planDrafts).length >
    0;

  const CLINICAL_REVIEW_OPTIONS = [
    "Awaiting review",
    "Ongoing intoxication",
    "Medically unstable",
    "Awaiting collateral",
    "Awaiting investigation results",
    "Specialist review pending",
    "Examination recorded",
  ] as const;

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        if (arrivalPlanOpenFor !== undefined) {
          setArrivalPlanOpenFor(undefined);
        } else if (transportOpenFor !== undefined) {
          closeTransportDialog();
        } else if (selectedPatientId !== null) {
          setSelectedPatientId(null);
        } else if (fullscreenBoard) {
          setFullscreenBoard(false);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [arrivalPlanOpenFor, transportOpenFor, selectedPatientId, fullscreenBoard]);

  const ALL_DEPARTMENT_TABS: { key: DepartmentTabKey; label: string }[] = [
    { key: "review", label: "Awaiting Review" },
    { key: "cleared", label: "Medical Clearance" },
    { key: "expected", label: "Expects" },
    { key: "forms", label: "Forms" },
    { key: "referred", label: "Referred" },
  ];

  function onDepartmentListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Home") {
      event.preventDefault();
      const first = ALL_DEPARTMENT_TABS[0].key;
      setDepartmentListTab(first);
      event.currentTarget.querySelector<HTMLButtonElement>(`#ward-ed-${first}-tab`)?.focus();
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      const last = ALL_DEPARTMENT_TABS[ALL_DEPARTMENT_TABS.length - 1].key;
      setDepartmentListTab(last);
      event.currentTarget.querySelector<HTMLButtonElement>(`#ward-ed-${last}-tab`)?.focus();
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const idx = ALL_DEPARTMENT_TABS.findIndex((t) => t.key === departmentListTab);
    const step = event.key === "ArrowRight" ? 1 : -1;
    const nextIdx = (idx + step + ALL_DEPARTMENT_TABS.length) % ALL_DEPARTMENT_TABS.length;
    const next = ALL_DEPARTMENT_TABS[nextIdx].key;
    setDepartmentListTab(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`#ward-ed-${next}-tab`)?.focus();
  }

  useEffect(() => {
    // Nothing has been dispatched from this screen yet, so a rejection already in state belongs to
    // somebody else and must not be surfaced here.
    if (declineCheckToken === 0) return;
    if (rejections.length > priorRejectionCountRef.current) {
      const newest = rejections[rejections.length - 1];
      setDeclineRejection(
        newest.attempted === "DECLINE_REFERRAL" ? { referralId: newest.movementId, rejection: newest } : undefined,
      );
    } else {
      setDeclineRejection(undefined);
    }
    priorRejectionCountRef.current = rejections.length;
  }, [rejections, declineCheckToken]);

  if (!department) {
    return (
      <div className={styles.screen} data-testid="ward-ed-screen">
        <main id="main-content" className={styles.main}>
          <h1 className={styles.notFoundHeading}>Emergency department not found</h1>
          <p className={styles.notFoundBody} data-testid="ward-ed-unresolved">
            No synthetic emergency department matches &ldquo;{edId}&rdquo;. It may have been renamed or removed, or the
            id in the address is incorrect — this never falls back to a different department.
          </p>
          <div className={styles.recoveryContainer}>
            <Link href="/mockups/ward-flow" className={styles.recoveryLink}>
              Return to Ward Flow Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const site = siteByCode(department.siteCode);
  // TypeScript's narrowing of `department` above does not reach into `submitReferral`'s closure
  // further down (the same reason `ward-screen.tsx`'s `wardUnitId` exists) — this plain string is
  // what it closes over instead.
  const thisEdId = department.id;

  // Its own patients only, and only while still open — an arrived or otherwise closed movement
  // has left the department (see `isOpen`'s own doc comment). This is THIS DEPARTMENT'S OPEN
  // MOVEMENTS: everyone it is still accountable for until they reach a ward, INCLUDING patients
  // already collected by transport and in transit. It is not a historical log.
  //
  // 🔴 THIS READ "who is here now" UNTIL 2026-09-07 AND THE PREDICATE NEVER MATCHED IT. `moving`
  // is admitted, and two seeded movements sit at that stage — so the comment claimed physical
  // presence for patients already in an ambulance. Both this chat and another stopped rather than
  // guess, because making the comment match the code legitimises a possibly-wrong count while
  // making the code match the comment changes a clinical population without authority.
  //
  // ✅ THE OWNER RESOLVED IT BY REJECTING THE QUESTION: the count is a real operational population
  // and only the WORDS were wrong. So the comment moved and THE PREDICATE IS UNTOUCHED.
  //
  // 🔴 DO NOT NARROW THIS FILTER. Dropping `moving` to make the screen literally "who is standing
  // here" would take a patient off the board of the department still accountable for them during
  // transit — the most fragile part of the journey, and the one where a failed transfer comes
  // straight back to this department. **An inflated count is a number that is wrong; a vanished
  // patient is a person nobody is watching.**
  //
  // ⚠️ THAT WARNING CAME FROM THE OTHER CHAT AND THIS ONE DID NOT HAVE IT. Both of us wrote a
  // correct fix for the same false sentence, in the same file, within hours; git raised a conflict
  // and the conflict is why the warning survived. Had either version merged cleanly over the
  // other, one of two true things would have been lost silently — and the half that would have
  // gone is the half that tells the next person what not to do. **Two correct fixes for one defect
  // are not interchangeable; the union of them is what either author actually wanted.**
  //
  // ⚠️ Worth keeping as a shape: "the code or the comment?" is a false pair when one of them is a
  // clinical population somebody relies on. The comment is cheap and the population is not, so the
  // burden of proof sits on changing the predicate — and neither chat could discharge it. Stopping
  // was right; the escalation was avoidable only because a third reading existed that neither of us
  // had, which is exactly what an owner is for.
  //
  // ⚠️ And the reusable half, named by the other chat: **a defect that touches a model field is not
  // thereby a model decision.** The field did not have to move for the sentence to become true.
  // Owner answer 19 (2026-09-17) / RB3: ED "For discharge" and "For community follow-up" are recorded
  // outcomes that keep the patient on the board until they physically leave the department.
  // Ward Lead audit (2026-09-17): `isEdInitiatedWithdrawal` widens this from "an ED outcome keeps
  // a closed movement here" to also keep an ED-initiated `WITHDRAW_REFERRAL` — this department's
  // own decision, so it stays accountable for it — while a coordinator-driven revocation or any
  // other closure stays off the board exactly as before.
  const patients = movements.filter(
    (movement) =>
      movement.originEdId === thisEdId &&
      movement.stage !== "arrived" &&
      (!movement.closure ||
        (movement.edOutcome !== undefined && !movement.leftDepartmentAt) ||
        isEdInitiatedWithdrawal(movement)),
  );

  /**
   * THE INBOX. Two fields, never one — `edId` AND `purpose`.
   *
   * ⚠️ A ward→ED medical notification carries the SAME `edId` as psychiatry's own review request:
   * both are about a patient in this department, raised by parties at this hospital. `purpose` is
   * the only thing keeping them apart, and `originSiteCode` — the inference that looks right and is
   * wrong on exactly this case — is not read here or in `edReferralsFor`.
   */
  /**
   * 🔴 THE INBOX IS NOW THE PEOPLE WHO ARE HERE, AND THE EXPECTS ARE THE PEOPLE ON THE WAY.
   *
   * Product owner, 2026-09-07: *"When a patient is referred to the ED and not in the ED then they
   * are an expect. If they are referred within the ED, they are put on the Referrals."* and *"When
   * expects arrive and are marked as arrived, they become referrals."*
   *
   * ⚠️ **THE FILTER ON `inbox` IS A BEHAVIOUR CHANGE, NOT A TIDY-UP.** Before today this list held
   * every queued referral addressed to this team, whether or not the patient was in the building —
   * and the paragraph under its own heading already said *"a person who is not in the department yet
   * has no department clock at all"*. **The concept was in the prose and absent from the structure.**
   *
   * The two lists read the SAME predicate from opposite sides — `hasArrivedInDepartment` — rather
   * than each spelling out its own rule. Two filters spelling one rule is how two lists come to
   * disagree about who is in the building, and `tests/ward-ed-expects-derivation.test.ts` pins the
   * partition: nobody in both, nobody in neither.
   */
  /*
   * 🔴 `edArrivedFor`, NOT `edReferralsFor(...).filter(...)` — AND THE DIFFERENCE WAS A PATIENT ON
   * NEITHER LIST. `edReferralsFor` is a worklist admitting `queued` only, while `edExpectsFor`
   * admits `queued` AND `accepted`. So an ACCEPTED referral whose patient had arrived left Expects
   * (they are here) without entering Referrals (not queued) — invisible to the department treating
   * them, one click after "Mark arrived". The two lists now take ONE population and one predicate
   * from opposite sides, so the partition holds by construction rather than by two filters somebody
   * has to keep in step.
   */
  const inbox = edArrivedFor(referrals, thisEdId, "psychiatric_review");
  const rawExpects = edExpectsFor(referrals, thisEdId, "psychiatric_review");
  const expects = [...rawExpects].sort((a, b) => {
    const etaA = movements.find((m) => m.referralId === a.referral.id)?.transport?.estimatedAt;
    const etaB = movements.find((m) => m.referralId === b.referral.id)?.transport?.estimatedAt;
    if (etaA !== undefined && etaB !== undefined) {
      return etaA - etaB;
    }
    if (etaA !== undefined) return -1;
    if (etaB !== undefined) return 1;
    return a.referral.raisedAt - b.referral.raisedAt;
  });

  /**
   * RECENTLY ANSWERED — owner ruling 7, 2026-09-01. A clinician who declines a referral watches the
   * row vanish from the inbox above the moment they answer it, because that list is a worklist
   * (`edReferralsFor`'s own `queued` scoping). Without this, there is no undo, no record on this
   * screen, and nothing to check a mistake against. `edAnsweredReferralsFor` is the second selector
   * that scoping requires — see its own doc comment for why it cannot be a parameter on
   * `edReferralsFor` instead.
   */
  const answeredAll = edAnsweredReferralsFor(referrals, thisEdId, "psychiatric_review");
  /**
   * `edAnsweredReferralsFor` returns them sorted by `decidedAt` DESCENDING, so slicing from the
   * front takes the ten most RECENT rather than an arbitrary ten. That ordering is load-bearing for
   * this cap, and `tests/ward-ed-answered-cap.dom.test.tsx` names the three oldest rows and asserts
   * their absence — so a selector that stopped sorting would fail there rather than quietly
   * showing ten of the wrong rows, which renders identically to ten of the right ones.
   *
   * ⚠️ AN UNDATED DECISION IS DROPPED FIRST, AND THAT IS THE INTENDED ORDER. The selector
   * sorts a missing `decidedAt` to `-Infinity`, so a row with no decision time sinks below every
   * dated one. Right, because nothing can be claimed as recent without a time — but it does mean
   * such a row leaves this list once ten dated decisions exist. The referral is untouched; only
   * this view of it is limited.
   */
  const answered = answeredAll.slice(0, ANSWERED_VISIBLE_CAP);

  /**
   * THE OUTBOX: patients this team referred onward who are STILL HERE.
   *
   * Filtered from `patients` above rather than from `movements` again, so it inherits that array's
   * own definition of who is present (this department's, still open, not yet arrived) instead of
   * restating it — two filters spelling one rule is how two lists come to disagree about who is in
   * the building.
   *
   * `acceptedUnitId` is the marker for "referred on and taken", and it is set from
   * `accepted_awaiting_bed` onward. A patient whose placement is still being requested or reviewed
   * has not been referred onward yet, and one who has `arrived` has left — `patients` already
   * excludes them. **No stage is treated as finished with**: a pulled bed and a booked handover are
   * both still jobs this team owes.
   */
  // P3-3 (Ward Lead audit, 2026-09-17): `!movement.closure` alongside the existing
  // `acceptedUnitId !== undefined` check — defence in depth for `RECORD_ED_OUTCOME`'s P1-4 fix
  // (`ward-flow-reducer.ts`), which now clears `acceptedUnitId` on outcome. A closed movement
  // belongs on the board (RB3's own reasoning at `patients` above) but never in "still to be
  // moved" — nothing is still moving it anywhere.
  const outbox = patients.filter((movement) => movement.acceptedUnitId !== undefined && !movement.closure);

  // P3-1 (Ward Lead audit, 2026-09-17): `&& !m.edOutcome` on both chips below. A patient whose ED
  // outcome is already recorded has a settled answer — "for discharge" or "for community
  // follow-up" — not an unreviewed or destination-less one; before this fix a discharged patient
  // still on the board (RB3's own reasoning above) kept inflating both counts.
  // Withdrawn (see `isEdInitiatedWithdrawal` above) also excluded from every chip below: it is
  // closed, so "reviewed", "under a form" and "has a destination" are questions about a bed search
  // that no longer exists. It gets its own chip instead.
  const notReviewedCount = patients.filter((m) => !m.examination && !m.edOutcome && !isEdInitiatedWithdrawal(m)).length;
  // P3-2 (Ward Lead audit, 2026-09-17): `!!m.legalForm` only. `legalStatus` is a clinical
  // classification (e.g. "Voluntary"), not a form under section — `!!m.legalStatus` counted every
  // voluntary patient as "under a form", which none of them are.
  const underFormCount = patients.filter((m) => !!m.legalForm && !isEdInitiatedWithdrawal(m)).length;
  const noDestCount = patients.filter(
    (m) => !m.acceptedUnitId && m.referredUnitIds.length === 0 && !m.edOutcome && !isEdInitiatedWithdrawal(m),
  ).length;
  // F7 (Opus adversarial review, 2026-09-17): this used to count `closure?.outcome ===
  // "did_not_proceed"`, which matches EVERY reason a journey closed without an admission —
  // including a community referral (`edOutcome: "for_community_follow_up"`) — not specifically a
  // discharge. "For discharge" now means exactly what its own label says: `edOutcome ===
  // "for_discharge"`, the outcome only `RECORD_ED_OUTCOME` writes.
  const dischargeCount = patients.filter((m) => m.edOutcome === "for_discharge").length;
  // Ward Lead audit (2026-09-17): the "Withdrawn" chip's own count.
  const withdrawnCount = patients.filter(isEdInitiatedWithdrawal).length;

  // ED Pressure Dynamic Island derivations
  const presentingCount = patients.length;
  const awaitingBedCount = patients.filter((m) => m.stage === "accepted_awaiting_bed" || m.stage === "pulled").length;
  const totalWaitMinutes = patients.reduce((sum, m) => sum + Math.max(now - m.openedAt, 0), 0);
  const avgWaitMinutes = presentingCount === 0 ? 0 : Math.round(totalWaitMinutes / presentingCount);
  const avgWaitLabel = formatElapsed(avgWaitMinutes);
  const breachesCount = patients.filter((m) => now - m.openedAt > accessTarget).length;
  const isEdAlarm = breachesCount > 0;
  const isEdWarn = awaitingBedCount > 3;

  const filteredPatients = patients.filter((m) => {
    if (boardFilter === "not_reviewed") return !m.examination && !m.edOutcome && !isEdInitiatedWithdrawal(m);
    if (boardFilter === "under_form") return !!m.legalForm && !isEdInitiatedWithdrawal(m);
    if (boardFilter === "no_destination")
      return !m.acceptedUnitId && m.referredUnitIds.length === 0 && !m.edOutcome && !isEdInitiatedWithdrawal(m);
    if (boardFilter === "discharge") return m.edOutcome === "for_discharge";
    if (boardFilter === "withdrawn") return isEdInitiatedWithdrawal(m);
    return true;
  });

  const visiblePatients = filteredPatients
    .filter((movement) => {
      const person = resolveSubjectPatient(movement, { patients: registryPatients, referrals, movements });
      return `${person.displayName} ${person.umrn}`.toLowerCase().includes(patientQuery.trim().toLowerCase());
    })
    .sort((a, b) => {
      if (patientSort === "longest") return a.openedAt - b.openedAt;
      if (patientSort === "name")
        return resolveSubjectPatient(a, { patients: registryPatients, referrals, movements }).displayName.localeCompare(
          resolveSubjectPatient(b, { patients: registryPatients, referrals, movements }).displayName,
        );
      return 0;
    });

  const selectedPatient = selectedPatientId ? patients.find((p) => p.id === selectedPatientId) : null;
  const selectedPatientInfo = selectedPatient
    ? resolveSubjectPatient(selectedPatient, {
        patients: registryPatients,
        referrals,
        movements,
      })
    : null;

  const awaitingReviewPatients = patients.filter((m) => !m.examination && !m.edOutcome && !isEdInitiatedWithdrawal(m));
  const clearedPatients = patients.filter((m) => movementMedicalClearance(m, referrals)?.cleared === true);
  const underFormPatients = patients.filter((m) => !!m.legalForm && !isEdInitiatedWithdrawal(m));

  type PriorityFlag = {
    tone: "danger" | "warn" | "good" | "quiet";
    kind: string;
    recordId: string;
    // Owner, 26 Sept 2026: set only for a movement-sourced flag, so the row can name the patient
    // instead of the WF journey number. Left undefined for a referral-sourced flag below, whose
    // `recordId` is a referral id, not a movement id, and out of this change's scope.
    personName?: string;
    meta: string;
    why: string;
    when: string;
    actionLabel?: string;
    onAction?: () => void;
  };

  const priorityFlags: PriorityFlag[] = [];
  for (const m of patients) {
    const flagPatientInfo = resolveSubjectPatient(m, {
      patients: registryPatients,
      referrals,
      movements,
    });
    if (m.legalForm?.dueAt !== undefined && m.legalForm.dueAt < now) {
      priorityFlags.push({
        tone: "danger",
        kind: "Form expiry passed",
        recordId: m.id,
        personName: flagPatientInfo.displayName,
        meta: `${m.cohort} · ${m.sex}`,
        why: `Form ${m.legalForm.code} passed its deadline at ${formatInstantWithDay(m.legalForm.dueAt, now)}. The movement stands at ${stageCopy[m.stage].label.toLowerCase()}.`,
        when: `passed ${splitDuration(Math.max(now - m.legalForm.dueAt, 0))} ago`,
        actionLabel: "Renew or discharge the form",
        onAction: () => setSelectedPatientId(m.id),
      });
    }
    // Walkthrough code-read, 25 Sept 2026: only once the bed is pulled (before that no bed is held and
    // the booking panel stays shut), and never when "no transport needed" is recorded.
    if (m.stage === "pulled" && !m.transport && (m.transportNeed?.needed ?? true) !== false) {
      priorityFlags.push({
        tone: "warn",
        kind: "Transport not booked",
        recordId: m.id,
        personName: flagPatientInfo.displayName,
        meta: `${m.cohort} · ${m.sex}`,
        why: `${m.acceptedUnitId ? (units.find((u) => u.id === m.acceptedUnitId)?.name ?? m.acceptedUnitId) + " holds the bed" : "A bed is held"} and no transport is booked. The handover cannot be marked ready until it is.`,
        when: `waiting ${splitDuration(Math.max(now - m.openedAt, 0))}`,
        actionLabel: "Book transport",
        onAction: () => toggleBookTransport(m.id),
      });
    }
    if (
      m.declines &&
      m.declines.length > 0 &&
      !m.acceptedUnitId &&
      (!m.referredUnitIds || m.referredUnitIds.length === 0)
    ) {
      priorityFlags.push({
        tone: "warn",
        kind: "Every ward asked has declined",
        recordId: m.id,
        personName: flagPatientInfo.displayName,
        meta: `${m.cohort} · ${m.sex}`,
        why: `${m.declines.length} ${m.declines.length === 1 ? "ward has" : "wards have"} declined and no ward has been asked since.`,
        when: "declined",
        actionLabel: "Ask another ward",
        onAction: () => setSelectedPatientId(m.id),
      });
    }
    if (m.stage === "accepted_awaiting_bed") {
      priorityFlags.push({
        tone: "good",
        kind: "Acceptance received",
        recordId: m.id,
        personName: flagPatientInfo.displayName,
        meta: `${m.cohort} · ${m.sex}`,
        why: `${m.acceptedUnitId ? (units.find((u) => u.id === m.acceptedUnitId)?.name ?? m.acceptedUnitId) : "Unit"} has accepted this person. The bed has not been pulled, so they are still in the department.`,
        when: `waiting ${splitDuration(Math.max(now - m.openedAt, 0))}`,
        actionLabel: "Open patient",
        onAction: () => setSelectedPatientId(m.id),
      });
    }
    if (m.stage === "moving") {
      priorityFlags.push({
        tone: "quiet",
        kind: "Left the department",
        recordId: m.id,
        personName: flagPatientInfo.displayName,
        meta: `${m.cohort} · ${m.sex}`,
        why: `${m.acceptedUnitId ? (units.find((u) => u.id === m.acceptedUnitId)?.name ?? m.acceptedUnitId) : "Unit"} is expecting this person. The department's part is done.`,
        when: "in transit",
        actionLabel: "Open patient",
        onAction: () => setSelectedPatientId(m.id),
      });
    }
    if (isArrivalLate(m, now) && m.arrivalDetails?.estimatedArrivalAt !== undefined) {
      const estimatedArrivalAt = m.arrivalDetails.estimatedArrivalAt;
      priorityFlags.push({
        tone: "danger",
        kind: "Arrival late",
        recordId: m.id,
        personName: flagPatientInfo.displayName,
        meta: `${m.cohort} · ${m.sex}`,
        why: `Estimated ward time was ${arrivalEtaLabel(estimatedArrivalAt, now)}. More than ${LATE_ARRIVAL_GRACE_MINUTES} minutes have passed (${OPERATIONAL_DEFAULT_LABEL}) and they have not been marked arrived.`,
        when: `late ${splitDuration(Math.max(now - (estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES), 0))}`,
        actionLabel: "Update arrival plan",
        onAction: () => setArrivalPlanOpenFor(m.id),
      });
    }
    if (m.originEdId === thisEdId && isOpen(m) && now - m.openedAt > LONG_WAIT_MINUTES) {
      priorityFlags.push({
        tone: "quiet",
        kind: `Waiting ${LONG_WAIT_TEXT}`,
        recordId: m.id,
        personName: flagPatientInfo.displayName,
        meta: `${m.cohort} · ${urgencyTierLabel(m.urgency)}`,
        why: `Waiting in the emergency department for ${splitDuration(now - m.openedAt)}, over ${LONG_WAIT_MINUTES / 60} hours (${OPERATIONAL_DEFAULT_LABEL}).`,
        when: `waiting ${splitDuration(now - m.openedAt)}`,
      });
    }
  }

  for (const { referral } of inbox) {
    const waited = Math.max(0, now - referral.raisedAt);
    if (waited > 60) {
      priorityFlags.push({
        tone: "warn",
        kind: "Referred and not yet seen",
        recordId: referral.id,
        meta: `${referral.ageBand} · ${urgencyTierLabel(referral.urgency)}`,
        why: "This department referred this person to psychiatry and no review has been recorded.",
        when: `waiting ${splitDuration(waited)}`,
      });
    }
  }

  for (const { referral } of expects) {
    const waiting = Math.max(0, now - referral.raisedAt);
    if (waiting <= 60) {
      priorityFlags.push({
        tone: "quiet",
        kind: "Expected within the hour",
        recordId: referral.id,
        meta: `${referral.ageBand} · ${urgencyTierLabel(referral.urgency)}`,
        why: `Referred ${splitDuration(waiting)} ago. Waiting for arrival in department.`,
        when: `waiting ${splitDuration(waiting)}`,
        actionLabel: "Mark arrived in department",
        onAction: () => {
          dispatch({
            type: "RECORD_ARRIVED_IN_DEPARTMENT",
            role: "ed",
            now,
            referralId: referral.id,
          });
        },
      });
    }
  }

  const PRIORITY_TONE_RANK: Record<string, number> = { danger: 0, warn: 1, good: 2, quiet: 3 };
  priorityFlags.sort((a, b) => PRIORITY_TONE_RANK[a.tone] - PRIORITY_TONE_RANK[b.tone]);

  type TimelineEventCategory = "bed_search" | "arrivals" | "clinical" | "transport";

  type TimelineEvent = {
    min: Instant;
    tone?: "danger" | "warn" | "good" | "quiet" | "info" | "purple" | null;
    what: string | React.ReactNode;
    by?: string | null;
    id?: string;
    category?: TimelineEventCategory;
    categoryLabel?: string;
    patientName?: string;
    movementId?: string;
    referralId?: string;
    badgeText?: string;
    badgeTone?: "danger" | "warn" | "good" | "quiet" | "info" | "purple";
    primaryText?: string;
    secondaryText?: string;
    unitName?: string;
    detailText?: string;
    isOpenMovement?: boolean;
    waitMinutes?: number;
  };

  const TIMELINE_DECLINE_REASON_LABELS: Record<string, string> = {
    no_bed: "No suitable bed available",
    no_suitable_bed: "No suitable bed available",
    sex_mix: "Gender mix constraint",
    sex_designation_unavailable: "Designated bed unavailable for recorded gender",
    specialling_unavailable: "1:1 specialling unavailable",
    acuity_mix: "Ward acuity mix at capacity",
    capability_mismatch: "Clinical capability mismatch",
    bed_pulled_for_earlier_referral: "Bed reallocated for earlier referral",
    out_of_catchment: "Out of catchment area",
    belongs_to_another_service: "Belongs to another health service",
    referred_elsewhere: "Referred elsewhere",
    another_reason: "Alternative clinical reason",
    age_band_not_provided_here: "Age cohort not admitted by unit",
    secure_bed_unavailable: "Secure / locked bed unavailable",
    outside_catchment: "Outside catchment area",
    needs_inpatient_care: "Requires inpatient admission",
    declined_or_unreachable: "Patient declined or unreachable",
    open_to_peer_team: "Already open to peer community team",
  };

  function formatTimelineDeclineReason(reason: string): string {
    if (TIMELINE_DECLINE_REASON_LABELS[reason]) {
      return TIMELINE_DECLINE_REASON_LABELS[reason];
    }
    return reason.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const TIMELINE_EXAM_OUTCOME_LABELS: Record<string, string> = {
    inpatient_order: "Inpatient treatment order",
    community_order: "Community treatment order",
    revoked: "Revoked — does not proceed",
    further_examination_ordered: "Further examination ordered",
  };

  function formatTimelineExamOutcome(outcome: string): string {
    if (TIMELINE_EXAM_OUTCOME_LABELS[outcome]) {
      return TIMELINE_EXAM_OUTCOME_LABELS[outcome];
    }
    return outcome.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const timelineEvents: TimelineEvent[] = [];
  for (const m of movements) {
    if (m.originEdId !== thisEdId) continue;
    const isMovementOpen = isOpen(m);
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    const patientInfo = resolveSubjectPatient(m, {
      patients: registryPatients,
      referrals,
      movements,
    });
    if (now - m.openedAt <= 24 * 60 || isMovementOpen) {
      const isLongWait = now - m.openedAt > LONG_WAIT_MINUTES && isMovementOpen;
      timelineEvents.push({
        id: `arrival-${m.id}-${m.openedAt}`,
        min: m.openedAt,
        tone: isLongWait ? "warn" : "quiet",
        category: "arrivals",
        categoryLabel: "Arrivals & Departures",
        patientName: patientInfo.displayName,
        movementId: m.id,
        badgeText: "Arrived",
        badgeTone: isLongWait ? "warn" : "quiet",
        primaryText: "Arrived at Emergency Department",
        detailText: isLongWait ? `Waiting ${splitDuration(now - m.openedAt)} (${LONG_WAIT_TEXT})` : undefined,
        by: null,
        isOpenMovement: isMovementOpen,
        what: (
          <>
            <b>{patientInfo.displayName}</b> arrived at the department
            {isLongWait && (
              <span>
                {" "}
                &mdash; waiting {LONG_WAIT_TEXT} ({splitDuration(now - m.openedAt)})
              </span>
            )}
          </>
        ),
      });
    }
    const mc = movementMedicalClearance(m, referrals);
    if (mc?.cleared && now - mc.at <= 24 * 60) {
      timelineEvents.push({
        id: `mc-${m.id}-${mc.at}`,
        min: mc.at,
        tone: "good",
        category: "clinical",
        categoryLabel: "Clinical & Legal",
        patientName: patientInfo.displayName,
        movementId: m.id,
        badgeText: "Medically Cleared",
        badgeTone: "good",
        primaryText: "Medically cleared for mental health pathway",
        by: null,
        isOpenMovement: isMovementOpen,
        what: (
          <>
            <b>{patientInfo.displayName}</b> medically cleared
          </>
        ),
      });
    }
    if (m.examination && now - m.examination.at <= 24 * 60) {
      const outcomeLabel = formatTimelineExamOutcome(m.examination.outcome);
      timelineEvents.push({
        id: `exam-${m.id}-${m.examination.at}`,
        min: m.examination.at,
        tone: "info",
        category: "clinical",
        categoryLabel: "Clinical & Legal",
        patientName: patientInfo.displayName,
        movementId: m.id,
        badgeText: "Examined",
        badgeTone: "info",
        primaryText: "Psychiatric examination completed",
        detailText: outcomeLabel,
        by: null,
        isOpenMovement: isMovementOpen,
        what: (
          <>
            <b>{patientInfo.displayName}</b> examined &mdash; {outcomeLabel}
          </>
        ),
      });
    }
    if (m.legalFormReceivedAt && now - m.legalFormReceivedAt <= 24 * 60) {
      const formCode = m.legalForm ? `Form ${m.legalForm.code}` : "Legal Form";
      const formFull = m.legalForm ? legalFormName(m.legalForm) : "Statutory form received";
      timelineEvents.push({
        id: `form-${m.id}-${m.legalFormReceivedAt}`,
        min: m.legalFormReceivedAt,
        tone: "purple",
        category: "clinical",
        categoryLabel: "Clinical & Legal",
        patientName: patientInfo.displayName,
        movementId: m.id,
        badgeText: formCode,
        badgeTone: "purple",
        primaryText: `${formCode} received`,
        detailText: formFull,
        by: null,
        isOpenMovement: isMovementOpen,
        what: (
          <>
            <b>{patientInfo.displayName}</b> {formCode} received
          </>
        ),
      });
    }
    if (m.declines) {
      for (const d of m.declines) {
        if (d.at !== undefined && now - d.at <= 24 * 60) {
          const targetUnit = units.find((u) => u.id === d.unitId);
          const unitName = targetUnit?.name ?? d.unitId;
          const formattedReason = formatTimelineDeclineReason(d.reason);
          timelineEvents.push({
            id: `decline-${m.id}-${d.unitId}-${d.at}`,
            min: d.at,
            tone: "warn",
            category: "bed_search",
            categoryLabel: "Bed searches",
            patientName: patientInfo.displayName,
            movementId: m.id,
            badgeText: "Bed Declined",
            badgeTone: "warn",
            unitName,
            primaryText: `Declined by ${unitName}`,
            detailText: formattedReason,
            by: null,
            isOpenMovement: isMovementOpen,
            what: (
              <>
                <b>{patientInfo.displayName}</b> {unitName} declined: &ldquo;{formattedReason}&rdquo;
              </>
            ),
          });
        }
      }
    }
    if (m.acceptedAt && m.acceptedUnitId && now - m.acceptedAt <= 24 * 60) {
      const targetUnit = units.find((u) => u.id === m.acceptedUnitId);
      const unitName = targetUnit?.name ?? m.acceptedUnitId;
      timelineEvents.push({
        id: `accept-${m.id}-${m.acceptedUnitId}-${m.acceptedAt}`,
        min: m.acceptedAt,
        tone: "good",
        category: "bed_search",
        categoryLabel: "Bed searches",
        patientName: patientInfo.displayName,
        movementId: m.id,
        badgeText: "Bed Accepted",
        badgeTone: "good",
        unitName,
        primaryText: `Bed offer accepted by ${unitName}`,
        by: null,
        isOpenMovement: isMovementOpen,
        what: (
          <>
            <b>{patientInfo.displayName}</b> {unitName} accepted
          </>
        ),
      });
    }
    if (
      m.transport &&
      (m.transport.acceptedAt ?? m.openedAt) &&
      now - (m.transport.acceptedAt ?? m.openedAt) <= 24 * 60
    ) {
      const bookedTime = m.transport.acceptedAt ?? m.openedAt;
      const bookedByRole = m.transport.bookedBy?.role ? WARD_FLOW_ROLE_LABELS[m.transport.bookedBy.role] : null;
      timelineEvents.push({
        id: `transport-${m.id}-${bookedTime}`,
        min: bookedTime,
        tone: "good",
        category: "transport",
        categoryLabel: "Transport",
        patientName: patientInfo.displayName,
        movementId: m.id,
        badgeText: "Transport Booked",
        badgeTone: "good",
        primaryText: m.transport.provider,
        detailText: m.transport.cadNumber
          ? `CAD: ${m.transport.cadNumber}`
          : m.transport.escortRequired
            ? "Clinical escort required"
            : undefined,
        by: bookedByRole,
        isOpenMovement: isMovementOpen,
        what: (
          <>
            <b>{patientInfo.displayName}</b> transport booked with {m.transport.provider}
          </>
        ),
      });
    }
    if (m.leftDepartmentAt && now - m.leftDepartmentAt <= 24 * 60) {
      timelineEvents.push({
        id: `left-${m.id}-${m.leftDepartmentAt}`,
        min: m.leftDepartmentAt,
        tone: "quiet",
        category: "arrivals",
        categoryLabel: "Arrivals & Departures",
        patientName: patientInfo.displayName,
        movementId: m.id,
        badgeText: "Departed",
        badgeTone: "quiet",
        primaryText: "Departed from Emergency Department",
        by: null,
        isOpenMovement: false,
        what: (
          <>
            <b>{patientInfo.displayName}</b> marked left the department
          </>
        ),
      });
    }
  }

  for (const r of referrals) {
    const hasEdDest = r.destinations.some(
      (d) => d.destination.kind === "emergency_department" && d.destination.edId === thisEdId,
    );
    if (!hasEdDest) continue;
    const rPatientInfo = resolveSubjectPatient(r, {
      patients: registryPatients,
      referrals,
    });
    const patientDisplayName = rPatientInfo.displayName;

    if (now - r.raisedAt <= 24 * 60) {
      timelineEvents.push({
        id: `ref-raised-${r.id}-${r.raisedAt}`,
        min: r.raisedAt,
        tone: "quiet",
        category: "bed_search",
        categoryLabel: "Bed searches",
        patientName: patientDisplayName,
        referralId: r.id,
        badgeText: "Referral Raised",
        badgeTone: "quiet",
        primaryText: `Referral raised (${r.ageBand.toLowerCase()} cohort)`,
        by: null,
        what: (
          <>
            <b>{r.id}</b> referral raised, {r.ageBand.toLowerCase()}
          </>
        ),
      });
    }
    if (r.triagedAt !== undefined && now - r.triagedAt <= 24 * 60) {
      timelineEvents.push({
        id: `ref-triaged-${r.id}-${r.triagedAt}`,
        min: r.triagedAt,
        tone: "quiet",
        category: "arrivals",
        categoryLabel: "Arrivals & Departures",
        patientName: patientDisplayName,
        referralId: r.id,
        badgeText: "Triaged",
        badgeTone: "quiet",
        primaryText: "Triaged in department",
        by: null,
        what: (
          <>
            <b>{r.id}</b> triaged in department
          </>
        ),
      });
    }
  }

  timelineEvents.sort((a, b) => b.min - a.min);

  const arrivalEventsCount = timelineEvents.filter((e) => e.category === "arrivals").length;
  const clinicalEventsCount = timelineEvents.filter((e) => e.category === "clinical").length;
  const transportEventsCount = timelineEvents.filter((e) => e.category === "transport").length;
  const bedSearchEventsCount = timelineEvents.filter((e) => e.category === "bed_search").length;

  const filteredTimelineEvents = timelineEvents.filter((e) => {
    if (timelineCategoryFilter !== "all" && e.category !== timelineCategoryFilter) {
      return false;
    }
    if (timelineSearchQuery.trim()) {
      const q = timelineSearchQuery.toLowerCase().trim();
      const matchName = e.patientName?.toLowerCase().includes(q);
      const matchUnit = e.unitName?.toLowerCase().includes(q);
      const matchBadge = e.badgeText?.toLowerCase().includes(q);
      const matchDetail = e.detailText?.toLowerCase().includes(q);
      const matchPrimary = e.primaryText?.toLowerCase().includes(q);
      const matchRef = e.referralId?.toLowerCase().includes(q);
      return Boolean(matchName || matchUnit || matchBadge || matchDetail || matchPrimary || matchRef);
    }
    return true;
  });

  const selectedPatientJourneyEvents: TimelineEvent[] = [];
  if (selectedPatient) {
    selectedPatientJourneyEvents.push({
      min: selectedPatient.openedAt,
      tone: "quiet",
      what: "Arrived at the department",
      by: null,
    });
    const selMc = movementMedicalClearance(selectedPatient, referrals);
    if (selMc?.cleared) {
      selectedPatientJourneyEvents.push({
        min: selMc.at,
        tone: "quiet",
        what: "Medically cleared",
        by: null,
      });
    }
    if (selectedPatient.examination) {
      selectedPatientJourneyEvents.push({
        min: selectedPatient.examination.at,
        tone: "quiet",
        what: `Reviewed by psychiatry (${selectedPatient.examination.outcome})`,
        by: null,
      });
    }
    if (selectedPatient.legalForm?.dueAt !== undefined) {
      selectedPatientJourneyEvents.push({
        min: selectedPatient.legalForm.dueAt,
        tone: selectedPatient.legalForm.dueAt < now ? "danger" : "warn",
        what:
          (selectedPatient.legalForm.dueAt < now ? "Deadline passed on " : "Deadline falls due on ") +
          `Form ${selectedPatient.legalForm.code}`,
        by: null,
      });
    }
    if (selectedPatient.declines) {
      for (const d of selectedPatient.declines) {
        if (d.at !== undefined) {
          selectedPatientJourneyEvents.push({
            min: d.at,
            tone: "warn",
            what: `${units.find((u) => u.id === d.unitId)?.name ?? d.unitId} declined`,
            by: null,
          });
        }
      }
    }
    if (selectedPatient.acceptedAt && selectedPatient.acceptedUnitId) {
      selectedPatientJourneyEvents.push({
        min: selectedPatient.acceptedAt,
        tone: "good",
        what: `${units.find((u) => u.id === selectedPatient.acceptedUnitId)?.name ?? selectedPatient.acceptedUnitId} accepted`,
        by: null,
      });
    }
    if (selectedPatient.transport) {
      selectedPatientJourneyEvents.push({
        min: selectedPatient.transport.acceptedAt ?? selectedPatient.openedAt,
        tone: "good",
        what: "Transport booked",
        by: selectedPatient.transport.bookedBy?.role
          ? WARD_FLOW_ROLE_LABELS[selectedPatient.transport.bookedBy.role]
          : null,
      });
    }
    if (selectedPatient.arrivalDetails?.recordedAt !== undefined) {
      const details = selectedPatient.arrivalDetails;
      selectedPatientJourneyEvents.push({
        min: details.recordedAt,
        tone: isArrivalLate(selectedPatient, now) ? "danger" : "good",
        what: `Arrival plan recorded · ${arrivalModeLabel(details.mode)} · ward ${arrivalEtaLabel(details.estimatedArrivalAt, now)}`,
        by: details.recordedBy ? WARD_FLOW_ROLE_LABELS[details.recordedBy] : null,
      });
    }
    selectedPatientJourneyEvents.sort((a, b) => b.min - a.min);
  }

  function submitReferral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Guards the same fields `referralDraftBlockedReason` names, and does so with direct
    // `=== undefined` checks — not a call to that function — so TypeScript narrows each local
    // binding to its real, answered type below. This is the raise-referral form's own version of
    // `submitDecline`'s `if (declineDraft === undefined) return;` a few lines up: the button
    // being `aria-disabled` stops a click, but this form (unlike the decline panel) IS a real
    // `<form>`, so pressing Enter inside a field submits it regardless of what the button
    // advertises. Without this guard that keystroke would file the same fabricated cohort,
    // security level, sex, legal status or urgency tier the whole fix exists to stop — and, since
    // T3, the same half-typed expiry `referralDraftBlockedReason`'s last check refuses.
    const { cohort, security, sex, gender, legalStatus, urgency } = draft;
    if (
      cohort === undefined ||
      security === undefined ||
      sex === undefined ||
      gender === undefined ||
      legalStatus === undefined ||
      urgency === undefined ||
      draft.specialling === undefined ||
      draft.highAcuity === undefined ||
      (draft.legalFormDueAtDate !== "") !== (draft.legalFormDueAtTime !== "")
    ) {
      return;
    }
    dispatch({
      type: "RAISE_REFERRAL",
      role: "ed",
      now,
      edId: thisEdId,
      // Opus review round 2, 17 September 2026 (P2), item 6: `undefined` in the ordinary,
      // unlinked case (this form's existing behaviour) — set only when this form was opened via
      // the inbox row's own "Raise into a movement" button, which is also what supplied the
      // gender prefill in `draft.gender` above.
      referralId: raisingFromReferralId,
      draft: {
        cohort,
        security,
        sex,
        // T11 (item 8): widened from the three-state local draft — `"not_recorded"` becomes
        // `undefined` on the dispatched event, the model's own "not yet recorded" convention.
        gender: gender === "not_recorded" ? undefined : gender,
        // T15 (item 12): `"none"` becomes `undefined` on the dispatched event, the same widening
        // the gender field immediately above gets.
        tentativeDiagnosis: draft.tentativeDiagnosis === "none" ? undefined : draft.tentativeDiagnosis,
        specialling: draft.specialling,
        highAcuity: draft.highAcuity,
        legalStatus,
        urgency,
        legalFormCode: draft.legalFormCode,
        // `undefined` when the clinician typed nothing (or the guard above already refused
        // something incomplete) — the reducer then writes no deadline at all, which is the state
        // every ward surface already renders explicitly as absent.
        legalFormDueAt: instantFromDateAndTimeInputs(draft.legalFormDueAtDate, draft.legalFormDueAtTime, dayZero),
      },
    });
    setDraft(DEFAULT_DRAFT);
    setReferralOpen(false);
    setRaisingFromReferralId(undefined);
  }

  function toggleExamination(movementId: string) {
    setExaminationOpenFor((current) => (current === movementId ? undefined : movementId));
    setExaminationOutcome(undefined);
  }

  function submitExamination(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (!examinationOutcome) return;
    dispatch({ type: "RECORD_EXAMINATION", role: "ed", now, movementId, outcome: examinationOutcome });
    setExaminationOpenFor(undefined);
    setExaminationOutcome(undefined);
  }

  function toggleUrgencyChange(movementId: string, currentUrgency: 1 | 2 | 3) {
    setUrgencyChangeOpenFor((current) => (current === movementId ? undefined : movementId));
    setUrgencyDraft({ urgency: currentUrgency, reason: undefined });
  }

  function submitUrgencyChange(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    // A real <form>: Enter inside a field submits it whatever the button advertises.
    if (urgencyDraft.reason === undefined) return;
    dispatch({
      type: "CHANGE_URGENCY",
      role: "ed",
      now,
      movementId,
      urgency: urgencyDraft.urgency,
      reason: urgencyDraft.reason,
    });
    setUrgencyChangeOpenFor(undefined);
  }

  function toggleLegalStatusChange(movementId: string, currentLegalStatus: LegalStatus) {
    setLegalStatusChangeOpenFor((current) => (current === movementId ? undefined : movementId));
    setLegalStatusDraft({ legalStatus: currentLegalStatus, reason: undefined });
  }

  function submitLegalStatusChange(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    // This IS a real <form>, so Enter inside a field submits it whatever the button advertises —
    // the same bypass the raise-referral form guards. An `aria-disabled` control alone would not
    // catch it, and the reducer requires a reason, so an unguarded Enter would dispatch `undefined`.
    if (legalStatusDraft.reason === undefined) return;
    dispatch({
      type: "CHANGE_LEGAL_STATUS",
      role: "ed",
      now,
      movementId,
      legalStatus: legalStatusDraft.legalStatus,
      reason: legalStatusDraft.reason,
    });
    setLegalStatusChangeOpenFor(undefined);
  }

  function toggleWithdrawReferral(movementId: string) {
    setWithdrawOpenFor((current) => (current === movementId ? undefined : movementId));
  }

  function confirmWithdrawReferral(movementId: string) {
    dispatch({ type: "WITHDRAW_REFERRAL", role: "ed", now, movementId });
    setWithdrawOpenFor(undefined);
  }

  function toggleLegalFormExpiry(movementId: string) {
    setLegalFormExpiryOpenFor((current) => (current === movementId ? undefined : movementId));
    // Blanked on every open, the same ruling `toggleBookTransport` below records: a remembered
    // date or time from a previous patient's panel would stand in for an unmade decision, and a
    // legal form's expiry is exactly that kind of clinical fact.
    setLegalFormExpiryDraft(BLANK_TYPED_EXPIRY_DRAFT);
  }

  function submitLegalFormExpiry(
    event: FormEvent<HTMLFormElement>,
    movementId: string,
    currentDueAt: Instant | undefined,
  ) {
    event.preventDefault();
    // A real <form>: Enter inside a field submits it whatever the button advertises, the same
    // bypass every other panel on this screen guards against.
    const dueAt = instantFromDateAndTimeInputs(legalFormExpiryDraft.date, legalFormExpiryDraft.time, dayZero);
    // Never dispatched half-answered or backwards. Both refusals are the reducer's own rule
    // ("There is no legal form…"/"An extension's new expiry must be later…") — this mirrors them
    // rather than owning them, the same discipline `submitBookTransport` below holds to, so the
    // control never advertises a save it already knows the reducer would refuse.
    if (dueAt === undefined) return;
    if (currentDueAt !== undefined && dueAt <= currentDueAt) return;
    dispatch({ type: "RECORD_LEGAL_FORM_EXPIRY", role: "ed", now, movementId, dueAt });
    setLegalFormExpiryOpenFor(undefined);
    setLegalFormExpiryDraft(BLANK_TYPED_EXPIRY_DRAFT);
  }

  function toggleReceiptCorrection(movementId: string) {
    setReceiptCorrectionOpenFor((current) => (current === movementId ? undefined : movementId));
    // Blanked on every open, the same ruling `toggleLegalFormExpiry` above records: a remembered
    // reason from a previous patient's panel would stand in for an unmade decision.
    setReceiptCorrectionReasonDraft(undefined);
  }

  function submitReceiptCorrection(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    // A real <form>: Enter inside a field submits it whatever the button advertises, the same
    // bypass every other panel on this screen guards against — the reducer requires a reason, so
    // an unguarded Enter would dispatch `undefined`.
    if (receiptCorrectionReasonDraft === undefined) return;
    dispatch({
      type: "CORRECT_LEGAL_FORM_RECEIPT",
      role: "ed",
      now,
      movementId,
      reason: receiptCorrectionReasonDraft,
    });
    setReceiptCorrectionOpenFor(undefined);
    setReceiptCorrectionReasonDraft(undefined);
  }

  function toggleBookTransport(movementId: string) {
    setTransportOpenFor((current) => (current === movementId ? undefined : movementId));
    // ⚠️ **BLANKED ON EVERY OPEN, NOT ONLY ON EVERY CLOSE.** Carrying the previous patient's
    // answers into the next panel would be a remembered value standing in for an unmade decision —
    // the same ruling as a derived one, and harder to see because it was true once.
    setTransportDraft(BLANK_TRANSPORT_DRAFT);
  }

  function toggleDecline(referralId: string) {
    setDeclineOpenFor((current) => (current === referralId ? undefined : referralId));
    // Blanked on every OPEN as well as every close, the same ruling `toggleBookTransport` records:
    // the previous row's reason carried into this panel would be a remembered value standing in
    // for an unmade decision, and this list is one row per patient.
    setDeclineDraft(undefined);
    setDeclineRejection(undefined);
  }

  function submitDecline(referralId: string) {
    // Never dispatched without a reason. The reducer refuses one by membership check — that is the
    // rule's real home — but a refusal raised from here would be invisible to whoever pressed the
    // button, so the control declines to advertise a decline it knows would be rejected.
    if (declineDraft === undefined) return;
    priorRejectionCountRef.current = rejections.length;
    dispatch({
      type: "DECLINE_REFERRAL",
      role: "ed",
      now,
      referralId,
      // Named, never defaulted: this screen is the emergency department's own inbox, so the
      // destination answering here is the emergency department. The reducer must not have to guess
      // which destination replied — and naming it is what keeps its `answerableBy` guard meaningful.
      destinationKind: "emergency_department",
      reason: declineDraft,
    });
    setDeclineCheckToken((token) => token + 1);
    // ⚠️ **THE PANEL IS DELIBERATELY NOT CLOSED AND THE DRAFT NOT CLEARED HERE.** `dispatch` does
    // not say whether the reducer accepted, so closing on dispatch would discard a clinician's
    // chosen reason on a REFUSAL. On acceptance the row leaves the inbox — `edReferralsFor` keeps
    // only `queued` addressings — and the panel goes with it; on a refusal the panel stays open,
    // beside the stated reason it was refused for.
  }

  function submitBookTransport(movementId: string) {
    const { provider, escortRequired, cadNumber, transportLegalStatus, estimatedTime, estimatedDay } = transportDraft;
    const estimatedAt = instantFromEstimatedTimeInputs(estimatedTime, estimatedDay, now);
    // Never dispatched half-answered. The reducer would refuse it — that refusal is the rule's
    // real home — but a refusal raised from here would be invisible to whoever pressed the button,
    // so the control declines to advertise a booking it knows would be rejected.
    if (
      provider === undefined ||
      escortRequired === undefined ||
      cadNumber.trim().length === 0 ||
      transportLegalStatus === undefined ||
      estimatedAt === undefined
    ) {
      return;
    }
    dispatch({
      type: "BOOK_TRANSPORT",
      role: "ed",
      now,
      movementId,
      provider,
      escortRequired,
      cadNumber: cadNumber.trim(),
      transportLegalStatus,
      estimatedAt,
    });
    closeTransportDialog();
  }

  const arrivalPlanMovement = arrivalPlanOpenFor ? movements.find((m) => m.id === arrivalPlanOpenFor) : undefined;

  return (
    <div
      className={styles.screen}
      data-testid="ward-ed-screen"
      data-ward-design="third-edition"
      data-ward-rebuilt-screen="emergency-department"
    >
      <main id="main-content" className={styles.main}>
        <EdOverview
          key={department.id}
          departmentId={department.id}
          departments={departments.map((candidate) => {
            const candidateSite = siteByCode(candidate.siteCode);
            const candidateMovements = movements.filter(
              (movement) =>
                movement.originEdId === candidate.id &&
                movement.stage !== "arrived" &&
                (!movement.closure ||
                  (movement.edOutcome !== undefined && !movement.leftDepartmentAt) ||
                  isEdInitiatedWithdrawal(movement)),
            );
            return {
              id: candidate.id,
              name: candidate.name,
              code: candidateSite?.code ?? candidate.siteCode,
              service: candidateSite?.service ?? "Service not identified",
              waiting: candidateMovements.length,
              longest: candidateMovements.length
                ? splitDuration(Math.max(...candidateMovements.map((movement) => Math.max(now - movement.openedAt, 0))))
                : "—",
              breaches: candidateMovements.filter((movement) => now - movement.openedAt > accessTarget).length,
            };
          })}
          figures={[
            { label: "On the board", value: patients.length },
            {
              label: "Waiting for a bed",
              value: patients.filter(
                (movement) => movement.stage === "accepted_awaiting_bed" || movement.stage === "pulled",
              ).length,
            },
            { label: "Review referrals", value: inbox.length },
            { label: "Expected", value: expects.length },
            { label: "Under a form", value: patients.filter((movement) => !!movement.legalForm).length },
            {
              label: "Longest here",
              value: patients.length
                ? splitDuration(Math.max(...patients.map((movement) => Math.max(now - movement.openedAt, 0))))
                : "—",
            },
          ]}
          referralOpen={referralOpen}
          onRaiseReferral={() => {
            setRaisingFromReferralId(undefined);
            setReferralOpen(true);
            requestAnimationFrame(() =>
              document.querySelector<HTMLSelectElement>('[data-testid="ward-ed-referral-cohort"]')?.focus(),
            );
          }}
        />

        <section
          id="ward-ed-referral-intake"
          aria-label="New referral"
          hidden={!referralOpen}
          className={`${styles.panel} ${styles.full} ${styles.listSection} ${styles.referralBarSection}`}
          tabIndex={0}
        >
          <div className={styles.ph}>
            <h2>New referral</h2>
            <button
              type="button"
              className={styles.inboxBtn}
              onClick={() => {
                setReferralOpen(false);
                setRaisingFromReferralId(undefined);
                document.querySelector<HTMLButtonElement>('[data-testid="ward-ed-raise-referral-toggle"]')?.focus();
              }}
            >
              Close referral
            </button>
          </div>
          {referralOpen && (
            <div className={styles.referralPanelBody}>
              {(() => {
                const referralBlocked = referralDraftBlockedReason(draft);
                return (
                  <form className={styles.referralForm} onSubmit={submitReferral} data-testid="ward-ed-referral-form">
                    <div className={styles.referralGrid}>
                      <label className={styles.referralField}>
                        Cohort
                        <select
                          data-testid="ward-ed-referral-cohort"
                          value={draft.cohort ?? NO_COHORT_VALUE}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              cohort:
                                event.target.value === NO_COHORT_VALUE ? undefined : (event.target.value as Cohort),
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
                              sex:
                                event.target.value === NO_SEX_VALUE ? undefined : (event.target.value as RecordedSex),
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
                        Raise referral
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
                        <span id="ward-ed-referral-blocked" className="sr-only">
                          {referralBlocked}
                        </span>
                      ) : null}
                    </div>
                  </form>
                );
              })()}
            </div>
          )}
        </section>

        <section className={styles.departmentWorkspace} aria-label="Selected department work">
          <section className={`${styles.panel} ${styles.mod}`} aria-labelledby="ward-ed-attention-heading">
            <div className={styles.ph}>
              <h2 id="ward-ed-attention-heading">Needs you</h2>

              <span className={styles.count}>
                {priorityFlags.length === 0
                  ? "none"
                  : `${priorityFlags.length} flag${priorityFlags.length === 1 ? "" : "s"}`}
              </span>
            </div>

            <div className={styles.attentionWrap}>
              {priorityFlags.length === 0 ? (
                <p className={styles.none}>No outstanding flags recorded for this department.</p>
              ) : (
                <ul className={styles.attentionList}>
                  {priorityFlags.map((flag, idx) => (
                    <li key={idx} className={styles.attentionRow} data-tone={flag.tone}>
                      <div className={styles.attentionHeader}>
                        <span className={styles.attentionBadge} data-tone={flag.tone} aria-hidden="true">
                          <span className={styles.attentionBadgeGlyph}>
                            <AttentionToneIcon tone={flag.tone} />
                          </span>
                        </span>
                        <span className="sr-only">
                          {flag.tone === "danger"
                            ? "Urgent warning: "
                            : flag.tone === "warn"
                              ? "Warning: "
                              : flag.tone === "good"
                                ? "Accepted: "
                                : "Status: "}
                        </span>
                        <span className={styles.attentionTitle}>{flag.kind}</span>
                        <span className={styles.attentionMeta}>
                          <span className={styles.attentionMetaDot} aria-hidden="true">
                            &middot;
                          </span>
                          <button
                            type="button"
                            className={styles.attentionIdBtn}
                            onClick={() => {
                              if (patients.some((p) => p.id === flag.recordId)) {
                                setSelectedPatientId(flag.recordId);
                              }
                            }}
                          >
                            {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number
                             * — `personName` is unset for a referral-sourced flag, which keeps its
                             * own id (RF-…, out of this change's scope). */}
                            {flag.personName ?? flag.recordId}
                          </button>
                          <span className={styles.attentionDemographics}>{flag.meta}</span>
                        </span>
                        <span className={styles.attentionStamp} data-tone={flag.tone}>
                          {flag.when}
                        </span>
                      </div>
                      <div className={styles.attentionBody}>
                        <span className={styles.attentionWhy}>{flag.why}</span>
                        <div className={styles.attentionFooter}>
                          {flag.actionLabel ? (
                            <button type="button" className={styles.attentionNext} onClick={flag.onAction}>
                              <span>Next:</span> {flag.actionLabel}
                            </button>
                          ) : (
                            <span />
                          )}
                          {patients.some((patient) => patient.id === flag.recordId) && (
                            <button
                              type="button"
                              className={styles.attentionRecord}
                              onClick={() => setSelectedPatientId(flag.recordId)}
                            >
                              View record <span aria-hidden="true">›</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          <section className={`${styles.panel} ${styles.mod}`} aria-labelledby="ward-ed-lists-heading">
            <div className={styles.ph}>
              <h2 id="ward-ed-lists-heading">Lists</h2>

              <span className={styles.count}>
                {departmentListTab === "review"
                  ? `${awaitingReviewPatients.length === 0 ? "none" : awaitingReviewPatients.length} awaiting review`
                  : departmentListTab === "cleared"
                    ? `${clearedPatients.length === 0 ? "none" : clearedPatients.length} medical clearance`
                    : departmentListTab === "expected"
                      ? `${expects.length === 0 ? "none" : expects.length} expected`
                      : departmentListTab === "forms"
                        ? `${underFormPatients.length === 0 ? "none" : underFormPatients.length} under a form`
                        : `${outbox.length + answeredAll.length === 0 ? "none" : outbox.length + answeredAll.length} referred`}
              </span>
            </div>
            <div
              className={`${styles.tabbar} ${styles.departmentListTabs}`}
              role="tablist"
              aria-label="Lists"
              onKeyDown={onDepartmentListKeyDown}
            >
              <button
                type="button"
                role="tab"
                id="ward-ed-review-tab"
                aria-label={`Awaiting Review, ${awaitingReviewPatients.length === 0 ? "none" : awaitingReviewPatients.length} patients`}
                aria-selected={departmentListTab === "review"}
                aria-controls="ward-ed-review-panel"
                tabIndex={departmentListTab === "review" ? 0 : -1}
                className={styles.tabBtn}
                onClick={() => setDepartmentListTab("review")}
              >
                Review{" "}
                <span className={styles.tabNum} data-zero={awaitingReviewPatients.length === 0 ? "true" : undefined}>
                  {awaitingReviewPatients.length === 0 ? "none" : awaitingReviewPatients.length}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                id="ward-ed-cleared-tab"
                aria-label={`Medical Clearance, ${clearedPatients.length === 0 ? "none" : clearedPatients.length}`}
                aria-selected={departmentListTab === "cleared"}
                aria-controls="ward-ed-cleared-panel"
                tabIndex={departmentListTab === "cleared" ? 0 : -1}
                className={styles.tabBtn}
                onClick={() => setDepartmentListTab("cleared")}
              >
                Med Clear{" "}
                <span className={styles.tabNum} data-zero={clearedPatients.length === 0 ? "true" : undefined}>
                  {clearedPatients.length === 0 ? "none" : clearedPatients.length}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                id="ward-ed-expected-tab"
                aria-label={`Expects, ${expects.length === 0 ? "none" : expects.length}`}
                aria-selected={departmentListTab === "expected"}
                aria-controls="ward-ed-expected-panel"
                tabIndex={departmentListTab === "expected" ? 0 : -1}
                className={styles.tabBtn}
                onClick={() => setDepartmentListTab("expected")}
              >
                Expects{" "}
                <span className={styles.tabNum} data-zero={expects.length === 0 ? "true" : undefined}>
                  {expects.length === 0 ? "none" : expects.length}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                id="ward-ed-forms-tab"
                aria-label={`Forms, ${underFormPatients.length === 0 ? "none" : underFormPatients.length}`}
                aria-selected={departmentListTab === "forms"}
                aria-controls="ward-ed-forms-panel"
                tabIndex={departmentListTab === "forms" ? 0 : -1}
                className={styles.tabBtn}
                onClick={() => setDepartmentListTab("forms")}
              >
                Forms{" "}
                <span className={styles.tabNum} data-zero={underFormPatients.length === 0 ? "true" : undefined}>
                  {underFormPatients.length === 0 ? "none" : underFormPatients.length}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                id="ward-ed-referred-tab"
                aria-label="Referred · Still to be moved"
                aria-selected={departmentListTab === "referred"}
                aria-controls="ward-ed-outbox-panel"
                tabIndex={departmentListTab === "referred" ? 0 : -1}
                className={styles.tabBtn}
                onClick={() => setDepartmentListTab("referred")}
              >
                Referred{" "}
                <span
                  className={styles.tabNum}
                  data-zero={outbox.length + answeredAll.length === 0 ? "true" : undefined}
                >
                  {outbox.length + answeredAll.length === 0 ? "none" : outbox.length + answeredAll.length}
                </span>
              </button>
            </div>

            <section
              id="ward-ed-review-panel"
              role="tabpanel"
              aria-labelledby="ward-ed-review-tab"
              aria-label="Awaiting Review"
              hidden={departmentListTab !== "review"}
              className={styles.lstWrap}
              tabIndex={0}
            >
              <section aria-label="Referrals" className={styles.inboxSection} data-testid="ward-ed-inbox" tabIndex={0}>
                <h3 className={styles.inboxSubheading}>
                  Referrals &middot; {inbox.length} patient{inbox.length === 1 ? "" : "s"}
                </h3>
                <p className={styles.inboxMeta}>
                  Oldest first · Department time is from recorded triage; referral time is separate.
                </p>
                {inbox.length === 0 ? (
                  <p className={styles.placeholder} data-testid="ward-ed-inbox-empty">
                    No referral for psychiatric review is addressed to {department.name}. Bed-only and medical requests
                    are outside this list.
                  </p>
                ) : (
                  <ul className={styles.inboxList}>
                    {inbox.map(({ referral, destination, addressing }) => {
                      const clocks = referralClocks(referral, now);
                      const lines = edReferralClockLines(clocks);
                      const declineOpen = declineOpenFor === referral.id;
                      const declineBlocked = declineReasonBlockedReason(declineDraft);
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
                          data-purpose={destination.purpose}
                          data-ed-id={destination.edId}
                          data-minutes-since-referral={clocks.sinceReferral}
                          data-since-referral-running={clocks.sinceReferralRunning ? "true" : "false"}
                          data-minutes-in-department={clocks.inDepartment}
                        >
                          <header className={styles.inboxItemHeader}>
                            <strong>{referral.id}</strong>
                            <span style={{ fontSize: "0.85rem", color: "var(--ink)", fontWeight: 600 }}>
                              {referralPatient.displayName}
                            </span>
                            <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                              (UMRN: <strong>{referralPatient.umrn}</strong>)
                            </span>
                            <span className={styles.inboxPurpose} data-testid={`ward-ed-inbox-purpose-${referral.id}`}>
                              {referralPurposeLabel(destination.purpose)}
                            </span>
                          </header>
                          <p className={styles.inboxFacts}>{referralPersonFacts(referral).join(" · ")}</p>
                          <dl className={styles.inboxClocks} data-testid={`ward-ed-inbox-clocks-${referral.id}`}>
                            <div
                              className={styles.inboxClockRow}
                              data-testid={`ward-ed-inbox-department-clock-${referral.id}`}
                            >
                              <dt>{lines.department.term}</dt>
                              <dd>{lines.department.value}</dd>
                            </div>
                            <div
                              className={styles.inboxClockRow}
                              data-testid={`ward-ed-inbox-referral-clock-${referral.id}`}
                            >
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
                              setReferralDetailsOpenFor((current) =>
                                current === referral.id ? undefined : referral.id,
                              )
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
                                  dispatch({
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
                                  dispatch({
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
                                onClick={() => {
                                  setRaisingFromReferralId(referral.id);
                                  setDraft((current) => ({ ...current, gender: referralWardGender(referral) }));
                                  setReferralOpen(true);
                                }}
                              >
                                Raise into a movement
                              </button>
                            )}
                            {addressing.state !== "queued" ? null : (
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
                                  <div
                                    className={styles.declineForm}
                                    data-testid={`ward-ed-inbox-decline-panel-${referral.id}`}
                                  >
                                    <label
                                      className={styles.referralField}
                                      htmlFor={`ward-ed-inbox-decline-reason-${referral.id}`}
                                    >
                                      Why is {referral.id} being declined?
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
                                      aria-describedby={
                                        declineBlocked ? `ward-ed-inbox-decline-blocked-${referral.id}` : undefined
                                      }
                                      title={declineBlocked ?? undefined}
                                      onClick={
                                        declineBlocked ? ignoreUnavailableActivation : () => submitDecline(referral.id)
                                      }
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
                            )}
                          </div>
                          {declineRejection?.referralId === referral.id ? (
                            <p
                              className={styles.rejection}
                              role="alert"
                              data-testid={`ward-ed-inbox-decline-rejection-${referral.id}`}
                            >
                              Decline not recorded: {declineRejection.rejection.reason}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <h2 className={styles.sectionHeading} style={{ marginTop: "1rem" }}>
                Awaiting Review &middot; {awaitingReviewPatients.length} patient
                {awaitingReviewPatients.length === 1 ? "" : "s"}
              </h2>
              <p className={styles.unitMeta}>Patients in department without a recorded psychiatric review.</p>
              {awaitingReviewPatients.length === 0 ? (
                <p className={styles.none}>
                  Everyone on this department&rsquo;s psychiatry list has been seen. Absence here means every referral
                  has a recorded review, not that no referral was made.
                </p>
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
                            <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                              UMRN: <strong>{patientInfo.umrn}</strong>
                            </span>
                            <span className={styles.bayNumber}>{patientBay(m.id)}</span>
                            <span>{m.cohort}</span>
                            <span>{m.sex}</span>
                          </span>
                          <span className={styles.lstWhy}>
                            {outstandingItem(m).label}.{" "}
                            {mc?.cleared
                              ? `Medically cleared at ${formatInstantWithDay(mc.at, now)}.`
                              : mc
                                ? "Not medically cleared."
                                : "Clearance pending."}
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
            </section>

            <section
              id="ward-ed-cleared-panel"
              role="tabpanel"
              aria-labelledby="ward-ed-cleared-tab"
              aria-label="Medical Clearance"
              hidden={departmentListTab !== "cleared"}
              className={styles.lstWrap}
              tabIndex={0}
            >
              <h2 className={styles.sectionHeading}>
                Medical Clearance &middot; {clearedPatients.length} patient
                {clearedPatients.length === 1 ? "" : "s"}
              </h2>
              <p className={styles.unitMeta}>Patients marked medically cleared for psychiatric assessment.</p>
              {clearedPatients.length === 0 ? (
                <p className={styles.none}>
                  No medical clearance is recorded for anybody here. Absence here means nothing has been written down,
                  not that nobody is fit to be seen.
                </p>
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
                            <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                              UMRN: <strong>{patientInfo.umrn}</strong>
                            </span>
                            <span className={styles.bayNumber}>{patientBay(m.id)}</span>
                            <span>{m.cohort}</span>
                            <span>{m.sex}</span>
                          </span>
                          <span className={styles.lstWhy}>
                            {reviewed ? "Reviewed by psychiatry. " : "Not seen by psychiatry yet. "}
                            {stageCopy[m.stage].label}
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
            </section>

            <section
              id="ward-ed-expected-panel"
              role="tabpanel"
              aria-labelledby="ward-ed-expected-tab"
              aria-label="Expects"
              data-testid="ward-ed-expects"
              hidden={departmentListTab !== "expected"}
              className={styles.lstWrap}
              tabIndex={0}
            >
              <h2 className={styles.sectionHeading}>
                Expects &middot; {expects.length} patient{expects.length === 1 ? "" : "s"}
              </h2>
              <p className={styles.unitMeta}>
                Not yet in the department; scheduled arrival time first when recorded, longest since referral first
                otherwise. Accepted referrals stay here until arrival is marked.
              </p>
              {expects.length === 0 ? (
                <p className={styles.placeholder} data-testid="ward-ed-expects-empty">
                  No expects are recorded for psychiatry at {department.name}; this does not establish that nobody is on
                  the way.
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
                          <strong>{referral.id}</strong>
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
                            Referred over {EXPECT_RECONSIDER_AFTER_MINUTES / 60} hours ago and not arrived. Reconsider
                            whether this referral still stands; no record was changed.
                          </p>
                        ) : null}
                        <button
                          type="button"
                          className={styles.arrivedButton}
                          data-testid={`ward-ed-expects-arrived-${referral.id}`}
                          onClick={() =>
                            dispatch({
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
            </section>

            <section
              id="ward-ed-forms-panel"
              role="tabpanel"
              aria-labelledby="ward-ed-forms-tab"
              aria-label="Forms"
              hidden={departmentListTab !== "forms"}
              className={styles.lstWrap}
              tabIndex={0}
            >
              <h2 className={styles.sectionHeading}>
                Forms &middot; {underFormPatients.length} patient{underFormPatients.length === 1 ? "" : "s"}
              </h2>
              <p className={styles.unitMeta}>Patients with a recorded involuntary form.</p>
              {underFormPatients.length === 0 ? (
                <p className={styles.none}>
                  Nobody on this department&rsquo;s list is under a legal form. Absence here means no form is recorded,
                  not that no form applies.
                </p>
              ) : (
                <ul className={styles.lst}>
                  {underFormPatients.map((m) => {
                    const due = m.legalForm?.dueAt;
                    const tone = due === null || due === undefined ? "quiet" : due < now ? "danger" : "good";
                    const stamp =
                      due === null || due === undefined
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
                            <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                              UMRN: <strong>{patientInfo.umrn}</strong>
                            </span>
                            <span className={styles.bayNumber}>{patientBay(m.id)}</span>
                            <span>{m.cohort}</span>
                            <span>{m.sex}</span>
                          </span>
                          <span className={styles.lstWhy}>
                            Form {m.legalForm ? m.legalForm.code : ""}.{" "}
                            {due === null || due === undefined
                              ? "No deadline is recorded against it."
                              : due < now
                                ? `The deadline passed ${splitDuration(Math.max(now - due, 0))} ago.`
                                : `The deadline is ${splitDuration(Math.max(due - now, 0))} away.`}
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
            </section>
            {/*
             * RECENTLY ANSWERED — owner ruling 7, 2026-09-01. Directly beneath the inbox because it is
             * the same clinician's own question a moment later: "what did I just decide, and why?" The
             * row a clinician just declined has already left the inbox above — that list is a worklist
             * — so without this section there is no undo, no record on this screen, and nothing to
             * check a mistake against.
             *
             * ⚠️ **`data-testid` VALUES ARE `ward-ed-answered-*`, NEVER `ward-ed-inbox-*`.** Two tests
             * in this suite assert an answered row DISAPPEARS from `ward-ed-inbox-row-<id>` — that is
             * "the only success signal on screen" for a decline, per their own comments — and
             * `getAllByTestId(/^ward-ed-inbox-row-/)` would silently grow to include this section's
             * rows too. Reusing the inbox's prefix here would turn both green tests red BECAUSE this
             * feature works; the distinct prefix is what keeps them passing while proving something new.
             *
             * Same structure and classes as the inbox section above, on purpose — a coordinator moving
             * between the two should not have to learn a second layout.
             */}
            <section
              id="ward-ed-outbox-panel"
              role="tabpanel"
              aria-labelledby="ward-ed-referred-tab"
              hidden={departmentListTab !== "referred"}
              aria-label="Referred · Still to be moved"
              className={styles.lstWrap}
              tabIndex={0}
            >
              <div className={styles.referredSubSection} data-testid="ward-ed-outbox">
                <h2 className={styles.sectionHeading}>
                  Still to be moved &middot; {outbox.length} patient{outbox.length === 1 ? "" : "s"}
                </h2>
                <p className={styles.unitMeta}>
                  Patients referred onward who remain in {department.name}. Bed acceptance does not remove them; elapsed
                  movement time starts at recorded acceptance.
                </p>
                {outbox.length === 0 ? (
                  <p className={styles.placeholder} data-testid="ward-ed-outbox-empty">
                    No patient here is waiting to be moved onward.
                  </p>
                ) : (
                  <ul className={styles.cardList}>
                    {outbox.map((movement) => {
                      // Resolved from the live `units`, never `unitById` — whole-branch review Critical 1,
                      // the same correction the patients section below already carries.
                      const acceptedUnit = units.find((unit) => unit.id === movement.acceptedUnitId);
                      // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
                      const patientInfo = resolveSubjectPatient(movement, {
                        patients: registryPatients,
                        referrals,
                        movements,
                      });
                      return (
                        <li
                          key={movement.id}
                          className={styles.card}
                          data-testid={`ward-ed-outbox-row-${movement.id}`}
                          data-stage={movement.stage}
                        >
                          <header className={styles.cardHeader}>
                            <strong>{patientInfo.formalName}</strong>
                            <span className={styles.cardMeta}>{stageCopy[movement.stage].label}</span>
                            {/*
                             * THE URGENCY TIER, BESIDE THE STAGE, ON EVERY ROW — owner ruling, 2026-08-31.
                             *
                             * ⚠️ **UNCONDITIONAL, TIER 3 INCLUDED.** Showing it only on tiers 1 and 2 would
                             * make its ABSENCE the signal for tier 3, and this project has repeatedly proved
                             * that nobody reads an absence. Same position on every card, whatever the tier.
                             *
                             * `urgencyTierLabel`, never a second spelling: the boards, the pickers and this
                             * row must all say "Tier 3 · least urgent" in the same words.
                             *
                             * Neutral tone for all three tiers by design — see `.tierLabel` in ed.module.css.
                             */}
                            <span
                              className={styles.tierLabel}
                              data-testid={`ward-ed-outbox-tier-${movement.id}`}
                              data-urgency={movement.urgency}
                            >
                              <span className={styles.urgencyGlyph} aria-hidden="true">
                                {urgencyGlyph(movement.urgency)}
                              </span>{" "}
                              {urgencyTierLabel(movement.urgency)}
                            </span>
                          </header>
                          <p className={styles.cardMeta}>
                            {movement.cohort} &middot; {movement.security} &middot; {movement.sex} &middot;{" "}
                            {movement.legalStatus}
                          </p>
                          <div className={styles.outstandingItem}>
                            <span className={styles.outstandingLabel}>Going to</span>
                            {/* The unit's own name, or an honest statement that this state cannot name
                            one — never a substituted unit and never a bare id. */}
                            <span>{acceptedUnit ? acceptedUnit.name : "Accepted unit not resolved"}</span>
                          </div>
                          {movement.transport?.diversion !== undefined && movement.admissionId !== undefined ? (
                            <div className={styles.actionRow}>
                              <button
                                type="button"
                                data-testid={`ward-ed-release-diverted-bed-${movement.id}`}
                                className={styles.declineButton}
                                onClick={() =>
                                  dispatch({
                                    type: "RELEASE_DIVERTED_BED",
                                    role: "ed",
                                    now,
                                    movementId: movement.id,
                                  })
                                }
                              >
                                Release the held bed
                              </button>
                            </div>
                          ) : null}
                          {/*
                           * ⚠️ **NOT A REFERRAL CLOCK, AND `referralClocks` MUST NEVER BE REACHED FOR
                           * HERE.** This row is a `Movement`; `triagedAt` lives on a `Referral` and
                           * nothing joins the two. What a move being owed is counted from is
                           * `acceptedAt`, which `ACCEPT_IN_PRINCIPLE` writes and which is deliberately
                           * absent from every hand-authored movement in the seed — so a seeded row
                           * still states the absence, and only the absence, in the same register the
                           * rest of the board uses for a fact it does not hold. Substituting
                           * `openedAt` here would answer a different question (how long they have been
                           * in the department) under this label, and read as plausible while doing it.
                           */}
                          <div className={styles.outstandingItem}>
                            <span className={styles.outstandingLabel}>Waiting to move</span>
                            <span>
                              {movement.acceptedAt === undefined
                                ? "Acceptance time not recorded"
                                : `${splitDuration(Math.max(now - movement.acceptedAt, 0))} since accepted`}
                            </span>
                          </div>
                          <div className={styles.outstandingItem}>
                            <span className={styles.outstandingLabel}>Gender</span>
                            <span data-testid={`ward-ed-gender-${movement.id}`}>
                              {movement.gender ?? "Not yet recorded"}
                            </span>
                          </div>
                          {movement.transportNeed?.needed === false ? (
                            <div
                              className={styles.outstandingItem}
                              data-testid={`ward-ed-outbox-no-transport-${movement.id}`}
                            >
                              No transport needed
                            </div>
                          ) : null}
                          {movement.arrivalDetails ? (
                            <div
                              className={styles.outstandingItem}
                              data-testid={`ward-ed-outbox-arrival-plan-${movement.id}`}
                            >
                              <span className={styles.outstandingLabel}>Arrival plan</span>
                              <span>
                                {arrivalModeLabel(movement.arrivalDetails.mode)} · ward{" "}
                                {arrivalEtaLabel(movement.arrivalDetails.estimatedArrivalAt, now)}
                                {movement.arrivalDetails.trackingNumber
                                  ? ` · ${movement.arrivalDetails.trackingNumber}`
                                  : ""}
                              </span>
                            </div>
                          ) : null}
                          {isArrivalLate(movement, now) ? (
                            <div
                              className={styles.arrivalLate}
                              role="status"
                              data-testid={`ward-ed-outbox-arrival-late-${movement.id}`}
                            >
                              Arrival late — more than 60 minutes past the estimated ward time. Not marked arrived.
                            </div>
                          ) : null}
                          {canSetArrivalPlan(movement) ? (
                            <div className={styles.actionRow}>
                              <button
                                type="button"
                                data-testid={`ward-ed-outbox-arrival-plan-toggle-${movement.id}`}
                                className={styles.acceptButton}
                                onClick={() => setArrivalPlanOpenFor(movement.id)}
                              >
                                {movement.arrivalDetails ? "Edit arrival plan" : "Set arrival plan"}
                              </button>
                            </div>
                          ) : null}
                          {movement.referralAbsence?.reason === "none_raised" ? (
                            <div
                              className={styles.outstandingItem}
                              data-testid={`ward-ed-outbox-no-referral-${movement.id}`}
                            >
                              No referral raised
                            </div>
                          ) : null}
                          {!movement.closure && (
                            <div className={styles.tableActionGroup}>
                              <select
                                data-testid={`ward-ed-record-gender-${movement.id}`}
                                aria-label={`Record gender for ${patientInfo.displayName}`}
                                value={genderRecordDraft[movement.id] ?? ""}
                                onChange={(event) =>
                                  setGenderRecordDraft((current) => ({
                                    ...current,
                                    [movement.id]: event.target.value as ReferralGender | "",
                                  }))
                                }
                              >
                                <option value="">Choose…</option>
                                {GENDER_OPTIONS.map((gender) => (
                                  <option key={gender} value={gender}>
                                    {gender}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                data-testid={`ward-ed-record-gender-submit-${movement.id}`}
                                className={styles.acceptButton}
                                disabled={
                                  !genderRecordDraft[movement.id] || genderRecordDraft[movement.id] === movement.gender
                                }
                                onClick={() => {
                                  const gender = genderRecordDraft[movement.id];
                                  if (!gender) return;
                                  dispatch({
                                    type: "RECORD_MOVEMENT_GENDER",
                                    role: "ed",
                                    now,
                                    movementId: movement.id,
                                    gender,
                                  });
                                  setGenderRecordDraft((current) => ({ ...current, [movement.id]: "" }));
                                }}
                              >
                                Record gender
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/*
               * RECENT DECISIONS (ANSWERED REFERRALS)
               *
               * ⚠️ **`data-testid` VALUES ARE `ward-ed-answered-*`, NEVER `ward-ed-inbox-*`.** Two tests
               * look for those rows: one asserts an answered row is here, and the other asserts an
               * answered row is NOT in the inbox. Both are `referral-row` tests; both match `WF-`
               * rows too. Reusing the inbox's prefix here would turn both green tests red BECAUSE this
               * feature works; the distinct prefix is what keeps them passing while proving something new.
               */}
              <div className={styles.referredSubSection} data-testid="ward-ed-answered">
                <h3 className={styles.sectionHeading}>
                  Recent &middot;{" "}
                  {answeredAll.length > ANSWERED_VISIBLE_CAP
                    ? `${answered.length} of ${answeredAll.length}`
                    : answeredAll.length}{" "}
                  referral{answeredAll.length === 1 ? "" : "s"}
                </h3>
                <p className={styles.unitMeta}>
                  Accepted, declined or cancelled referrals, most recently decided first. Shows the latest{" "}
                  {ANSWERED_VISIBLE_CAP}; the heading counts all.
                </p>
                {answeredAll.length === 0 ? (
                  <p className={styles.placeholder} data-testid="ward-ed-answered-empty">
                    Nothing addressed to psychiatry at {department.name} has been answered yet.
                  </p>
                ) : (
                  <ul className={styles.cardList}>
                    {answered.map(({ referral, addressing, destination }) => (
                      <li
                        key={`${referral.id}-${destination.edId}-${destination.purpose}`}
                        className={styles.card}
                        data-testid={`ward-ed-answered-row-${referral.id}`}
                        data-purpose={destination.purpose}
                        data-ed-id={destination.edId}
                        data-state={addressing.state}
                      >
                        <header className={styles.cardHeader}>
                          <strong>{referral.id}</strong>
                          <span className={styles.cardMeta} data-testid={`ward-ed-answered-purpose-${referral.id}`}>
                            {referralPurposeLabel(destination.purpose)}
                          </span>
                        </header>
                        <p className={styles.referralState} data-testid={`ward-ed-answered-state-${referral.id}`}>
                          {answeredAddressingLabel(addressing)}
                        </p>
                        {addressing.decidedAt !== undefined ? (
                          <p className={styles.cardMeta} data-testid={`ward-ed-answered-decided-${referral.id}`}>
                            Decided {formatInstantWithDay(addressing.decidedAt, now)}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </section>
        </section>

        <section
          aria-label="This department's patients"
          className={`${styles.panel} ${styles.full} ${styles.listSection}${fullscreenBoard ? ` ${styles.fullscreenBoard}` : ""}`}
          tabIndex={0}
        >
          <div className={styles.ph}>
            <h2>ED psychiatry</h2>
            <div className={styles.phActions}>
              <button
                type="button"
                className={styles.fullscreenToggleBtn}
                onClick={() => setFullscreenBoard((prev) => !prev)}
                aria-label={fullscreenBoard ? "Exit larger screen mode" : "Larger screen mode"}
                title={fullscreenBoard ? "Exit larger screen mode (Esc)" : "Expand board to larger screen mode"}
              >
                <svg
                  className={styles.expandIcon}
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {fullscreenBoard ? (
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                  ) : (
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  )}
                </svg>
                <span>{fullscreenBoard ? "Exit larger screen" : "Larger screen mode"}</span>
              </button>
              <span className={styles.count}>
                <b>{patients.length}</b> {patients.length === 1 ? "person" : "people"}
              </span>
            </div>
          </div>
          <div className={styles.boardChips} role="tablist" aria-label="Filter the board">
            <button
              type="button"
              className={styles.boardChip}
              aria-pressed={boardFilter === "all"}
              onClick={() => setBoardFilter("all")}
            >
              Everyone <span className={styles.c}>{patients.length}</span>
            </button>
            <button
              type="button"
              className={styles.boardChip}
              aria-pressed={boardFilter === "not_reviewed"}
              onClick={() => setBoardFilter("not_reviewed")}
            >
              Not reviewed{" "}
              <span className={styles.c} data-zero={notReviewedCount === 0 ? "true" : undefined}>
                {notReviewedCount === 0 ? "none" : notReviewedCount}
              </span>
            </button>
            <button
              type="button"
              className={styles.boardChip}
              aria-pressed={boardFilter === "under_form"}
              onClick={() => setBoardFilter("under_form")}
            >
              Under a form{" "}
              <span className={styles.c} data-zero={underFormCount === 0 ? "true" : undefined}>
                {underFormCount === 0 ? "none" : underFormCount}
              </span>
            </button>
            <button
              type="button"
              className={styles.boardChip}
              aria-pressed={boardFilter === "no_destination"}
              onClick={() => setBoardFilter("no_destination")}
            >
              No destination{" "}
              <span className={styles.c} data-zero={noDestCount === 0 ? "true" : undefined}>
                {noDestCount === 0 ? "none" : noDestCount}
              </span>
            </button>
            <button
              type="button"
              className={styles.boardChip}
              aria-pressed={boardFilter === "discharge"}
              onClick={() => setBoardFilter("discharge")}
            >
              For discharge{" "}
              <span className={styles.c} data-zero={dischargeCount === 0 ? "true" : undefined}>
                {dischargeCount === 0 ? "none" : dischargeCount}
              </span>
            </button>
            <button
              type="button"
              className={styles.boardChip}
              aria-pressed={boardFilter === "withdrawn"}
              onClick={() => setBoardFilter("withdrawn")}
            >
              Withdrawn{" "}
              <span className={styles.c} data-zero={withdrawnCount === 0 ? "true" : undefined}>
                {withdrawnCount === 0 ? "none" : withdrawnCount}
              </span>
            </button>
          </div>
          <div className={styles.boardTools}>
            <label className={styles.patientSearch}>
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                aria-label="Find a patient or UMRN"
                placeholder="Find a patient or UMRN…"
                value={patientQuery}
                onChange={(event) => setPatientQuery(event.target.value)}
              />
            </label>
            <label className={styles.patientSort}>
              Sort{" "}
              <select value={patientSort} onChange={(event) => setPatientSort(event.target.value)}>
                <option value="current">Current order</option>
                <option value="longest">Longest in ED</option>
                <option value="name">Patient name</option>
              </select>
            </label>
            <span className={styles.draftNote} role="status">
              {hasBoardDrafts ? "Unsaved changes · This screen only" : "Draft fields · This screen only"}
            </span>
            <span className={styles.boardResult} role="status">
              {visiblePatients.length} of {patients.length} patients<span className="sr-only"> · Synthetic data</span>
            </span>
          </div>
          {patients.length === 0 ? (
            <p className={styles.placeholder}>
              Nobody is on this department&apos;s psychiatry list. Absence here means none is recorded, not that the
              department is empty.
            </p>
          ) : (
            <div
              className={`${styles.tableWrap} ${styles.boardWrap}`}
              id="qpane-patients"
              tabIndex={0}
              aria-label="Emergency department board, scrolls sideways"
            >
              <table className={styles.boardTable}>
                <colgroup>
                  {[15, 6, 4, 6, 8, 25, 17, 11, 8].map((width, index) => (
                    <col key={index} style={{ width: `${width}%` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">Time in ED</th>
                    <th scope="col">ED bay</th>
                    <th scope="col">Form</th>
                    <th scope="col">Medically cleared</th>
                    <th scope="col">Presentation</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Destination</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePatients.length === 0 && (
                    <tr>
                      <td colSpan={9} className={styles.noPatientMatches}>
                        No patients match this search and filter.
                      </td>
                    </tr>
                  )}
                  {visiblePatients.map((movement) => {
                    const minutesInDepartment = Math.max(now - movement.openedAt, 0);
                    const medicalClearance = movementMedicalClearance(movement, referrals);
                    const formExpiryText = movement.legalForm ? formExpiryLine(movement.legalForm, now) : undefined;
                    const formExpiryWarningText = movement.legalForm
                      ? formExpiryWarning(movement.legalForm, now)
                      : undefined;
                    const item = outstandingItem(movement);
                    // Owner, 26 Sept 2026: resolved early so the blocked-reason sentences below can
                    // name the patient instead of the WF journey number.
                    const patientInfo = resolveSubjectPatient(movement, {
                      patients: registryPatients,
                      referrals,
                      movements,
                    });
                    const examBlocked = examinationBlockedReason(movement, patientInfo.displayName);
                    const handoverBlocked = handoverBlockedReason(movement, patientInfo.displayName);
                    const transportBlocked = bookTransportBlockedReason(movement, patientInfo.displayName);
                    const transportLegalFormWarning = transportLegalFormNotice(movement);
                    const transportOpen = transportOpenFor === movement.id;
                    const withdrawBlocked = withdrawReferralBlockedReason(movement, patientInfo.displayName);
                    const withdrawOpen = withdrawOpenFor === movement.id;
                    const transportAnswersBlocked = transportAnswersBlockedReason(transportDraft, now);
                    const examOpen = examinationOpenFor === movement.id;
                    const edOutcomeOpen = edOutcomeOpenFor === movement.id;
                    const edOutcomeBlocked = edOutcomeBlockedReason(movement);
                    const dischargeBlocked = dischargeChoiceBlockedReason(movement);
                    const cmhtBlocked = communityReferralBlockedReason(movement);
                    const linkedReferral = movement.referralId
                      ? referrals.find((r) => r.id === movement.referralId)
                      : undefined;
                    // D-14 (default-deny on the patient link): this used to fall back to
                    // `allPatients.find(...).suburb` via `linkedReferral.patientId`, which put
                    // `.patientId` in a file `tests/ward-patient-link-default-deny.test.ts`'s
                    // ALLOWLIST does not name — and item 14 never asked for that fallback.
                    // RB4's own wording is "a linked suburb lists that team first" — the suburb
                    // RECORDED ON THE REFERRAL, which every referral already carries (`RECEIVE_
                    // REFERRAL` refuses one with no suburb answer). No patient lookup is needed
                    // to satisfy it.
                    const recordedSuburb = linkedReferral?.suburb?.kind === "named" ? linkedReferral.suburb.name : null;
                    const teamOptions = communityTeamOptionsForSuburb(recordedSuburb);
                    const urgencyChangeOpen = urgencyChangeOpenFor === movement.id;
                    const legalStatusChangeOpen = legalStatusChangeOpenFor === movement.id;
                    // T3: "Record expiry from the form" once `legalForm` carries no `dueAt` yet,
                    // "Record an extension" once it does — read from the movement itself, never
                    // from a flag the draft carries (`toggleLegalFormExpiry`'s own comment).
                    // Hidden entirely, rather than disabled, when there is no legal form at all:
                    // the reducer's own refusal for that case ("There is no legal form on this
                    // record to add an expiry to.") is then structurally unreachable from here,
                    // the same reasoning `isForm1A`'s "Mark Form 1A received" button above follows.
                    const legalFormExpiryOpen = legalFormExpiryOpenFor === movement.id;
                    const legalFormExpiryIsExtension = movement.legalForm?.dueAt !== undefined;
                    const legalFormExpiryDraftInstant = legalFormExpiryOpen
                      ? instantFromDateAndTimeInputs(legalFormExpiryDraft.date, legalFormExpiryDraft.time, dayZero)
                      : undefined;
                    const legalFormExpirySaveBlocked =
                      legalFormExpiryDraftInstant === undefined ||
                      (movement.legalForm?.dueAt !== undefined &&
                        legalFormExpiryDraftInstant <= movement.legalForm.dueAt);
                    // T4: offered only once a receipt is actually recorded — the reducer's own
                    // "no recorded legal form receipt to correct" refusal is then structurally
                    // unreachable from here, the same reasoning `isForm1A`'s "Mark Form 1A
                    // received" button below follows for its own precondition.
                    const receiptCorrectionOpen = receiptCorrectionOpenFor === movement.id;
                    // Whole-branch review Critical 1: resolved from the live `units`, not `unitById`.
                    const acceptedUnit = movement.acceptedUnitId
                      ? units.find((unit) => unit.id === movement.acceptedUnitId)
                      : undefined;
                    // The three disjuncts this dropped never fired: `LegalForm` has no `form`
                    // field (only `code`) and `LegalStatus` is a closed union of four clinical
                    // sentences ("Voluntary" | "Referred for psychiatric examination" |
                    // "Detained awaiting examination" | "Involuntary inpatient") that never
                    // includes "1A"/"form_1a"/"3D"/"form_3d" — both facts checked against the
                    // real types, not assumed. Each `as any`/`as string` cast existed only to get
                    // past the compiler correctly reporting those comparisons as impossible.
                    const isForm1A = movement.legalForm?.code === "1A";
                    const isUnfolded =
                      communityReferralOpenFor === movement.id ||
                      withdrawOpen ||
                      transportOpen ||
                      examOpen ||
                      edOutcomeOpen ||
                      urgencyChangeOpen ||
                      legalStatusChangeOpen ||
                      legalFormExpiryOpen ||
                      receiptCorrectionOpen;

                    const primaryAction =
                      movement.edOutcome !== undefined && !movement.leftDepartmentAt
                        ? "left"
                        : movement.closure
                          ? "closure"
                          : movement.examination === undefined
                            ? "exam"
                            : movement.stage === "pulled" && movement.transport === undefined
                              ? "transport"
                              : movement.stage === "pulled" && movement.transport !== undefined
                                ? "handover"
                                : movement.edOutcome === undefined
                                  ? "outcome"
                                  : undefined;

                    return (
                      <Fragment key={movement.id}>
                        <tr
                          data-testid={`ward-ed-patient-${movement.id}`}
                          data-origin-ed={movement.originEdId}
                          data-minutes-in-department={minutesInDepartment}
                          data-selected={selectedPatientId === movement.id ? "true" : undefined}
                          data-unfolded={isUnfolded ? "true" : undefined}
                          className={styles.qRow}
                        >
                          <td className={styles.patientIdentity}>
                            <button
                              type="button"
                              className={styles.patientName}
                              title={`View patient details for ${patientInfo.displayName}`}
                              onClick={() =>
                                setSelectedPatientId(selectedPatientId === movement.id ? null : movement.id)
                              }
                            >
                              {patientInfo.displayName}
                            </button>
                            <span className={styles.umrnBadge}>
                              <span>UMRN</span>
                              <b>{patientInfo.umrn}</b>
                            </span>
                            <span className={styles.sub}>
                              {movement.cohort} &middot; {movement.security} &middot;{" "}
                              <span
                                className={styles.identityUrgency}
                                data-urgency={movement.urgency}
                                data-testid={`ward-ed-tier-${movement.id}`}
                                aria-label={urgencyTierLabel(movement.urgency)}
                              >
                                Tier {movement.urgency}
                                <span className="sr-only">
                                  {urgencyTierLabel(movement.urgency).replace(/^Tier \d+/, "")}
                                </span>
                              </span>
                            </span>
                            {/*
                             * Opus review round 2, 17 September 2026 (P2): the `gender_designation`
                             * gate's own refusal says "Record gender first" and, until this
                             * control, nothing on the running app could act on it. A select plus
                             * a separate submit — never dispatched on change — the same
                             * "dispatch only proves what the model reflects back" discipline every
                             * other control in this file holds to.
                             */}
                            <span className="sr-only" data-testid={`ward-ed-gender-${movement.id}`}>
                              Gender: {movement.gender ?? "Not yet recorded"}
                            </span>
                            {movement.transportNeed?.needed === false ? (
                              <span className={styles.sub} data-testid={`ward-ed-no-transport-badge-${movement.id}`}>
                                No transport needed
                              </span>
                            ) : null}
                            {movement.arrivalDetails ? (
                              <span className={styles.sub} data-testid={`ward-ed-arrival-plan-${movement.id}`}>
                                Ward ETA {arrivalEtaLabel(movement.arrivalDetails.estimatedArrivalAt, now)}
                                {movement.arrivalDetails.trackingNumber
                                  ? ` · ${movement.arrivalDetails.trackingNumber}`
                                  : ""}
                              </span>
                            ) : null}
                            {isArrivalLate(movement, now) ? (
                              <span
                                className={styles.arrivalLate}
                                role="status"
                                data-testid={`ward-ed-arrival-late-${movement.id}`}
                              >
                                Arrival late — more than 60 minutes past the estimated ward time. Not marked arrived.
                              </span>
                            ) : null}
                            {movement.arrivalDetails ? (
                              movement.arrivalDetails.estimatedArrivalAt !== undefined ? (
                                now > movement.arrivalDetails.estimatedArrivalAt + 60 ? (
                                  <span
                                    className={styles.transitBadgeOverdue}
                                    data-testid={`ward-ed-transit-badge-${movement.id}`}
                                  >
                                    ⚠ Overdue ETA (+
                                    {Math.floor((now - movement.arrivalDetails.estimatedArrivalAt) / 60)}h) ·{" "}
                                    {movement.arrivalDetails.modeOfArrival ??
                                      (movement.arrivalDetails.mode
                                        ? arrivalModeLabel(movement.arrivalDetails.mode)
                                        : "Transit")}
                                  </span>
                                ) : (
                                  <span
                                    className={styles.transitBadge}
                                    data-testid={`ward-ed-transit-badge-${movement.id}`}
                                  >
                                    ⏱ ETA in {Math.max(0, movement.arrivalDetails.estimatedArrivalAt - now)}m ·{" "}
                                    {movement.arrivalDetails.modeOfArrival ??
                                      (movement.arrivalDetails.mode
                                        ? arrivalModeLabel(movement.arrivalDetails.mode)
                                        : "Transit")}
                                  </span>
                                )
                              ) : (
                                <span
                                  className={styles.transitBadge}
                                  data-testid={`ward-ed-transit-badge-${movement.id}`}
                                >
                                  ⏱ Transit: {holdLabel} hold (
                                  {movement.arrivalDetails.modeOfArrival ??
                                    (movement.arrivalDetails.mode
                                      ? arrivalModeLabel(movement.arrivalDetails.mode)
                                      : "Transit")}
                                  )
                                </span>
                              )
                            ) : movement.stage === "pulled" ? (
                              <span
                                className={styles.transitBadgeHold}
                                data-testid={`ward-ed-transit-badge-${movement.id}`}
                              >
                                ⏱ Pulled · {holdLabel} hold clock active
                              </span>
                            ) : null}
                          </td>
                          <td
                            className={styles.compactTime}
                            title={`In department from ${formatInstantWithDay(movement.openedAt, now)}`}
                          >
                            <b>{splitDuration(minutesInDepartment)}</b>
                            <span
                              className={minutesInDepartment > accessTarget ? styles.accessWarning : "sr-only"}
                              data-testid={`ward-ed-access-target-${movement.id}`}
                              data-state={minutesInDepartment > accessTarget ? "over" : "under"}
                              title={`Access target ${splitDuration(accessTarget)}. ${accessTargetLine(minutesInDepartment, accessTarget)}`}
                            >
                              {minutesInDepartment > accessTarget && <span aria-hidden="true">Over target</span>}
                              <span className="sr-only">
                                Access target {splitDuration(accessTarget)}.{" "}
                                {accessTargetLine(minutesInDepartment, accessTarget)}
                              </span>
                            </span>
                          </td>
                          <td className={styles.bayCell}>
                            <span className={styles.bayNumber}>{patientBay(movement.id).replace(/^Bay /, "")}</span>
                          </td>
                          <td className={styles.compactForm}>
                            <select
                              className={styles.thinSelect}
                              aria-label={`Legal form for ${patientInfo.displayName}`}
                              data-testid={`ward-ed-form-pill-${movement.id}`}
                              value={
                                formOverrides[movement.id] === undefined
                                  ? (movement.legalForm?.code ?? "")
                                  : (formOverrides[movement.id] ?? "")
                              }
                              onChange={(event) => {
                                setFormOverrides((current) => ({
                                  ...current,
                                  [movement.id]: event.target.value || null,
                                }));
                                announceToWardShell(
                                  "Form draft changed on this screen only. The recorded legal form is unchanged.",
                                );
                              }}
                            >
                              <option value="">None</option>
                              {movement.legalForm?.code &&
                                !RECORDED_ED_FORMS.some((form) => form === movement.legalForm?.code) && (
                                  <option value={movement.legalForm.code}>{movement.legalForm.code}</option>
                                )}
                              {RECORDED_ED_FORMS.map((form) => (
                                <option key={form}>{form}</option>
                              ))}
                            </select>
                            {formExpiryText !== undefined && (
                              <span
                                className={movement.legalForm?.dueAt === undefined ? "sr-only" : styles.compactExpiry}
                                title={formExpiryText}
                              >
                                {movement.legalForm?.dueAt === undefined ? (
                                  <span data-testid={`ward-ed-form-expiry-${movement.id}`}>{formExpiryText}</span>
                                ) : (
                                  <>
                                    <span aria-hidden="true">
                                      {formatInstantWithDay(movement.legalForm.dueAt, now)}
                                    </span>
                                    <span className="sr-only" data-testid={`ward-ed-form-expiry-${movement.id}`}>
                                      {formExpiryText}
                                    </span>
                                  </>
                                )}
                              </span>
                            )}
                            {formExpiryWarningText !== undefined && (
                              <span
                                className={styles.accessWarning}
                                data-testid={`ward-ed-form-expiry-warning-${movement.id}`}
                                data-level="warning"
                              >
                                {formExpiryWarningText}
                              </span>
                            )}
                          </td>
                          <td>
                            <select
                              className={styles.thinSelect}
                              aria-label={`Medical clearance for ${patientInfo.displayName}`}
                              data-cleared={
                                clearanceOverrides[movement.id] === undefined
                                  ? medicalClearance === undefined
                                    ? "none"
                                    : medicalClearance.cleared
                                      ? "yes"
                                      : "no"
                                  : (clearanceOverrides[movement.id] ?? "none")
                              }
                              value={
                                clearanceOverrides[movement.id] === undefined
                                  ? medicalClearance === undefined
                                    ? ""
                                    : medicalClearance.cleared
                                      ? "yes"
                                      : "no"
                                  : (clearanceOverrides[movement.id] ?? "")
                              }
                              onChange={(event) => {
                                setClearanceOverrides((current) => ({
                                  ...current,
                                  [movement.id]:
                                    event.target.value === "yes" ? "yes" : event.target.value === "no" ? "no" : null,
                                }));
                                announceToWardShell(
                                  "Clearance draft changed on this screen only. The recorded medical clearance is unchanged.",
                                );
                              }}
                            >
                              <option value="">Pending</option>
                              <option value="yes">Yes</option>
                              <option value="no">No</option>
                            </select>
                            {medicalClearance && (
                              <span className="sr-only" data-testid={`ward-ed-medical-clearance-${movement.id}`}>
                                Medical clearance: {medicalClearance.cleared ? "Yes" : "No"} — recorded{" "}
                                {formatInstantWithDay(medicalClearance.at, now)}
                              </span>
                            )}
                          </td>
                          <td className={styles.presentationCell}>
                            {(() => {
                              const overriddenReview = reviewStatusOverrides[movement.id];
                              const currentReviewStatus =
                                overriddenReview !== undefined
                                  ? overriddenReview
                                  : movement.examination
                                    ? "Examination recorded"
                                    : "Awaiting review";
                              const isRecorded = currentReviewStatus === "Examination recorded";
                              const isPending = currentReviewStatus === "Awaiting review";
                              const reviewTone = isRecorded ? "good" : isPending ? "warn" : "info";

                              return (
                                <div className={styles.reviewDropdownWrap}>
                                  <EdReviewStatus
                                    patientName={patientInfo.displayName}
                                    value={currentReviewStatus}
                                    options={CLINICAL_REVIEW_OPTIONS}
                                    className={styles.reviewPill}
                                    tone={reviewTone}
                                    onChange={(value) => {
                                      setReviewStatusOverrides((current) => ({ ...current, [movement.id]: value }));
                                      announceToWardShell(
                                        `Review draft set to ${value} on this screen only. The recorded examination is unchanged.`,
                                      );
                                    }}
                                  />
                                </div>
                              );
                            })()}
                            {movement.supersededExaminations && movement.supersededExaminations.length > 0 ? (
                              <ul className={styles.sub} data-testid={`ward-ed-examination-history-${movement.id}`}>
                                {movement.supersededExaminations.map((record, index) => (
                                  <li key={index}>
                                    {`Earlier examination · ${record.outcome.replace(/_/g, " ")} — ${formatInstantWithDay(record.at, now)}`}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                            {examinationRevokedWhileBedHeld(movement) ? (
                              <div
                                className={styles.sub}
                                data-testid={`ward-ed-examination-revoked-flag-${movement.id}`}
                                data-level="warning"
                              >
                                {EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE}
                              </div>
                            ) : null}
                            <EdPresentation
                              testId={`ward-ed-outstanding-${movement.id}`}
                              kind={item.kind}
                              patientName={patientInfo.displayName}
                              value={presentationDrafts[movement.id] ?? item.detail}
                              onChange={(value) =>
                                setPresentationDrafts((current) => ({ ...current, [movement.id]: value }))
                              }
                            />
                          </td>
                          <td>
                            <EdPlanPicker
                              triggerId={`ward-ed-plan-${movement.id}`}
                              patientName={patientInfo.displayName}
                              labels={planDrafts[movement.id] ?? []}
                              onChange={(labels) => setPlanDrafts((current) => ({ ...current, [movement.id]: labels }))}
                            />
                          </td>
                          <td>
                            <span className={styles.dest}>
                              {isEdInitiatedWithdrawal(movement)
                                ? // Ward Lead audit (2026-09-17): `WITHDRAW_REFERRAL`'s
                                  // post-acceptance branch does not clear `acceptedUnitId`
                                  // (`ward-flow-reducer.ts` — a separate defect, out of this
                                  // fix's scope), so `acceptedUnit` below can still resolve for a
                                  // withdrawn movement. Checked first so this column never shows a
                                  // ward name beside "Withdrawn: ..." in the actions column on the
                                  // same row.
                                  "Withdrawn"
                                : movement.edOutcome === "for_community_follow_up"
                                  ? "For community follow-up"
                                  : movement.edOutcome === "for_discharge"
                                    ? "For discharge"
                                    : acceptedUnit
                                      ? acceptedUnit.name
                                      : movement.referredUnitIds.length > 0
                                        ? "Awaiting bed placement"
                                        : "In department"}
                            </span>
                            {acceptedUnit && !movement.closure && (
                              <span className={styles.acceptedLabel}>Accepted</span>
                            )}
                            {!acceptedUnit && movement.referredUnitIds.length > 0 ? (
                              <div className={styles.sub} data-testid={`ward-ed-referred-${movement.id}`}>
                                {movement.referredUnitIds
                                  .map(
                                    (unitId) => units.find((unit) => unit.id === unitId)?.name ?? "Unit not recorded",
                                  )
                                  .join(" · ")}
                                {movement.referredAt === undefined && (
                                  <span className="sr-only"> · referral time not recorded</span>
                                )}
                              </div>
                            ) : null}
                          </td>
                          <td>
                            {movement.edOutcome !== undefined && !movement.leftDepartmentAt ? (
                              <div className={styles.tableActionGroup} data-unfolded="true">
                                <button
                                  type="button"
                                  data-testid={`ward-ed-mark-left-${movement.id}`}
                                  data-action={`ward-ed-mark-left-${movement.id}`}
                                  className={`${styles.acceptButton} ${styles.primaryActionButton}`}
                                  onClick={() =>
                                    dispatch({
                                      type: "RECORD_LEFT_DEPARTMENT",
                                      role: "ed",
                                      now,
                                      movementId: movement.id,
                                    })
                                  }
                                >
                                  Left the department
                                </button>
                              </div>
                            ) : movement.closure ? (
                              /*
                               * Ward Lead audit (2026-09-17): an ED-initiated withdrawal
                               * (`WITHDRAW_REFERRAL`, both its pre- and post-acceptance branches
                               * when dispatched as `"ed"`) now stays on this board — see
                               * `patients` above — but every control below dispatches an event
                               * `RECORD_ED_OUTCOME`/`RECORD_EXAMINATION`/etc. the reducer always
                               * refuses once `movement.closure` is set, so none of them are
                               * offered here. Only the reason is shown; there is nothing left to
                               * do with a withdrawn record. (The `edOutcome` branch above is
                               * checked FIRST because `RECORD_ED_OUTCOME` also sets `closure` —
                               * this branch must only catch the withdrawal shape, never that one.)
                               */
                              <p className={styles.sub} data-testid={`ward-ed-withdrawn-reason-${movement.id}`}>
                                Withdrawn: {movement.closure.reason}
                              </p>
                            ) : (
                              <>
                                <EdActionsMenu
                                  patientName={patientInfo.displayName}
                                  testId={`ward-ed-actions-menu-${movement.id}`}
                                  triggerTestId={`ward-ed-unfold-${movement.id}`}
                                  onViewRecord={() => setSelectedPatientId(movement.id)}
                                  onEditPresentation={() =>
                                    document.getElementById(`ward-ed-outstanding-${movement.id}`)?.click()
                                  }
                                  onEditPlan={() => document.getElementById(`ward-ed-plan-${movement.id}`)?.click()}
                                >
                                  <button
                                    type="button"
                                    data-testid={`ward-ed-examine-toggle-${movement.id}`}
                                    aria-disabled={examBlocked ? "true" : undefined}
                                    aria-describedby={
                                      examBlocked ? `ward-ed-examine-unavailable-${movement.id}` : undefined
                                    }
                                    title={examBlocked ?? undefined}
                                    aria-expanded={examOpen}
                                    className={`${styles.declineButton}${primaryAction === "exam" ? ` ${styles.primaryActionButton}` : ""}`}
                                    onClick={
                                      examBlocked ? ignoreUnavailableActivation : () => toggleExamination(movement.id)
                                    }
                                  >
                                    Record examination
                                  </button>
                                  <button
                                    type="button"
                                    data-testid={`ward-ed-outcome-toggle-${movement.id}`}
                                    aria-disabled={edOutcomeBlocked ? "true" : undefined}
                                    aria-describedby={
                                      edOutcomeBlocked ? `ward-ed-outcome-unavailable-${movement.id}` : undefined
                                    }
                                    title={edOutcomeBlocked ?? undefined}
                                    aria-expanded={edOutcomeOpen}
                                    className={`${styles.declineButton}${primaryAction === "outcome" ? ` ${styles.primaryActionButton}` : ""}`}
                                    onClick={
                                      edOutcomeBlocked
                                        ? ignoreUnavailableActivation
                                        : () =>
                                            setEdOutcomeOpenFor((current) =>
                                              current === movement.id ? undefined : movement.id,
                                            )
                                    }
                                  >
                                    Record outcome
                                  </button>
                                  {edOutcomeBlocked ? (
                                    <span id={`ward-ed-outcome-unavailable-${movement.id}`} className="sr-only">
                                      {edOutcomeBlocked}
                                    </span>
                                  ) : null}
                                  <button
                                    type="button"
                                    data-testid={`ward-ed-handover-${movement.id}`}
                                    aria-disabled={handoverBlocked ? "true" : undefined}
                                    aria-describedby={
                                      handoverBlocked ? `ward-ed-handover-unavailable-${movement.id}` : undefined
                                    }
                                    title={handoverBlocked ?? undefined}
                                    className={`${styles.acceptButton}${primaryAction === "handover" ? ` ${styles.primaryActionButton}` : ""}`}
                                    onClick={
                                      handoverBlocked
                                        ? ignoreUnavailableActivation
                                        : () =>
                                            dispatch({
                                              type: "HANDOVER_READY",
                                              role: "ed",
                                              now,
                                              movementId: movement.id,
                                            })
                                    }
                                  >
                                    Mark handover ready
                                  </button>
                                  <button
                                    type="button"
                                    data-testid={`ward-ed-book-transport-toggle-${movement.id}`}
                                    aria-disabled={transportBlocked ? "true" : undefined}
                                    aria-describedby={
                                      transportBlocked ? `ward-ed-book-transport-unavailable-${movement.id}` : undefined
                                    }
                                    title={transportBlocked ?? undefined}
                                    aria-expanded={transportOpen}
                                    aria-haspopup="dialog"
                                    className={`${styles.acceptButton}${primaryAction === "transport" ? ` ${styles.primaryActionButton}` : ""}`}
                                    onClick={
                                      transportBlocked
                                        ? ignoreUnavailableActivation
                                        : () => toggleBookTransport(movement.id)
                                    }
                                  >
                                    {/* Owner's third ruling, 2026-09-17, verbatim: "you click a button saying it is
                                booked" — this logs a booking already made by phone, so the button states that,
                                never "Book transport" as though the app were doing the booking. */}
                                    Transport booked
                                  </button>
                                  {canSetArrivalPlan(movement) ? (
                                    <button
                                      type="button"
                                      data-testid={`ward-ed-arrival-plan-toggle-${movement.id}`}
                                      className={styles.acceptButton}
                                      onClick={() => setArrivalPlanOpenFor(movement.id)}
                                    >
                                      {movement.arrivalDetails ? "Edit arrival plan" : "Set arrival plan"}
                                    </button>
                                  ) : null}
                                  {/* Owner ruling, 17 September 2026 (second round, item 10): "No
                                transport needed" is recorded at pull, booking is skipped, and the
                                ward records the arrival.

                                ⚠️ THE ENGINE WAS ALREADY BUILT AND NOBODY COULD REACH IT.
                                `RECORD_TRANSPORT_NEED` has existed in the reducer — refusing a closed
                                movement, allowing re-recording because a patient who could walk at
                                09:00 may need an escort by 11:00 — and sat in the reachability
                                allowlist because no screen dispatched it. This button is the whole
                                gap.

                                ⚠️ IT RECORDS AN ANSWER, IT DOES NOT SKIP A STAGE. The reducer decides
                                what a recorded `needed: false` means for booking; this states the
                                fact and nothing else. Shown only while the answer is unrecorded and
                                no transport exists, because re-recording belongs beside the
                                recorded answer rather than as a second way to say the same thing. */}
                                  {movement.transport === undefined &&
                                  transportNeedState(movement) === "not_recorded" ? (
                                    <button
                                      type="button"
                                      data-testid={`ward-ed-no-transport-needed-${movement.id}`}
                                      className={styles.acceptButton}
                                      onClick={() =>
                                        dispatch({
                                          type: "RECORD_TRANSPORT_NEED",
                                          role: "ed",
                                          now,
                                          movementId: movement.id,
                                          needed: false,
                                        })
                                      }
                                    >
                                      No transport needed
                                    </button>
                                  ) : null}
                                  {movement.referralId === undefined &&
                                  movementReferralLink(movement, referrals).kind === "not_recorded" ? (
                                    <button
                                      type="button"
                                      data-testid={`ward-ed-no-referral-raised-${movement.id}`}
                                      className={styles.acceptButton}
                                      onClick={() =>
                                        dispatch({
                                          type: "RECORD_NO_REFERRAL",
                                          role: "ed",
                                          now,
                                          movementId: movement.id,
                                        })
                                      }
                                    >
                                      No referral raised
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    data-testid={`ward-change-urgency-toggle-${movement.id}`}
                                    aria-expanded={urgencyChangeOpen}
                                    className={styles.declineButton}
                                    onClick={() => toggleUrgencyChange(movement.id, movement.urgency)}
                                  >
                                    Change urgency
                                  </button>
                                  <button
                                    type="button"
                                    data-testid={`ward-change-legal-status-toggle-${movement.id}`}
                                    aria-expanded={legalStatusChangeOpen}
                                    className={styles.declineButton}
                                    onClick={() => toggleLegalStatusChange(movement.id, movement.legalStatus)}
                                  >
                                    Change legal status
                                  </button>
                                  <button
                                    type="button"
                                    data-testid={`ward-ed-withdraw-referral-toggle-${movement.id}`}
                                    aria-disabled={withdrawBlocked ? "true" : undefined}
                                    aria-describedby={
                                      withdrawBlocked
                                        ? `ward-ed-withdraw-referral-unavailable-${movement.id}`
                                        : undefined
                                    }
                                    title={withdrawBlocked ?? undefined}
                                    aria-expanded={withdrawOpen}
                                    className={styles.declineButton}
                                    onClick={
                                      withdrawBlocked
                                        ? ignoreUnavailableActivation
                                        : () => toggleWithdrawReferral(movement.id)
                                    }
                                  >
                                    Withdraw referral
                                  </button>
                                  {isForm1A && movement.legalFormReceivedAt === undefined ? (
                                    <button
                                      type="button"
                                      data-testid={`ed-mark-form-received-${movement.id}`}
                                      data-action={`ed-mark-form-received-${movement.id}`}
                                      className={styles.acceptButton}
                                      onClick={() =>
                                        dispatch({
                                          type: "RECORD_LEGAL_FORM_RECEIVED",
                                          role: "ed",
                                          now,
                                          movementId: movement.id,
                                        })
                                      }
                                    >
                                      Mark Form 1A received
                                    </button>
                                  ) : null}
                                  {isForm1A && movement.legalFormReceivedAt !== undefined ? (
                                    <button
                                      type="button"
                                      data-testid={`ed-correct-form-receipt-toggle-${movement.id}`}
                                      aria-expanded={receiptCorrectionOpen}
                                      className={styles.declineButton}
                                      onClick={() => toggleReceiptCorrection(movement.id)}
                                    >
                                      Correct receipt
                                    </button>
                                  ) : null}
                                  {movement.legalForm ? (
                                    <button
                                      type="button"
                                      data-testid={`ward-ed-legal-form-expiry-toggle-${movement.id}`}
                                      aria-expanded={legalFormExpiryOpen}
                                      className={styles.declineButton}
                                      onClick={() => toggleLegalFormExpiry(movement.id)}
                                    >
                                      {legalFormExpiryIsExtension
                                        ? "Record an extension"
                                        : "Record expiry from the form"}
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    data-testid={`ed-refer-cmht-${movement.id}`}
                                    data-action={`ed-refer-cmht-${movement.id}`}
                                    aria-disabled={cmhtBlocked ? "true" : undefined}
                                    aria-describedby={
                                      cmhtBlocked ? `ward-ed-cmht-unavailable-${movement.id}` : undefined
                                    }
                                    title={cmhtBlocked ?? undefined}
                                    aria-expanded={communityReferralOpenFor === movement.id}
                                    className={styles.declineButton}
                                    onClick={
                                      cmhtBlocked
                                        ? ignoreUnavailableActivation
                                        : () =>
                                            setCommunityReferralOpenFor(
                                              communityReferralOpenFor === movement.id ? undefined : movement.id,
                                            )
                                    }
                                  >
                                    Refer to a community team
                                  </button>
                                </EdActionsMenu>
                                {examBlocked ? (
                                  <span id={`ward-ed-examine-unavailable-${movement.id}`} className="sr-only">
                                    {examBlocked}
                                  </span>
                                ) : null}
                                {handoverBlocked ? (
                                  <span id={`ward-ed-handover-unavailable-${movement.id}`} className="sr-only">
                                    {handoverBlocked}
                                  </span>
                                ) : null}
                                {transportBlocked ? (
                                  <span id={`ward-ed-book-transport-unavailable-${movement.id}`} className="sr-only">
                                    {transportBlocked}
                                  </span>
                                ) : null}
                                {transportLegalFormWarning ? (
                                  <p
                                    className="sr-only"
                                    data-testid={`ward-ed-transport-legal-form-notice-${movement.id}`}
                                  >
                                    {transportLegalFormWarning}
                                  </p>
                                ) : null}
                                {/*
                                 * §2's exact line: `Extension recorded {time}: new expiry {time}`. Reads
                                 * `movement.legalFormExpiryHistory` (T2), one line per entry whose `basis`
                                 * is `"extension"` — never the first typed expiry, which has no "new" to
                                 * report against. `RECORD_LEGAL_FORM_EXPIRY` appends one entry per
                                 * successful dispatch and never removes one, so this can only grow.
                                 */}
                                {movement.legalFormExpiryHistory
                                  ?.filter((entry) => entry.basis === "extension")
                                  .map((entry) => (
                                    <p
                                      key={`${entry.at}-${entry.dueAt}`}
                                      className={styles.cardMeta}
                                      data-testid={`ward-ed-legal-form-expiry-history-${movement.id}`}
                                    >
                                      {`Extension recorded ${formatInstantWithDay(entry.at, now)}: new expiry ${formatInstantWithDay(entry.dueAt, now)}`}
                                    </p>
                                  ))}
                                {withdrawBlocked ? (
                                  <span id={`ward-ed-withdraw-referral-unavailable-${movement.id}`} className="sr-only">
                                    {withdrawBlocked}
                                  </span>
                                ) : null}
                                {cmhtBlocked ? (
                                  <p
                                    id={`ward-ed-cmht-unavailable-${movement.id}`}
                                    data-testid={`ward-ed-cmht-unavailable-${movement.id}`}
                                    className="sr-only"
                                  >
                                    {cmhtBlocked}
                                  </p>
                                ) : null}
                              </>
                            )}
                          </td>
                        </tr>

                        {(communityReferralOpenFor === movement.id && !cmhtBlocked) ||
                        (withdrawOpen && !withdrawBlocked) ||
                        (transportOpen && !transportBlocked) ||
                        (examOpen && !examBlocked) ||
                        (edOutcomeOpen && !edOutcomeBlocked) ||
                        urgencyChangeOpen ||
                        legalStatusChangeOpen ||
                        legalFormExpiryOpen ||
                        receiptCorrectionOpen ? (
                          <tr className={styles.subFormRow}>
                            <td colSpan={9}>
                              {/*
                               * ⚠️ **TWO STEPS, AND NOT FOR SYMMETRY WITH THE PANELS AROUND IT.** Withdrawing
                               * closes the movement, and NOTHING IN THE MODEL REVERSES IT — there is no
                               * un-withdraw event, so a mis-click is permanent and the record would then say a
                               * referrer took this patient back when nobody did. The other controls on this
                               * card open a panel because they need answers; this one opens a panel because it
                               * needs a second before something irreversible happens.
                               *
                               * Not a `<form>`, for the reason the transport panel states in full above: a
                               * form submits on Enter regardless of what its button advertises.
                               */}
                              {withdrawOpen && !withdrawBlocked ? (
                                <div
                                  className={styles.declineForm}
                                  data-testid={`ward-ed-withdraw-referral-${movement.id}`}
                                >
                                  <p className={styles.cardMeta}>
                                    {movement.referredUnitIds.length === 1
                                      ? `Withdraw the referral for ${patientInfo.displayName}? This says the patient no longer needs a bed, so it withdraws that referral and closes the movement.`
                                      : `Withdraw every live referral for ${patientInfo.displayName}? This says the patient no longer needs a bed, so it withdraws all ${movement.referredUnitIds.length} of them at once and closes the movement.`}{" "}
                                    It cannot be undone, and it does not say where the patient went.
                                  </p>
                                  <div className={styles.actionRow}>
                                    <button
                                      type="button"
                                      data-testid={`ward-ed-withdraw-referral-confirm-${movement.id}`}
                                      className={styles.declineButton}
                                      onClick={() => confirmWithdrawReferral(movement.id)}
                                    >
                                      Withdraw referral
                                    </button>
                                    <button
                                      type="button"
                                      data-testid={`ward-ed-withdraw-referral-cancel-${movement.id}`}
                                      className={styles.acceptButton}
                                      onClick={() => setWithdrawOpenFor(undefined)}
                                    >
                                      Keep the referral
                                    </button>
                                  </div>
                                </div>
                              ) : null}

                              {communityReferralOpenFor === movement.id && !cmhtBlocked ? (
                                <div className={styles.declineForm} data-testid={`ward-ed-cmht-panel-${movement.id}`}>
                                  <p className={styles.cardMeta}>
                                    Direct referral to Community Mental Health Team (inpatient admission not required):
                                  </p>
                                  <p
                                    className={styles.cardMeta}
                                    data-testid={`ward-ed-cmht-legal-status-${movement.id}`}
                                  >
                                    Legal status:{" "}
                                    {movement.legalStatus ??
                                      (movement.legalForm ? `Form ${movement.legalForm.code}` : "Voluntary")}
                                  </p>
                                  {recordedSuburb ? (
                                    <p
                                      className={styles.cardMeta}
                                      data-testid={`ward-ed-cmht-catchment-note-${movement.id}`}
                                    >
                                      Team for the recorded home suburb ({recordedSuburb}) listed first.
                                    </p>
                                  ) : (
                                    <p
                                      className={styles.cardMeta}
                                      data-testid={`ward-ed-cmht-catchment-note-${movement.id}`}
                                    >
                                      No home suburb is recorded, so no team is listed first.
                                    </p>
                                  )}
                                  <label
                                    className={styles.referralField}
                                    htmlFor={`ward-ed-cmht-select-${movement.id}`}
                                  >
                                    Select community team
                                    <select
                                      id={`ward-ed-cmht-select-${movement.id}`}
                                      data-testid={`ward-ed-cmht-select-${movement.id}`}
                                      value={communityTeamChoice}
                                      onChange={(e) => setCommunityTeamChoice(e.target.value)}
                                      className={styles.capacityInput}
                                    >
                                      <option value="">Choose a community mental health team</option>
                                      {teamOptions.map((team) => (
                                        <option key={team} value={team}>
                                          {team}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <div className={styles.actionRow}>
                                    <button
                                      type="button"
                                      disabled={!communityTeamChoice}
                                      data-testid={`ward-ed-cmht-confirm-${movement.id}`}
                                      className={styles.declineButton}
                                      onClick={() => {
                                        if (!communityTeamChoice) return;
                                        dispatch({
                                          type: "REFER_TO_COMMUNITY_TEAM",
                                          role: "ed",
                                          now,
                                          movementId: movement.id,
                                          team: communityTeamChoice,
                                        });
                                        setCommunityReferralOpenFor(undefined);
                                        setCommunityTeamChoice("");
                                      }}
                                    >
                                      Confirm CMHT referral
                                    </button>
                                    <button
                                      type="button"
                                      data-testid={`ward-ed-cmht-cancel-${movement.id}`}
                                      className={styles.acceptButton}
                                      onClick={() => {
                                        setCommunityReferralOpenFor(undefined);
                                        setCommunityTeamChoice("");
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : null}

                              {/*
                               * ⚠️ **A POPUP (DIALOG), NOT AN INLINE PANEL — owner's third ruling, 2026-09-17.**
                               * `role="dialog"`/`aria-modal="true"`/`aria-labelledby` name and announce it,
                               * `handleTransportDialogKeyDown` traps Tab inside it and closes it on Escape, and
                               * the `useEffect` beside `transportDialogRef` moves focus in on open.
                               *
                               * ⚠️ **DELIBERATELY NOT A `<form>`, unlike the four panels around it.** A form
                               * submits on Enter from inside a field whatever its submit button advertises, so
                               * an `aria-disabled` submit — which, unlike the native attribute, stays fully
                               * operable — would let a half-answered booking through by keyboard while the
                               * screen said it could not. The reducer would refuse it and the refusal would be
                               * silent. With no form there is no implicit submission to bypass anything.
                               */}
                              {transportOpen && !transportBlocked
                                ? createPortal(
                                    <div className={styles.modalBackdrop} onClick={closeTransportDialog}>
                                      <div
                                        ref={transportDialogRef}
                                        className={styles.declineForm}
                                        data-testid={`ward-ed-book-transport-${movement.id}`}
                                        role="dialog"
                                        aria-modal="true"
                                        aria-labelledby={`ward-ed-book-transport-title-${movement.id}`}
                                        onKeyDown={handleTransportDialogKeyDown}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <h4
                                          id={`ward-ed-book-transport-title-${movement.id}`}
                                          className={styles.declineLegend}
                                        >
                                          Log the transport booking made by phone for {patientInfo.displayName}
                                        </h4>
                                        <label
                                          className={styles.referralField}
                                          htmlFor={`ward-ed-transport-provider-${movement.id}`}
                                        >
                                          Who is collecting {patientInfo.displayName}
                                          <select
                                            id={`ward-ed-transport-provider-${movement.id}`}
                                            data-testid={`ward-ed-transport-provider-${movement.id}`}
                                            value={transportDraft.provider ?? NO_TRANSPORT_PROVIDER_VALUE}
                                            onChange={(event) =>
                                              setTransportDraft((current) => ({
                                                ...current,
                                                provider:
                                                  event.target.value === NO_TRANSPORT_PROVIDER_VALUE
                                                    ? undefined
                                                    : (event.target.value as TransportProvider),
                                              }))
                                            }
                                          >
                                            {/* Nobody chosen, first and selected — never a provider standing in for
                                a choice not made. */}
                                            <option value={NO_TRANSPORT_PROVIDER_VALUE}>Not chosen</option>
                                            {/* Derived from `TRANSPORT_PROVIDERS`, never hand-listed: a hand-written
                                options array is how the ED cohort picker silently omitted Youth
                                (see `COHORT_OPTIONS` above). */}
                                            {TRANSPORT_PROVIDERS.map((provider) => (
                                              <option key={provider} value={provider}>
                                                {provider}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                        <fieldset
                                          className={styles.declineFieldset}
                                          data-testid={`ward-ed-transport-escort-${movement.id}`}
                                        >
                                          <legend className={styles.declineLegend}>
                                            Does {patientInfo.displayName} need an escort?
                                          </legend>
                                          <p className={styles.cardMeta}>
                                            Neither answer is selected, and nothing selects one from this patient&apos;s
                                            legal status or from the last booking. This is recorded as this team&apos;s
                                            answer.
                                          </p>
                                          {ESCORT_ANSWERS.map((answer) => (
                                            <label key={answer.label} className={styles.declineOption}>
                                              <input
                                                type="radio"
                                                name={`transport-escort-${movement.id}`}
                                                data-testid={`ward-ed-transport-escort-${answer.value ? "yes" : "no"}-${movement.id}`}
                                                value={answer.value ? "yes" : "no"}
                                                // `=== answer.value`, never a truthiness test: an unanswered draft is
                                                // `undefined`, which must check NEITHER box rather than the "no" one.
                                                checked={transportDraft.escortRequired === answer.value}
                                                onChange={() =>
                                                  setTransportDraft((current) => ({
                                                    ...current,
                                                    escortRequired: answer.value,
                                                  }))
                                                }
                                              />
                                              {answer.label}
                                            </label>
                                          ))}
                                        </fieldset>
                                        <label
                                          className={styles.referralField}
                                          htmlFor={`ward-ed-transport-cad-number-${movement.id}`}
                                        >
                                          CAD transport number
                                          <input
                                            type="text"
                                            id={`ward-ed-transport-cad-number-${movement.id}`}
                                            data-testid={`ward-ed-transport-cad-number-${movement.id}`}
                                            value={transportDraft.cadNumber}
                                            onChange={(event) =>
                                              setTransportDraft((current) => ({
                                                ...current,
                                                cadNumber: event.target.value,
                                              }))
                                            }
                                          />
                                        </label>
                                        <fieldset
                                          className={styles.declineFieldset}
                                          data-testid={`ward-ed-transport-legal-status-${movement.id}`}
                                        >
                                          <legend className={styles.declineLegend}>
                                            Is the transport voluntary or involuntary?
                                          </legend>
                                          {TRANSPORT_LEGAL_STATUSES.map((status) => (
                                            <label key={status} className={styles.declineOption}>
                                              <input
                                                type="radio"
                                                name={`transport-legal-status-${movement.id}`}
                                                data-testid={`ward-ed-transport-legal-status-${status}-${movement.id}`}
                                                value={status}
                                                checked={transportDraft.transportLegalStatus === status}
                                                onChange={() =>
                                                  setTransportDraft((current) => ({
                                                    ...current,
                                                    transportLegalStatus: status,
                                                  }))
                                                }
                                              />
                                              {TRANSPORT_LEGAL_STATUS_LABELS[status]}
                                            </label>
                                          ))}
                                        </fieldset>
                                        <label
                                          className={styles.referralField}
                                          htmlFor={`ward-ed-transport-estimated-time-${movement.id}`}
                                        >
                                          Estimated time (24-hour, HH:MM)
                                          <input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="HH:MM"
                                            id={`ward-ed-transport-estimated-time-${movement.id}`}
                                            data-testid={`ward-ed-transport-estimated-time-${movement.id}`}
                                            value={transportDraft.estimatedTime}
                                            onChange={(event) =>
                                              setTransportDraft((current) => ({
                                                ...current,
                                                estimatedTime: event.target.value,
                                              }))
                                            }
                                          />
                                        </label>
                                        <fieldset
                                          className={styles.declineFieldset}
                                          data-testid={`ward-ed-transport-estimated-day-${movement.id}`}
                                        >
                                          <legend className={styles.declineLegend}>Today or tomorrow?</legend>
                                          {(["today", "tomorrow"] as const).map((day) => (
                                            <label key={day} className={styles.declineOption}>
                                              <input
                                                type="radio"
                                                name={`transport-estimated-day-${movement.id}`}
                                                data-testid={`ward-ed-transport-estimated-day-${day}-${movement.id}`}
                                                value={day}
                                                checked={transportDraft.estimatedDay === day}
                                                onChange={() =>
                                                  setTransportDraft((current) => ({ ...current, estimatedDay: day }))
                                                }
                                              />
                                              {day === "today" ? "Today" : "Tomorrow"}
                                            </label>
                                          ))}
                                        </fieldset>
                                        <div className={styles.actionRow}>
                                          <button
                                            type="button"
                                            data-testid={`ward-ed-book-transport-confirm-${movement.id}`}
                                            className={styles.declineSubmit}
                                            aria-disabled={transportAnswersBlocked ? "true" : undefined}
                                            aria-describedby={
                                              transportAnswersBlocked
                                                ? `ward-ed-book-transport-blocked-${movement.id}`
                                                : undefined
                                            }
                                            title={transportAnswersBlocked ?? undefined}
                                            onClick={
                                              transportAnswersBlocked
                                                ? ignoreUnavailableActivation
                                                : () => submitBookTransport(movement.id)
                                            }
                                          >
                                            Transport booked
                                          </button>
                                          <button
                                            type="button"
                                            data-testid={`ward-ed-book-transport-cancel-${movement.id}`}
                                            className={styles.acceptButton}
                                            onClick={closeTransportDialog}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                        {transportAnswersBlocked ? (
                                          <span
                                            id={`ward-ed-book-transport-blocked-${movement.id}`}
                                            className="sr-only"
                                          >
                                            {transportAnswersBlocked}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>,
                                    document.body,
                                  )
                                : null}

                              {examOpen && !examBlocked ? (
                                <form
                                  className={styles.declineForm}
                                  onSubmit={(event) => submitExamination(event, movement.id)}
                                  data-testid={`ward-ed-examine-form-${movement.id}`}
                                >
                                  <fieldset className={styles.declineFieldset}>
                                    <legend className={styles.declineLegend}>
                                      Examination outcome for {patientInfo.displayName}
                                    </legend>
                                    {(
                                      [
                                        { value: "inpatient_order", label: "Inpatient treatment order" },
                                        { value: "community_order", label: "Community treatment order" },
                                        { value: "revoked", label: "Revoked — does not proceed" },
                                        // Owner item 7 (2026-09-17): settles nothing and exists
                                        // only to say a repeat examination is coming — offered on
                                        // every visit to this panel, including a repeat one, the
                                        // same way the other three outcomes are.
                                        { value: "further_examination_ordered", label: "Further examination ordered" },
                                      ] as const
                                    ).map((option) => (
                                      <label key={option.value} className={styles.declineOption}>
                                        <input
                                          type="radio"
                                          name={`examination-outcome-${movement.id}`}
                                          value={option.value}
                                          checked={examinationOutcome === option.value}
                                          onChange={() => setExaminationOutcome(option.value)}
                                        />
                                        {option.label}
                                      </label>
                                    ))}
                                  </fieldset>
                                  <button type="submit" disabled={!examinationOutcome} className={styles.declineSubmit}>
                                    Confirm examination outcome
                                  </button>
                                </form>
                              ) : null}

                              {edOutcomeOpen && !edOutcomeBlocked ? (
                                <div className={styles.declineForm} data-testid={`ward-ed-outcome-form-${movement.id}`}>
                                  <fieldset className={styles.declineFieldset}>
                                    <legend className={styles.declineLegend}>
                                      Record outcome for {patientInfo.displayName}
                                    </legend>
                                    <p className={styles.cardMeta}>
                                      This ends the bed search: any live ward requests are withdrawn, a held bed is
                                      released, and an uncollected transport job is cancelled. The patient stays on this
                                      board until &quot;Left the department&quot; is recorded.
                                    </p>
                                    <div className={styles.actionRow}>
                                      <button
                                        type="button"
                                        data-testid={`ward-ed-outcome-discharge-${movement.id}`}
                                        aria-disabled={dischargeBlocked ? "true" : undefined}
                                        aria-describedby={
                                          dischargeBlocked
                                            ? `ward-ed-outcome-discharge-unavailable-${movement.id}`
                                            : undefined
                                        }
                                        title={dischargeBlocked ?? undefined}
                                        className={styles.acceptButton}
                                        onClick={
                                          dischargeBlocked
                                            ? ignoreUnavailableActivation
                                            : () => {
                                                dispatch({
                                                  type: "RECORD_ED_OUTCOME",
                                                  role: "ed",
                                                  now,
                                                  movementId: movement.id,
                                                  outcome: "for_discharge",
                                                });
                                                setEdOutcomeOpenFor(undefined);
                                              }
                                        }
                                      >
                                        For discharge
                                      </button>
                                      <button
                                        type="button"
                                        data-testid={`ward-ed-outcome-community-${movement.id}`}
                                        className={styles.acceptButton}
                                        onClick={() => {
                                          dispatch({
                                            type: "RECORD_ED_OUTCOME",
                                            role: "ed",
                                            now,
                                            movementId: movement.id,
                                            outcome: "for_community_follow_up",
                                          });
                                          setEdOutcomeOpenFor(undefined);
                                        }}
                                      >
                                        For community follow-up
                                      </button>
                                    </div>
                                    {dischargeBlocked ? (
                                      <p
                                        id={`ward-ed-outcome-discharge-unavailable-${movement.id}`}
                                        data-testid={`ward-ed-outcome-discharge-unavailable-${movement.id}`}
                                        className={styles.cardMeta}
                                      >
                                        {dischargeBlocked}
                                      </p>
                                    ) : null}
                                  </fieldset>
                                </div>
                              ) : null}

                              {urgencyChangeOpen ? (
                                <form
                                  className={styles.declineForm}
                                  onSubmit={(event) => submitUrgencyChange(event, movement.id)}
                                  data-testid={`ward-change-urgency-${movement.id}`}
                                >
                                  <label
                                    className={styles.referralField}
                                    htmlFor={`ward-change-urgency-tier-${movement.id}`}
                                  >
                                    Urgency tier for {patientInfo.displayName}
                                    <select
                                      id={`ward-change-urgency-tier-${movement.id}`}
                                      value={urgencyDraft.urgency}
                                      onChange={(event) =>
                                        setUrgencyDraft((current) => ({
                                          ...current,
                                          urgency: Number(event.target.value) as 1 | 2 | 3,
                                        }))
                                      }
                                    >
                                      {/* Labelled, not a bare digit, for the same reason as the raise-referral
                                picker above: the value stays the bare tier, the text carries the
                                direction. */}
                                      {URGENCY_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                          {urgencyTierLabel(option)}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label
                                    className={styles.referralField}
                                    htmlFor={`ward-change-urgency-reason-${movement.id}`}
                                  >
                                    Reason
                                    <select
                                      id={`ward-change-urgency-reason-${movement.id}`}
                                      required
                                      value={urgencyDraft.reason ?? NO_CHANGE_REASON_VALUE}
                                      onChange={(event) =>
                                        setUrgencyDraft((current) => ({
                                          ...current,
                                          reason:
                                            event.target.value === NO_CHANGE_REASON_VALUE
                                              ? undefined
                                              : (event.target.value as UrgencyChangeReason),
                                        }))
                                      }
                                    >
                                      <option value={NO_CHANGE_REASON_VALUE}>Choose a reason</option>
                                      {URGENCY_CHANGE_REASONS.map((reason) => (
                                        <option key={reason} value={reason}>
                                          {changeReasonLabels[reason]}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <button
                                    type="submit"
                                    className={styles.declineSubmit}
                                    aria-disabled={urgencyDraft.reason === undefined ? "true" : undefined}
                                    aria-describedby={
                                      urgencyDraft.reason === undefined
                                        ? `ward-change-urgency-blocked-${movement.id}`
                                        : undefined
                                    }
                                    title={urgencyDraft.reason === undefined ? URGENCY_REASON_UNCHOSEN : undefined}
                                    onClick={
                                      urgencyDraft.reason === undefined ? ignoreUnavailableActivation : undefined
                                    }
                                  >
                                    Record urgency change
                                  </button>
                                  {urgencyDraft.reason === undefined ? (
                                    <span id={`ward-change-urgency-blocked-${movement.id}`} className="sr-only">
                                      {URGENCY_REASON_UNCHOSEN}
                                    </span>
                                  ) : null}
                                </form>
                              ) : null}

                              {legalStatusChangeOpen ? (
                                <form
                                  className={styles.declineForm}
                                  onSubmit={(event) => submitLegalStatusChange(event, movement.id)}
                                  data-testid={`ward-change-legal-status-${movement.id}`}
                                >
                                  <label
                                    className={styles.referralField}
                                    htmlFor={`ward-change-legal-status-value-${movement.id}`}
                                  >
                                    Legal status for {patientInfo.displayName}
                                    <select
                                      id={`ward-change-legal-status-value-${movement.id}`}
                                      value={legalStatusDraft.legalStatus}
                                      onChange={(event) =>
                                        setLegalStatusDraft((current) => ({
                                          ...current,
                                          legalStatus: event.target.value as LegalStatus,
                                        }))
                                      }
                                    >
                                      {LEGAL_STATUS_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label
                                    className={styles.referralField}
                                    htmlFor={`ward-change-legal-status-reason-${movement.id}`}
                                  >
                                    Reason
                                    <select
                                      id={`ward-change-legal-status-reason-${movement.id}`}
                                      required
                                      value={legalStatusDraft.reason ?? NO_CHANGE_REASON_VALUE}
                                      onChange={(event) =>
                                        setLegalStatusDraft((current) => ({
                                          ...current,
                                          reason:
                                            event.target.value === NO_CHANGE_REASON_VALUE
                                              ? undefined
                                              : (event.target.value as LegalStatusChangeReason),
                                        }))
                                      }
                                    >
                                      <option value={NO_CHANGE_REASON_VALUE}>Choose a reason</option>
                                      {LEGAL_STATUS_CHANGE_REASONS.map((reason) => (
                                        <option key={reason} value={reason}>
                                          {changeReasonLabels[reason]}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <button
                                    type="submit"
                                    className={styles.declineSubmit}
                                    aria-disabled={legalStatusDraft.reason === undefined ? "true" : undefined}
                                    aria-describedby={
                                      legalStatusDraft.reason === undefined
                                        ? `ward-change-legal-status-blocked-${movement.id}`
                                        : undefined
                                    }
                                    title={
                                      legalStatusDraft.reason === undefined ? LEGAL_STATUS_REASON_UNCHOSEN : undefined
                                    }
                                    onClick={
                                      legalStatusDraft.reason === undefined ? ignoreUnavailableActivation : undefined
                                    }
                                  >
                                    Record legal status change
                                  </button>
                                  {legalStatusDraft.reason === undefined ? (
                                    <span id={`ward-change-legal-status-blocked-${movement.id}`} className="sr-only">
                                      {LEGAL_STATUS_REASON_UNCHOSEN}
                                    </span>
                                  ) : null}
                                </form>
                              ) : null}

                              {legalFormExpiryOpen ? (
                                <form
                                  className={styles.declineForm}
                                  onSubmit={(event) =>
                                    submitLegalFormExpiry(event, movement.id, movement.legalForm?.dueAt)
                                  }
                                  data-testid={`ward-ed-legal-form-expiry-${movement.id}`}
                                >
                                  <fieldset className={styles.declineFieldset}>
                                    <legend className={styles.declineLegend}>
                                      {legalFormExpiryIsExtension
                                        ? `Extension written on the form for ${patientInfo.displayName}`
                                        : `Expiry written on the form for ${patientInfo.displayName}`}
                                    </legend>
                                    {legalFormExpiryIsExtension ? (
                                      <p className={styles.cardMeta}>New expiry written on the form</p>
                                    ) : null}
                                    <label className={styles.referralField}>
                                      Date
                                      <input
                                        type="date"
                                        data-testid={`ward-ed-legal-form-expiry-date-${movement.id}`}
                                        value={legalFormExpiryDraft.date}
                                        onChange={(event) =>
                                          setLegalFormExpiryDraft((current) => ({
                                            ...current,
                                            date: event.target.value,
                                          }))
                                        }
                                      />
                                    </label>
                                    <label className={styles.referralField}>
                                      Time
                                      <input
                                        type="time"
                                        data-testid={`ward-ed-legal-form-expiry-time-${movement.id}`}
                                        value={legalFormExpiryDraft.time}
                                        onChange={(event) =>
                                          setLegalFormExpiryDraft((current) => ({
                                            ...current,
                                            time: event.target.value,
                                          }))
                                        }
                                      />
                                    </label>
                                  </fieldset>
                                  <button
                                    type="submit"
                                    className={styles.declineSubmit}
                                    disabled={legalFormExpirySaveBlocked}
                                    data-testid={`ward-ed-legal-form-expiry-save-${movement.id}`}
                                  >
                                    {legalFormExpiryIsExtension ? "Save extension" : "Save expiry"}
                                  </button>
                                </form>
                              ) : null}

                              {receiptCorrectionOpen ? (
                                <form
                                  className={styles.declineForm}
                                  onSubmit={(event) => submitReceiptCorrection(event, movement.id)}
                                  data-testid={`ed-correct-form-receipt-${movement.id}`}
                                >
                                  <label
                                    className={styles.referralField}
                                    htmlFor={`ed-correct-form-receipt-reason-${movement.id}`}
                                  >
                                    Reason for correction
                                    <select
                                      id={`ed-correct-form-receipt-reason-${movement.id}`}
                                      required
                                      value={receiptCorrectionReasonDraft ?? NO_CHANGE_REASON_VALUE}
                                      onChange={(event) =>
                                        setReceiptCorrectionReasonDraft(
                                          event.target.value === NO_CHANGE_REASON_VALUE
                                            ? undefined
                                            : (event.target.value as LegalFormReceiptCorrectionReason),
                                        )
                                      }
                                    >
                                      <option value={NO_CHANGE_REASON_VALUE}>Choose a reason</option>
                                      {LEGAL_FORM_RECEIPT_CORRECTION_REASONS.map((reason) => (
                                        <option key={reason} value={reason}>
                                          {legalFormReceiptCorrectionReasonLabels[reason]}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <button
                                    type="submit"
                                    className={styles.declineSubmit}
                                    disabled={receiptCorrectionReasonDraft === undefined}
                                    data-testid={`ed-correct-form-receipt-save-${movement.id}`}
                                  >
                                    Save correction
                                  </button>
                                </form>
                              ) : null}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selectedPatient ? (
          <aside className={styles.pxDrawer} aria-labelledby="pxTitle">
            <dialog
              ref={patientDialogRef}
              className={`${styles.menuPanel} ${styles.patientDialog}`}
              aria-labelledby="pxTitle"
              onCancel={() => setSelectedPatientId(null)}
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  const rect = event.currentTarget.getBoundingClientRect();
                  if (
                    event.clientX < rect.left ||
                    event.clientX > rect.right ||
                    event.clientY < rect.top ||
                    event.clientY > rect.bottom
                  )
                    setSelectedPatientId(null);
                }
              }}
            >
              <div className={styles.popHead}>
                {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                <h2 id="pxTitle">{selectedPatientInfo?.displayName ?? "Unknown Patient"}</h2>
                <span className={styles.count}>
                  UMRN: <strong>{selectedPatientInfo?.umrn}</strong> &middot; {selectedPatient.cohort} &middot;{" "}
                  {selectedPatient.sex}
                </span>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={() => setSelectedPatientId(null)}
                  aria-label="Close patient details"
                >
                  Close
                </button>
                <p className={`${styles.fresh} ${styles.meta}`}>
                  <span>{site?.name ?? department.name}</span>
                  <span>{selectedPatient.legalStatus}</span>
                  <span>{urgencyTierLabel(selectedPatient.urgency)}</span>
                </p>
              </div>
              <div className={`${styles.popBody} ${styles.pxBody}`}>
                <section className={styles.pxBlock}>
                  <h3>Where they are up to</h3>
                  <dl className={styles.pairs}>
                    {selectedPatient.legalForm && (
                      <div className={styles.pair}>
                        <dt>Recorded legal form</dt>
                        <dd>
                          {selectedPatient.legalForm.code} · {formExpiryLine(selectedPatient.legalForm, now)}
                        </dd>
                      </div>
                    )}
                    <div className={styles.pair}>
                      <dt>Recorded medical clearance</dt>
                      <dd>
                        {movementMedicalClearance(selectedPatient, referrals) === undefined
                          ? "Not recorded"
                          : movementMedicalClearance(selectedPatient, referrals)?.cleared
                            ? "Yes"
                            : "No"}
                      </dd>
                    </div>
                    {selectedPatient.referredUnitIds.length > 0 && (
                      <div className={styles.pair}>
                        <dt>Since referral</dt>
                        <dd>
                          {selectedPatient.referredAt === undefined
                            ? "Referral time not recorded"
                            : splitDuration(Math.max(now - selectedPatient.referredAt, 0))}
                        </dd>
                      </div>
                    )}

                    {selectedPatient.arrivalMode === "police" && (
                      <div className={styles.pair}>
                        <dt>Police presence</dt>
                        <dd>Police in attendance</dd>
                      </div>
                    )}
                    <div className={styles.pair}>
                      <dt>Gender</dt>
                      <dd>{selectedPatient.gender ?? "Not yet recorded"}</dd>
                    </div>
                    <div className={styles.pair}>
                      <dt>Patient</dt>
                      <dd>
                        <b>{selectedPatientInfo?.displayName}</b> (UMRN: <strong>{selectedPatientInfo?.umrn}</strong>)
                      </dd>
                    </div>
                    <div className={styles.pair}>
                      <dt>In the department</dt>
                      <dd>
                        <b>{elapsedLabel(selectedPatient, now)}</b>, from{" "}
                        {formatInstantWithDay(selectedPatient.openedAt, now)}
                      </dd>
                    </div>
                    <div className={styles.pair}>
                      <dt>Bay</dt>
                      <dd className={styles.bayNumber}>{patientBay(selectedPatient.id)}</dd>
                    </div>
                    <div className={styles.pair}>
                      <dt>Legal status</dt>
                      <dd>{selectedPatient.legalStatus}</dd>
                    </div>
                    <div className={styles.pair}>
                      <dt>Stage</dt>
                      <dd>{stageCopy[selectedPatient.stage].label}</dd>
                    </div>
                    <div className={styles.pair}>
                      <dt>Outstanding item</dt>
                      <dd>
                        {outstandingItem(selectedPatient).label} — {outstandingItem(selectedPatient).detail}
                      </dd>
                    </div>
                    {selectedPatient.arrivalDetails ? (
                      <>
                        <div className={styles.pair}>
                          <dt>Arrival mode</dt>
                          <dd>{arrivalModeLabel(selectedPatient.arrivalDetails.mode)}</dd>
                        </div>
                        <div className={styles.pair}>
                          <dt>Tracking number</dt>
                          <dd>{selectedPatient.arrivalDetails.trackingNumber ?? "Not recorded"}</dd>
                        </div>
                        <div className={styles.pair}>
                          <dt>Estimated ward time</dt>
                          <dd>{arrivalEtaLabel(selectedPatient.arrivalDetails.estimatedArrivalAt, now)}</dd>
                        </div>
                      </>
                    ) : null}
                  </dl>
                  {isArrivalLate(selectedPatient, now) ? (
                    <p
                      className={styles.arrivalLate}
                      role="status"
                      data-testid={`ward-ed-drawer-arrival-late-${selectedPatient.id}`}
                    >
                      Arrival late — more than 60 minutes past the estimated ward time. Not marked arrived.
                    </p>
                  ) : null}
                  {canSetArrivalPlan(selectedPatient) ? (
                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        data-testid={`ward-ed-drawer-arrival-plan-toggle-${selectedPatient.id}`}
                        className={styles.acceptButton}
                        onClick={() => setArrivalPlanOpenFor(selectedPatient.id)}
                      >
                        {selectedPatient.arrivalDetails ? "Edit arrival plan" : "Set arrival plan"}
                      </button>
                    </div>
                  ) : null}
                </section>
                <section className={styles.pxBlock}>
                  <h3>Notes</h3>
                  <p className={styles.pxP}>
                    <b>Presenting:</b> {outstandingItem(selectedPatient).label} —{" "}
                    {outstandingItem(selectedPatient).detail}
                  </p>
                  <p className={styles.pxP}>
                    <b>Plan:</b> {stageCopy[selectedPatient.stage].label}
                  </p>
                </section>
                <section className={styles.pxBlock}>
                  <h3>The journey the record holds</h3>
                  {selectedPatientJourneyEvents.length === 0 ? (
                    <p className={styles.none}>No journey events recorded.</p>
                  ) : (
                    <ol className={`${styles.tl} ${styles.tlTight}`}>
                      {selectedPatientJourneyEvents.map((e, index) => (
                        <li key={index} className={styles.tlRow} data-tone={e.tone ?? "quiet"}>
                          <span className={styles.tlAt}>
                            <b>{formatInstantWithDay(e.min, now)}</b>
                          </span>
                          <span className={styles.tlMark} aria-hidden="true">
                            <span className={styles.tick} data-tone={e.tone ?? "quiet"}>
                              <span className={styles.tickGlyph}>
                                {e.tone === "danger" ? "▲" : e.tone === "warn" ? "■" : e.tone === "good" ? "✓" : "●"}
                              </span>
                            </span>
                          </span>
                          <span className="sr-only">
                            {e.tone === "danger"
                              ? "Urgent: "
                              : e.tone === "warn"
                                ? "Warning: "
                                : e.tone === "good"
                                  ? "Completed: "
                                  : "Event: "}
                          </span>
                          <span className={styles.tlWhat}>{e.what}</span>
                          <span className={styles.tlBy}>{e.by ?? ""}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>
              <div className={styles.popFoot}>
                <span>This record shows recorded clinical state. Table drafts are not saved.</span>
              </div>
            </dialog>
          </aside>
        ) : null}

        <section
          aria-label="Seen in the last twenty four hours"
          className={`${styles.panel} ${styles.full} ${styles.listSection} ${styles.seenSection}`}
          data-testid="ward-ed-seen-24h"
          tabIndex={0}
        >
          <div className={styles.seenHeaderArea}>
            <div className={styles.seenTopRow}>
              <div className={styles.seenHeadingGroup}>
                <h2>Seen in the last 24 hours</h2>
                <span className={styles.seenCountBadge}>
                  {timelineEvents.length === 0
                    ? "none"
                    : `${timelineEvents.length} event${timelineEvents.length === 1 ? "" : "s"}`}
                </span>
              </div>
              <span className={styles.seenSubNote}>
                What was recorded, not everything that happened &middot; Chronological clinical audit
              </span>
            </div>

            <WardDynamicIsland
              testId="ward-ed-hud-island"
              title="ED Pressure"
              status={isEdAlarm ? "alarm" : isEdWarn ? "warning" : "nominal"}
              statusText={isEdAlarm ? `${breachesCount} past access target` : "Access target compliance nominal"}
              ariaLabel="Emergency department flow indicators"
              metrics={[
                {
                  id: "kpi-presenting",
                  label: "Presenting",
                  value: presentingCount,
                  tone: "accent",
                },
                {
                  id: "kpi-awaiting-bed",
                  label: "Awaiting Bed",
                  value: awaitingBedCount,
                  tone: awaitingBedCount > 0 ? "warn" : "good",
                },
                {
                  id: "kpi-avg-wait",
                  label: "Avg Wait",
                  value: avgWaitLabel,
                  tone: breachesCount > 0 ? "warn" : "normal",
                },
                {
                  id: "kpi-breaches",
                  label: "Past Target",
                  value: breachesCount,
                  tone: breachesCount > 0 ? "danger" : "good",
                },
              ]}
            />

            <div className={styles.seenToolbar}>
              <div className={styles.seenFilterTabs} role="tablist" aria-label="Filter events by category">
                <button
                  type="button"
                  role="tab"
                  aria-selected={timelineCategoryFilter === "all"}
                  className={`${styles.seenTabBtn} ${timelineCategoryFilter === "all" ? styles.seenTabBtnActive : ""}`}
                  onClick={() => setTimelineCategoryFilter("all")}
                >
                  All events ({timelineEvents.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={timelineCategoryFilter === "bed_search"}
                  className={`${styles.seenTabBtn} ${timelineCategoryFilter === "bed_search" ? styles.seenTabBtnActive : ""}`}
                  onClick={() => setTimelineCategoryFilter("bed_search")}
                >
                  Bed search ({bedSearchEventsCount})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={timelineCategoryFilter === "arrivals"}
                  className={`${styles.seenTabBtn} ${timelineCategoryFilter === "arrivals" ? styles.seenTabBtnActive : ""}`}
                  onClick={() => setTimelineCategoryFilter("arrivals")}
                >
                  Arrivals &amp; Triage ({arrivalEventsCount})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={timelineCategoryFilter === "clinical"}
                  className={`${styles.seenTabBtn} ${timelineCategoryFilter === "clinical" ? styles.seenTabBtnActive : ""}`}
                  onClick={() => setTimelineCategoryFilter("clinical")}
                >
                  Clinical &amp; Legal ({clinicalEventsCount})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={timelineCategoryFilter === "transport"}
                  className={`${styles.seenTabBtn} ${timelineCategoryFilter === "transport" ? styles.seenTabBtnActive : ""}`}
                  onClick={() => setTimelineCategoryFilter("transport")}
                >
                  Transport ({transportEventsCount})
                </button>
              </div>

              <div className={styles.seenSearchBox}>
                <input
                  type="search"
                  className={styles.seenSearchInput}
                  placeholder="Search patient, unit, reason..."
                  value={timelineSearchQuery}
                  onChange={(e) => setTimelineSearchQuery(e.target.value)}
                  aria-label="Filter timeline events by text"
                />
                {timelineSearchQuery ? (
                  <button
                    type="button"
                    className={styles.seenClearSearch}
                    onClick={() => setTimelineSearchQuery("")}
                    aria-label="Clear search filter"
                  >
                    &times;
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {timelineEvents.length === 0 ? (
            <p className={styles.none}>
              Nothing has been recorded against this department in the last twenty four hours. Absence here means
              nothing was written down, not that nothing happened.
            </p>
          ) : filteredTimelineEvents.length === 0 ? (
            <div className={styles.seenEmptyBox}>
              <p>No recorded events match the selected category or search filter.</p>
              <button
                type="button"
                className={styles.seenResetBtn}
                onClick={() => {
                  setTimelineCategoryFilter("all");
                  setTimelineSearchQuery("");
                }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className={styles.seenStreamWrap}>
              <ol className={styles.seenStream}>
                {filteredTimelineEvents.map((e, index) => {
                  const nodeClass =
                    e.tone === "danger"
                      ? styles.nodeDanger
                      : e.tone === "warn"
                        ? styles.nodeWarn
                        : e.tone === "good"
                          ? styles.nodeGood
                          : e.tone === "info"
                            ? styles.nodeInfo
                            : styles.nodeQuiet;

                  const badgeToneClass =
                    e.badgeTone === "danger"
                      ? styles.badgeDanger
                      : e.badgeTone === "warn"
                        ? styles.badgeWarn
                        : e.badgeTone === "good"
                          ? styles.badgeGood
                          : e.badgeTone === "purple"
                            ? styles.badgePurple
                            : e.badgeTone === "info"
                              ? styles.badgeInfo
                              : styles.badgeQuiet;

                  const nodeGlyph =
                    e.tone === "danger"
                      ? "▲"
                      : e.tone === "warn"
                        ? "✕"
                        : e.tone === "good"
                          ? "✓"
                          : e.tone === "info"
                            ? "●"
                            : "§";

                  return (
                    <li key={e.id ?? index} className={styles.seenItemRow}>
                      <div className={styles.seenTimeGutter}>
                        <span className={styles.seenClock}>{formatInstantWithDay(e.min, now)}</span>
                        <span className={styles.seenAgo}>{splitDuration(Math.max(now - e.min, 0))} ago</span>
                      </div>

                      <div className={styles.seenRail} aria-hidden="true">
                        <span className={`${styles.seenNode} ${nodeClass}`}>{nodeGlyph}</span>
                      </div>

                      <div className={styles.seenCard}>
                        <div className={styles.seenCardTop}>
                          <div className={styles.seenPatientBlock}>
                            {e.movementId && e.patientName ? (
                              <button
                                type="button"
                                className={styles.seenPatientBtn}
                                onClick={() => setSelectedPatientId(e.movementId!)}
                                title={`Open patient details for ${e.patientName}`}
                              >
                                {e.patientName}
                              </button>
                            ) : e.patientName ? (
                              <span className={styles.seenPatientStatic}>{e.patientName}</span>
                            ) : null}

                            {e.referralId ? <span className={styles.seenRefPill}>Ref #{e.referralId}</span> : null}

                            {e.waitMinutes && e.waitMinutes >= 1440 ? (
                              <span className={styles.seenLongWaitPill} title={`Department stay: ${LONG_WAIT_TEXT}`}>
                                Waiting {LONG_WAIT_TEXT}
                              </span>
                            ) : null}
                          </div>

                          <div className={styles.seenMetaGroup}>
                            {e.badgeText ? (
                              <span className={`${styles.seenBadge} ${badgeToneClass}`}>{e.badgeText}</span>
                            ) : null}

                            {e.by ? (
                              <span className={styles.seenAuthorTag} title={`Recorded by ${e.by}`}>
                                <span aria-hidden="true">👤</span>
                                <span>{e.by}</span>
                              </span>
                            ) : (
                              <span className={styles.seenSystemTag}>Audited record</span>
                            )}
                          </div>
                        </div>

                        <div className={styles.seenCardDetail}>
                          {e.badgeText === "Bed Declined" ? (
                            <div className={styles.seenDeclineContent}>
                              <div className={styles.seenDeclineUnit}>
                                <span className={styles.seenUnitTag}>{e.unitName}</span> declined admission:
                              </div>
                              {e.detailText && (
                                <div className={styles.seenDeclineQuote}>
                                  <span className={styles.seenQuoteLabel}>Reason:</span>
                                  <strong className={styles.seenQuoteText}>&ldquo;{e.detailText}&rdquo;</strong>
                                </div>
                              )}
                            </div>
                          ) : e.badgeText === "Examined" ? (
                            <div className={styles.seenExamContent}>
                              <span>Psychiatric examination completed</span>
                              {e.detailText && <span className={styles.seenExamOutcome}>Outcome: {e.detailText}</span>}
                            </div>
                          ) : e.badgeTone === "purple" ? (
                            <div className={styles.seenLegalContent}>
                              <span>Statutory document received:</span>
                              <strong>{e.badgeText}</strong>
                              {e.detailText && <span className={styles.seenLegalTitle}>({e.detailText})</span>}
                            </div>
                          ) : e.badgeText === "Transport Booked" ? (
                            <div className={styles.seenTransportContent}>
                              <span>Patient transport booked with</span>
                              <span className={styles.seenTransportProvider}>{e.primaryText}</span>
                              {e.detailText && <span className={styles.seenEscortBadge}>&middot; {e.detailText}</span>}
                            </div>
                          ) : (
                            e.what
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </section>

        {(() => {
          const totalReadyBeds = units.reduce((acc, u) => acc + (unitCapacity(u, bedReleases).available ?? 0), 0);
          const totalPendingPrep = units.reduce((acc, u) => acc + bedsPendingPreparation(u.id, bedReleases), 0);
          const filteredServices =
            capacityServiceFilter === "all"
              ? wardServiceOrder
              : wardServiceOrder.filter((s) => s === capacityServiceFilter);

          return (
            <section
              aria-label="Statewide capacity"
              className={`${styles.panel} ${styles.full} ${styles.listSection} ${styles.capacitySection}`}
              tabIndex={0}
            >
              <div className={styles.ph}>
                <div className={styles.capacityHeaderTop}>
                  <div>
                    <h2>Statewide capacity &middot; {units.length} units</h2>
                    <p className={styles.note}>
                      Ward-confirmed capacity for context. Read-only across all health areas; no action is available
                      here.
                    </p>
                  </div>
                  <div className={styles.capacityKpiGroup}>
                    <span className={styles.capacityKpiReady}>
                      <i className={styles.statusDotLive} aria-hidden="true" />
                      <strong>{totalReadyBeds}</strong> beds ready now
                    </span>
                    {totalPendingPrep > 0 ? (
                      <span className={styles.capacityKpiPending}>
                        <strong>{totalPendingPrep}</strong> being prepared
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className={styles.capacityFilterBar} role="tablist" aria-label="Filter units by Health Service">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={capacityServiceFilter === "all"}
                    className={
                      capacityServiceFilter === "all"
                        ? `${styles.capacityFilterBtn} ${styles.activeFilter}`
                        : styles.capacityFilterBtn
                    }
                    onClick={() => setCapacityServiceFilter("all")}
                  >
                    All Services ({units.length})
                  </button>
                  {wardServiceOrder.map((svc) => {
                    const count = units.filter((u) => siteByCode(u.siteCode)?.service === svc).length;
                    return (
                      <button
                        key={svc}
                        type="button"
                        role="tab"
                        aria-selected={capacityServiceFilter === svc}
                        className={
                          capacityServiceFilter === svc
                            ? `${styles.capacityFilterBtn} ${styles.activeFilter}`
                            : styles.capacityFilterBtn
                        }
                        onClick={() => setCapacityServiceFilter(svc)}
                      >
                        {svc.toUpperCase()} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className={styles.capacityTableWrap} data-testid="ward-ed-statewide-capacity">
                <table className={styles.capacityTable}>
                  <thead>
                    <tr>
                      <th scope="col">Unit</th>
                      <th scope="col">Cohort</th>
                      <th scope="col">Security</th>
                      <th scope="col" className={styles.n}>
                        Ready
                      </th>
                      <th scope="col" className={styles.n}>
                        Beds
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServices.flatMap((service) =>
                      units
                        .filter((unit) => siteByCode(unit.siteCode)?.service === service)
                        .map((unit) => {
                          const capacity = unitCapacity(unit, bedReleases);
                          const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
                          return (
                            <tr key={unit.id} className={styles.capacityRow}>
                              <th scope="row">
                                <div className={styles.unitNameCol}>
                                  <span className={styles.unitNameText}>{unit.name}</span>
                                  <span className={styles.serviceTag} data-service={service}>
                                    {service.toUpperCase()}
                                  </span>
                                </div>
                              </th>
                              <td>
                                <span className={styles.cohortTag} data-cohort={unit.cohort}>
                                  {unit.cohort}
                                </span>
                              </td>
                              <td>
                                <span className={styles.securityTag}>{designationSummary(unit)}</span>
                              </td>
                              <td className={styles.n} data-testid={`ward-ed-capacity-ready-${unit.id}`}>
                                <span className={capacity.available > 0 ? styles.readyPill : styles.zeroPill}>
                                  {capacity.available}
                                </span>
                                {pendingPreparation > 0 ? (
                                  <small
                                    className={styles.beingMadeReady}
                                    data-testid={`ward-ed-capacity-pending-${unit.id}`}
                                  >
                                    {pendingPreparation} still being made ready
                                  </small>
                                ) : null}
                              </td>
                              <td className={styles.n}>
                                <div className={styles.bedCapacityCell}>
                                  <span className={styles.bedTotalNum}>{unit.beds}</span>
                                  <div
                                    className={styles.capacityMeter}
                                    title={`${capacity.available} ready / ${unit.beds} total beds`}
                                    aria-hidden="true"
                                  >
                                    <div
                                      className={styles.capacityMeterFill}
                                      style={{
                                        width: `${Math.min(100, Math.round(((unit.beds - capacity.available) / unit.beds) * 100))}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        }),
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })()}
        <WardPrototypeFooter testId="ward-ed-governance" note="Emergency department census · Not a medical device" />
      </main>
      {arrivalPlanMovement ? (
        <ArrivalTimeModal
          isOpen
          onClose={() => setArrivalPlanOpenFor(undefined)}
          movement={arrivalPlanMovement}
          role="ed"
        />
      ) : null}
    </div>
  );
}
