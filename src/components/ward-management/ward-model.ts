import type { EligibilityGate } from "./ward-eligibility";
import type { Instant } from "@/components/ward-management/ward-clock";
// A TYPE-ONLY import, and it introduces no cycle: `ward-patients.ts` imports nothing at all.
import type { PatientId } from "@/components/ward-management/ward-patients";
// A TYPE-ONLY import, and it introduces no cycle: `ward-diagnosis.ts` imports nothing at all —
// see that module's own doc comment for why the vocabulary lives there rather than here or on
// `ward-admissions.ts`, where the fact it describes first gained a runtime writer.
import type { TentativeDiagnosisBlock } from "@/components/ward-management/ward-diagnosis";
/**
 * `WardFlowRole` now lives in its own module, `ward-flow-roles.ts` (Spec D15 restoration,
 * 2026-09-11). It used to be imported from `ward-flow-events.ts` — a TYPE-ONLY import, so it
 * created no runtime cycle even though `ward-flow-events.ts` imports many VALUE and type
 * declarations from this file — but `ward-flow-events.ts` also declares the bed-release event
 * types and imports `BedReleaseWaitingOn`, so that edge put the whole release model inside the
 * module graph `tests/ward-referral-matching.test.ts` (Spec D15) walks from matching's own entry
 * points, purely to reach one role type that has nothing to do with bed releases. Reused rather
 * than redeclared, for the same reason as before: `Addressee`'s own doc comment gives —
 * `WardFlowRole` is already exhaustive by design, and a second, hand-copied union here is exactly
 * the "two homes for one fact" shape this file's own comments (`referralState`,
 * `INBOX_CATEGORIES`) warn against elsewhere.
 */
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { LegalClock } from "@/components/ward-management/ward-legal-clock";
import type {
  BedPreparationNote,
  BedReleaseBlocker,
  GenderPlacementReason,
  LegalFormReceiptCorrectionReason,
  LegalStatusChangeReason,
  UrgencyChangeReason,
  UrgentMarkReason,
  OverrideReason,
  WithdrawalReason,
  WardRequestWithdrawalReason,
  WardIntakeConstraint,
} from "@/components/ward-management/ward-change-reasons";

/**
 * The health services, as a runtime array with the type derived from it — the same shape as
 * `COHORTS`, `SEXES`, `SEX_DESIGNATIONS`, `MOVEMENT_STAGES`, `DECLINE_REASONS`,
 * `BED_RELEASE_STATES` and `BED_RELEASE_WAITING_ON` below.
 *
 * WHY THIS CHANGED, 2026-08-29. It was a bare type union — the only multi-value union in this file
 * without a companion array — and that made a real hole rather than an inconsistency. The five
 * services were re-typed by hand in two more places (`wardServiceOrder` in `ward-derivations.ts`,
 * `columnServices` in `ward-management-network.tsx`), nothing checked those copies for
 * completeness, and `ward-management-network.tsx` tests membership through a `readonly string[]`
 * cast, so the compiler could not catch it either.
 *
 * The consequence, in the owner's own terms: he intends to replace this invented network with real
 * WA figures and to "build another hospital" later. A hospital in a SIXTH service would compile
 * clean and then be absent from the network map and the ED screen's unit table — no error, no
 * failing test, the service simply not there. This file's own `COHORTS` comment records the same
 * defect having happened once already with `Cohort`.
 *
 * A runtime array does not by itself close that. It makes the completeness of the other two lists
 * CHECKABLE, which `tests/ward-flow-service-coverage.test.ts` then checks.
 */
export const HEALTH_SERVICES = ["North Metro", "South Metro", "East Metro", "WACHS", "CAHS", "Private"] as const;
export type HealthService = (typeof HEALTH_SERVICES)[number];
/**
 * Widened for Phase 7 (spec "The front door"): a referral can arrive for a young person, and
 * without a `"Youth"` cohort every youth referral would fail the cohort gate in
 * `ward-eligibility.ts` against every unit in the network for a structural reason, not an
 * operational one. `ward-sites.ts` seeds exactly one Youth unit — see its own comment for why
 * that unit is a real, product-owner-supplied fact and not an invention.
 *
 * Fix round B (review finding I3): given a runtime members array, `COHORTS`, matching every
 * other 3+-value union in this file (`SEX_DESIGNATIONS`, `REFERRAL_SOURCES`, `REFERRAL_STATES`,
 * `REFERRAL_DECLINE_REASONS`, `MOVEMENT_STAGES`, `DECLINE_REASONS`, `BED_RELEASE_STATES`).
 * `Cohort` was the one union in this file with no such array, and a hand-maintained
 * `COHORT_OPTIONS: Cohort[]` picker in `ed-screen.tsx` silently omitted `"Youth"` as a result —
 * typed as `Cohort[]` rather than derived from this list, so widening the union could never make
 * the picker fail to compile. Named `COHORTS` (the type-derived plural, matching
 * `SexDesignation` → `SEX_DESIGNATIONS`) rather than `AGE_BANDS`, even though the `Referral`
 * field carrying it is `ageBand` — the array names the TYPE, like every neighbour above, not the
 * field. `ed-screen.tsx` now derives `COHORT_OPTIONS` from this array directly.
 */
export const COHORTS = ["Adult", "Older adult", "Youth"] as const;
export type Cohort = (typeof COHORTS)[number];
export type Security = "Open" | "Secure";

/**
 * Fix round C (Phase 7 Task 5, review finding I3 all over again): `Sex` and urgency were the
 * two remaining 2/3-value unions in this file with no runtime array of their own — see
 * `COHORTS`'s own doc comment above for the defect class this closes, and for why every other
 * 3+-value union here (`SEX_DESIGNATIONS`, `REFERRAL_SOURCES`, `REFERRAL_STATES`,
 * `REFERRAL_DECLINE_REASONS`, `MOVEMENT_STAGES`, `DECLINE_REASONS`, `BED_RELEASE_STATES`) already
 * carries one. `SEXES` and `URGENCY_LEVELS` below are what every Sex/urgency `<select>` in this
 * codebase (`ward-referral-drawer.tsx`, `ed-screen.tsx`, `shortlist-panel.tsx`) must now derive its
 * option list from, never a hand-written array — and so must any picker added later. (M11:
 * `referral-match.tsx` was listed here too and has no Sex or urgency picker at all; its only
 * `<select>` is the decline reason, correctly derived from `REFERRAL_DECLINE_REASONS`.) This is
 * the same fix Task 4 already applied to `COHORT_OPTIONS` in `ed-screen.tsx`, generalised to the
 * two unions it left behind.
 */
/**
 * THE CLOSED SET OF `Movement.blocker` VALUES THAT MEAN NOTHING IS HOLDING THE MOVEMENT UP.
 *
 * ⚠️ `Movement.blocker` — the free-prose one. NOT `BedRelease.blocker`, the `BedReleaseBlocker`
 * enum that shares the name. Nothing here applies to that field.
 *
 * **Why a closed set rather than a pattern, and this is a repair of a defect this file shipped
 * on 2026-09-01.** `hasActiveBlocker` (ward-priority.ts) used to recognise "nothing is blocking"
 * by matching the literal `"No blocker"` and a regex for `"None"` followed by a dash or colon —
 * both CASE-SENSITIVE. That was safe while the only writers were the fixture and the reducer,
 * because both wrote from a fixed vocabulary. `RECORD_MOVEMENT_BLOCKER` then let a person type
 * ANY non-blank prose, and the two halves stopped matching: a nurse clearing a blocker with
 * `"none — resolved"`, `"no blocker"`, `"Nothing outstanding"`, `"N/A"` or `"Cleared"` left the
 * movement scoring ten points as actively obstructed in `operationalScore`, and so sitting higher
 * in the queue than it should — silently, with nothing red anywhere.
 *
 * ⚠️ **THE COMPUTED KIND OF WRONG, NOT THE DISPLAYED KIND.** A wrong sentence is read by a person
 * who can disbelieve it; a wrong score is acted on by a system that cannot.
 *
 * **The remedy is not a wider pattern.** Chasing phrasings is unbounded and the next one is missed
 * too, and a case-insensitive `/^none/i` would swallow `"None of the secure units can take him"` —
 * a REAL blocker, pinned by `tests/ward-priority.test.ts` for exactly this reason. So clearing gets
 * its own representation instead (`CLEAR_MOVEMENT_BLOCKER`), and this list stays a closed set that
 * cannot grow by invention: the reducer's own sentinels, plus the two legacy values the
 * hand-authored fixture already carries.
 *
 * ⚠️ **A CONSEQUENCE, STATED RATHER THAN HIDDEN: TYPED PROSE IS ALWAYS AN OBSTRUCTION.** Somebody
 * who types `"Nothing outstanding"` into the blocker box still scores as blocked, because this set
 * does not interpret English and must not start. Two things make that acceptable rather than a
 * relocation of the same defect — the Clear control exists so nobody has to guess magic words, and
 * `RECORD_MOVEMENT_BLOCKER` refuses a value that differs from a member of this list ONLY by case,
 * naming the control instead. That refusal is exact-equality-ignoring-case against this closed set,
 * never a pattern, so it cannot reach `"None of the secure units can take him"`.
 */
export const BLOCKERS_MEANING_NOTHING_IS_BLOCKING = [
  /** Legacy, hand-authored: the generated fixture movements' own "nothing here" value. */
  "No blocker",
  /** Legacy, hand-authored AND written by the reducer at `PATIENT_COLLECTED`. */
  "None — in transit",
  /** Legacy, hand-authored AND written by the reducer at `PATIENT_ARRIVED`. */
  "None — handover complete",
  /** Written by the reducer at the two closures that are not an arrival. */
  "None — the movement did not proceed",
  /** Written by `CLEAR_MOVEMENT_BLOCKER` — a person saying the obstruction is gone. Distinct from
   *  "No blocker", which means nobody ever recorded one: an absence with its reason, the same
   *  distinction the two "None — …" values above exist to preserve. */
  "None — cleared",
] as const;

export type BlockerMeaningNothingIsBlocking = (typeof BLOCKERS_MEANING_NOTHING_IS_BLOCKING)[number];

export const SEXES = ["Female", "Male"] as const;
export type Sex = (typeof SEXES)[number];

/**
 * 🔴 OWNER RULING R7, 25 September 2026 (`docs/ward-flow/decisions.md`): a person's RECORDED sex,
 * Australian-standard style (ABS 2020): female, male, another term (which covers intersex people),
 * or not recorded. **"Non-binary" is not a sex** — it describes gender (`REFERRAL_GENDERS`).
 *
 * `SEXES` above stays the two-value BUCKET: what `Unit.sexMix` counts and what a ward's
 * `sexDesignation` names. A recorded sex outside it counts in neither bucket
 * (`mixSexOf`, `ward-eligibility.ts`). "Not recorded" is an explicit value here because sex has
 * always been a required field on a movement and a ward arm; absence never means it.
 */
export const RECORDED_SEXES = [...SEXES, "Another term", "Not recorded"] as const;
export type RecordedSex = (typeof RECORDED_SEXES)[number];

/** See `SEXES`'s own doc comment immediately above — the same fix, for urgency. */
export const URGENCY_LEVELS = [1, 2, 3] as const;
/** D-32: category recorded by the referring clinician, never inferred by this prototype. */
export const ATS_CATEGORIES = [1, 2, 3, 4, 5] as const;
export type AtsCategory = (typeof ATS_CATEGORIES)[number];

export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

export const ARRIVAL_MODES = ["mental_health_transport", "ambulance", "police", "hospital_transfer", "self"] as const;
export type ArrivalMode = (typeof ARRIVAL_MODES)[number];

export const ARRIVAL_MODE_LABELS: Record<ArrivalMode, string> = {
  mental_health_transport: "Mental Health Transport",
  ambulance: "Ambulance (St John)",
  police: "Police Escort",
  hospital_transfer: "Inter-Hospital Patient Transport",
  self: "Self / Family / Carer",
};

export type MovementArrivalDetails = {
  mode: ArrivalMode;
  modeOfArrival?: string;
  trackingNumber?: string;
  estimatedArrivalAt: Instant;
  recordedAt: Instant;
  recordedBy: WardFlowRole;
};

export type MovementUploadedForm = {
  id: string;
  formName: string;
  formType?: string;
  fileName: string;
  sizeBytes?: number;
  uploadedAt: Instant;
  uploadedBy: WardFlowRole;
  uploadedByRole?: WardFlowRole;
};

/**
 * Phase 7 (spec "The front door"): the bed-facing counterpart of `Sex`, and a CONSTRAINT on who
 * may occupy a bed, never a value to compare a referral's `sex` against for equality.
 * `"Undesignated"` is the default and — by construction of the seed fixture in `ward-sites.ts` —
 * the clear majority: an undesignated bed accepts a referral of either sex. `"Female only"` and
 * `"Male only"` each narrow that acceptance to one sex. A matching rule of the shape
 * `bed.sexDesignation === referral.sex` is wrong for the same reason `unit.security === "Secure"`
 * would be wrong for `unit.authorised` — it reads as a plausible equality check while actually
 * excluding every undesignated bed, which is most of the network. The seed fixture deliberately
 * keeps most units undesignated (never all of them, and never uniform) so that exact mistake
 * cannot pass every test.
 */
export const SEX_DESIGNATIONS = ["Undesignated", "Female only", "Male only"] as const;
export type SexDesignation = (typeof SEX_DESIGNATIONS)[number];

/**
 * T10 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`, item 8, owner answer 8,
 * 17 September 2026): **gender is recorded AT REFERRAL, and it is what decides the incoming
 * patient's own designation check — never `Sex`, and never `Patient.gender`.**
 *
 * (R7, 25 September 2026: now FOUR values, and `Patient.gender` holds the same four — see the
 * ruling block below this list. The history that follows is kept as written.)
 *
 * ⚠️ **THREE VALUES, NOT TWO — DELIBERATELY WIDER THAN `Patient.gender` (`GENDERS`,
 * `ward-patients.ts`).** That field stays a two-value fact about a PERSON, unchanged by this
 * task. This is a fact about a REFERRAL/MOVEMENT — what the referring clinician recorded at
 * intake — and `"Non-binary"` must be a real, distinct answer there so item 9 (non-binary
 * placement) has something to check for, rather than being indistinguishable from "not yet
 * recorded". Absent means exactly that: not yet recorded, the same convention `Movement.sex`'s
 * neighbours already hold to.
 *
 * ⚠️ **NEVER READ `Movement.sex` / the ward arm's `sex` AS A FALLBACK.** That is the exact defect
 * this field exists to close: owner note 1, 2026-09-17, warns against merging separate clocks and
 * fields that only happen to look alike, and `genderEligibility` below (the still-unwired,
 * `Patient.gender`-based gate closing P1 `#BAY1TY`) carries the identical warning about `sex`
 * silently standing in for `gender`. A `gender ?? (sex as ReferralGender)` shortcut here would
 * reintroduce the same defect on a different field.
 */
export const REFERRAL_GENDERS = ["Female", "Male", "Non-binary", "Different term"] as const;
export type ReferralGender = (typeof REFERRAL_GENDERS)[number];

/**
 * 🔴 OWNER RULING R7, 25 September 2026 (`docs/ward-flow/decisions.md`): gender identity is
 * Female, Male, Non-binary, Different term, or not recorded (the field absent). Beds are allocated
 * by gender identity. **If either gender or recorded sex is anything other than female or male —
 * including not recorded — a coordinator must review and record a short reason
 * (`GenderPlacement`) before allocation, on every ward, mixed or single-sex.** A female or male
 * gender that does not match a single-sex ward still refuses; no review changes that.
 *
 * The one predicate every engine path and screen reads, so none can drift from another.
 */
export function genderReviewNeeded(gender: ReferralGender | undefined, sex: RecordedSex): boolean {
  const binaryGender = gender === "Female" || gender === "Male";
  const binarySex = sex === "Female" || sex === "Male";
  return !(binaryGender && binarySex);
}

export const MOVEMENT_STAGES = [
  "placement_requested",
  "destination_review",
  "accepted_awaiting_bed",
  "pulled",
  "handover_ready",
  "moving",
  "arrived",
] as const;
export type MovementStage = (typeof MOVEMENT_STAGES)[number];

export const DECLINE_REASONS = [
  "no_bed",
  "sex_mix",
  "specialling_unavailable",
  "acuity_mix",
  "capability_mismatch",
  "bed_pulled_for_earlier_referral",
  "out_of_catchment",
] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

/**
 * `STEP_BACK_STAGE` and `WITHDRAW_ACCEPTANCE` (Task 5, ward-flow movement step-track plan,
 * 2026-09-04). Chosen, never typed — the same discipline `DECLINE_REASONS` above already has, and
 * placed alongside it in this file rather than in `ward-change-reasons.ts` (where every other
 * fixed reason list lives) because this build's assigned scope is a fixed, narrow set of files
 * that does not include `ward-change-reasons.ts`. `DECLINE_REASONS` is the existing precedent for
 * a reason list living in this file instead — chosen and content-free either way.
 *
 * ⚠️ **`WITHDRAW_ACCEPTANCE` reuses this list rather than a second one of its own** — owner ruling
 * 1 of 2026-09-04's five rulings, accepted as proposed: a second vocabulary for one concept is
 * exactly the "two places for one fact" this project's standing rule forbids, and all four reasons
 * read naturally for a withdrawal too.
 *
 * ⚠️ **THE WARD READS THESE; THE STEP-BACK READER DOES NOT** (same ruling, recorded rather than
 * acted on). `STEP_BACK_STAGE` is a coordinator's own record correction, seen only on the
 * coordinator's screen. `WITHDRAW_ACCEPTANCE` tells a ward its earlier "yes" no longer holds, and
 * if a ward-facing rendering of these reasons is ever built, the wording is revisited then — do
 * not pre-empt it now by writing ward-facing prose into a coordinator-facing label.
 *
 * ✅ **THE LABEL MAP NOW EXISTS — `stepBackReasonLabels` DIRECTLY BELOW.** The note that stood here
 * said to add the four labels to `changeReasonLabels` (`ward-change-reasons.ts`) before wiring any
 * picker. **That home turned out to be unreachable: `ward-model.ts` imports `ward-change-reasons.ts`,
 * so the reverse import needed to key a map by `StepBackReason` would be a cycle.** The precedent it
 * cites settles where they go instead — `REFERRAL_DECLINE_REASONS` also lives in this file, and its
 * `DECLINE_REASON_LABELS` lives in `ward-referrals.ts`, not in `ward-change-reasons.ts` either. So a
 * label map beside its own list is the established shape, and adjacency is the strongest form of
 * "one place for one fact".
 *
 * **The instruction that note gave about the wording is followed exactly, not re-decided:** the
 * label for `the_patient_situation_changed` is `"The situation changed"`, free of the token
 * "patient" — which `tests/ward-change-reasons.test.ts` forbids in any reason LABEL, though not in
 * a reason VALUE (`patient_no_longer_coming` → "No longer coming" is the same move). That test now
 * scans these four labels too, so they are held to the same content-free bar as every other list.
 */
export const STEP_BACK_REASONS = [
  "recorded_in_error",
  "the_decision_changed",
  "the_patient_situation_changed",
  "the_bed_was_lost",
] as const;
export type StepBackReason = (typeof STEP_BACK_REASONS)[number];

/**
 * What a coordinator reads for each step-back reason. **Coordinator-facing only.**
 *
 * ⚠️ **THE WARD READS THESE REASONS AND THE STEP-BACK READER DOES NOT** — the ruling recorded in
 * the block above. `STEP_BACK_STAGE` is the coordinator's own record correction, seen only on the
 * coordinator's screen; `WITHDRAW_ACCEPTANCE` tells a ward its earlier "yes" no longer holds. **If
 * a ward-facing rendering of these is ever built, its wording is decided then and is not
 * necessarily this.** These four are deliberately written for the person choosing them, not for the
 * ward receiving the consequence, exactly as that ruling asks.
 *
 * Total `Record`, so a fifth reason cannot be added to the list above without the compiler
 * demanding its label here.
 */
export const stepBackReasonLabels: Record<StepBackReason, string> = {
  recorded_in_error: "Recorded in error",
  the_decision_changed: "The decision changed",
  // ⚠️ NOT "the patient's situation changed". The VALUE carries the token because the product brief
  // fixed it; the LABEL is the part this file controls, and the content-free guard scans labels.
  the_patient_situation_changed: "The situation changed",
  the_bed_was_lost: "The bed was lost",
};

/** Referring to more than three units at once spams wards and erodes trust between services. */
export const PARALLEL_REFERRAL_CAP = 3;

/**
 * The slider bounds for `WardConfiguration.parallelReferralCap` on the settings screen (Task
 * 7-wiring, 2026-09-16). The maximum is `PARALLEL_REFERRAL_CAP` itself, not a second, independently
 * chosen ceiling — a coordinator can only ever turn the cap DOWN from the product's own default,
 * never past it, so this range can never license a value the owner has not already accepted.
 */
export const PARALLEL_REFERRAL_CAP_RANGE = { min: 1, max: PARALLEL_REFERRAL_CAP, step: 1 } as const;

/**
 * How long a `PULL_PATIENT` hold on an accepting unit's bed lasts, in minutes, before it expires.
 *
 * Owner answer 35, 17 September 2026: default 4 hours. This replaces the carried-over literal
 * (`event.now + 60`) that had sat directly in the reducer since before this constant existed,
 * with no clinician or product-owner attribution behind it.
 */
export const PULL_HOLD_MINUTES = 240;

/**
 * The slider bounds for `WardConfiguration.pullHoldMinutes` on the settings screen. Not a
 * statutory or clinical range — a coordinator-usable band around the carried-over default above.
 */
export const PULL_HOLD_RANGE_MINUTES = { min: 30, max: 240, step: 15 } as const;

/**
 * The default morning discharge and census rollup time, in minutes from midnight.
 * 09:30 AM = 9 * 60 + 30 = 570 minutes.
 *
 * Josh's own ward-practice default (owner answer, 25 September 2026, decisions.md D-17): not a
 * Mental Health Act figure or any legal time limit. Named `_TIME_` rather than `_DEADLINE_` so the
 * legal-figure guard's model-shape rule is not asked to read an operational time as statutory.
 */
export const MORNING_ROLLUP_TIME_MINUTES = 570;

/**
 * The slider bounds for `WardConfiguration.morningRollupDeadlineMinutes` on the settings screen,
 * in 15-minute steps from 08:00 AM (480 min) to 11:00 AM (660 min).
 */
export const MORNING_ROLLUP_TIME_RANGE_MINUTES = { min: 480, max: 660, step: 15 } as const;

export type LegalStatus =
  "Voluntary" | "Referred for psychiatric examination" | "Detained awaiting examination" | "Involuntary inpatient";

/**
 * The legal clock and the ED clock are different clocks (spec "Model changes this phase
 * requires", `Movement.formedAt`). `dueAt`, when present, is the legal clock — never computed by
 * this prototype, always **typed by the clinician from the paper form in front of them.**
 *
 * 🔴 **CORRECTED 2026-09-17, T2 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`),
 * owner answer 1 — EVERYTHING BELOW ABOUT WHICH FORMS MAY CARRY A `dueAt` IS NOW FALSE.** Struck
 * in place rather than deleted, because the reading that made it true is what a reader will
 * otherwise re-derive. Until this date, neither a Form 1A nor a Form 3B could carry a `dueAt` at
 * all — Task 6A found that a 3B's post-examination clock only ever counted elapsed ED time
 * ("counting up," the clinician's own words, not a legal countdown), and a 1A's `dueAt` was
 * deleted on 2026-08-23 after it turned out to be an unverified figure an earlier agent invented
 * from its own recollection of the Act rather than from the clinician. Both readings were correct
 * for the code as it stood.
 *
 * ✅ **What changed, and why it is not a return of the deleted fabrication.** The 2026-08-23
 * instruction was "leave the legal part and just start a clock once the patient arrives to ED" —
 * it forbade this prototype from COMPUTING a statutory duration, never from recording one a human
 * supplies. Owner answer 1, 2026-09-17: *"the timer that starts when a patient arrives is separate
 * to forms. One records time in ED and the other is a forms category."* Put together with the
 * rest of item 1, his instruction is that **the clinician types the expiry written on whichever
 * form they are holding — 1A, 3B, 3D, 4A or 4C alike — and this model records exactly that typed
 * value and nothing else.** No `kind`, code or classification gates which forms may carry one any
 * longer; `RAISE_REFERRAL`'s capture and the `RECORD_LEGAL_FORM_EXPIRY` event both write whatever
 * the clinician typed, for any selected form.
 *
 * The field stays optional (never required), because a clinician who has not yet seen the form —
 * or a form that carries no expiry at all — must be able to leave it unset honestly. Never
 * substitute a fallback number for an absent `dueAt`, never let an absent `dueAt` read as "clear"
 * or "not yet due" — render its absence explicitly — and never COMPUTE a `dueAt` from a duration,
 * a form code, or an assistant's recollection of the Mental Health Act. A typed value traced to
 * the clinician who typed it (`legalFormExpiryHistory`, below) is the only legitimate source.
 */
export type LegalForm = {
  code: string;
  /** Setting recorded from the current paper, never inferred from geography. */
  region?: "metro" | "country";
  /**
   * **There is deliberately no `label` field.** Ward Flow does not hold form titles; the Chief
   * Psychiatrist's register does, and `legalFormName` in `ward-legal-forms.ts` resolves one from
   * `code` at render time. Removed on 2026-08-24, when the product owner approved adopting the
   * official titles — a stored label is how this model came to render "Inpatient treatment
   * order" (the title of a Form **6A**) on every Form 3B. A code the register does not list has
   * no title and is rendered as the bare code. Do not reintroduce this field.
   *
   * What kind of instrument the form is. Optional: this model holds no classification for a
   * Form 3D, and guessing one would be a claim about the Mental Health Act this prototype is
   * not entitled to make. It is deliberately NOT taken from the register's `category`, which the
   * product owner did not approve adopting.
   *
   * 🔴 **CORRECTED 2026-09-17, T2 — THIS FIELD NO LONGER DECIDES WHICH FORMS CAN CARRY A
   * DEADLINE.** Until this date `ward-flow-reducer.ts`'s `capturedDueAt` kept a submitted
   * `legalFormDueAt` only for `kind === "transport"` or `"transfer"`, so an examination or
   * detention form had the wrong `kind` and fell through to `undefined`. Owner answer 1,
   * 2026-09-17 (`docs/ward-flow/owner-answers-2026-09-17.md`) is that the clinician types the
   * expiry written on whichever form they hold, of any code — so capture no longer reads `kind`
   * at all. This field still records what KIND of instrument the form is, for whatever else reads
   * it; it is simply no longer the gate on `dueAt`.
   *
   * ⚠️ **AND `kind === undefined` IS NOT "STRUCTURALLY CLOCKLESS" — IT NEVER WAS, AND IS EVEN LESS
   * SO NOW.** A Form 3D carries no classification here, and this model still makes no claim about
   * what the Mental Health Act requires of one — but it may carry a typed `dueAt` exactly as any
   * other selectable form may, the moment a clinician types the expiry written on it.
   *
   * ⚠️ **This paragraph replaces an earlier one asserting that nothing displayed this field and
   * that it was only carried. That was true when written and is now false in both halves.** The
   * old wording is deliberately not quoted here — a comment that spells the claim it removes puts
   * that claim back in the file, so a search for it finds this line and cannot tell a correction
   * from a survival. Do not restore it for clarity.
   */
  kind?: "examination" | "detention" | "transport" | "transfer";
  dueAt?: Instant;
  /**
   * 🔴 **DELETED 2026-09-17, T4 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`).**
   * This field used to duplicate `Movement.legalFormReceivedAt` (`RECORD_LEGAL_FORM_RECEIVED`
   * wrote both, always to the same instant) — a second copy of one fact with nothing to keep the
   * two in step, and exactly the shape T4's own correction feature needs there to be only one of.
   * The movement-level field is the sole record now; see its own doc comment for what corrects it.
   */
  /**
   * Owner ruling 2026-09-25 (Josh, "both yes"): a Form 5B CONTINUES the Form 5A community treatment
   * order rather than replacing it. `RECORD_LEGAL_FORM_CONTINUATION` with a 5B on a movement whose
   * current form is 5A keeps the 5A record (its code, and the movement's `formedAt`) and records the
   * continuation here; `dueAt` becomes the 5B's typed end (or unknown if none was typed) while the
   * 5A's own typed end is kept as `continuedBy.continuedFormDueAt` (and in `legalFormExpiryHistory`
   * when it was recorded there). Only typed facts: nothing is computed.
   */
  continuedBy?: {
    code: string;
    startedAt: Instant;
    recordedAt: Instant;
    by: WardFlowRole;
    continuedFormDueAt?: Instant;
  };
};

/**
 * The emergency department's access target, in minutes. This is a real, named figure from spec
 * §7 — but it is a **departmental performance measure**, counted UP from `Movement.openedAt`
 * (how long the patient has been in the department), because that is the number a department is
 * judged on and mental health patients are its largest breachers. It is **not** a Mental Health
 * Act deadline: it must never be attached to a `LegalForm`, never gain a `dueAt`, and never feed
 * a legal-breach count or an eligibility gate. Task 6A only introduces and pins this constant
 * (see `tests/ward-model.test.ts`); Task 11's emergency department screen is what actually
 * renders it against `openedAt`.
 *
 * The spec originally named this figure four hours (240 minutes). The product owner — the
 * spec's own author — superseded that figure for this prototype on 2026-08-22, in response to a
 * direct clinical question, and set it to 24 hours (1440 minutes) instead. Nothing about *how*
 * this figure is counted, rendered or safeguarded changed: it is still counted up from
 * `openedAt`, never a deadline, and still barred from every `LegalForm`/`dueAt`/breach/
 * eligibility surface listed above.
 */
export const ED_ACCESS_TARGET_MINUTES = 1440;

/**
 * The slider bounds for `WardConfiguration.edAccessTargetMinutes` on the settings screen, in
 * 2-hour (120-minute) steps from 12 hours to 36 hours. Not a second sourced figure: the range is
 * this prototype's own adjustment band around the owner's 24-hour default above, chosen so the
 * default always falls inside it.
 */
export const ED_ACCESS_TARGET_RANGE_MINUTES = { min: 720, max: 2160, step: 120 } as const;

/**
 * How long a trip to a general hospital must be EXPECTED to last before the psychiatric bed is
 * given up, in hours. Ruling `FD-19` (owner, 2026-08-30): *a ward→ED-medical trip frees the bed
 * ONLY IF the stay is expected to exceed 48 hours, and that is overridable.* Below it, the bed
 * stays theirs and the person reads as on overnight leave.
 *
 * 🔴 **THIS IS A BED-MANAGEMENT THRESHOLD AND IT IS NOT A STATUTORY PERIOD. It must never be
 * conflated with, sited beside, or reused as one.** It decides one thing only: whether a bed
 * stays assigned to somebody who is temporarily elsewhere. It is barred from every surface
 * `ED_ACCESS_TARGET_MINUTES` above is barred from — never attached to a `LegalForm`, never given
 * a `dueAt`, never feeding a legal-breach count or an eligibility gate.
 *
 * ⚠️ **WHY THE PROVENANCE IS THE POINT AND NOT A FORMALITY.** This repository's standing refusal
 * is against inventing figures from the Mental Health Act, after three separate agents wrote
 * three different invented statutory durations into this directory (see
 * `tests/ward-legal-figure-guard.test.ts`). **48 is permitted precisely because the owner
 * supplied it** — it is his own operational figure, quoted from him, invented by nobody. A bare
 * `48` sitting in ward source near anything legal is exactly what a future reader would
 * reasonably assume came from the Act, so the figure is named, sourced, and pinned rather than
 * written as a literal at the point of use.
 *
 * Expressed in HOURS because the owner expressed it in hours; converting it to minutes for
 * arithmetic convenience would put a second, unsourced number beside the sourced one.
 */
export const ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS = 24;

/**
 * 🔴 **DELETED 2026-09-17, T2 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`).**
 * `FORM_1A_VALIDITY_HOURS`, `FORM_1A_EXAMINATION_WINDOW_HOURS` and `FORM_3D_DETENTION_WINDOW_HOURS`
 * stood here from 2026-09-16 (Ruling 1) until this date, each a computed statutory duration for a
 * Form 1A or 3D. The owner's ruling of 2026-09-17, put to him again after Ruling 1, is narrower
 * than the figure it approved: **this prototype works out no legal time limits of its own.** The
 * clinician types the expiry written on the form they are holding, and this model records exactly
 * that typed value — never a duration computed from a code, and never one of these three hours
 * figures added to a start time. Left here as a struck record rather than removed silently,
 * because a reader who has seen "Ruling 1" cited elsewhere in this codebase needs to find why it
 * no longer appears as code: `tests/ward-legal-figure-guard.test.ts` is the guard that made
 * reintroducing them by any name, in any exported declaration in this file, fail.
 */

/**
 * A capacity number is meaningless without where it came from and when.
 * `feed` knows which beds are physically empty; `ward` knows which are actually allocatable
 * once staffing, sex mix, acuity mix, single rooms and holds are accounted for.
 */
export type CapacitySource = "feed" | "ward";

export type CapacityFigure = {
  value: number;
  source: CapacitySource;
  confirmedAt: Instant;
  staleAfterMinutes: number;
  revision?: number;
};

/**
 * `referenceEdId` names which real WA emergency department this one is, as a
 * `reference/ward-reference-registry.ts` id. It is what lets a measured road distance be looked up
 * for this department. Names and routes only; the register carries no numbers, and no figure may
 * ever sit on this record — `statistics-claims-register.ts` holds a claim that says so and quotes
 * this declaration verbatim.
 *
 * ⚠️ KEEP THE BODY ON ONE FIELD PER LINE WITH NO COMMENT INSIDE IT. The claims register cites the
 * normalised declaration as a single string; a comment between the fields lands inside that string
 * and the citation stops matching. Explanations go here, above the type.
 */
export type EmergencyDepartment = {
  id: string;
  siteCode: string;
  referenceEdId?: string;
  name: string;
};

export type Unit = {
  id: string;
  siteCode: string;
  /**
   * Which real Western Australian ward this demo unit is NAMED AFTER, as an id in
   * `reference/ward-reference-registry.ts`. Undefined means the reference pack records no ward of
   * this cohort at this hospital, and the invented name stays -- an honest gap, never a guess.
   *
   * 🔴 THE NAME IS ALL IT BORROWS. Every number on this unit -- `beds`, `empty`, `allocatable`,
   * `sexMix`, the lot -- is still invented, and the registry deliberately carries no numeric field
   * for one to be copied from. A real ward's published bed count is NOT ratified for operational
   * use and must never reach this fixture. See `ward-sites.ts`'s own header.
   */
  referenceUnitId?: string;
  name: string;
  cohort: Cohort;
  /**
   * Authorised under the Mental Health Act 2014 to receive involuntary admissions. This IS the
   * bed's legal-status dimension — an authorised bed accepts BOTH voluntary and involuntary
   * admissions (it is a capability, not a value to equality-match), a non-authorised bed accepts
   * voluntary only. There is deliberately no separate `legalStatus` field on `Unit` for this same
   * fact: two fields for one fact is how a screen ends up giving two answers.
   */
  authorised: boolean;
  /**
   * HOW MANY OF THIS WARD'S BEDS ARE DESIGNATED LOCKED. Replaced `security: Security` on
   * 2026-09-04 by owner ruling: "Ward 7 in Bentley is a locked/Open ward so some wards are a
   * combination with a number of designated locked beds and open beds." `(OWNER, 2026-09-04)`
   *
   * ⚠️ A whole-ward flag could not express that, and the failure was not cosmetic: the old
   * eligibility gate read `movement.security === "Open" || unit.security === "Secure"`, so a
   * mixed ward recorded as `Open` hid every one of its locked beds from every patient who
   * needed one.
   *
   * ⚠️ **OPEN BEDS ARE DERIVED, NEVER STORED** — `openBeds(unit)` in `ward-bed-designation.ts`
   * returns `beds - lockedBeds`. Storing both is two sources for one fact, which the owner
   * ruled against by name in the same decision. A wholly-open ward carries `0` here.
   *
   * ⚠️ **THIS IS A PROPERTY OF THE WARD, NOT OF A PATIENT.** An involuntary patient is a
   * property of the person (`LegalStatus`); a voluntary patient may be nursed on a locked
   * ward. Never rename this to anything containing "involuntary".
   */
  lockedBeds: number;
  beds: number;
  /** Physically empty beds, per the feed. */
  empty: CapacityFigure;
  /** Beds the ward says it can actually allocate. Never greater than `empty` in practice. */
  allocatable: CapacityFigure;
  /**
   * HOW MANY OF THE `allocatable` BEDS ARE LOCKED ONES. The open half is derived
   * (`openBedsFree` in `ward-bed-designation.ts`), for the same one-source reason as
   * `lockedBeds` above.
   *
   * ⚠️ Splits the ALLOCATABLE figure, not the `empty` one. `allocatable` is what the ward says
   * it can actually fill; `empty` is what the feed believes is physically vacant. Every
   * eligibility gate has always asked about allocatable beds, so the split belongs there.
   * (Plan author's reasoning, 2026-09-04 — not an owner ruling.)
   */
  allocatableLocked: number;
  /**
   * ⚠️ **AUTHORED AND READ BY NOTHING.** Every "Held" figure any screen shows is DERIVED —
   * `unitCapacity` computes it as `empty.value - min(allocatable.value, empty.value)` and never
   * consults this field. Measured across src, tests and scripts: zero reads.
   *
   * **Which means typing a real held-bed count here changes no number anywhere**, and there is no
   * symptom to notice — not a wrong figure, no figure. See the warning at the top of
   * `ward-sites.ts`, which is where somebody replacing invented values actually is when it matters.
   */
  held: number;
  blocked: number;
  /** Current occupants by sex, which is what constrains who the next admission can be. */
  sexMix: Record<Sex, number>;
  /** How many 1:1 observation patients this unit can staff beyond its current load. */
  speciallingCapacity: number;
  /**
   * How many HIGH-ACUITY places this unit is staffed to hold at once — the ward's authored total.
   *
   * ⚠️ **AUTHORED, AND NEVER DECREMENTED AS PLACES FILL** — exactly like `speciallingCapacity`
   * above, and for the same reason it is worth saying twice: reading this figure alone can only
   * answer whether a ward has ANY high-acuity capacity, never whether it has any LEFT. A ward
   * authored for 2 with both in use still reads `2` here. **`remainingHighAcuityCapacity(unit,
   * admissions)` in `ward-admissions.ts` is the only thing that knows what is left**, because it is
   * the only one given the admissions.
   *
   * The specialling version of this exact field printed "N slots available" on a screen, the
   * reducer then refused the placement, and the screen had invited the placement the engine
   * rejects. **Do not print a subtraction derived from this field.**
   */
  highAcuityCapacity: number;
  /** Actual arrivals recorded while the physical-empty observation was zero.
   * These are unresolved observation conflicts, not a derived physical overflow census.
   * Retained until the corresponding stay leaves; never add them to the bed partition. */
  arrivalCapacityConflicts?: { movementId: string; admissionId?: string; at: Instant }[];
  /** A held reservation was actually released after a newer offered observation already
   * reported its physical/designated ceiling. The observation remains bounded; this records
   * the disagreement instead of inventing capacity or refusing cancellation. Cleared only by
   * a subsequent ward capacity confirmation. Never changes the physical-empty bed partition. */
  reservationReleaseCapacityConflicts?: {
    movementId: string;
    admissionId?: string;
    at: Instant;
    allocatableBefore: number;
    allocatableLockedBefore: number;
    lockedBedReleased: boolean;
  }[];
  /** Who this bed may hold, as a CONSTRAINT — see `SexDesignation`'s own doc comment. Never
   *  compared to a referral's `sex` by equality; `"Undesignated"` accepts either sex. */
  sexDesignation: SexDesignation;
  /**
   * A forensic WARD — independent of `security`, see the note on `security` above.
   *
   * 🔴 **THIS COMMENT SAID "a forensic bed" AND THAT SEEDED FIVE FALSE STRINGS ON TWO SCREENS**
   * (D-30, 2026-09-11). The flag sits on `Unit`, which is a ward: Broome's is a whole-ward flag
   * covering six beds, and `hub-screen.tsx`'s own governance comment had already said so while
   * the badge two hundred lines above it still read "Forensic bed". A coordinator told a ward is
   * "a forensic bed and is never offered" hears that ONE bed is excluded; all six are.
   *
   * ⚠️ **THE WORD IS WARD WHEREVER IT IS RENDERED. Never sweep this word mechanically:**
   * `coordinator/shortlist-panel.tsx` maps `forensic` to "Forensic history", which is a fact
   * about a PATIENT, and a find-and-replace turns it into a claim about a ward. Where space is
   * tight, `referral-match.tsx` renders the bare word "Forensic" — no noun, so no scope claim,
   * so it cannot be wrong in either direction. That is the pattern to copy.
   *
   * ⚠️ **EXPLANATORY PROSE ELSEWHERE STILL SAYS "forensic bed" IN ABOUT TWENTY COMMENTS AND TEST
   * TITLES, DELIBERATELY UNTOUCHED** — they sit in four lanes' files and rewriting them would be
   * a cross-lane sweep of exactly the kind this note forbids. **This line is the authority; that
   * prose is stale, not competing.**
   */
  forensic: boolean;
  /**
   * Infection control: when true, shared bays are hidden from offer — only single rooms remain
   * candidacy. Staffing, high acuity, and cleaning stay banners only; this one changes which beds
   * can be offered.
   */
  infectionNeedsSingleRoom?: boolean;
  /**
   * Bay ids currently closed. A closed bay is removed from offer; it is not a soft banner.
   */
  closedBayIds?: readonly string[];
  /**
   * Owner Answer 18 (second round, 2026-09-17): fixed-list reasons the ward has currently chosen
   * as limiting who it can accept right now, from `WARD_INTAKE_CONSTRAINTS`. Chosen, never typed —
   * replaces the ward screen's old free-text box, which the persistence default-deny treated as
   * typed text. A ward may choose several, or none at all: an empty array means nothing is
   * currently limiting intake, and is a recorded answer in its own right, not "not yet answered".
   *
   * Optional rather than required so the many existing `Unit` fixtures across the test suite (none
   * of which this task's scope touches) do not all need a new field added under this session's
   * timebox — `undefined` and `[]` are read identically everywhere this is displayed: "nothing
   * limiting intake is recorded".
   */
  intakeConstraints?: readonly WardIntakeConstraint[];
  homeRegion?: HomeRegion;
};

export type Site = {
  code: string;
  /** Which real WA hospital this site is named after, as a `reference/ward-reference-registry.ts`
   *  id. Undefined where the pack records no such facility. Names only; see `Unit.referenceUnitId`. */
  referenceSiteId?: string;
  name: string;
  service: HealthService;
  emergencyDepartment?: EmergencyDepartment;
  units: Unit[];
};

/**
 * A unit's refusal of a movement: which unit, when, and a reason from `DECLINE_REASONS`.
 *
 * **THERE IS NO `note` FIELD, and its absence is the point** (owner ruling PD-6, 2026-08-30). It
 * held free text written about a named individual, sitting immediately beside a controlled
 * vocabulary — and a controlled vocabulary with an escape hatch next to it is not a controlled
 * vocabulary. Every reason a decline can give is now a value from a list somebody chose
 * deliberately, which is what makes `DECLINE_REASONS`' own privacy discipline real rather than a
 * naming convention.
 *
 * If a reason cannot be expressed, the answer is a new member of `DECLINE_REASONS`, decided and
 * recorded — never a text field restored here. `tests/ward-model.test.ts` pins this structurally,
 * against the real seeded declines, so it cannot return quietly.
 */
export type Decline = {
  unitId: string;
  at: Instant;
  reason: DeclineReason;
};

/**
 * A COORDINATOR OVERRIDE, kept rather than shown and discarded.
 *
 * Owner decision OD-3: the reason was collected in a `<textarea>`, held in the shortlist panel's
 * own `useState`, and thrown away the moment another patient was selected — while the governance
 * page stated that override reasons are recorded. **A page making a false claim about what it
 * keeps.** Replacing the box with a fixed list alone would not have fixed that: it would have
 * swapped free text that goes nowhere for five reasons that go nowhere, and the row would read as
 * done.
 *
 * ⚠️ **THIS RECORD IS AN ACCOUNTABILITY RECORD, NOT AN AUDIT TRAIL, AND THE TWO STORE IDENTICAL
 * DATA.** The owner's requirement is that it is **visible to the party overridden** — the unit
 * referred to despite its own gate failing. That difference is a READ PERMISSION, not a field, so
 * a reviewer reading this type sees nothing missing either way. `overridesAgainstUnit`
 * (`ward-derivations.ts`) is the ward-facing read, and `tests/ward-override-register.test.ts`
 * is the boundary that goes red — because an override log only its author can see is a trail, and
 * the whole point of the decision was that it is not one.
 */
export type Override = {
  /** When the override was made. */
  at: Instant;
  /** A ROLE, never a person — the same discipline as `decidedBy` and `StatusChange.by`. */
  by: string;
  /** From `OVERRIDE_REASONS`, never free text, and never an "other, please specify" (WB-DB-16). */
  reason: OverrideReason;
  /**
   * The units referred to despite a failing gate — THE PARTIES OVERRIDDEN. This is the field the
   * ward-facing read is keyed on, which is why it is a list of ids and not a count: a number could
   * not answer "was I one of them".
   */
  unitIds: string[];
  /**
   * Item 10 (owner answers, 17 September 2026): a high-acuity staffing override needs a reason AND
   * a "Nurse unit manager consulted" tick — two separate facts, never one standing in for the
   * other. `true` when the ward or coordinator ticked it; absent means not applicable (the override
   * did not answer the high-acuity gate) or not ticked. Never `false` — the same "absent, not
   * false" discipline every other boolean-shaped optional field in this file already uses, so a
   * reader cannot mistake "not this kind of override" for "ticked no".
   */
  numConsulted?: true;
  /**
   * Which staffing gate this override answered, when it answered a specific named one rather than
   * an ordinary eligibility mismatch. Includes the precise suitability or resource gate answered at pull; absent identifies older
   * placement overrides recorded before gate-specific facts were available.
   */
  gate?: EligibilityGate | "high_acuity_staffing" | "specialling_staffing" | "locked_bed_capacity";
};

/**
 * T12 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`, item 9, owner answer 9,
 * 17 September 2026): *"Non-binary patient: coordinator places with a recorded reason after
 * checking with the ward, preferring a single room."*
 *
 * ⚠️ **NOT AN `Override`, DELIBERATELY A SEPARATE TYPE.** `Override` records a JUDGEMENT GATE that
 * FAILED and a reason bought past it — `SUITABILITY_GATES`' own shape. A non-binary placement can
 * be genuinely eligible at an Undesignated ward (`gender_designation` passes trivially there), so
 * there is no failing gate here for a reason to buy past. This is a PROCEDURAL requirement —
 * somebody with the authority to speak for the ward confirmed it — independent of whether any
 * gate passed or failed, which is why it is its own accountability record rather than a variant
 * of `Override`.
 *
 * `unitIds`, not one `unitId`: `REFER_TO_UNITS` refers to several wards in one act (FD-21), and one
 * recorded check can cover all of them at once, the same shape `Override.unitIds` already holds to
 * on the same event.
 *
 * `by` is a ROLE, never a person — see `Override.by`'s own doc comment for why. `reason` is chosen
 * from `GENDER_PLACEMENT_REASONS`, never free text — see that list's own placeholder warning.
 *
 * **Coordinator role only, checked at the point this is written** (`REFER_TO_UNITS`,
 * `ACCEPT_REFERRAL`) — a ward or ED role supplying both a reason and the ward-checked tick is
 * refused outright, never merely recorded without effect. `ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT`
 * never write one; they only refuse when no existing record on the movement names the unit they
 * are about to commit to.
 *
 * ⚠️ **`wardChecked: true`, ADDED BY WARD LEAD'S OPUS REVIEW OF T12, 17 September 2026.** The
 * coordinator's "checked with the ward" tick used to live only in the REASON TEXT — a session's
 * placeholder wording leaned on a "Checked with the ward;" prefix to say so, which made the tick a
 * fact smuggled inside a free-choice sentence rather than its own field. This field is the tick
 * itself, stored the way `Override.numConsulted` already stores its own tick: `true` when
 * recorded, and this type can never be constructed without it (never `false` — the same
 * "absent/true, never false" discipline `numConsulted` holds to; there is no absent case here
 * because this type is only ever constructed once the reducer has already confirmed the tick was
 * ticked). `GENDER_PLACEMENT_REASONS`'s six entries no longer need to restate the check at all.
 */
export type GenderPlacement = {
  at: Instant;
  by: WardFlowRole;
  unitIds: string[];
  reason: GenderPlacementReason;
  wardChecked: true;
};

export type StatusChange = {
  at: Instant;
  from: LegalStatus;
  to: LegalStatus;
  by: string;
  reason: LegalStatusChangeReason;
};

/** The urgency-tier counterpart of `StatusChange` — same shape, same discipline: who made the
 *  change, when, and a reason chosen from a fixed list rather than typed (see
 *  `ward-change-reasons.ts`'s own doc comment for why). */
export type UrgencyChange = {
  at: Instant;
  from: 1 | 2 | 3;
  to: 1 | 2 | 3;
  by: string;
  reason: UrgencyChangeReason;
};

/**
 * WHO COLLECTS THE PATIENT — obviously generic placeholders, and the owner's to replace.
 *
 * `TR-D2`. Until 2026-08-30 this field was a bare string with two values and no vocabulary: the
 * reducer hardcoded "State patient transport service" onto every job it created, and the seed used
 * **"St John WA"** — a REAL organisation, named inside a synthetic prototype, rendering straight to
 * screen as "St John WA accepted, awaiting departure".
 *
 * Two faults in one field. The screen stated who was collecting a patient and **nobody chose it**;
 * and a demonstration asserted an operational fact about a real body that has agreed to nothing.
 *
 * These three are PLACEHOLDERS in the `CM-8` sense — findable in one place, never presented as the
 * real set, and replaced wholesale on the day somebody supplies the actual providers. They are the
 * three the transport design names and no more: "and so on" in a spec is an invitation to invent,
 * and inventing a fourth provider is the same act as writing a real one in.
 */
export const TRANSPORT_PROVIDERS = ["Ambulance service", "Patient transport service", "Ward escort"] as const;
export type TransportProvider = (typeof TRANSPORT_PROVIDERS)[number];

/**
 * Owner ruling, third round, 2026-09-17: booking transport in Ward Flow LOGS a booking already made
 * over the phone — the CAD transport number, and whether the transport is voluntary or involuntary.
 * **This states what the BOOKER said about the transport, and does NOT change the movement's own
 * `legalStatus`.** The two can differ (a voluntary patient may still travel on a service the booker
 * states as "involuntary" for the transport's own paperwork), and nothing here reconciles them —
 * see `TransportJob.transportLegalStatus`'s own doc comment.
 */
export const TRANSPORT_LEGAL_STATUSES = ["voluntary", "involuntary"] as const;
export type TransportLegalStatus = (typeof TRANSPORT_LEGAL_STATUSES)[number];

export type TransportJob = {
  id: string;
  /** From `TRANSPORT_PROVIDERS`. Never free text — see that list's own doc comment. */
  provider: TransportProvider;
  escortRequired: boolean;
  bookedByRole?: WardFlowRole;
  bookedByUnitId?: string;
  /**
   * WHO BOOKED THIS JOB — owner ruling WLQ-11 (2026-09-15): *"whoever booked transport may cancel
   * it; the receiving ward still may not."* Before this the record stored no attribution at all
   * (see the superseded assertion in `tests/ward-book-transport.test.ts`), because nothing needed
   * to tell one booker from another. `CANCEL_TRANSPORT`'s `ward` branch (`ward-flow-reducer.ts`)
   * needs exactly that now, so this field exists to answer it and nothing more.
   *
   * `role` is recorded for every booker (`ed`, `ward` and `community` alike). `unitId` is recorded
   * ONLY for a `ward` booker — the claim-not-proof unit identity already used by `actingUnitId`
   * everywhere else in this model, read from the ward screen's own route parameter and never
   * authenticated.
   *
   * 🔴 **`placeId` ADDED — owner's third ruling, 2026-09-17: "only the community team that booked
   * transport may cancel it" (answer 9).** Recorded ONLY for a `community` booker, from the same
   * `actingPlaceId` claim-not-proof discipline `MARK_NOTICE_READ` already uses for a community
   * team's route-parameter identity. This is what closes the gap this comment used to describe —
   * `ed` still has no equivalent identity anywhere in this model, which is why `CANCEL_TRANSPORT`
   * grants it an unconditional right rather than a checked one.
   *
   * ⚠️ ABSENT ON EVERY PRE-EXISTING (seeded) TRANSPORT JOB, which predates this field and carries
   * no booker. `CANCEL_TRANSPORT`'s `ward`/`community` branches treat that absence as "not the
   * booker" — TR-D6's original coordinator/ED-only rule, unchanged for those jobs.
   */
  bookedBy?: { role: WardFlowRole; unitId?: string; placeId?: string };
  /**
   * THE CAD TRANSPORT NUMBER — owner's third ruling, 2026-09-17: booking this control logs a
   * transport already arranged by phone, named by the CAD (Computer-Aided Dispatch) number the
   * caller was given. Typed text, never derived — see `case "BOOK_TRANSPORT"`'s own comment
   * (`ward-flow-reducer.ts`) for the required-and-never-defaulted discipline every other answer on
   * this event already holds to, and `ward-flow-persistence-classification.ts` for why this field
   * puts the whole event on the typed-text list.
   *
   * ⚠️ OPTIONAL ON THE TYPE, NEVER OPTIONAL ON THE EVENT. `case "BOOK_TRANSPORT"` refuses a booking
   * that omits it, so every job THIS REDUCER CREATES carries one. It is optional here only because
   * every pre-existing (seeded) transport job predates this ruling and carries none — the same
   * "not recorded" reading `bookedBy` above and `formRequired` below already hold to.
   */
  cadNumber?: string;
  /**
   * WHAT THE BOOKER STATED ABOUT THE TRANSPORT — owner's third ruling, 2026-09-17, one of the three
   * answers the booking popup asks for. From `TRANSPORT_LEGAL_STATUSES`, membership-checked by the
   * reducer, same discipline as `provider`. Required and never defaulted, same as `escortRequired`.
   *
   * ⚠️ **NOT `Movement.legalStatus`, AND DOES NOT CHANGE IT.** See `TRANSPORT_LEGAL_STATUSES`'s own
   * doc comment for why the two are independent facts that can genuinely disagree.
   *
   * Optional on the type for the same seed-predates-this reason `cadNumber` above states.
   */
  transportLegalStatus?: TransportLegalStatus;
  /**
   * THE ESTIMATED TIME THE BOOKER WAS GIVEN — owner's third ruling, 2026-09-17, the third of the
   * three booking-popup answers. Typed as HH:MM by the person logging the call and resolved to an
   * `Instant` (today or tomorrow) by the popup itself, the same typed-time parsing the ED screen's
   * legal-form expiry controls already use — never computed from a duration (D5).
   *
   * Optional on the type for the same seed-predates-this reason `cadNumber` above states.
   */
  estimatedAt?: Instant;
  /**
   * The form this transfer requires. **STILL A BARE STRING, and that is a known gap rather than an
   * oversight** — `TR-D2` asks for it to draw from `SELECTABLE_LEGAL_FORMS`, and it should.
   *
   * Not done here because the change is not local. `SELECTABLE_LEGAL_FORMS` is typed
   * `readonly LegalForm[]` with `code: string`, so deriving a union from it needs `as const` on
   * that array — and `ward-legal-forms.ts` is pinned in roughly fifteen places by
   * `tests/ward-legal-figure-guard.test.ts`, the Mental Health Act figure guard the owner has said
   * must never be disturbed. Widening a type there is a deliberate change with that guard in front
   * of it, not a side effect of removing two organisation names from a different field.
   *
   * Nothing writes a bad code today: the only populated `formRequired` comes from the seed.
   */
  formRequired?: string;
  acceptedAt?: Instant;
  enRouteAt?: Instant;
  /**
   * ⚠️ `arrivedAt` AND `cancelledAt` READ AS INDEPENDENT AND ARE NOT — `closure` on `Movement`
   * (below) is the invariant that keeps them apart, and it is NOT stated anywhere in this type.
   *
   * Nothing here stops a hand-built `TransportJob` from carrying both `arrivedAt` and
   * `cancelledAt`, but the reducer can never produce one. In `ward-flow-reducer.ts`,
   * `PATIENT_ARRIVED` sets `arrivedAt` and the movement's own `closure` in the same update, and
   * refuses to run at all once `movement.closure` is already set. `RECORD_EXAMINATION`'s
   * `community_order`/`revoked` branch — the one that closes a movement without an admission —
   * sets `cancelledAt` the same way, guarded by the identical `movement.closure` check.
   * Whichever of the two runs first sets `closure`, and that is what makes the second one
   * impossible; nothing on `TransportJob` itself does the excluding.
   *
   * A fourth terminal transition that sets one of these fields (or a new one) MUST do both halves
   * of that: reject when `movement.closure` is already set, and set `closure` itself in the same
   * update. Do either alone and this type stops matching what the reducer can actually produce.
   *
   * 🔴 **WLQ-38 (owner, 2026-09-15) ADDED THE FOURTH AND FIFTH TERMINAL TRANSITIONS, AND BOTH FOLLOW
   * THE RULE ABOVE EXACTLY.** A post-acceptance `WITHDRAW_REFERRAL` (the referrer or the coordinator
   * revoking an accepted referral before the patient is collected) sets `cancelledAt` on any booked
   * job and `movement.closure` in the same update, guarded by the same `movement.closure` check
   * every other writer here already uses. `STOP_TRANSPORT` (a new event, for AFTER the patient is
   * collected — see `stoppedAt` below) does the same, so a stopped job also carries `cancelledAt`:
   * `orphanedTransport` (`ward-derivations.ts`) already excludes every closed movement from its own
   * sweep on the stated assumption that whichever event closed it also cancelled the job, and a
   * fourth or fifth writer that forgot would be exactly the "third terminal path that forgot" its
   * own comment names.
   *
   * (`collectedAt` is not part of this exclusion — it is an intermediate step either terminal path
   * can follow, not a terminal state of its own. And `CANCEL_TRANSPORT`, despite the name
   * similarity, never sets `cancelledAt` at all: it replaces the whole job with a fresh one for
   * rebooking and records the old one in `movement.unwinds` instead — see `UnwindRecord` below.)
   */
  collectedAt?: Instant;
  arrivedAt?: Instant;
  cancelledAt?: Instant;
  /**
   * WLQ-38 (owner, 2026-09-15): `STOP_TRANSPORT` stops a journey AFTER the patient has been
   * collected, which `CANCEL_TRANSPORT` refuses to do ("the patient has departed"). These fields
   * are that event's own record — who stopped it, when, and why (from `STOP_TRANSPORT_REASONS`,
   * `ward-change-reasons.ts`) — kept apart from `cancelledAt` above because a stopped job and a
   * cancelled-before-collection job are different situations a future screen may need to tell
   * apart, even though both also carry `cancelledAt` (see that field's own comment). All four are
   * set together, by `STOP_TRANSPORT` alone, or none of them at all.
   */
  stoppedAt?: Instant;
  stoppedBy?: WardFlowRole;
  stopReason?: string;
  /**
   * Build plan item 31 (T3, 2026-09-17): where the patient actually is, recorded in the same
   * `STOP_TRANSPORT` write as the three fields above. `string`, not the closed
   * `TransportWhereabouts` union above it, for the same reason `stopReason` is a plain `string`
   * rather than `StopTransportReason`: this type stays decoupled from `ward-change-reasons.ts`,
   * and the reducer's own membership check is what actually enforces the closed list.
   */
  stoppedWhereabouts?: string;
  /**
   * Build plan item 29 (T4a, 2026-09-17) / R2-7: a collected journey diverted to a place other
   * than the accepting ward. Written only by `RECORD_DIVERSION`, all four fields together or
   * none. The movement stays OPEN and the bed stays held until `RELEASE_DIVERTED_BED` — unlike
   * `STOP_TRANSPORT`, which closes the journey in the same write. `place`/`reason` are plain
   * `string` for the same decoupling reason `stoppedWhereabouts`/`stopReason` are; the reducer's
   * membership checks against `TRANSPORT_WHEREABOUTS` / `DIVERSION_REASONS` enforce the lists.
   */
  diversion?: {
    at: Instant;
    by: WardFlowRole;
    place: string;
    reason: string;
  };
  needed?: boolean;
};

export type MovementClosure = {
  at: Instant;
  outcome: "arrived" | "did_not_proceed";
  reason: string;
};

/**
 * WHETHER THIS PATIENT NEEDS TRANSPORT AT ALL — the third state, owner ruling R-2026-09-04-C.
 *
 * ⚠️ **THREE STATES, NOT TWO, AND THE ABSENT ONE IS THE DEFAULT.** `Movement.transport` answers
 * "is there a job?", and until this field existed that was the only thing the model held: a
 * movement with no `TransportJob` could mean **no transport is needed** (the ward is across the
 * corridor, the patient is walking) or **no transport has been booked yet**, and a screen could
 * honestly say no more than "no transport recorded". Those are opposite operational situations —
 * one is finished and one is outstanding — and they rendered identically.
 *
 * Deliberately the same shape as `Referral.medicalClearance`, which already models exactly this
 * uncertainty: a stated answer plus the time it was stated, and ABSENCE meaning **nobody has said**
 * rather than "no". Read it through `transportNeedState` (`ward-derivations.ts`), which names all
 * three so a caller cannot accidentally collapse two of them with `?? false`.
 *
 * ⚠️ **DO NOT DEFAULT IT AND DO NOT BACKFILL IT.** The ruling's own words: a migration that guessed
 * one of the other two for legacy movements would manufacture the very certainty this field exists
 * to provide honestly. Every hand-authored movement in `ward-movements.ts` and every generated one
 * therefore carries nothing here, and reads as "not recorded".
 *
 * ⚠️ **IT SAYS NOTHING ABOUT `TransportJob.formRequired`, WHICH IS STILL AN UNVALIDATED BARE
 * STRING** (see that field's own comment). A screen showing `needed` beside a form code must not
 * let the recorded need imply the form was checked; nothing checks it.
 */
export type MovementTransportNeed = {
  /** The answer somebody gave. `false` is a real answer — "this patient needs no transport". */
  needed: boolean;
  at: Instant;
};

/**
 * WHY A MOVEMENT CARRIES NO `referralId`, when somebody has actually said why.
 *
 * Owner ruling R-2026-09-04-D, second half. `Movement.referralId` being absent had three different
 * causes that rendered identically, and **only the first is clinical**:
 *
 *   - `none_raised` — nobody raised a front-door referral for this person. A recorded answer.
 *   - `not_asked` — the journey was raised at runtime and whoever raised it was never asked which
 *     referral it came from. Record-keeping, written by `RAISE_REFERRAL` itself.
 *   - *the field absent entirely* — the movement predates the link (`ward-movements.ts`'s
 *     hand-authored fixture) or nothing has ever recorded anything. Record-keeping, and the
 *     DEFAULT, in the same discipline as `MovementTransportNeed` above.
 *
 * ⚠️ **`none_raised` IS THE ONLY ONE A SCREEN MAY TREAT AS A CLINICAL FACT.** The ruling exists
 * because an earlier one asked for an absent referral to be rendered as the loudest thing on the
 * page; against the data of the day that would have reported that nobody was looking for anybody,
 * anywhere, with every gate green.
 *
 * ⚠️ **AND `none_raised` DOES NOT MEAN "NOBODY IS LOOKING FOR A BED".** It means no FRONT-DOOR
 * referral brought this person in. The bed search is `referredUnitIds`/`declines`, a different
 * absence with its own unresolved version of this problem — see `ed-home-derivations.ts`'s own
 * doc block, which refuses to count it for exactly this reason.
 */
export const MOVEMENT_REFERRAL_ABSENCE_REASONS = ["none_raised", "not_asked"] as const;
export type MovementReferralAbsenceReason = (typeof MOVEMENT_REFERRAL_ABSENCE_REASONS)[number];

export type MovementReferralAbsence = {
  reason: MovementReferralAbsenceReason;
  at: Instant;
};

/**
 * The undo the prototype has never had (Task 3, spec item 10). Before this, the only path that
 * released a pulled bed or cancelled a transport job was closing the movement outright — recording
 * an examination with outcome `community_order` or `revoked` — so a coordinator who pulled the
 * wrong bed had to declare the patient does not need admission in order to correct it.
 * `RELEASE_PULL` and `CANCEL_TRANSPORT` unwind exactly one earlier reservation each, WITHOUT
 * closing the movement, clearing `legalForm`, or touching `referredUnitIds` — the movement
 * survives and keeps its acceptance. Every unwind is recorded here so the fact that a pull or a
 * transport job was undone is never silently lost, the same discipline `StatusChange` and
 * `UrgencyChange` already hold to for their own reversible facts.
 */
export type UnwindRecord = {
  at: Instant;
  /**
   * The third and fourth kind, added for the coordinator step-back / withdraw-acceptance pair
   * (Task 5, ward-flow movement step-track plan, 2026-09-04, owner rulings E and F). Appended to
   * this ONE existing audit trail rather than a second store — ruling 3 of that plan is explicit
   * that inventing a second place to record an unwind is the defect, not a variant to avoid.
   *
   * `"stage_corrected"`: `STEP_BACK_STAGE` — a coordinator record correction, moving `stage`
   * strictly backwards with no other side effect.
   * `"acceptance_withdrawn"`: `WITHDRAW_ACCEPTANCE` — the coordinator undoes a WARD's earlier
   * "yes" (distinct from `WITHDRAW_REFERRAL`, which is the REFERRER taking its own referral back).
   */
  kind: "pull_released" | "transport_cancelled" | "stage_corrected" | "acceptance_withdrawn";
  by: string;
  reason: string;
  /** The cancelled job retained in the audit trail when a replacement becomes active. */
  transportId?: string;
  /** CAD or dispatch tracking number for a cancelled transport job. */
  cadNumber?: string;
  /**
   * Which ward's acceptance was withdrawn — populated only for `"acceptance_withdrawn"`, parallel
   * to `transportId` above. `WITHDRAW_ACCEPTANCE` clears `Movement.acceptedUnitId` in the same
   * update, so nothing else on the record would say who it used to be without this field.
   */
  unitId?: string;
};

/**
 * ONE STAGE TRANSITION — the single record of how a patient moved, replacing a reconstruction of
 * the journey from scattered timestamps (Task 4, ward-flow movement step-track plan, 2026-09-04).
 *
 * ⚠️ **APPEND-ONLY, ALWAYS.** Nothing ever rewrites or removes an entry, including a later
 * coordinator step-back — that appends its OWN backwards entry rather than editing the one it is
 * correcting. The array is the movement's history, not its current state; `movement.stage` alone
 * still answers "where is this patient now".
 *
 * `from` IS OPTIONAL AND ABSENT EXACTLY ONCE — on creation (`RAISE_REFERRAL`), where there is no
 * previous stage to name. An entry is still written there, so step 1 of the track lives inside
 * this array rather than being reachable only through `Movement.openedAt`.
 *
 * `by` IS A ROLE, NEVER A PERSON — the same discipline as `StatusChange.by`, `UrgencyChange.by`
 * and `Override.by`. Every reducer case that writes an entry takes it from the triggering event's
 * own `role`, never from a name a caller could supply.
 *
 * ⚠️ **THIS DOES NOT REPLACE `openedAt`, `referredAt`, `acceptedAt`, `transport.collectedAt` OR
 * `closure.at`.** Each of those has other consumers that read it directly (the ED referral board,
 * `daysInBed`, the outbox), and removing any of them to avoid "two places recording the same
 * fact" would break those callers for no gain. Two sources that AGREE, with something that
 * actually checks they agree, is the honest design; two sources with nobody checking is how this
 * project got a live-drift incident. `tests/ward-movement-stage-changes.test.ts` is that check.
 *
 * ⚠️ **AN EMPTY ARRAY HAS TWO DIFFERENT CAUSES, DECIDABLE FROM `movement.stage` ALONE.** A
 * movement still at `placement_requested` with no entries has made no transitions yet — the
 * ordinary case for a freshly raised movement. A movement at any LATER stage with no entries
 * PREDATES this field — every hand-authored and generated movement in `ward-movements.ts` is in
 * this second class, because none of them was reached by dispatching an event. A renderer must
 * say which; treating both as one "no record" absence is the exact defect this plan exists to
 * close on the fields that came before it.
 *
 * Never backfilled: existing hand-authored and generated movements keep `stageChanges: []`
 * exactly as authored. "No record of how this movement moved" is the honest answer for them, not
 * a gap to be invented shut.
 */
export type StageChange = {
  at: Instant;
  from?: MovementStage;
  to: MovementStage;
  by: string;
  reason?: string;
};

/**
 * A MOVEMENT's id — one person's journey through the system, never the person.
 *
 * ⚠️ **A TEMPLATE LITERAL TYPE RATHER THAN `string`, AND IT IS A DEFECT FIX RATHER THAN
 * TIDINESS.** The route was `/patients/[patientId]` (now
 * `/mockups/ward-flow/movements/[movementId]`) and rendered a MOVEMENT workspace: its parameter
 * was called `patientId` (now `movementId`), its component prop was called `patientId` (now
 * `movementId`), and inside it a variable named `patient` is still typed `Movement`. Every
 * identifier involved was a bare `string`, so nothing stopped a real patient id being passed to it
 * — and the names openly invited exactly that. It worked only because every existing call site
 * happened to pass a movement.
 *
 * With `MovementId` and `PatientId` as distinct types the mistake the name invites now fails to
 * COMPILE instead of rendering a dead-end "no movement matches" page. Every movement id in the
 * fixture is already `WF-###`, so no literal needed changing.
 */
export type MovementId = `WF-${string}`;

/**
 * The result of a psychiatric examination. `"further_examination_ordered"` is item 7 of the
 * owner's 17 September answers: *"a repeat examination is a new record, with a 'further
 * examination ordered' outcome."* It settles nothing — `RECORD_EXAMINATION` records it and
 * changes nothing else about beds or transport — and it is the only outcome after which a second
 * examination is ever accepted; every other outcome keeps the "already examined" refusal that
 * predates this type. `"community_order"` and `"revoked"` are the two outcomes that mean the
 * inpatient order was revoked — `examinationRevokedWhileBedHeld` (`ward-derivations.ts`) reads
 * this field for exactly those two values, never `"inpatient_order"` or
 * `"further_examination_ordered"`, neither of which is a revocation.
 */
export type ExaminationOutcome = "inpatient_order" | "community_order" | "revoked" | "further_examination_ordered";

export type Movement = {
  id: MovementId;
  /**
   * The patient this movement is for. Links directly to a Person in state.patients.
   */
  patientId?: PatientId;
  /** Where the patient physically is. Detention here is lawful even when unauthorised. */
  originEdId: string;
  openedAt: Instant;
  /**
   * THE FRONT-DOOR REFERRAL THIS JOURNEY WAS RAISED FROM — the link that did not exist.
   *
   * Owner ruling 8, 2026-09-01: **a journey never STARTS at a community team.** Every journey
   * begins at an emergency department, so `originEdId` requiring a real ED is the rule rather than
   * a gap — and a community team's referral to an ED and the journey that ED subsequently raises
   * are TWO LINKED RECORDS rather than one. This is that link, and it is the whole of it. Nothing
   * about the journey is derived from the referral: `RAISE_REFERRAL` already carries every fact a
   * movement needs, so this field adds an id and changes nothing else.
   *
   * ⚠️ **OPTIONAL, AND ABSENCE IS THE ORDINARY CASE.** Most movements have no referral — a person
   * who walked into an emergency department was referred by nobody — so an absent value is a real
   * answer rather than a missing one.
   *
   * ⚠️ **TWO OF THE TWENTY HAND-AUTHORED MOVEMENTS NOW CARRY ONE (owner ruling R-2026-09-04-D,
   * first half), AND THE OTHER EIGHTEEN STILL DO NOT.** This comment previously said the fixture
   * would never be given a value here because doing so would invent the fact the field records.
   * The ruling's answer is that a fixture in which the link resolves for NOBODY hides the link's
   * whole general problem behind a uniform absence, so `ward-movements.ts` now authors two
   * referral-and-journey PAIRS — a referral raised before the journey and addressed to the very
   * department that raised it, the same two conditions `RAISE_REFERRAL` enforces at runtime. The
   * remaining eighteen carry nothing, because nothing in their authored story says anybody
   * referred them, and guessing would be the invention this paragraph used to forbid outright.
   *
   * ⚠️ **AN ABSENT VALUE HERE IS NOT SELF-EXPLAINING — READ `referralAbsence` BESIDE IT.**
   *
   * ⚠️ **`Admission.referralId` IS THE COUNTER-EXAMPLE, NOT THE PRECEDENT.** That field is
   *
   * 🔴 CORRECTED 2026-09-11: EVERY FACTUAL CLAUSE ABOUT `Admission.referralId` ABOVE IS NOW FALSE.
   * Struck in place rather than deleted, because the reading that made it true is what a reader
   * will otherwise re-derive.
   *
   *     seeded Admission.referralId, non-null      10      every one RESOLVES
   *     real Referral ids                          24      dangling: ZERO
   *     admissions carrying literal null          257      an honest absence, not a broken join
   *
   * Repaired 2026-09-10 at a6e5208b85 - "seeded referralId links what is true and nulls the rest,
   * invents nothing". ⚠️ The manufacturing by string substitution is GONE, not reduced.
   *
   * ✅ WHAT SURVIVES, and it is why this paragraph is corrected rather than removed: the two
   * fields are still NOT the same kind of field. `Movement.referralId` is runtime-ENFORCED -
   * RAISE_REFERRAL refuses an id that does not resolve. `Admission.referralId` is seed-authored
   * and no reducer path validates it. Do not copy one field's guarantees onto the other.
   * ⚠️ The "all 65 community team pages are empty" clause is doubly stale: the count is 64.
   * documented as *"the join back to the front door"* and joins to nothing: its seeded values are
   * manufactured from the admission's own id by string substitution (`RF-${suffix}` and
   * `id.replace(/^AD-/, "RF-")` in `ward-admissions-seed.ts`), which overlaps the real
   * `RF-001`…`RF-009` in **zero** places, and its one runtime writer honestly writes `null`. It
   * compiles, renders, and means nothing — see
   * `docs/ward-flow/fields-with-no-producer-2026-09-01.md`, where it is finding zero and the reason
   * all 65 community team pages are empty.
   *
   * **The difference here is enforced, not intended.** `RAISE_REFERRAL` — the only writer — REFUSES
   * an id that does not resolve to a referral already in state, and refuses one whose referral was
   * not addressed to the department doing the raising. A manufactured string cannot reach this
   * field; the only way to obtain a value is to name a referral that exists.
   *
   * Read through `referralForMovement` (`ward-derivations.ts`), which returns `undefined` for a
   * movement that has no referral rather than throwing or guessing at one.
   */
  referralId?: string;
  /**
   * WHY THERE IS NO `referralId`, when somebody has said why — see `MovementReferralAbsence`.
   *
   * ⚠️ **MEANINGLESS BESIDE A SET `referralId`, AND THE TYPE CANNOT STOP THAT.** The two fields
   * answer the same question and only one of them may be answered: `RAISE_REFERRAL` writes exactly
   * one, `RECORD_NO_REFERRAL` refuses a movement that already names a referral, and
   * `movementReferralLink` (`ward-derivations.ts`) resolves the contradiction in favour of the
   * referral that actually exists rather than reporting an absence beside a real join.
   */
  referralAbsence?: MovementReferralAbsence;
  /**
   * WHETHER THIS PATIENT NEEDS TRANSPORT — three states, absent meaning nobody has said. See
   * `MovementTransportNeed`, and read it through `transportNeedState` (`ward-derivations.ts`).
   */
  transportNeed?: MovementTransportNeed;
  /**
   * THE URGENT FLAG — the one thing that outranks a wait and a tier (owner, 2026-08-30).
   *
   * His words: "A long wait always is prioritised… however… in certain cases patients can be
   * marked as urgent for many reasons which outranks everything." Asked how far to take it, he
   * scoped it deliberately small: **"For now just have a feature that flags the patient. I will
   * build on it later."**
   *
   * So this is ADDITIVE AND REVERSIBLE. It sits above `urgency` in `queueOrder`.
   *
   * ⚠️ **PART OF "LATER" ARRIVED 2026-09-17 — ITEM 37.** `queueOrder`'s third key is no longer
   * `operationalScore`: it is now the wait itself, uncapped, on the owner's own fuller ruling
   * ("otherwise go by time for the main level of urgency"). See `queueOrder`'s own doc comment
   * (`ward-priority.ts`) for what changed and what did not — `operationalScore` itself is
   * untouched and still drives the factor breakdown shown elsewhere; it simply no longer orders
   * this queue.
   *
   * Carries no reason ON THIS FIELD — see `urgentFlag` immediately below for the reason, author
   * and instant that field now carries. `flaggedUrgent` itself stays a plain boolean because 129
   * call sites across this codebase read it as one; widening it would have meant touching every
   * one of them for a fact `urgentFlag` already states more precisely.
   */
  flaggedUrgent: boolean;
  /**
   * WHO FLAGGED THIS, WHEN, AND WHY — the part of "I will build on it later" that arrived
   * 2026-09-17 (item 37). `undefined` alongside `flaggedUrgent: true` means exactly what it says:
   * a movement flagged before this field existed (the fixture's own WF-018, hand-authored on
   * 2026-08-30 with no provenance to recover), never a bug to paper over with an invented author
   * or instant. `undefined` alongside `flaggedUrgent: false` is the ordinary unflagged case.
   *
   * `FLAG_MOVEMENT_URGENT` writes this together with `flaggedUrgent: true`; `CLEAR_MOVEMENT_URGENT_FLAG`
   * clears both together, so the two fields can never disagree about whether a flag is live —
   * only about whether an OLD one carries provenance.
   *
   * `reason` is drawn from `URGENT_MARK_REASONS` (`ward-change-reasons.ts`) — chosen, never
   * typed, the same discipline as every other reason list in this file.
   *
   * `by` is typed `WardFlowRole`, not the bare `string` `Override.by`/`StatusChange.by`/
   * `UrgencyChange.by` above use — narrowed 2026-09-17 (review fix-forward 5) so the queue line
   * can render it through `WARD_FLOW_ROLE_LABELS` ("Flow coordinator", not "coordinator") without
   * a cast. Still a ROLE, never a person, the same discipline those three fields hold to; only the
   * type is stricter, because this is the one of the four actually rendered by name on screen.
   */
  urgentFlag?: { at: Instant; by: WardFlowRole; reason: UrgentMarkReason };
  /**
   * EVERY TIME THIS PATIENT WAS FLAGGED AND (WHERE IT HAPPENED) UNFLAGGED — review fix-forward
   * item 6, 2026-09-17. `urgentFlag` above is the CURRENT flag only, and clearing it wipes the
   * record of who raised it and why; this is the append-only log that survives a clear, so a
   * coordinator can see a patient was flagged twice last shift even though neither flag is live
   * now.
   *
   * `FLAG_MOVEMENT_URGENT` appends one entry with `clearedAt`/`clearedBy` both absent.
   * `CLEAR_MOVEMENT_URGENT_FLAG` fills those two fields on the OPEN entry — the last one with no
   * `clearedAt` — rather than appending a second entry, so one flag-then-clear cycle is one row,
   * not two. Absent (`undefined`) entirely on a movement never flagged through either event; the
   * fixture's WF-018 is flagged with no history, the same "flagged before this existed" case
   * `urgentFlag` above documents.
   */
  urgentFlagHistory?: {
    raisedAt: Instant;
    raisedBy: WardFlowRole;
    reason: UrgentMarkReason;
    clearedAt?: Instant;
    clearedBy?: WardFlowRole;
  }[];
  urgency: UrgencyLevel;
  /** Absent means ATS not recorded; independent of the three operational urgency tiers. */
  atsCategory?: AtsCategory;
  cohort: Cohort;
  security: Security;
  /** Recorded sex (R7, 25 September 2026). See `RECORDED_SEXES`. */
  sex: RecordedSex;
  homeRegion?: HomeRegion;
  /**
   * T10, item 8 (owner answer, 17 September 2026): the gender recorded AT REFERRAL — never
   * derived from `sex` — that the `gender_designation` gate (`ward-eligibility.ts`) checks
   * against a unit's `sexDesignation` for the incoming patient. Absent means not yet recorded,
   * same convention as every other "nobody has said" field on this type. See `ReferralGender`'s
   * own doc comment for why this is a wider, separate fact from `Patient.gender`.
   */
  gender?: ReferralGender;
  /**
   * EVERY TIME THIS MOVEMENT'S `gender` WAS SET OR CORRECTED, OLDEST FIRST — Opus review round
   * 2, 17 September 2026 (P2). Before this field existed, `gender_designation`'s own refusal told
   * a coordinator to "Record gender first" and nothing on the running app could: `gender` was
   * writable only at `RAISE_REFERRAL`/`RECEIVE_REFERRAL`, before a movement existed to correct.
   * `RECORD_MOVEMENT_GENDER` (`ward-flow-events.ts`) is the only writer, appends one entry per
   * change and updates `gender` in the same update, so this array and `gender` can never disagree
   * about the current value. `from` is absent exactly when the movement had no gender recorded
   * yet — the ordinary first-recording case — never a fabricated "Not yet recorded" member of
   * `ReferralGender` itself, which has none.
   */
  genderChanges?: { at: Instant; by: WardFlowRole; from?: ReferralGender; to: ReferralGender }[];
  /**
   * T15 (item 12, owner answer 17 September 2026): carried from the referral this movement was
   * raised from (`RAISE_REFERRAL`'s own copy), or set directly by the ED's own intake choice,
   * which REPLACES whatever the referral carried — the 29 Aug ruling, "easy to continually adjust
   * and refine along the way". Absent means nobody has recorded one; `PULL_PATIENT` is what turns
   * that into `Admission.tentativeDiagnosis`'s own `null` convention.
   */
  tentativeDiagnosis?: TentativeDiagnosisBlock;
  /**
   * T12 (item 9): every coordinator-recorded "checked with the ward" confirmation for a
   * Non-binary placement on THIS movement, oldest first. See `GenderPlacement`'s own doc comment
   * for the full rule. Absent (or empty) means nobody has recorded one yet — never checked for a
   * movement whose `gender` is not `"Non-binary"`, since the requirement only exists for that one
   * value.
   */
  genderPlacements?: GenderPlacement[];
  specialling: boolean;
  /**
   * Whether high-acuity nursing was requested for this movement. **Carried from the referral's
   * `highAcuityNursingNeeded`, which the REFERRING CLINICIAN marks — owner ruling 2026-09-10.**
   *
   * Never inferred: not from urgency, not from `specialling`, not from legal status, not from
   * security. `false` is the ordinary state and means it was not requested — **it is not a finding
   * that high-acuity nursing was considered and ruled out.**
   */
  highAcuity: boolean;
  legalStatus: LegalStatus;
  legalForm?: LegalForm;
  /**
   * EVERY TYPED EXPIRY EVER RECORDED AGAINST THIS MOVEMENT'S LEGAL FORM, OLDEST FIRST — added T2
   * (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`), owner answer 1 and item 5
   * (regional extensions): *"the clinician records the extension and the new expiry; the app
   * never calculates one."*
   *
   * Referral capture, written-form capture, continuation and typed-expiry events append the
   * supplied expiry. Replacement forms may have no expiry while this history remains intact;
   * current authority is legalForm.dueAt, never the last historical entry. An extension of the
   * current recorded form must be later than its entered expiry. A replacement form begins a new
   * current value and does not erase the prior form's history.
   *
   * Absent on the six authored synthetic fixture expiries, which predate these writers. Never
   * backfill an actor or typed record for those examples. Legacy calculated clocks are not paper
   * evidence and cannot force a clinician's first actual entry to be treated as an extension.
   */
  legalFormExpiryHistory?: { at: Instant; by: WardFlowRole; dueAt: Instant; basis: "written_on_form" | "extension" }[];
  statusChanges: StatusChange[];
  /** Urgency-tier changes, in the order they were made. Empty for a movement whose urgency has
   *  never changed since it was raised. */
  urgencyChanges: UrgencyChange[];
  /** Every coordinator override on this movement, oldest first. Empty for a movement nobody has
   *  overridden a gate for — which is most of them. See `Override`. */
  overrides: Override[];
  stage: MovementStage;
  owner: string;
  /** Units currently holding a live referral. Never longer than PARALLEL_REFERRAL_CAP. */
  referredUnitIds: string[];
  acceptedUnitId?: string;
  /** When `ACCEPT_IN_PRINCIPLE` (ward-flow-reducer.ts) set `acceptedUnitId`. Absent for every
   *  movement in the seed fixture (`ward-movements.ts`), which is hand-authored with
   *  `acceptedUnitId` already set rather than reached by dispatching that event — this field is
   *  deliberately never backfilled onto that fixture, so its absence there is real, not a bug.
   *  `effectivenessNumbers` (ward-derivations.ts) prefers this over the `withdrawnReferrals`
   *  archaeology it used before this field existed, and reports honestly when neither is present. */
  /**
   * When this movement was referred to units — written by `REFER_TO_UNITS` beside
   * `referredUnitIds`, which is the one place a movement becomes referred.
   *
   * ⚠️ **OPTIONAL, AND ABSENT ON EVERY SEEDED MOVEMENT ON PURPOSE.** Same discipline as
   * `acceptedAt` below: a hand-authored fixture carries no referral time, so a row that has none
   * says so rather than falling back to `openedAt`. Substituting arrival time under a "referred"
   * label answers a different question while reading as plausible — the ED outbox's own comment
   * already forbids exactly that swap for `acceptedAt`.
   *
   * Added 2026-09-02 on the owner's instruction, after the ED referral board could not honestly
   * answer "how long since we referred them": the model held `openedAt`, `acceptedAt`, `formedAt`
   * and `pullExpiresAt` and nothing for this.
   */
  referredAt?: Instant;
  /**
   * When the current referral-decision wait began — written by `REFER_TO_UNITS` when it adds wards
   * into an empty live set (first referral, or re-refer after every ward declined/withdrew).
   * Adding wards while others are still live, and declines themselves, leave this alone. Stream A
   * decision targets read it (falling back to `referredAt` on older records). Distinct from
   * `referredAt`, which stays the first referral's moment for the ED board. Absent on every seeded
   * movement, same discipline as `referredAt`.
   */
  referralDecisionOpenedAt?: Instant;

  acceptedAt?: Instant;
  declines: Decline[];
  transport?: TransportJob;
  /**
   * WHAT IS HOLDING THIS MOVEMENT UP, IN SOMEBODY'S OWN WORDS.
   *
   * ⚠️ **NOT `BedRelease.blocker`, WHICH IS A DIFFERENT FIELD WITH THE SAME NAME.** That one is a
   * `BedReleaseBlocker | null` — a typed enum chosen from `BED_RELEASE_BLOCKERS`, carrying a
   * `blockedBy` role, about a BED being freed. This one is free prose about a MOVEMENT. They are
   * not two spellings of one idea and neither list applies to the other; the reducer cases that
   * write them (`BLOCK_BED_RELEASE`/`CLEAR_BED_RELEASE_BLOCK` for the enum,
   * `RECORD_MOVEMENT_BLOCKER` and the stage transitions for this one) are unrelated.
   *
   * ⚠️ **FREE PROSE, AND THAT IS LOAD-BEARING RATHER THAN AN OVERSIGHT.** Owner ruling,
   * 2026-09-01, after this field was audited as a candidate for derivation: do not derive it.
   * A constrained vocabulary would lose the same thing a derivation would. Two properties of the
   * twenty-one hand-authored values prove it:
   *
   *   1. Three of them record the ABSENCE of a blocker TOGETHER WITH THE REASON for the absence —
   *      `"None — in transit"` (twice) and `"None — handover complete"`. A derived field yields
   *      ONE value when nothing is blocking. These are two different situations that both have no
   *      blocker, and the field is what distinguishes them.
   *   2. Others name activity by parties this model has no field for at all — a family, a
   *      specialling roster, an escort provider organising a vehicle. There is nothing in state to
   *      compute them from, and there was never going to be.
   *
   * `tests/ward-movement-blocker.test.ts` asserts five of those values are still expressible, so a
   * later narrowing of this type fails a test rather than silently deleting a category.
   *
   * ⚠️ **IT WENT STALE FOR THE WHOLE LIFE OF THE FIELD, WHICH IS THE OTHER HALF.** Until
   * 2026-09-01 the only runtime writer was `RAISE_REFERRAL`, which stamped the literal
   * `"Awaiting coordinator referral"` at creation, and NO stage transition ever touched it again.
   * A patient with transport already en route still read "Awaiting coordinator referral" on the
   * console's **Response** and **Current blocker** lines, so a coordinator chased the wrong
   * patient. Two things fixed that, and both were needed:
   *
   *   - `RECORD_MOVEMENT_BLOCKER`, so a human can say what is actually happening, in their words.
   *   - `STAGE_TRANSITION_BLOCKERS` (ward-flow-reducer.ts), restated by the reducer at every
   *     transition that CONTRADICTS the standing sentence. A blocker the record beside it
   *     disproves is wrong by construction, not merely out of date. ⚠️ The property is not "never
   *     older than the stage": `PULL_PATIENT` and `HANDOVER_READY` both advance the stage and
   *     deliberately leave the sentence alone, because neither is told anything that falsifies it.
   *     See that constant's own comment for why the stronger-sounding claim is the false one.
   *
   * A human's prose overwrites the machine's and stands until the situation next changes — the
   * same way a handover note does. Never `null` and never empty: `RECORD_MOVEMENT_BLOCKER` refuses
   * a blank rather than storing one, because a blank would be indistinguishable from a field
   * nobody had reached yet, which is the exact ambiguity this field spent its life in.
   *
   * ⚠️ Read by `operationalScore` (ward-priority.ts), which awards ten points for an ACTIVE
   * blocker and recognises the `"None — …"` and `"No blocker"` shapes as inactive. A new inactive
   * phrasing must be taught to `hasActiveBlocker` there, or it scores as a live obstruction.
   */
  blocker: string;
  closure?: MovementClosure;
  /** Recorded outcome from the emergency department (Item 19, owner answers 2026-09-17). */
  edOutcome?: "for_discharge" | "for_community_follow_up";
  /** When the patient physically departed the emergency department. */
  leftDepartmentAt?: Instant;
  /** When the referral for examination was made. May precede `openedAt` for a community-formed
   *  patient — the legal clock and the department clock are different clocks. */
  formedAt?: Instant;
  /** When Form 1A was marked as received in the emergency department (Owner ruling 1, 2026-09-16).
   *
   * 🔴 **CORRECTED 2026-09-17, T2r fix round, finding 10 — "starts the 24-hour psychiatric
   * examination countdown clock" IS NOW FALSE.** That computed clock (`FORM_1A_EXAMINATION_WINDOW_HOURS`)
   * was deleted by T2 on owner answer 1: this prototype works out no legal time limits of its own.
   * This field still records the receipt instant itself — `RECORD_LEGAL_FORM_RECEIVED`
   * (`ward-flow-reducer.ts`) still writes it, and nothing here starts a clock from it any longer.
   *
   * 🔴 **T4 (2026-09-17): CAN NOW BE CLEARED, NOT ONLY WRITTEN ONCE.** `CORRECT_LEGAL_FORM_RECEIPT`
   * clears this field back to `undefined` — for a receipt marked in error, against the wrong
   * movement, or before the form had physically arrived — and appends the original instant, who
   * corrected it and why to `legalFormReceiptCorrections` below, so the fact a receipt was once
   * recorded is never simply lost. A second `RECORD_LEGAL_FORM_RECEIVED` may then succeed, exactly
   * as if this field had never been set. */
  legalFormReceivedAt?: Instant;
  /**
   * Earlier receipt records this movement has outgrown, oldest first. T4 (2026-09-17):
   * `CORRECT_LEGAL_FORM_RECEIPT` is a correction, not a silent overwrite — the ORIGINAL
   * `legalFormReceivedAt` instant it cleared is kept here, alongside who corrected it and the
   * fixed reason they gave (`LegalFormReceiptCorrectionReason`,
   * `ward-change-reasons.ts`). `undefined` on a movement whose receipt has never been corrected,
   * including every hand-authored fixture movement.
   */
  legalFormReceiptCorrections?: {
    at: Instant;
    by: WardFlowRole;
    reason: LegalFormReceiptCorrectionReason;
    receivedAt: Instant;
  }[];
  /** How the patient reached the department. Police attendance is a real and invisible pressure. */
  arrivalMode?: "self" | "ambulance" | "police";
  /** When a pulled bed lapses. A pull cannot expire without a time to expire at. */
  pullExpiresAt?: Instant;
  /**
   * WHEN THE COORDINATOR PLANS THE MOVE TO HAPPEN (owner, 26 Sept 2026: "go ahead with your
   * recommendations" — the 48-hour horizon shows demo moves spread across the window rather than
   * every bar at now). A planned time, never a prediction: nothing computes it from a duration.
   * Only the synthetic demo seed sets it today (`ward-demo-planned-moves.ts`); no screen writes it
   * yet. `undefined` means no plan is recorded, and the horizon then draws the move at now.
   */
  plannedMoveAt?: Instant;
  /**
   * The `Admission` this movement's PULL created, while that pull stands.
   *
   * ⚠️ **IT EXISTS SO A RELEASED PULL CAN UNDO ITSELF, AND THAT IS THE WHOLE OF IT.** `PULL_PATIENT`
   * creates a person in a bed; `RELEASE_PULL` must remove exactly the one it created, and
   * `PATIENT_ARRIVED` must mark exactly the one that arrived. Without an id, both events would have
   * to GUESS — "the pulled admission at this unit" is ambiguous the moment two people are pulled to
   * the same ward, which is an ordinary Tuesday rather than an edge case.
   *
   * Carries no fact about a person: it is an internal join between two records this reducer wrote
   * itself, in the same shape as `pullExpiresAt` beside it. Set by `PULL_PATIENT`, cleared by
   * `RELEASE_PULL` (which deletes what it points at), and left in place through arrival so the
   * closed movement still names the person it produced. `undefined` on every movement that has
   * never been pulled — including every movement in the hand-authored seed, whose `pulled` and
   * later stages were authored rather than reached by dispatching the event.
   */
  admissionId?: string;
  /**
   * The source `Admission` at the sending hospital when this movement represents a repatriation
   * or inter-hospital transfer. Kept separate from `admissionId` so that pre-pull movements do not
   * deadlock destination pulls or cause accidental deletion of active stays on referral withdrawal.
   */
  sourceAdmissionId?: string;
  /** The CURRENT psychiatric examination a Form 1A refers the person for. Until it happens you
   *  often do not know whether an authorised bed is needed at all. Superseded by a later
   *  examination only when this one's outcome is `"further_examination_ordered"` — see
   *  `supersededExaminations` below and `RECORD_EXAMINATION`'s own guard. */
  examination?: { at: Instant; outcome: ExaminationOutcome };
  /**
   * Earlier examination records this movement has outgrown, oldest first. Owner item 7
   * (2026-09-17): a repeat examination is a NEW record, not an edit to the old one, so the
   * superseded record is kept rather than overwritten. Populated only when the CURRENT
   * `examination` above superseded one — every entry here therefore has outcome
   * `"further_examination_ordered"`, because that is the only outcome `RECORD_EXAMINATION` ever
   * allows a second examination after. `undefined` on a movement that has never had more than one
   * examination recorded, including every hand-authored fixture movement.
   */
  supersededExaminations?: { at: Instant; outcome: ExaminationOutcome }[];
  /** Referrals ended because another unit accepted. A shrinking `referredUnitIds` tells nobody. */
  /** ⚠️ `reason` is a CODE from `WITHDRAWAL_REASONS`, never free text, and it may never name a
   *  place — `FD-23`. A losing ward reads this field, and it used to carry the accepting
   *  ward's name. See that list's own doc comment for why a type rather than a better
   *  sentence. Render `withdrawalReasonLabels[reason]`, never the code.
   *
   *  RA1 (item 18): `detail?` carries the GRANULAR reason a coordinator chose from
   *  `WARD_REQUEST_WITHDRAWAL_REASONS` when withdrawing ONE ward's request with
   *  `WITHDRAW_WARD_REQUEST` — present only on entries `reason: "coordinator_withdrew"` writes,
   *  `undefined` on the other two causes, which never asked anyone to choose one. Same discipline
   *  as `reason`: a code from a fixed list, never free text, never a place. */
  withdrawnReferrals: {
    unitId: string;
    at: Instant;
    reason: WithdrawalReason;
    detail?: WardRequestWithdrawalReason;
  }[];
  /** Recorded when the network is exhausted. */
  escalation?: { at: Instant; triedUnitIds: string[]; contact: string };
  /** Every pull released and transport job cancelled against this movement, oldest first. Empty
   *  for a movement nothing has ever been unwound on. See `UnwindRecord`'s own doc comment. */
  unwinds: UnwindRecord[];
  /** Every stage transition this movement has made, oldest first, written by the reducer. Empty
   *  either because the movement has made none yet or because it predates this field — the two
   *  are decidable from `stage` alone. See `StageChange`'s own doc comment. */
  stageChanges: StageChange[];
  arrivalDetails?: MovementArrivalDetails;
  /**
   * When a late-arrival notice was raised for this movement. Absent until the engine finds
   * `now` more than an hour past `arrivalDetails.estimatedArrivalAt` with no arrival yet.
   */
  arrivalLateNotifiedAt?: Instant;
  medicalClearance?: { cleared: boolean; at: Instant };
  /** D-34: explicit ED deterioration; ordinary unknown clearance is not this event.
   * The unwind/stage trails retain every occurrence, including after fresh re-clearance. */
  medicalDeterioration?: { at: Instant; by: "ed"; resumedAt?: Instant };
  uploadedForms?: MovementUploadedForm[];
  /**
   * Active legal-form clock computed from an entered start by `ward-legal-clock.ts`. A newer form
   * clears the previous clock. `legalForm.dueAt` is kept in step with `legalClock.expiresAt` when
   * a clock is written so existing screens that read `dueAt` stay honest.
   */
  legalClock?: LegalClock;
  /**
   * Legal mismatch between the person's legal status and the accepting ward (involuntary on a
   * voluntary-only / unauthorised ward, or voluntary on a locked-only ward). Override continues;
   * updating withdraws and lists other wards.
   */
  legalMismatch?: {
    at: Instant;
    unitId: string;
    kind: "involuntary_on_voluntary_ward" | "voluntary_on_locked_ward";
    /** Legacy, never written since 2026-09-25: owner ruling (Josh, "all yes") removed
     *  OVERRIDE_LEGAL_MISMATCH — ward authorisation for an involuntary patient is never overridable.
     *  Kept optional so older demo rows and saved sessions still load. */
    overridden?: boolean;
    overrideReason?: string;
  };
  /**
   * Unit ids currently waitlisting this movement (no bed yet). Cap is `PARALLEL_REFERRAL_CAP`.
   * The first pull drops the others.
   */
  waitlistedUnitIds?: string[];
  /**
   * Expect flag: voluntary past 48h or involuntary past 7 days. Removal is a confirmed action
   * (`CLEAR_EXPECT_FLAG`), never automatic.
   */
  expectFlag?: {
    raisedAt: Instant;
    kind: "voluntary_48h" | "involuntary_7d";
    clearedAt?: Instant;
    clearedBy?: WardFlowRole;
  };
};

/** A transition the reducer refused, surfaced on the coordinator screen rather than swallowed. */
export type Rejection = {
  id: string;
  at: Instant;
  movementId: string;
  attempted: string;
  reason: string;
};

/**
 * A bed release's lifecycle, in the order a bed moves through it. Hand-listed (never derived) for
 * the same reason `DECLINE_REASONS` is: a UI picker needs a runtime list, not just a type.
 *
 * **Three stages since 2026-08-28**, down from four — the product owner's decision, recorded in
 * `docs/ward-flow-phase-6-7-decisions.md` ("The bed model becomes three stages plus a flag").
 * Each stage says how CERTAIN the discharge is, and nothing else. `"blocked"` was removed as a
 * stage and became a flag (`BedRelease.blocker`/`blockedBy`) that sits ON a expected or
 * confirmed release, because being stuck is not a degree of certainty.
 *
 * The defect that forced it, verified in the code before it was raised: `capacityBreakdown`
 * (`ward-bed-availability.ts`) sorted today's releases into `confirmedToday` or `expectedToday`
 * by state, so a release in state `"blocked"` matched NEITHER branch and was counted nowhere.
 * Marking a confirmed discharge blocked silently dropped the ward's confirmed count — the figures
 * improved at the exact moment the ward got stuck. A blocked-but-confirmed bed now keeps counting
 * as confirmed, and `CapacityBreakdown.blockedToday` states how many are stuck beside it.
 *
 * Transitions go BOTH ways: `confirmed` may return to `expected` when a decision is reversed
 * (`REVERT_BED_RELEASE`). The old one-way model did not stop reversals happening — it made wards
 * record them dishonestly.
 */
export const BED_RELEASE_STATES = ["expected", "confirmed", "discharged"] as const;
export type BedReleaseState = (typeof BED_RELEASE_STATES)[number];

/**
 * **The Q1 axis change, landed 2026-08-28** ("The three lists", List 2). This replaces
 * `BED_RELEASE_CONFIDENCE_LEVELS` — the `likely` / `possible` pair Phase 5 shipped — outright.
 *
 * A expected discharge no longer carries HOW CONFIDENT the ward is; it carries WHAT IT IS
 * WAITING ON. The owner's reasoning: confidence asks a ward to estimate a probability, people are
 * poor at that, and worse, two wards' "likely" do not mean the same thing — so a coordinator can
 * neither compare them nor add them up. What a discharge is waiting on is a **fact, not a
 * judgement**: comparable across wards, and actionable. A bed waiting on a ward round is a
 * different prospect from one waiting on a family meeting.
 *
 * **`"Nothing outstanding"` carries more weight than it looks.** It is a expected discharge with
 * no obstacle at all — the closest thing to the old "likely", and the one a coordinator can most
 * safely plan against. Without it the list would force a ward to name an obstacle that does not
 * exist, which is how a fixed list starts producing false records.
 *
 * Provenance, stated because it matters: these words were proposed by an agent session and
 * APPROVED by the product owner. No charge nurse has seen them, and this is the list of the three
 * most in need of a clinician's own words — the owner is not the one held up waiting on a ward
 * round. They ship verbatim; a clinician's wording replaces them verbatim in turn.
 */
export const BED_RELEASE_WAITING_ON = [
  "Awaiting ward round",
  "Awaiting family or carer agreement",
  "Awaiting accommodation",
  "Awaiting community team acceptance",
  /*
   * ═══ TWO ADDED 2026-09-06 — OWNER RULING, CLINICIAN CHECK R6: *"Add those two."* ═══
   * (`docs/ward-flow/clinician-check-rulings-2026-09-06.md`, read at source before this edit.)
   *
   * ⚠️ **A FIXED CLINICAL LIST, EXTENDED BY THE OWNER — NO AGENT MAY ALTER IT FURTHER.** These
   * values ARE the rendered text; there is no label map between them and a coordinator's screen.
   *
   * ⚠️ **ONE DECISION WAS MINE AND IT IS THE INITIAL CAPITAL, NOTHING ELSE.** He wrote the two
   * mid-sentence as *"awaiting legal or Mental Health Act process"* and *"awaiting transport"*. The
   * other five entries begin with a capital and render directly, so a lowercase pair would read as
   * a defect on the screen. **The WORDS are his, unchanged; only the first letter is conformed to
   * the list's existing convention.** If that is wrong it is a one-character revert — flagged to
   * Ward Lead rather than left to be noticed.
   *
   * "Mental Health Act" keeps its capitals because it is the Act's name.
   *
   * ⚠️ **"Awaiting transport" WAS PREDICTED BY THE 24-HOUR PULL RULING AND ARRIVED SEPARATELY.**
   * The owner said a transport can take four hours; a ward waiting on one had no way to say so,
   * because this list offered ward round, family, accommodation, community team, or nothing.
   */
  "Awaiting legal or Mental Health Act process",
  "Awaiting transport",
  /* Stays last: it is the null case, not another thing to wait for. */
  "Nothing outstanding",
] as const;
export type BedReleaseWaitingOn = (typeof BED_RELEASE_WAITING_ON)[number];

/**
 * A bed release names the stay it belongs to (`admissionId`, owner decision 2026-09-25) and nothing
 * else about the departing patient: no timing that could identify them, no reason relating to them,
 * and (spec D11) not even sex, the one otherwise-permitted patient attribute. Every other field
 * below is about the BED or the confirming WARD. `tests/ward-flow-reducer.test.ts` and
 * `tests/ward-bed-availability-model.test.ts` both assert this structurally against the type's own
 * field set, not against fixture content.
 */
export type BedRelease = {
  id: string;
  unitId: string;
  /**
   * THE STAY THIS RELEASE BELONGS TO — owner decision, Josh, 25 September 2026: *a bed release is a
   * named patient's discharge.* Required, never null, and always an `Admission.id` on this same
   * `unitId`. `FLAG_BED_RELEASE` refuses to create a release without one.
   *
   * It is what makes the free-bed count move exactly once. When this admission leaves
   * (`RECORD_LEAVING` / `RECORD_PATIENT_DISCHARGE`, both through `departAdmission`), this release
   * completes to `"discharged"` in the same write that raises the ward's figures. Before this field
   * existed, the reducer guessed which departure matched which release by comparing ward-wide counts,
   * with two seeded ids hard-coded as exceptions.
   *
   * A JOIN KEY, NOT A DISPLAY FIELD. No screen renders it, and no audit record copies it. A bed that
   * comes free for any other reason (cleaning, repairs) is not a `BedRelease` at all. It belongs to
   * the blocked and closed-bed records.
   */
  admissionId: string;
  state: BedReleaseState;
  expectedAt: Instant;
  /**
   * What this discharge is still waiting on, chosen from `BED_RELEASE_WAITING_ON`. Non-null only
   * while `state` is `"expected"` — a confirmed discharge is a decision, not something still
   * being waited on, and a released one has already happened.
   *
   * Renamed from `confidence` by the Q1 axis change of 2026-08-28. Keeping the old name over the
   * new values would have put "Awaiting ward round" in a field called `confidence` on a screen a
   * coordinator reads as fact, which is the kind of quiet mismatch this project treats as a
   * defect rather than a cosmetic point.
   *
   * `"Nothing outstanding"` is a legitimate value, not an absence: it means a expected discharge
   * with no obstacle. `null` means the release is not expected at all. The two are different and
   * must not be collapsed.
   */
  waitingOn: BedReleaseWaitingOn | null;
  /**
   * **The blocked FLAG's reason** (bed-model rework, 2026-08-28). Non-null means this discharge
   * is decided-or-expected AND currently stuck; it may sit on a `"expected"` release or on a
   * `"confirmed"` one, and a blocked-but-confirmed release still counts as confirmed. Always
   * `null` on a `"discharged"` release — once the bed is free there is nothing left being held up.
   *
   * Before this rework `blocked` was a fourth STATE and this field was legal only in it, which
   * is what made a stuck confirmed discharge fall out of the ward's confirmed count entirely.
   * Always a `BedReleaseBlocker` — enforced by the type here, and by a membership check against
   * `BED_RELEASE_BLOCKERS` in the reducer.
   */
  blocker: BedReleaseBlocker | null;
  /**
   * The role that recorded the block, non-null exactly when `blocker` is. A role — a unit or
   * service label — never a personal name, the same discipline `confirmedBy` holds to. Kept
   * separate from `confirmedBy` because the two answer different questions once a block can
   * outlive a state change: `confirmedBy` is who last reported this release's stage, this is who
   * said it was stuck (Q3: provenance stays a role and a timestamp, never a person).
   */
  blockedBy: string | null;
  /**
   * Q4 of the 2026-08-28 decisions: this bed is being MADE READY (cleaning and the like).
   * **Informational only — it must NEVER gate allocation.** A bed being prepared is still
   * offered, still counts in `availableNow`, and still appears in every figure, because the pull
   * of the next patient takes hours anyway. See `BED_PREPARATION_NOTES` for the full reasoning.
   */
  preparing: boolean;
  /**
   * What the bed is waiting on to be ready, chosen from `BED_PREPARATION_NOTES` — the owner
   * supplied that list on 2026-08-28, so the field is now expressible where it could previously
   * only be `null`. `null` alongside `preparing: true` remains legal and means "being made ready,
   * reason not stated"; `preparing: false` forces it null, because "not being made ready, waiting
   * on a clean" is a contradiction.
   *
   * **A note here still gates NOTHING.** See `preparing` above and `BED_PREPARATION_NOTES`.
   */
  preparationNote: BedPreparationNote | null;
  confirmedAt: Instant;
  /** A role — a unit or service label. Never a personal name. */
  confirmedBy: string;
};

/**
 * A bed occupied by someone on approved leave. **It is its own count and is never merged into
 * `available` (spec D4).** Names the stay it belongs to (`admissionId`, owner ruling 2026-09-25) and
 * nothing else about the person on leave: no reason, no destination.
 *
 * 🔴 **`usable` WAS REMOVED 2026-09-06 — OWNER RULING 11, VIA WARD LEAD.** This type used to say
 * *"it may or may not be fillable while they are away, and a coordinator needs to see which"*, and
 * carried `usable: boolean` — **the ward's statement that the bed could be filled while its occupant
 * was away.** The ruling is that a bed on leave is **not** one a ward would offer, so the field asked
 * a ward to assert exactly what the ruling denies.
 *
 * ⚠️ **THE FIGURE'S MEANING CHANGED WITH IT, AND THIS IS NOT A RENAME.** `capacityBreakdown` counted
 * `leaveUsable` = leave beds flagged usable; it now counts `onLeave` = **beds on leave**. Same
 * population, one assertion fewer. Nothing merges into `availableNow` in either version.
 */
export type LeaveBed = {
  id: string;
  unitId: string;
  /**
   * THE STAY THIS LEAVE BELONGS TO — owner ruling, Josh, 25 September 2026 (11:50): *each bed on
   * leave is linked to the patient stay it belongs to, the same way bed releases are.* Required,
   * never null, and always an `Admission.id` on this same `unitId` whose `state` is `"occupied"`.
   * `RECORD_LEAVE_BED` refuses to create one without it, and refuses a second for the same stay.
   *
   * It ends when the stay ends: leaving (`RECORD_LEAVING` / `RECORD_PATIENT_DISCHARGE`, both through
   * `departAdmission`) removes this record in the same write, so "on leave" can never count a bed
   * whose occupant has already left.
   *
   * A JOIN KEY, NOT A DISPLAY FIELD. It is never merged into availability (spec D4). Adding it
   * changes no bed figure.
   */
  admissionId: string;
  expectedReturn: Instant;
  confirmedAt: Instant;
  /** A role. Never a personal name. */
  confirmedBy: string;
  /**
   * Off-ward leave and medical trips both count as leave beds. After 24 hours the engine may set
   * `openWarningAt` so screens can warn; a person still opens the bed (`END_LEAVE_BED`).
   */
  kind?: "off_ward" | "medical_trip";
  /** When the 24-hour "consider opening" warning was raised. Absent until then. */
  openWarningAt?: Instant;
  /**
   * Absent without leave (Patient page gate board, owner approval 9 Oct 2026). Present only while
   * the person is missing: the bed stays held exactly as it does for leave, so no bed figure moves.
   * `since` is when the ward recorded the absence. `steps` lists each missing person step done, a
   * fixed choice and the time it was recorded, never typed text. A list of `{ step, at }` rather than
   * a map keyed by step, so `at` moves with every other time when the demo clock re-anchors
   * (`ward-reanchor.ts` shifts by field name). Ended by `END_LEAVE_BED` on return.
   */
  absentWithoutLeave?: { since: Instant; steps: { step: AbsenceStep; at: Instant }[] };
};

/**
 * The missing person steps a ward records while somebody is absent without leave, in the order the
 * Patient page shows them. Chosen, never typed. A step records only that it was done and when.
 */
export const ABSENCE_STEPS = [
  "searched",
  "psychiatrist_told",
  "description_recorded",
  "police_notified",
  "next_of_kin_told",
] as const;
export type AbsenceStep = (typeof ABSENCE_STEPS)[number];

export const ABSENCE_STEP_LABELS: Record<AbsenceStep, string> = {
  searched: "Ward and grounds searched",
  psychiatrist_told: "Treating psychiatrist told",
  description_recorded: "Description recorded",
  police_notified: "Police notified",
  next_of_kin_told: "Next of kin told",
};

/**
 * Phase 7 (spec "The front door"): where a referral entered the network. A referral itself
 * carries no patient location — only where the request came FROM, and only as one of a fixed,
 * synthetic set of channels, never a service name that could identify a specific team.
 *
 * ⚠️ **SOURCE IS WHO SENT IT; `originSiteCode` IS WHERE IT CAME FROM. Two questions, and this
 * field answers only the first.** Nothing derives one from the other, and they sit at different
 * granularities deliberately: a source is a channel, a site code is a HOSPITAL. **Neither is a
 * department, and no field on a `Referral` is** — ED identity lives on `Movement.originEdId` and
 * on the ED destination arm's `edId`, never on a referral's origin. A screen that promises to say
 * which department a referral came from is promising something this type cannot carry.
 *
 * **`ed_medical` — owner ruling, 2026-09-06:** *"ED medical staff will refer a patient and ED
 * psychiatry staff will add it to the referral board. The patient were officially referred from
 * ED in the referral location."* That is two facts about one referral and they land in the two
 * fields above: ED medical staff are the SOURCE, the emergency department is the LOCATION —
 * carried as its hospital's site code, which is the finest thing that exists here.
 *
 * ⚠️ **IT IS NOT CALLED `emergency_department`, AND THAT IS A DECISION RATHER THAN A PREFERENCE.**
 * That exact string is already a `REFERRAL_DESTINATION_KINDS` value on this same record — and per
 * its own comment it does not even mean "goes to an ED" there; it is ED psychiatry's
 * self-addressed inbox. **One referral carrying the identical string in two fields meaning two
 * different things is a defect nobody sees until they happen to read both.** The owner's words
 * name the REFERRER rather than the place, so the value does too.
 *
 * ⚠️ **ONLY THE LABEL IS THE OWNER'S.** "ED medical staff" is quoted from him verbatim and lives
 * in the two `SOURCE_LABELS` maps. `ed_medical` is an identifier that reaches no screen, ruled by
 * Ward Lead 2026-09-06 on exactly that distinction: fixed lists are the owner's **where he sees
 * them**, and taking an internal value to him is asking him to name a variable.
 *
 * ⚠️ **A REFERRAL FROM `ed_medical` MUST COME FROM A SITE THAT HAS AN EMERGENCY DEPARTMENT**, and
 * `RECEIVE_REFERRAL` enforces it — see `ward-flow-reducer.ts`. **Nine sites in `wardSites` have
 * none** (Fremantle, Bentley and the country sites). Without that check the model accepts a
 * referral from the emergency department of a hospital that has no emergency department, and it
 * renders as a clean, plausible row that nothing anywhere contradicts.
 *
 * **`gp` — owner answer 25, 2026-09-17, verbatim:** *"GP referrals: the GP is told by phone or
 * letter for now; add 'GP' as a referral source."* This supersedes his earlier 2026-09-11 answer
 * ("NO. They come through ED or community.") that kept `gp` out of this list — see
 * `docs/ward-flow/owner-answers-2026-09-17.md` item 25 and `shell/ward-facade.ts`'s own comment on
 * the answer it replaces. Recorded so a GP referral can be attributed honestly; the app itself
 * still contacts nobody on its behalf. `referralReferrer` (`ward-flow-reducer.ts`) resolves no
 * addressee for `gp`, exactly like `community`/`crisis_service`/`ambulance`/
 * `inter_hospital` — see that function's own doc comment, which this addition does not change.
 */
export const REFERRAL_SOURCES = [
  "community",
  "crisis_service",
  "ambulance",
  "inter_hospital",
  "ed_medical",
  "gp",
  /**
   * Ward-to-ward stepdown / transfer request. Same referral path as an emergency referral; the
   * sending ward is named on `Referral.originUnitId`. The sending bed stays occupied until arrival.
   */
  "psychiatric_ward",
] as const;
export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

/** A referral's own lifecycle — deliberately separate from `MovementStage`, which belongs to a
 *  movement already inside the department. A referral is a request for a bed, not yet a person
 *  in a department bed. */
export const REFERRAL_STATES = ["queued", "accepted", "declined"] as const;
export type ReferralState = (typeof REFERRAL_STATES)[number];

/**
 * Task 1's privacy discipline, carried into decline reasons the same way `BED_RELEASE_BLOCKERS`
 * (`ward-change-reasons.ts`) carries it for a bed release: every entry describes the SERVICE's
 * answer or the NETWORK's state, never the person referred. `"no_suitable_bed"` and
 * `"secure_bed_unavailable"` are the network having nothing that fits; `"age_band_not_provided_here"`
 * and `"sex_designation_unavailable"` are the network's own capability gaps (this site does not run
 * that cohort, or has no bed of a workable designation left), not a judgement on the referral;
 * `"belongs_to_another_service"` and `"referred_elsewhere"` are administrative facts about where
 * the request belongs — and `"belongs_to_another_service"` is deliberately NOT spelled
 * `"out_of_catchment"`, which it was until Phase 8 Task 6: "out of catchment" names a boundary
 * this system does not hold for anybody, so the label asserted a check nothing performs. The
 * renamed reason states only what a coordinator can actually know and say, and it stays distinct
 * from `"referred_elsewhere"` (this request is another service's to answer, versus this request
 * has already been sent on somewhere else). None of these is a figure, timeframe or threshold
 * from the Mental Health Act, and none reads as being about the person's presentation or
 * behaviour — the same bar that kept "Pending case review outcome" out of
 * `BED_RELEASE_BLOCKERS` ("case review" reads as about the patient's own case, not the
 * bed/service).
 *
 * ⚠️ THE CATCH-ALL, AND IT EXISTS BECAUSE THE ALTERNATIVE WAS A DEAD END.
 *
 * Owner decision, 2026-09-02: a ward must state why it is refusing a patient, which closed a
 * defect where a ward that pressed Decline without touching the control was recorded as saying
 * "no suitable bed". ⚠️ THAT FIX CREATED A NEW PROBLEM: a ward whose real reason is not one of
 * the other six could then not decline AT ALL. Asked to choose between a chosen catch-all, free
 * text, and leaving the ward stuck, he chose the catch-all.
 *
 * ⚠️ NEVER FREE TEXT, and that is the same rule `homeRegion` records for itself. Free text
 * cannot be counted or compared, and it is where identifying details about a patient leak into
 * an operational field.
 *
 * ⚠️ AND IT IS A DELIBERATE CHOICE, NOT AN ABSENCE. A ward picks this on purpose, which is a
 * different thing from the unchosen state the control starts in — that one refuses to submit.
 * This one says "none of the other six, ring me", which is a real answer a coordinator can act on.
 */
export const REFERRAL_DECLINE_REASONS = [
  "no_suitable_bed",
  "age_band_not_provided_here",
  "sex_designation_unavailable",
  "secure_bed_unavailable",
  "belongs_to_another_service",
  "referred_elsewhere",
  "another_reason",
] as const;
export type ReferralDeclineReason = (typeof REFERRAL_DECLINE_REASONS)[number];

/**
 * ⚠️ **THE REASONS AN EMERGENCY-DEPARTMENT-ADDRESSED DECLINE MUST NOT OFFER, AND WHY EACH ONE IS
 * EXCLUDED.** Moved here from `ed-screen.tsx` (2026-09-17, community-decline engine fix) so that
 * screen's own inbox, the reducer's own per-destination-kind membership check on `DECLINE_REFERRAL`
 * (`ward-flow-reducer.ts`), and any other surface that answers on an ED's behalf can share one list
 * rather than each hand-copying or re-deriving it.
 *
 * An ED-addressed referral asks a psychiatry team to SEE A PATIENT (`purpose:
 * "psychiatric_review"`), never for a bed — so the four reasons below are answers to a question
 * that destination was never asked, each one naming a property of a BED that could not be
 * supplied:
 *
 *   `no_suitable_bed`             — no bed was sought here.
 *   `secure_bed_unavailable`      — a bed's security level; no bed was sought here.
 *   `age_band_not_provided_here`  — which age band a UNIT admits; this team admits nobody.
 *   `sex_designation_unavailable` — a BED's sex designation; this team designates no bed.
 *
 * Offering one would let a clinician file "No suitable bed" against a request for a review, which
 * reads on the record as a bed refusal that never happened.
 */
export const BED_SHAPED_DECLINE_REASONS: readonly ReferralDeclineReason[] = [
  "no_suitable_bed",
  "secure_bed_unavailable",
  "age_band_not_provided_here",
  "sex_designation_unavailable",
];

/**
 * The reasons an ED-addressed decline may give, DERIVED by removing the bed-shaped four from
 * `REFERRAL_DECLINE_REASONS` — never hand-listed as the three that survive.
 *
 * ⚠️ **THE DIRECTION OF THE FILTER IS THE POINT.** A hand-written `["belongs_to_another_service",
 * "referred_elsewhere", "another_reason"]` keeps its shape when the model's list grows, so a
 * further reason added to `REFERRAL_DECLINE_REASONS` would silently never reach an ED destination
 * and nothing would fail. Written as an EXCLUSION, a new reason is offered by default and has to be
 * argued out deliberately.
 *
 * Also the reducer's own membership vocabulary for an `emergency_department` decline
 * (`DECLINE_REFERRAL`'s destination-kind-scoped check, `ward-flow-reducer.ts`) — see that check's
 * own comment for why a decline is validated against the list for the DESTINATION KIND that
 * answered, never against `REFERRAL_DECLINE_REASONS` whole.
 */
export const ED_DECLINE_REASONS: readonly ReferralDeclineReason[] = REFERRAL_DECLINE_REASONS.filter(
  (reason) => !BED_SHAPED_DECLINE_REASONS.includes(reason),
);

/**
 * 🔴 **A COMMUNITY TEAM DECLINING A REFERRAL IS A DIFFERENT ACT FROM A WARD DECLINING A BED, AND
 * THESE ARE TWO LISTS BY OWNER RULING (O-16.6, 2026-09-12).**
 *
 * ⚠️ **THE MEASUREMENT, RECORDED HERE BECAUSE THE RULING REQUIRES IT AND BECAUSE THE NEXT READER
 * WILL OTHERWISE MERGE THESE TWO HELPFULLY.** The approved community drawing names five outcomes.
 * Against `REFERRAL_DECLINE_REASONS` directly above, the overlap in meaning is **ZERO — not one of
 * the seven fits**:
 *
 *     the seven, above       no suitable bed · age band not provided here · sex designation
 *                            unavailable · secure bed unavailable · belongs to another service ·
 *                            referred elsewhere · another reason
 *     the community four     outside the catchment · needs inpatient care rather than community
 *                            follow-up · the person declined or could not be reached · already
 *                            open to a peer team
 *
 * 🔴 **The seven are about a BED. The four are about a SERVICE and a PERSON.** One shared list forces
 * both into wording that fits neither.
 *
 * ⚠️ **THE NEAREST PAIR IS THE TRAP AND IT IS NOT A NEAR-MISS.** `belongs_to_another_service` and
 * *"already open to another community team"* read as interchangeable and are different claims: the
 * first says **this is not our service**, the second says **a peer team already holds this person**.
 * Merging them puts a wrong reason against a real refusal, and this codebase's own words about a
 * neighbouring list are that **a wrong reason is worse than a blunt one**.
 *
 * 🔴 **FOUR MEMBERS, AND THE DRAWING'S FIFTH ROW IS DELIBERATELY ABSENT (O-18.1).** That row is
 * *"Withdrawn by the referrer before assessment"*, **which is not a decline**: a decline is the
 * receiving service saying no, a withdrawal is the sender saying never mind. **O-17.11 ruled a
 * withdrawal a FIELD on the addressing for exactly that reason, and putting it here would flatter or
 * damn a team for something it did not do.** The table still renders five rows — the fifth's number
 * comes from the withdrawal field, not from this vocabulary.
 *
 * **Keys here, words in `COMMUNITY_DECLINE_REASON_LABELS` (`ward-referrals.ts`)** — the same split
 * the seven above use, and bound by `Record<CommunityDeclineReason, string>`, so a member without a
 * label is a compile error rather than a blank on a screen. **The words are the drawing's own,
 * copied and never retyped.**
 */
export const COMMUNITY_DECLINE_REASONS = [
  "outside_the_teams_catchment",
  "needs_inpatient_care_not_community_follow_up",
  "client_declined_or_could_not_be_contacted",
  "already_open_to_another_community_team",
] as const;
export type CommunityDeclineReason = (typeof COMMUNITY_DECLINE_REASONS)[number];

/**
 * Phase 7 fix round B (this task): "A sixth answer, given mid-build" in
 * `docs/ward-flow-phase-6-7-decisions.md`. A referral records the broad area a person is from —
 * a REGION, chosen from this fixed list, never an address, never a postcode, never free text.
 * Real Western Australian regions, permitted by roadmap decision 12 ("real WA place names for
 * geography and distance only") — a region name is public geography, not a fact the prototype
 * invented about anyone's home. `RECEIVE_REFERRAL` (`ward-flow-reducer.ts`) membership-checks
 * every referral's `homeRegion` against this array, the same discipline `REFERRAL_SOURCES` and
 * `REFERRAL_DECLINE_REASONS` already hold to, so an address can never be entered where a region
 * belongs.
 *
 * This field exists so a later phase can ask "how far from home was this person placed", never
 * to compute a distance or a travel-time band itself — that calculation is Phase 8's, deliberately
 * not built here. See the decisions doc for why the field is needed now: the out-of-area equity
 * measure the roadmap names "the one with teeth" would otherwise measure distance from the
 * referring hospital, not from home, because that is the only geography the system holds today.
 */
export const HOME_REGIONS = [
  "Perth Metropolitan",
  "Peel",
  "South West",
  "Great Southern",
  "Wheatbelt",
  "Goldfields-Esperance",
  "Mid West",
  "Gascoyne",
  "Pilbara",
  "Kimberley",
] as const;
export type HomeRegion = (typeof HOME_REGIONS)[number];

/**
 * Where a referral is ADDRESSED, and the criteria that destination can answer.
 *
 * Owner ruling, 2026-08-30: every referral is a request that can be accepted or declined. There is
 * no notification-only kind — a ward asking an ED to see someone, and a ward asking a community
 * team to follow someone up, are both requests, and both can be declined even though they rarely
 * are. So ONE verb and ONE lifecycle serve all four destinations, and **what varies between them is
 * the criteria, nothing else.**
 *
 * That is the whole reason this is a union rather than a `kind` string beside a flat field list.
 * A destination that carried only an address would let one screen ask a community team about bed
 * security. Here it cannot: **the community arm has no such field, so the question cannot be
 * spelled**, and `referralEligibility` (`ward-eligibility.ts`) cannot be called with anything but a
 * ward referral because the criteria it reads exist on no other arm. That is a compiler guarantee,
 * not a screen remembering.
 *
 * **What each arm carries, and why the other two carry nothing.** Capacity, sex mix, security and
 * authorisation are all properties of a BED. An ED is being asked a medical question and a
 * community team is answered by a team rather than a bed, so none of the four applies to them —
 * not "does not apply yet", but has no meaning there at all.
 *
 * **THERE IS NO `medical_ward` ARM, AND ITS ABSENCE IS A DECISION, NOT AN OVERSIGHT.** Owner,
 * 2026-08-30: "just route to ED which also includes medical ward" — a psychiatric ward sending
 * someone for a medical problem addresses the ED, and the ED is where a medical ward is reached
 * from. An arm for it was built and taken out again on that ruling. Recorded here so the next
 * reader who notices a psych ward can refer to a medical ward in real life does not add the arm
 * believing it was forgotten: it was considered, and deferred, with a reason.
 *
 * **NO ARM CARRIES AN ADDRESS OR A STATE.** An arm says what a destination IS and what it can be
 * asked; `ReferralAddressing` below says where a particular referral was sent and what came back.
 * Keeping the two apart is what stops a lifecycle field being read as a criterion — the union is
 * matched against beds, and a `state` inside it would sooner or later be matched against one too.
 *
 * (This comment previously recorded multi-destination as an OPEN QUESTION. Owner ruling FD-21,
 * 2026-08-30, settled it: one referral, several destinations, chosen in one act.)
 */
export const REFERRAL_DESTINATION_KINDS = ["psychiatric_ward", "emergency_department", "community_team"] as const;
export type ReferralDestinationKind = (typeof REFERRAL_DESTINATION_KINDS)[number];

export type ReferralDestination =
  | {
      kind: "psychiatric_ward";
      /** Selected recipient. Absent on legacy network-wide requests. */
      unitId?: string;
      /**
       * Compared to a unit's `sexMix` and `sexDesignation` by equality. A fact about the person,
       * and the ONLY one that sits on an arm rather than on the referral itself — it is here
       * because it is read solely to match a bed's designation, and no other destination has one.
       */
      sex: RecordedSex;
      /**
       * T10, item 8: the gender recorded at referral — see `Movement.gender`'s doc comment for
       * why this is a separate, wider fact from `sex` immediately above and from
       * `Patient.gender`. Absent means not yet recorded.
       */
      gender?: ReferralGender;
      /** Whether THIS REQUEST needs a secure bed. Never a fact stored about the person. */
      secureBedNeeded: boolean;
      /**
       * Whether THIS REQUEST needs a bed that can hold someone involuntarily — never a fact stored
       * about the person, and never a legal determination. Same convention as `secureBedNeeded` and
       * roadmap decision 5's cohort framing: the request needs an adolescent bed, a secure bed, or
       * here, a bed that can hold someone involuntarily — the word never attaches to the patient.
       * Introduces no figure, timeframe or threshold from the Mental Health Act; a plain
       * Voluntary/Involuntary bed label was already permitted, and this is the same category.
       */
      involuntaryBedNeeded: boolean;
      /**
       * Whether THIS REQUEST needs high-acuity nursing. Same convention as the two above: a fact
       * about the request, never one stored about the person, and never a score, risk or
       * assessment. **The referring clinician marks it at referral** — owner ruling 2026-09-10,
       * chosen over the system working it out. Read only to ask whether a ward is staffed for a
       * high-acuity place; see the `acuity` gate in `ward-eligibility.ts` for why nothing here
       * may be turned into a remaining count.
       */
      highAcuityNursingNeeded: boolean;
    }
  | {
      kind: "emergency_department";
      /**
       * WHICH department. Required on every ED destination, whoever sent it and whyever.
       *
       * ⚠️ **THE ARM IS CALLED `emergency_department` AND THE REFERRAL DOES NOT GO TO ONE.** It
       * goes to the PSYCHIATRY SERVICE AT one — including the ward→ED medical notification, which
       * exists so that psychiatry know. ED medical staff are not users of this system at all:
       * `FD-16` records that their request arrives verbally, by phone or conversation, and
       * psychiatry then raise a referral addressed to themselves. That verbal step is the owner's
       * described workflow, not a gap somebody forgot to close.
       *
       * The name was kept rather than changed to `ed_psychiatry`, deliberately: renaming churns
       * every exhaustive switch over `REFERRAL_DESTINATION_KINDS` for a naming nuance a comment
       * carries just as well. **This comment IS the carrier — losing the fact is the cost that
       * matters, not the name.**
       */
      edId: string;
      /** WHY. See `REFERRAL_PURPOSES` — a separate axis from `kind`, on purpose. */
      purpose: ReferralPurpose;
    }
  | {
      kind: "community_team";
      /**
       * WHICH TEAM. Required on every community destination, and the whole point of this arm.
       *
       * ⚠️ **THIS FIELD EXISTS BECAUSE THE OWNER REVERSED THE RULE THAT USED TO STAND IN FOR IT.**
       * The community hub WIP (`2e9499fb`) decided whether a patient belonged to a team by comparing
       * the patient's `homeRegion` with the team's region. The owner ruled, 2026-08-31, that
       * association comes from a team NAMED ON THE REFERRAL and that home region is only a
       * geographic guess. Until this field existed the correct rule could not be spelled at all, so
       * the WIP was not merely wrong — it was the only thing the model could express.
       *
       * ⚠️ **SEEDED FROM THE CATCHMENT TABLE, DECIDED BY THE REFERRER, AND THEN FIXED.** The suburb
       * lookup in `ward-catchment.ts` proposes a clinic; it does not settle one. That table answers
       * `contested`, `unreviewed` and "not in the table" as often as it answers cleanly, and
       * `referral-destination-options.ts` deliberately refuses to collapse a contested reading to a
       * winner. So the value stored here is the team a person CHOSE for this referral, not a lookup
       * replayed later — which is what makes it stable when the table is edited, and what makes a
       * referral to a team outside the table representable at all.
       *
       * ⚠️ **AND IT IS A NAME, NOT AN ID INTO A REGISTRY, ON PURPOSE.** The catchment source names
       * clinics as strings and this system holds no authoritative registry of WA community teams;
       * minting ids for them would assert a roster nobody has ruled on. `COMMUNITY_TEAMS` in
       * `ward-teams.ts` is NOT that registry — it is ten placeholder names keyed by `HomeRegion`,
       * built for the board's "going back to" line, and keying association off it would re-introduce
       * region-derived membership through the back door. Never read it here.
       */
      teamName: string;
    };

/**
 * WHY A REFERRAL WAS ADDRESSED TO AN EMERGENCY DEPARTMENT — a separate axis from WHERE.
 *
 * `FD-15`/`FD-11`. Three flows address a department and none of them means the same thing: a
 * community service asking for a **bed**, ED psychiatry addressing **themselves** for a review
 * (`FD-16`'s self-addressed inbox, which is the whole mechanism), and a ward telling ED about a
 * **medical** problem.
 *
 * ⚠️ **IT IS A FIELD, NOT A KIND, AND THAT IS THE DECISION RATHER THAN A DETAIL.** A fourth
 * destination kind encoding "psychiatric review at an ED" would put the WHY inside the WHERE, and a
 * bed request would then be answered by the same affordance as a review request — which is how one
 * silently becomes the other.
 *
 * ⚠️ **AND IT EXISTS TO KILL A SPECIFIC WORKAROUND THAT WAS FOUND AND REFUSED RATHER THAN
 * SHIPPED:** inferring "addressed to itself" from `originSiteCode === department.siteCode`. That
 * compiles, reads correctly, and drops the ward→ED MEDICAL notification straight into the
 * psychiatry inbox — because a psychiatric ward at the same hospital shares that site code. It is
 * wrong on exactly the case the spec names, which is the case nobody re-reads after implementing
 * from it. `FD-18` is the general form; `tests/ward-referral-ed-destination.test.ts` is the guard.
 *
 * ⚠️ **AND THERE IS A SECOND, PERMITTED PIECE OF REASONING THAT LOOKS IDENTICAL TO THE REFUSED ONE.
 * The distinction is written here because a reader who collapses them will be reasoning correctly
 * from what is in front of them.** `REFERRAL_SOURCES`'s `ed_medical` plus `originSiteCode` DOES
 * identify one emergency department, because a `Site` carries at most one (`emergencyDepartment`
 * is a single optional field and `allEmergencyDepartments()` is a flatMap over it).
 *
 * **That is allowed, and the refused inference above is not, for one reason: it derives the
 * department from a fact somebody RECORDED, not from a coincidence.** The refused version reads
 * meaning out of two site codes happening to match — which they also do for a psychiatric ward at
 * the same hospital, so it answers a question nobody asked it. `ed_medical` was chosen by the
 * person raising the referral and means only itself.
 *
 * ⚠️ **The permission is exactly that wide and no wider.** It licenses resolving WHICH department
 * an `ed_medical` referral came from. It does not license inferring a `ReferralPurpose`, a
 * destination, or self-addressing from any site code, ever.
 *
 * Only the ED arm carries it. A psychiatric-ward destination is asking for a bed and a community
 * team is not, so giving them a purpose would mean inventing values nobody has ruled on — and a
 * fixed list in this project is the owner's to write.
 */
export const REFERRAL_PURPOSES = ["bed", "psychiatric_review", "medical_assessment"] as const;
export type ReferralPurpose = (typeof REFERRAL_PURPOSES)[number];

/**
 * ONE DESTINATION THIS REFERRAL WAS SENT TO, AND WHAT THAT DESTINATION ANSWERED.
 *
 * Owner ruling FD-21, 2026-08-30: a referrer chooses several destinations in ONE act — not repeat
 * referrals — up to `PARALLEL_REFERRAL_CAP`. So a referral holds a list of these, and each one is
 * answered independently.
 *
 * **WHY THE STATE IS HERE AND NOT ON THE REFERRAL**, which is the whole reason this type exists.
 * A referral used to carry one `state`, one `decidedAt`, one `decidedBy`, one `declineReason` and
 * one `acceptedUnitId`, because there was one thing to decide. Two rulings make that impossible:
 *
 *   FD-24 — a decline locks nobody out, so one destination may decline while the others stay live.
 *           A referral whose ward said no is NOT a declined referral.
 *   FD-22 — the first acceptance cancels the rest. "Cancelled" is a state only a destination can
 *           be in; a referral is never cancelled, it is accepted.
 *
 * A plural list with the state left on the referral would have compiled and passed everything and
 * been unable to express either ruling.
 *
 * **And `cancelled` is why no separate withdrawal record exists here.** `Movement.withdrawnReferrals`
 * holds the same meaning for its own subject — a person already inside a department — and keeps it.
 * One meaning on two subjects is not a duplicated concept; two different NAMES for one meaning would
 * be. Kept deliberately distinct from FD-5, a referrer withdrawing, which is an act by a person
 * rather than a consequence of somebody else's acceptance, and which has no event yet.
 */
export const REFERRAL_ADDRESSING_STATES = ["queued", "accepted", "declined", "cancelled"] as const;
export type ReferralAddressingState = (typeof REFERRAL_ADDRESSING_STATES)[number];

export type ReferralAddressing = {
  /** Explicitly placed on a recipient waitlist; still awaiting an answer. */
  waitlistedAt?: Instant;
  destination: ReferralDestination;
  state: ReferralAddressingState;
  /** When this destination answered, or when acceptance elsewhere cancelled it. */
  decidedAt?: Instant;
  /** A ROLE, never a person — see `WARD_FLOW_ROLE_LABELS`. Absent on a `cancelled` addressing,
   *  because nobody decided it: it is a consequence of an acceptance, not an act. */
  decidedBy?: string;
  /**
   * Only on a `declined` addressing. From `REFERRAL_DECLINE_REASONS` when `destination.kind` is
   * `psychiatric_ward` or `emergency_department` (the latter further narrowed to
   * `ED_DECLINE_REASONS` by convention, never enforced by this type); from
   * `COMMUNITY_DECLINE_REASONS` when `destination.kind` is `community_team` — O-16.6, community-
   * decline engine fix, 2026-09-17. `DECLINE_REFERRAL` (`ward-flow-reducer.ts`) holds the two
   * vocabularies apart at runtime, since this field's own type cannot narrow per destination kind —
   * see that case.
   */
  declineReason?: ReferralDeclineReason | CommunityDeclineReason;
  /**
   * Only on an `accepted` addressing, and only from `OVERRIDE_REASONS` — the SAME vocabulary the
   * three placement events use, deliberately not a second one. Set when the ward accepted a
   * referral that failed a judgement gate (age, legal status, sex designation, forensic, security,
   * sex mix), which is permitted with a reason recorded and refused without one.
   *
   * ⚠️ Its ABSENCE on an accepted addressing means the referral passed every gate — not that
   * nobody bothered to type a reason. The reducer refuses the acceptance outright in that case, so
   * an accepted-and-unreasoned addressing is only ever a clean one.
   */
  acceptOverrideReason?: OverrideReason;
  /** The unit that accepted. Only ever set on a `psychiatric_ward` addressing — the other three
   *  are answered by a person or a team, and have no unit to name. */
  acceptedUnitId?: string;
  /** FD-5 — when the referrer took this referral back. A FIELD, not a fifth state (O-17.11), and
   *  set on every destination still `queued` at that moment: the referrer takes back the REFERRAL,
   *  not one ward's copy of it. A destination that already answered keeps its answer. The reasoning,
   *  and the three same-shaped events it must not be confused with, are on
   *  `RECORD_REFERRER_WITHDRAWAL` (`ward-flow-events.ts`) and in its reducer case. */
  withdrawnAt?: Instant;
  /** The ROLE that wrote it down — never the person who withdrew, who is the referrer and outside
   *  this system. Deliberately not `withdrawnBy`: that name reads as the first and would hold the
   *  second. Like `decidedBy`, see `WARD_FLOW_ROLE_LABELS`. */
  withdrawalRecordedBy?: string;
  /**
   * Owner ruling 11 (2026-09-17): only set when `RECORD_REFERRER_WITHDRAWAL` withdrew THIS one
   * destination alone (`destinationKind: "community_team"`), never on a whole-referral withdrawal —
   * that act carries no reason at all (see that event's own doc comment, `ward-flow-events.ts`, for
   * why). Reuses `WardRequestWithdrawalReason`, the one existing fixed vocabulary for "why a person
   * took back one destination's own live request", rather than a second list for this narrower act.
   */
  withdrawalReason?: WardRequestWithdrawalReason;
};

/** The ward arm, named so signatures can require it. */
export type WardReferralDestination = Extract<ReferralDestination, { kind: "psychiatric_ward" }>;

/**
 * One addressing whose destination is a psychiatric ward — the only kind with bed criteria, and so
 * the only thing `referralEligibility` can be asked about.
 *
 * This replaced a `WardReferral = Referral & { destination: WardReferralDestination }` intersection
 * when a referral gained several destinations. The intersection said "a referral that is a ward
 * referral", which stopped being a meaningful claim: a referral can be addressed to a ward AND an
 * ED at once, so the ward-ness belongs to the addressing, not to the referral.
 */
export type WardAddressing = ReferralAddressing & { destination: WardReferralDestination };

/**
 * The front door: a referral arriving from anywhere in the network, before it is ever a
 * `Movement` inside a department. Carries a deliberately tiny, governed set of facts about the
 * person referred and nothing else: no name, date of birth, record number, address, diagnosis, or
 * narrative history or treatment. No free-text field of any kind, unlike `Decline` (which has an
 * optional `note`) — a referral has no field a person's own words, or an author's summary of them,
 * could ever land in. `tests/ward-referral-model.test.ts` asserts this structurally, against this
 * type's own field set, so a future field named `patientId`, `notes`, `diagnosis` or `dob` is
 * caught rather than merely discouraged by convention.
 *
 * **THE FACTS ABOUT A PERSON ARE `ageBand`, `homeRegion`, AND — on a ward referral only — `sex`.**
 * This comment said "EXACTLY five facts" until the destination union landed, listing
 * `secureBedNeeded` and `involuntaryBedNeeded` among them. That was never right, and the type's own
 * field comments said so in the same breath: both are described there as facts about the REQUEST,
 * never about the person. Splitting the arms made the contradiction impossible to keep. Corrected
 * rather than deleted, because the count is a governance record and the reason it changed is the
 * part worth keeping.
 *
 * The set moved from three to four mid-build (Task 2, "A fifth answer, given mid-build" in
 * `docs/ward-flow-phase-6-7-decisions.md`, spec D5), from four to five in Phase 7 fix round B
 * ("A sixth answer, given mid-build" in the same doc), which added `homeRegion`, and was restated
 * — not widened — when the destination union landed on 2026-08-30. Each widening is deliberate and
 * rare on purpose: widening this set is a governance decision, not an implementation one, and the
 * structural test is what makes that true rather than aspirational.
 *
 * **`ageBand` and `homeRegion` stayed common to every destination, and that was a judgement.**
 * Every destination kind has age bands — a paediatric ED, a youth community team, an adolescent
 * ward — and every one of them cares where a person is from. Neither is a bed property, so neither
 * belongs on the ward arm. Recorded here as a decision rather than left as an accident of where the
 * fields already sat; if the owner rules otherwise, this is the line to change.
 *
 * **What `homeRegion` did and did not do** (corrected, review finding I5). It is the first fact
 * this system holds about where a person is from. It does NOT give any bed a catchment: neither
 * `Site` nor `Unit` carries a region, nothing associates a bed, unit, site or service with one,
 * and nothing checks a `DECLINE_REFERRAL`'s administrative decline reason against anything at all
 * — that reason is still the coordinator's own assertion, checked against nothing. Phase 8 Task 6
 * closed the honesty half of that gap by renaming `"out_of_catchment"` to
 * `"belongs_to_another_service"`, so the reason no longer implies a catchment check; the reason is
 * still unchecked, and `homeRegion` cannot check it — a catchment is a service's boundary and a
 * home region is where a person lives, and the two vocabularies do not align (ten WA regions
 * against five health services), so mapping one onto the other would invent an administrative
 * fact. This comment previously claimed the gap was closed; it was not,
 * and `HOME_REGIONS`' own comment 25 lines above already said the honest version. A comment
 * asserting an unchecked real-world fact is exactly how the deleted Form 1A figure entered this
 * codebase — an agent read it, believed it, and wrote it into the model.
 */
/**
 * Why a suburb is not a `string` — and it was one, for about an hour.
 *
 * 🔴 **A PATIENT OF NO FIXED ABODE COULD NOT BE REFERRED AT ALL.** The field landed as
 * `suburb: string`, resolved against the catchment table, empty refused. There was therefore no
 * representable answer for *"not known"* — and in psychiatry that is not an edge case. Homelessness
 * is common among people needing acute admission, and a person brought in by police at 3am
 * frequently has no recorded address. ⚠️ **The front door refused precisely the cohort most likely
 * to need a bed.** Found by Ward Referrals reading the committed code rather than the description
 * of it.
 *
 * ⚠️ **AND OPTIONAL WOULD HAVE BEEN WORSE.** An unanswered suburb passing the form and failing at
 * the reducer is a control that appears to accept and does not. The type has to carry the answer,
 * not omit it.
 *
 * ⚠️ **THE FAILURE MODE THIS PREVENTS IS A CLINICIAN TYPING SOMETHING UNTRUE.** Faced with a
 * required picker and no honest option, the way past the form is to choose a plausible nearby
 * suburb — which puts an invented administrative fact into the record through the one field that
 * had resolution built into it specifically to keep invented places out. A type that cannot say
 * "we do not know" does not prevent unknowns; it launders them.
 *
 * ⚠️ **WHETHER "NOT KNOWN" AND "NO FIXED ABODE" ARE ONE ANSWER OR TWO IS THE OWNER'S, AND IT IS ON
 * HIS QUEUE.** They mean different things to a community team deciding who follows a patient up,
 * which is this field's whole purpose. `SUBURB_UNKNOWN_REASONS` is provisional and has one member;
 * a second is an ADDED MEMBER, not a rebuild, which is why this is a union rather than
 * `string | null` — `R41`: a wrong value is an edit, a wrong shape is a rebuild.
 */
export const SUBURB_UNKNOWN_REASONS = ["not_known"] as const;
export type SuburbUnknownReason = (typeof SUBURB_UNKNOWN_REASONS)[number];

/** What a screen says. One home for the wording, so no surface invents its own phrase for absence. */
export const suburbUnknownLabels: Record<SuburbUnknownReason, string> = {
  not_known: "Suburb not known",
};

export type ReferralSuburb = { kind: "named"; name: string } | { kind: "unknown"; reason: SuburbUnknownReason };

/**
 * How long each written-history field may be.
 *
 * ⚠️ **PLACEHOLDERS. NOBODY HAS MEASURED A REAL REFERRAL AGAINST THEM.** Chosen to be generous
 * enough that no ordinary referral meets one, and small enough that the field is BOUNDED — a
 * bounded free-text field is a different privacy proposition from an endless one. The owner has
 * been told they are unmeasured and it is his number to set.
 *
 * ⚠️ **A LIMIT IS ENFORCED BY REFUSING, NEVER BY CUTTING.** The reducer rejects an over-length
 * value and the front door shows a counted, blocking state. Nothing truncates: silently dropping
 * the tail of a risk note is the worst thing this form could do, and it would look like success.
 *
 * ⚠️ **2000, AND IT IS NOT A NEW NUMBER.** The three-box form used 1500 / 2000 / 1000; the owner's
 * 2026-09-05 ruling collapsed it to one box and this takes the LARGEST of the three rather than
 * authoring a fresh figure or summing them. Total capacity therefore falls from 4500 to 2000, and
 * that is a real reduction — but an over-long story BLOCKS the Send with a counted, visible
 * message, so a referrer who needs more is told, not truncated.
 *
 * The keys are exactly the history fields on `Referral`, so a second field cannot be added without
 * either appearing here or failing `historyFieldsAreLimited` in the model tests.
 */
export const REFERRAL_HISTORY_LIMITS = {
  history: 2000,
} as const;

export type ReferralHistoryField = keyof typeof REFERRAL_HISTORY_LIMITS;

/**
 * How long a sending team's name may be. A NAME, not a story -- kept out of
 * `REFERRAL_HISTORY_LIMITS` on purpose, because that map's one entry is the free-text account of a
 * person and putting a 120-character label beside a 2000-character narrative invites a later reader
 * to treat them as the same kind of thing. The reducer refuses an over-length value rather than
 * shortening it, exactly as it does for the history.
 */
export const SENDING_TEAM_NAME_LIMIT = 120;

/* `REQUIRED_HISTORY_FIELD` was declared here until the owner's ruling of 2026-09-05: ONE story
 * box, OPTIONAL. There is no required history field any more, so the constant is gone rather than
 * left pointing at a rule nobody enforces. The reducer's blank-refusal went with it. */

/**
 * How long a correction note (`Referral.corrections[].note`, RB7, build plan item 27, 2026-09-17)
 * may be. Kept OUT of `REFERRAL_HISTORY_LIMITS` on purpose, the same reason `SENDING_TEAM_NAME_LIMIT`
 * is above: that map's keys are "exactly the history fields on `Referral`" (its own comment), and a
 * correction is not a history field — it is an entry in an ARRAY, appended by
 * `ADD_REFERRAL_CORRECTION`, never the single flat `history` string itself.
 *
 * ⚠️ **SAME NUMBER AS `history`, SAME REASON, NOT A COINCIDENCE.** 2000 is the placeholder ceiling
 * this session chose for exactly the same "generous enough for any ordinary entry, small enough to
 * be a BOUNDED field" reasoning `REFERRAL_HISTORY_LIMITS`'s own comment states, applied to a second
 * piece of free text this codebase now holds. Unmeasured against a real correction, like its twin —
 * the owner's number to set, not this session's.
 *
 * ⚠️ **A LIMIT IS ENFORCED BY REFUSING, NEVER BY CUTTING.** `case "ADD_REFERRAL_CORRECTION"`
 * rejects an over-length note outright; nothing truncates it.
 *
 * ⚠️ **NAMED `MAX_CHARACTERS`, NEVER `LIMIT`, AND THAT IS DELIBERATE.** `tests/ward-legal-figure-guard.test.ts`'s
 * Part 3 token denylist flags any exported `ward-management` identifier tokenising to both a
 * `LEGAL_TOKENS` member (`REFERRAL` here) and a `DURATION_TOKENS` member (`LIMIT` was one) — the
 * exact shape every fabricated Mental Health Act figure this guard exists to catch has taken. This
 * constant is genuinely not one (a text-field character cap, not a clock), but Part 3 carries no
 * allowlist of its own (unlike Part 2's `MODEL_CONSTANT_PROVENANCE` above), so the fix is the name,
 * not a justification written beside a name the guard still trips on. Do not rename this back to
 * anything containing `LIMIT`, `WINDOW`, `DEADLINE` or `TIMEOUT`.
 */
export const REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS = 2000;

/**
 * ONE CORRECTION NOTE — RB7, build plan item 27 (2026-09-17). See `Referral.corrections`'s own
 * doc comment for why this exists as an append-only array rather than ever touching `history`.
 *
 * `by` is a ROLE (`WardFlowRole`), never a person — the same discipline `localBedSought.by` and
 * `withdrawalRecordedBy` already hold on this type, so a correction records WHO ACTED (in the
 * organisational sense this whole model uses) and never a person's name.
 */
export type ReferralCorrection = {
  at: Instant;
  by: WardFlowRole;
  /** Human-typed prose, refused blank or over `REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS`. Never derived from,
   *  never truncated — the same two rules `history` itself is held to. */
  note: string;
};

export type Referral = {
  /** Confirmed drawer submission; typed text and chart bytes stay in memory under D-18. */
  intake?: import("./referrals/referral-submission").ReferralIntakeDetails;
  id: string;
  /**
   * Everywhere this referral was sent, and what each of them answered. One to
   * `PARALLEL_REFERRAL_CAP` entries, chosen by the referrer in ONE act (FD-21) — never repeat
   * referrals, which would be several referrals for one person and a different thing entirely.
   *
   * Each entry carries its own state, so one destination declining leaves the others live (FD-24)
   * and the first acceptance cancels the rest (FD-22). See `ReferralAddressing`.
   *
   * The referral's own state is DERIVED from these by `referralState` (`ward-referrals.ts`) rather
   * than stored beside them — two homes for one fact is how a referral comes to say "queued" while
   * a destination it holds says "accepted".
   */
  destinations: ReferralAddressing[];
  /**
   * ⚠️ WHICH PERSON THIS REFERRAL IS ABOUT — A POINTER, NEVER A COPY.
   *
   * Owner ruling, 2026-09-02, confirmed to Ward Builder Two directly: *"Yes to the referral
   * remembering its patient."* Until then a `Referral` deliberately carried NO link to anybody, and
   * `ALLOWED_REFERRAL_FIELDS` (`tests/ward-referral-model.test.ts`) named `patientId` as a field
   * its guard existed to catch. **This is that guard being widened by a decision, not defeated.**
   *
   * ⚠️ AN ID AND NOTHING ELSE. No name, no date of birth, no record number, no address, no
   * diagnosis — those remain forbidden and the structural test still fails on every one of them.
   * A `patientName` stored "for convenience" beside this would satisfy the letter of that guard and
   * destroy the point of it: the referral is supposed to hold a POINTER, so that what a person's
   * identity says lives in exactly one place and cannot drift into an operational record.
   *
   * ⚠️ OPTIONAL ON PURPOSE. A referral raised outside the patient flow legitimately has no person
   * on file yet, and a required field would force something to be invented — which is how a
   * fabricated identity enters a clinical record.
   *
   * ⚠️ AND NOTHING READS IT YET. Whether a ward may see where else a person has been referred is
   * `FD-23`, and the mechanism for that does not exist. Writing the pointer and displaying a
   * person's referral history are two different decisions and only the first has been made.
   */
  patientId?: PatientId;
  // Facts about a person, common to every destination. Nothing else may ever be added here.
  ageBand: Cohort;
  /**
   * The broad area this person is from — see `HOME_REGIONS`'s own doc comment. A region, never
   * an address; membership-checked, never free text. Carries no distance, travel-time band or
   * ordering by proximity — that is Phase 8's work, deliberately not built here.
   */
  homeRegion: HomeRegion;
  /**
   * The suburb this person is from — **`CM-4`: the suburb is the RECORDED fact.** It is the coarsest
   * fact the owner's catchment documents are keyed on and the finest one that is stable, so it
   * survives whichever way the five deferred catchment questions are answered.
   *
   * ⚠️ **A SUBURB IS NOT AN ADDRESS (`PD-3`), and that is the entire reason this field is allowed
   * to exist.** It identifies a service area, not a dwelling. `PD-1`'s permission to hold facts
   * about a person reaches it for exactly that reason, while `address` remains UNRULED and the
   * guard stays closed on it. A ruling permitting a suburb must never be read as permitting the
   * category.
   *
   * ⚠️ **Resolved against the catchment table, never checked for non-emptiness** —
   * `referralSuburbIsKnown` (`ward-referrals.ts`), enforced by `RECEIVE_REFERRAL`. A street address
   * is a non-empty string and would pass a length check, which would put the very thing this field
   * is coarser than into the field itself.
   *
   * ⚠️ **`homeRegion` IS NOT DERIVED FROM THIS, AND THE DUPLICATION IS AN ACCEPTED COST WITH A
   * REASON.** `CM-4` says region should be derived from suburb, and it cannot be today: the
   * catchment source keys suburbs to follow-up CLINICS, not to the ten WA regions `HOME_REGIONS`
   * holds. Mapping one onto the other would invent an administrative fact — the same invention
   * `homeRegion`'s own comment refuses, and the reason `"out_of_catchment"` was renamed. So both
   * are stored, they CAN contradict one another, and nothing can catch it. Recorded rather than
   * quietly lived with; `tests/ward-referral-suburb.test.ts` is where the fix starts on the day a
   * suburb-to-region source exists.
   *
   * ⚠️ **PROVENANCE: relayed by Ward Referrals, not heard first-hand by this session** (`R55`). The
   * design basis, `CM-4` and `PD-3`, is first-hand in the register and is what this is built on.
   */
  suburb: ReferralSuburb;
  // Facts about the referral itself.
  source: ReferralSource;
  /**
   * Sending ward when `source` is `psychiatric_ward`. Required for that source; absent otherwise.
   * The sending bed stays occupied until the person arrives at the destination.
   */
  originUnitId?: string;
  /**
   * WHICH TEAM OR SERVICE SENT THIS REFERRAL, BY NAME. Owner, 2026-09-12, asked directly: *"Should
   * a referral record which team or service sent it, not just which hospital?"* -- **"Yes it
   * should."**
   *
   * 🔴 **A NAME, NEVER AN ID, AND THAT IS A CONSTRAINT RATHER THAN A PREFERENCE.** This application
   * holds no authoritative registry of WA community teams. Minting ids for them would assert a
   * roster nobody has ruled on -- the refusal stated on `ReferralDestination`'s `community_team`
   * arm, which carries `teamName` for precisely this reason and is the precedent followed here.
   * The owner ruled that a referral RECORDS its sender; he has NOT ruled that this application may
   * mint team identities, and those are different permissions.
   *
   * ⚠️ **OPTIONAL, AND THE ABSENCE IS A REAL ANSWER.** Police, an ambulance service and an
   * emergency department's own medical staff are legitimate sources with no sending team to name.
   * A required field would force one to be invented, which is the fabrication `patientId`'s own
   * comment refuses two fields above.
   *
   * 🔴 **IT IS NOT A REFERRER AND MUST NEVER BE RENDERED AS ONE.** `referral-referrer.ts` answers
   * a different question -- WHO, a person -- and D-12 forbids an organisation standing in a field
   * labelled as a person. **A service is not a human being**, and "Armadale Community Mental Health
   * Service" printed under "Referred by" is a fabricated attribution on a clinical record rather
   * than a formatting choice. `referralReferrerName` deliberately does not read this field, and
   * `tests/ward-referral-sending-team.test.ts` fails if it starts to.
   *
   * ⚠️ **IT DOES NOT WIDEN THE PERSON-FACTS THIS TYPE HOLDS.** Like `source`, `originSiteCode` and
   * `raisedAt` it is operational: it says where the referral came FROM, never who the patient is.
   * `homeAddress`, `notes` and `diagnosis` are refused by
   * `tests/ward-referral-model.test.ts` exactly as before.
   *
   * 🔴 **THAT SENTENCE NAMED `patientId` UNTIL 2026-09-12 AND IT WAS FALSE THE DAY I TYPED IT.**
   * `patientId` is ON the allowlist -- owner ruling 2026-09-02, *"Yes to the referral remembering
   * its patient"* -- and it sits on the canonical `Required<Referral>` literal too. ⚠️ **I copied a
   * sentence that was true when its twin was written on 2026-08-30 and had stopped being true ten
   * days before I reused it.** A privacy claim listing a field it does not actually refuse is the
   * worst direction for this particular error: it reads as a stronger guarantee than the type gives,
   * and the field it wrongly claimed is the one that links a referral to a person.
   *
   * ✅ **AND IT HAS A PRODUCER FROM THE DAY IT LANDS.** `RECEIVE_REFERRAL` carries it and the
   * reducer writes it -- see `triagedAt`'s own comment on this type for what happens when a field
   * arrives with nothing able to write it, and `docs/ward-flow/fields-with-no-producer-2026-09-01.md`
   * for the three instances that cost this programme a night. ⚠️ **The remaining gap is stated
   * rather than hidden: no INTAKE CONTROL offers it yet, so today only a dispatch can set it.**
   */
  sendingTeamName?: string;
  raisedAt: Instant;
  urgency: UrgencyLevel;
  /** Absent means ATS not recorded; independent of the three operational urgency tiers. */
  atsCategory?: AtsCategory;
  /** A synthetic site code (see `wardSites`), never an address. */
  originSiteCode: string;
  transportNeeded: boolean;
  /**
   * ⚠️ THE WRITTEN HISTORY — THE ONLY FREE TEXT ON A REFERRAL, AND THE ONLY FIELD HERE THAT
   * NOTHING CAN CHECK.
   *
   * Owner instruction, 2026-09-05: a referrer must be able to write the patient's story. Until
   * that date this type held no free text of any kind, and the front door had NO free-text control
   * — no `<textarea>`, no `[contenteditable]` — which made "this form cannot record a name, an
   * address or a clinical note" true BY CONSTRUCTION rather than by anyone's care. Three screens
   * said so to clinicians and were right.
   *
   * ⚠️ **THAT GUARANTEE IS GONE, AND THIS IS WHERE IT WENT.** It is now a policy people keep, not
   * a property the software holds. Every sentence that promised otherwise was rewritten in the
   * same change that added this field, and `mockup-referral-intake-v6.html` carries the wording.
   * If you are reading this because you are about to write a governance sentence: say which half
   * is enforced. The STRUCTURED fields still cannot hold a name. This one plainly can.
   *
   * ⚠️ **NOTHING MAY EVER BE DERIVED FROM IT.** Not an urgency, not a risk level, not a
   * destination, not a ranking, not a summary. `urgency` is recorded from the referrer and
   * `UrgencyLevel` is a closed union for exactly this reason; a screen that read a risk out of
   * this prose would be inferring a clinical judgement from it, which is the line this prototype
   * does not cross. No parser, no keyword scan, no length heuristic. **A referral whose story is
   * blank is not a referral about a safe person** — the field being optional makes that clearer,
   * not less true.
   *
   * ⚠️ **STORED BYTE FOR BYTE.** No trim, no normalisation, no truncation. A form that quietly
   * drops the last paragraph of a story is worse than one that refuses to send, so the length
   * limit is enforced at the front door as a BLOCKING, VISIBLE state and never by silently
   * cutting. `REFERRAL_HISTORY_LIMITS` holds it, and the reducer refuses an over-length value
   * rather than shortening it.
   *
   * ⚠️ **EMPTY IS A REAL ANSWER, WHICH IS WHY THIS IS `string` AND NOT OPTIONAL.** `""` means
   * the referrer left it blank; there is no third state where the field did not exist. Screens
   * render the blank as words — "Not written yet" — never as an empty box, because a blank reads
   * as a value.
   *
   * ⚠️ **AND NOTHING REQUIRES IT TO BE NON-EMPTY. Owner ruling, 2026-09-05: one story box,
   * OPTIONAL.** It was three boxes with the first required until that ruling; `FD-13` had said one
   * optional field from 2026-08-30 and the built form had diverged from it. A referrer with
   * nothing written down should not be made to invent something to get a referral out of the
   * door, and a blocked Send at 3am is answered by typing a character, not by writing a history.
   *
   * ⚠️ **ONE FLAT `string`, NEVER AN OBJECT.** The three-box version was three flat keys for a
   * reason that survives the collapse to one: a `history: {...}` object would be ONE permitted key
   * in `ALLOWED_REFERRAL_FIELDS` with an unchecked shape behind it — precisely the hole that opened
   * when the decision fields moved inside `destinations` and needed two more allowlists to close.
   * If a second box is ever wanted, it is a second flat key, not a nested one.
   */
  history: string;
  /**
   * RB7, build plan item 27 (2026-09-17): notes added AFTER the fact — a typo caught, a fact that
   * changed, a clarification — none of which may ever rewrite `history` above.
   *
   * ⚠️ **APPEND-ONLY, AND `history` STAYS BYTE FOR BYTE THE ORIGINAL RECORD.** `history`'s own doc
   * comment says the written account is "STORED BYTE FOR BYTE" and read by nothing that derives a
   * judgement from it; a correction that silently edited or appended into that same field would
   * make what a referrer originally wrote unrecoverable, and would make every later reader of
   * `history` see words the referrer never actually wrote at the time. `corrections` is the
   * SEPARATE, ordered, attributed record instead — each entry is who added it and when, on top of
   * the unchanged original — never a member that could stand in for `history` or be confused with
   * it. `tests/ward-referral-history-immutable.test.ts` is the static proof that no writer other
   * than `RECEIVE_REFERRAL` ever assigns fresh content to `history` itself.
   *
   * ⚠️ **TYPED TEXT, THE SAME AS `history`.** Each `note` is a person's own words, refused blank or
   * over `REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS` and never truncated (the reducer's `ADD_REFERRAL_CORRECTION`
   * case enforces both) — see `REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS`'s own comment for why this is a
   * separate constant rather than a member of `REFERRAL_HISTORY_LIMITS`. D-11 CRITICAL: the event
   * that writes this is on `WARD_FLOW_TYPED_TEXT_EVENT_TYPES`
   * (`ward-flow-persistence-classification.ts`), never the safe list, so dispatching one locks
   * session persistence exactly as a typed `history` does.
   *
   * Optional, and absent means no correction has ever been added — never an empty array, because
   * an empty array and "never corrected" are the same fact told two ways and this type holds only
   * one of them.
   */
  corrections?: ReferralCorrection[];
  /**
   * T15 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`, item 12, owner answer 12,
   * 17 September 2026): *"An admission from a referral carries the referral's broad diagnosis
   * category, marked tentative."* One of the eleven ICD-10-AM Chapter V block codes
   * (`TENTATIVE_DIAGNOSIS_BLOCKS`, `ward-diagnosis.ts`), never a free-text diagnosis — see that
   * module's own doc comment for the vocabulary and why a referral, rather than `Admission` alone,
   * is where it starts: the owner's own words, 2026-08-29, are that it "should arrive with
   * referral and be easy to continually adjust and refine along the way".
   *
   * ⚠️ **DOES NOT WIDEN THE PERSON-FACTS THIS TYPE HOLDS BEYOND WHAT THIS COMMENT SAYS.** This is
   * a governance decision, the third time this file records one for this exact field (see
   * `ward-admissions.ts`'s own comment on `Admission.tentativeDiagnosis`) — `homeAddress` and
   * `notes` still fail `tests/ward-referral-model.test.ts`'s allowlist exactly as before; only
   * `tentativeDiagnosis` itself is now permitted, by name, for this named reason.
   *
   * Optional, and absent means nobody has recorded one — never `null`, which is `Admission`'s own
   * "explicitly none" convention on the SAME fact once it reaches a bed. `RAISE_REFERRAL` copies
   * this onto `Movement.tentativeDiagnosis`, which `PULL_PATIENT` then copies onto
   * `Admission.tentativeDiagnosis`, defaulting to `null` there only.
   */
  tentativeDiagnosis?: TentativeDiagnosisBlock;
  /**
   * T12 (item 9): the front door's own copy of the same accountability record
   * `Movement.genderPlacements` carries — see `GenderPlacement`'s own doc comment. Written by
   * `ACCEPT_REFERRAL` when a coordinator accepts a `Non-binary` ward referral at a unit nothing
   * has already cleared; read by that same case to decide whether a fresh record is even needed.
   * A referral's own record is independent of any movement later raised from it — accepting a
   * referral "starts nothing" (owner ruling 15), so this is the front door's own commitment
   * moment, not a copy of a movement's.
   */
  genderPlacements?: GenderPlacement[];
  // `state`, `acceptedUnitId`, `declineReason`, `decidedAt` and `decidedBy` were here until
  // 2026-08-30. All five moved onto `ReferralAddressing`, because with several destinations there
  // is no longer one thing to decide — see that type's own doc comment. `referralState` derives the
  // referral's overall state from its destinations.
  /**
   * Phase 8 (spec D8-6): that somebody looked for a bed closer to home before this referral was
   * placed, and when. Optional because nobody knows whether country services do this today — the
   * step exists as something a coordinator MAY record if it happened, and is never a stage the
   * pathway requires, never a gate on acceptance, and never something whose absence is counted
   * against anyone.
   *
   * `by` is a ROLE (`WardFlowRole`), never a person, exactly as `decidedBy` above is. There is
   * deliberately no note, reason or outcome field: a free-text field here would be the one place
   * a person's own words could land on a referral, which `Referral`'s own doc comment forbids
   * outright, and an outcome enum would be inventing a vocabulary nobody has been asked for.
   */
  localBedSought?: { at: Instant; by: string };
  /**
   * When this person was triaged into the department the referral concerns — the start of the
   * SECOND clock, and the field `P9-D7` was recorded against before anything could read it.
   *
   * `P9-D2` (OWNER, 2026-08-30): every wait carries two clocks, both visible — time in department
   * **from triage**, and time since the referral to mental health. **The gap between them is the
   * signal**: it says whether the delay sits upstream of mental health or with them. His words are
   * the reason this is triage rather than anything else — he rejected a *medically-ready* start
   * because it *"needs a state somebody must actively set, so the number silently depends on
   * remembering to tick something."*
   *
   * ⚠️ **ABSENT IS A REAL STATE AND IT IS NOT ZERO.** A community expect sits on the to-see board
   * before arriving (`P9-D5`), so for them the department clock does not exist yet. `P9-D7`
   * requires it to render as genuinely absent — never `0m`, never an em dash styled like a
   * duration, never a zero sorting alongside real waits, because *"a not-yet-arrived expect showing
   * '0m in department' reads as 'just arrived', which is the opposite of the truth."* Read it
   * through `referralClocks` (`ward-referrals.ts`), which returns `undefined` rather than a number
   * no screen should print.
   *
   * ⚠️ **THIS IS NOT THE `arrivedAt` PHASE 8 TASK 2R DELETED, and the distinction is the whole
   * reason for the name.** That field meant arriving **at a bed**, and it was removed because
   * `Admission` (`ward-admissions.ts`) is the single record of a person occupying one — a
   * tightening, not an oversight. This is arriving **in the department**: a different event, at a
   * different place, starting a different clock, for a person who may never get a bed at all.
   * Calling it `arrivedAt` again would have read as reversing that deletion rather than
   * complementing it, and the guard comment in `tests/ward-referral-model.test.ts` says both.
   *
   * ⚠️ **TRIAGE IS NOT ARRIVAL, AND NO SCREEN MAY WORD IT AS ONE.** A patient arrives, waits, and
   * is triaged some time later — on a busy night that gap is not small. This field is therefore a
   * PROXY for arrival and the closest thing the system actually records. The arithmetic does not
   * care; the wording does. *"Arrived 14:20"* asserts a fact this model does not hold, so every row
   * says triage. Raised by Ward Referrals, whose ED hub is the first screen to render it, against a
   * comment of mine that said "arrival" three times beside a field that says triage — **the name was
   * honest and the comment was not, which is the half a reader copies.**
   *
   * The ruling it implements is worded as arrival (`P9-D7`: the referral clock runs only until the
   * patient arrives). Triage is what stands in for it. Whether that gap matters clinically is the
   * owner's question, not ours, and it is a proxy the prototype can live with **while it is labelled
   * as one.**
   *
   * ⚠️ **PROVENANCE: owner ruling, RELAYED through the orchestrator (`P9-F3`, 2026-08-30).** No
   * session heard it first-hand, which `R55` requires to be recorded rather than smoothed into
   * "(OWNER)". It is a time, never a person fact: it says where a body is, not who they are.
   */
  triagedAt?: Instant;

  /**
   * When the ED psychiatry team RECORDED that this person is physically in the department.
   *
   * 🔴 **THIS IS THE FIELD THAT MAKES AN "EXPECT" A THING THAT CAN STOP BEING ONE.** Product owner,
   * 2026-09-07, defining a concept this model did not have: *"When a patient is referred to the ED
   * and not in the ED then they are an **expect**. If they are referred within the ED, they are put
   * on the **Referrals**."* and *"When expects arrive and are marked as arrived, they become
   * referrals."* **One list feeds the other and this field is the only door between them.**
   *
   * ⚠️ **IT IS NOT `arrivedAt`, AND THE NAME IS A DECISION.** Phase 8 Task 2R deleted an `arrivedAt`
   * from this type — that one meant arriving **at a bed**, which `Admission` owns — and
   * `tests/ward-referral-model.test.ts` records the removal as a tightening. `TransportJob` also
   * still has an `arrivedAt`, for a transport leg ending. **Reusing the word for a third meaning
   * would collide with one live field and read as reversing a deliberate deletion.**
   *
   * 🔴 **AND IT IS NOT `triagedAt`, WHICH IS THE WHOLE POINT OF ADDING IT.** That field's own
   * comment says triage is a PROXY for arrival, and asks whether the gap matters clinically. **It
   * does, and the owner answered it: arrival means physically here, not triaged.** In WA the gap
   * between the two is ramping — a patient on the ambulance ramp is at the hospital and untriaged,
   * and a triage-based list would call them "on the way" while they are outside the door. Asked
   * directly on 2026-09-07 — should the marker mean arrived or triaged — his answer was **"Arrived
   * means physically here"**.
   *
   * ⚠️ **READ IT AS `inDepartmentAt ?? triagedAt`, NEVER ALONE, AND THE ASYMMETRY IS CLINICAL.**
   * Triage implies presence — nobody is triaged in absentia — so a triaged referral has arrived
   * whether or not anyone pressed the button. The converse is false: an arrival says nothing about
   * whether triage has happened. **Reading this field on its own would have made every one of the
   * four already-triaged referrals in the fixture an expect on first render, inverting the screen
   * silently**, because an empty Referrals list beside a full Expects list is exactly what this
   * feature is built to be able to show.
   *
   * ⚠️ **A HUMAN OBSERVATION, NOT A SENSED FACT.** Owner, same date: *"Marking the patient is done
   * manually when the ED psychiatry doctors notice the patient has arrived in ED."* Nothing feeds it
   * from ambulance dispatch or a triage system, so it is as timely as somebody noticing. **His "for
   * now" is recorded here rather than smoothed away** — it is a provisional arrangement, not a
   * settled design.
   *
   * Operational, never a person fact: like `raisedAt` and `triagedAt` it says where a body is and
   * when, never who they are.
   */
  inDepartmentAt?: Instant;

  /**
   * Whether this patient's medical workup is done, as recorded by the emergency department holding
   * them. Written only by `RECORD_MEDICAL_CLEARANCE`.
   *
   * ⚠️ **THREE STATES, NOT TWO, AND THAT IS THE WHOLE POINT.** Absent means **NOBODY HAS
   * ASSESSED IT** — it does not mean "not cleared". A boolean cannot hold that difference, and on
   * the day this field was added the owner had just ordered the identical defect fixed on the ED
   * referral form's `specialling`, where an unticked checkbox meant both "not required" and "not
   * answered" and the reducer read the ambiguity as a decision. **Do not collapse this to a
   * boolean, and do not default it.**
   *
   * On the `Referral` rather than the `Movement` because the psychiatry inbox — the surface the
   * owner asked for it on — renders referrals, and **nothing joins a `Movement` to a `Referral`.**
   */
  medicalClearance?: {
    cleared: boolean;
    at: Instant;
  };
};

/**
 * COMMUNICATION — ADDENDUM TO THE THIRD-EDITION MASTER BUILD PLAN
 * (`docs/ward-flow/plans/2026-09-1x-communication-addendum.md`, §0–§1), owner ruling **D-2**,
 * 2026-09-10. Read that file's §0 before touching anything below: the system already has a
 * substantial work list (`buildActionInbox`, `ward-derivations.ts`) and this is deliberately NOT a
 * second one. `buildActionInbox` is a pure DERIVATION from `movements`/`units` with no addressee and
 * no way to put anything into it (its own doc comment: "nothing is authored"). What follows is the
 * other half the owner's finding named: a second, AUTHORED list of facts about who was told what, at
 * a moment, because "the referrer was told" is not a fact any amount of re-reading `movements` can
 * produce. The two lists are never summed into one tally (addendum §1.4) and this type never feeds
 * `buildActionInbox`'s computation in either direction.
 *
 * ⚠️ **THIS PHASE DOES NOT CREATE AN IDENTITY MODEL, AND THAT IS A RULING, NOT A GAP.** Addendum
 * §1.2: the master plan's §7.1 item 2 — *"nobody is anybody"* — was never answered by the owner, and
 * inventing one here would answer a use-gate question with privacy consequences nobody asked. A
 * notice addresses a ROLE AT A PLACE (`Addressee` below), never a user, an account or a person who
 * logs in. A future change that needs a user record to make this work has left this addendum's scope
 * and must be put to the owner rather than guessed.
 */

/**
 * WHO A NOTICE IS FOR — a role at an optional place, never a person. Addendum §1.2.
 *
 * `role` is reused from `WardFlowRole` rather than redeclared (see this file's own import comment
 * for why that is safe) precisely because it is already exhaustive by design: every screen this
 * prototype has is already gated by one of its six members, so "which screens can see this notice"
 * is answered by the same union that already answers "which screen is this".
 *
 * `placeId` narrows a role to ONE ward, ONE emergency department or ONE team — a ward sees its own
 * notices and not every ward's, exactly the scoping `FD-23` already holds a referral's OWN fields to.
 * Optional because `officer` has no place in this model (`ward-role-switcher.tsx` never scopes it to
 * one): an officer notice is addressed to the whole role, on purpose, not to a place nobody
 * currently splits.
 *
 * 🔴 **`demo` IS A MEMBER OF `WardFlowRole` AND MUST NEVER APPEAR HERE.** The demonstration harness
 * that jumps the clock forward is not a person and cannot be "told" anything — see
 * `ward-flow-reducer.ts`'s `appendNotices`, the one gate every notice passes through before it
 * reaches live state, which refuses a `demo`-addressed notice structurally rather than trusting every
 * future call site to remember not to construct one.
 */
export type Addressee = {
  role: WardFlowRole;
  placeId?: string;
};

/**
 * EVERY KIND OF NOTICE THIS PHASE CAN RAISE — a closed union, exhaustive like `WardFlowRole` itself,
 * so a `switch` over it must be total rather than defaulted. Addendum §1.3's original table named
 * exactly five DECISIONS across seven members, because two of those decisions each address two
 * different parties (`ACCEPT_REFERRAL`: the referrer and the receiving ward; `CANCEL_TRANSPORT`: the
 * officer and the receiving ward) and each party gets its own member. Two notices raised by one
 * event would otherwise share a `(subject, kind)` pair and collide under the id rule below — see
 * `ward-flow-reducer.ts`'s `makeNotice` doc comment.
 *
 * ⚠️ **NO SIXTH DECISION, AND NO EIGHTH MEMBER" WAS THE ORIGINAL RULE, AND WLQ-38 IS A DELIBERATE,
 * DOCUMENTED SIXTH — NOT A SILENT DRIFT.** Owner ruling, 2026-09-15: the referrer or the coordinator
 * may revoke an accepted referral (`WITHDRAW_REFERRAL`) or stop a collected transport
 * (`STOP_TRANSPORT`), and the receiving ward must be told either way — the same "a party who was
 * expecting a patient learns they are not coming" shape `CANCEL_TRANSPORT`'s ward half already
 * carries. Two members added, one per event, both addressed to the ward alone (neither act needs a
 * referrer-facing half: the referrer or the coordinator IS the one acting, so there is nobody on
 * that side left to tell). **The corresponding row in the addendum table itself
 * (`docs/ward-flow/plans/2026-09-1x-communication-addendum.md` §1.3) is OWED, not written** — this
 * build's own constraints forbid editing anything under `docs/`, so the row that keeps this comment
 * and that table in agreement is recorded here as a debt for whoever next has `docs/` access, rather
 * than silently left undone. The rule the union enforces — table and members agree, or the drift is
 * caught — still held: this comment IS the corresponding entry until the addendum itself is updated.
 */
export type NoticeKind =
  // RELEASE_PULL — told to the referrer (`ward-flow-reducer.ts`, `movement.originEdId`).
  | "bed_pull_released"
  // DECLINE (a movement) or DECLINE_REFERRAL (a front-door referral) — told to the referrer. One
  // shared kind: both are the same decision — "a destination said no" — reaching the referrer
  // through two different records, and each event raises at most one notice, so the two can never
  // collide under the id rule.
  | "referral_declined"
  // ACCEPT_IN_PRINCIPLE — told to the referrer.
  | "accepted_in_principle"
  // ACCEPT_REFERRAL, the referrer's half — "the answer to the question they asked".
  | "referral_accepted_referrer"
  // ACCEPT_REFERRAL, the receiving ward's half — raised only when the accepting destination is a
  // psychiatric ward, the only kind that names a unit.
  | "referral_accepted_ward"
  // RA1 (item 18, owner answer 18, 2026-09-17) — WITHDRAW_WARD_REQUEST, told to the one ward whose
  // live request was withdrawn. Distinct from `referral_revoked_ward` (an ACCEPTED referral pulled
  // back after WLQ-38) and from `acceptance_withdrawn_ward` (a ward's own "yes" undone): this ward
  // never said yes and never held a bed — only a live request, now taken back.
  | "ward_request_withdrawn"
  // CANCEL_TRANSPORT, the officer's half.
  | "transport_cancelled_officer"
  // CANCEL_TRANSPORT, the receiving ward's half.
  | "transport_cancelled_ward"
  // WLQ-38 (owner, 2026-09-15) — a post-acceptance WITHDRAW_REFERRAL, told to the accepting ward.
  | "referral_revoked_ward"
  // Item 48, Q3 (owner, 2026-09-17) — WITHDRAW_ACCEPTANCE, told to the ward whose acceptance was
  // withdrawn.
  | "acceptance_withdrawn_ward"
  // Item 48, Q3 (owner, 2026-09-17) — RECORD_EXAMINATION with outcome `"revoked"`, told to the
  // accepting ward. Never raised for `"community_order"` (the owner named "revoked" only), and
  // never raised when the movement holds no `acceptedUnitId` — there is nobody to tell.
  | "examination_revoked_ward"
  // WLQ-38 (owner, 2026-09-15) — STOP_TRANSPORT, told to the receiving ward.
  | "transport_stopped_ward"
  // Build plan item 31 (T3, 2026-09-17) — STOP_TRANSPORT, the officer's half: where the patient
  // actually is, the same "officer carries no placeId" shape `transport_cancelled_officer`
  // already holds (`CANCEL_TRANSPORT`, WLQ-38's own sibling).
  | "transport_stopped_officer"
  // Build plan item 29 (T4a, 2026-09-17) — RECORD_DIVERSION, told to the accepting ward.
  | "diversion_recorded_ward"
  // Build plan item 29 (T4a, 2026-09-17) — RECORD_DIVERSION, told to the referring ED.
  | "diversion_recorded_ed"
  // Build plan item 29 (T4a, 2026-09-17) — RELEASE_DIVERTED_BED, told to the accepting ward unless
  // the ward itself released it.
  | "diversion_bed_released_ward"
  // Item 48 (owner, 2026-09-17) — REFER_TO_COMMUNITY_TEAM, told to the destination community team.
  | "community_referral_received"
  // P1-3 (Ward Lead ruling, 17 September 2026) — RECORD_MOVEMENT_GENDER, told to the coordinator,
  // and ONLY when the movement's stage is `accepted_awaiting_bed` through `moving` at the moment
  // the correction lands: an acceptance or a bed is already held for a unit chosen under the OLD
  // gender, so the coordinator — never the ward or ED, who cannot see the correction either way —
  // needs telling to go and check it. No notice is raised for a correction at an earlier stage
  // (nothing is held yet) or at `arrived` (the movement is closed to further placement decisions).
  | "movement_gender_recorded_after_placement"
  // Owner ruling 11 (2026-09-17) — RECORD_REFERRER_WITHDRAWAL's `destinationKind: "community_team"`
  // variant, told to the one community team whose still-queued arm was taken back. The whole-
  // referral withdrawal above raises no notice at all (nobody in this model currently holds a
  // resolvable identity for most referrers to be told anything back — see `referralReferrer`'s own
  // doc comment, `ward-flow-reducer.ts`); this scoped act names a real, resolvable addressee (the
  // community team itself), so it is the one variant of this event that can tell anybody at all.
  | "community_referral_withdrawn"
  // SET_ARRIVAL_DETAILS / EVALUATE_ARRIVAL_LATENESS — estimated arrival more than 60 minutes past
  // and the person has not arrived. Told to the referrer role AND the destination ward (two notices).
  | "arrival_late_referrer"
  | "arrival_late_ward"
  // DECLINE redirected to waitlist (no_bed / bed_pulled_for_earlier_referral) — told to the referrer.
  | "referral_waitlisted"
  // Leave bed past 24 hours — consider opening. Told to the ward that recorded the leave.
  | "leave_bed_open_warning";

/**
 * A NOTICE — AN AUTHORED, ADDRESSED FACT, addendum §1.1. The second list beside
 * `buildActionInbox`'s derived one (see this section's own header comment above for why a second
 * list is correct here and not the duplicated-effort failure this whole addendum warns against).
 *
 * ⚠️ **`sentence` IS STORED, NEVER RE-DERIVED AT RENDER, AND THAT IS THE WHOLE POINT OF THIS TYPE.**
 * A notice is a record of what somebody was told AT A TIME. The movement or referral it is `about`
 * keeps changing after the notice is raised — that is what generated the notice in the first place —
 * so a screen that re-computed the words from current state would silently rewrite history: a
 * referrer who was told "your pull was released" could later read a DIFFERENT sentence for the exact
 * same past event, produced by whatever the record says now rather than what was true when they were
 * told. `tests/ward-notices.test.ts` proves this by reading a notice's `sentence` again after the
 * state it was raised from has moved on, and requires the ORIGINAL words back.
 *
 * `id` is derived from `(subject, kind, count)`, never from a module-level counter — the same
 * discipline `makeRejection` (`ward-flow-reducer.ts:558`) already holds `Rejection.id` to, for the
 * same reason: a counter that lives outside the reducer's own state would make two calls with an
 * identical `(state, event)` mint two different ids, which breaks the reducer's purity (`same
 * (state, event) twice ⇒ identical output`). See `makeNotice` (`ward-flow-reducer.ts`) for exactly
 * how the triple is built.
 */
export type Notice = {
  id: string;
  /** When this notice was raised. From the triggering event's own `now`, never `Date.now()` —
   *  the same clock discipline every other timestamp in this model already holds to. */
  raisedAt: Instant;
  to: Addressee;
  /**
   * What this notice is about — every `NoticeKind` this phase raises names exactly one movement or
   * one referral, never both and never neither (see each kind's own comment on `NoticeKind` above).
   * `unitId` is not part of that either/or: it rides ALONGSIDE a movement or referral id to say WHICH
   * unit a ward-addressed notice concerns, and is never set alone.
   *
   * Fix round 1 (review finding, Minor): this comment previously opened "never more than one of
   * these is set", which `unitId` riding alongside a movement or referral id directly contradicts —
   * the code was always right; the sentence was not.
   */
  about: {
    movementId?: MovementId;
    referralId?: string;
    patientId?: PatientId;
    unitId?: string;
  };
  kind: NoticeKind;
  /** The words a person reads — TRUE READ ALONE, and never re-derived; see this type's own header
   *  comment above. */
  sentence: string;
  /**
   * `undefined` until the addressed viewer reads it. This phase raises notices and stores them;
   *  nothing in this phase ever sets this field — a later phase's read affordance writes it.
   *
   *  🔴 **THAT LATER PHASE IS ITEM 48, Q2 (owner answer 48, 2026-09-17): a notice counts as read
   *  ONLY when `MARK_NOTICE_READ` (`ward-flow-events.ts`) sets it.** Nothing else — not opening
   *  the Activity drawer, not `noticeIsForWardChrome` scoping a notice into view — ever writes
   *  this field. See `case "MARK_NOTICE_READ"` in `ward-flow-reducer.ts` for the addressee check
   *  that gates the write.
   */
  readAt?: Instant;
  /** Who marked it read — the ROLE, never a person, the same discipline every other `by`/actor
   *  field in this model already holds to (`StageChange.by`, `UnwindRecord.by`,
   *  `InboxAcknowledgement.by`). Set together with `readAt`, by `MARK_NOTICE_READ` alone, and by
   *  nothing else. */
  readBy?: WardFlowRole;
};
