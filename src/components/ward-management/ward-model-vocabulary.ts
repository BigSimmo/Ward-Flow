// The ward model's shared vocabulary: services, cohorts, sexes, urgency and triage levels, arrival
// modes, movement stages, step-back reasons, legal status and forms, and capacity figures. Moved out
// of `ward-model.ts` unchanged; that file re-exports all of it and keeps the configured figures.
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";

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
  /** When the arrival plan was FIRST recorded, and by whom. Later edits never move these. */
  recordedAt: Instant;
  recordedBy: WardFlowRole;
  /**
   * The latest edit after the first recording, when there has been one. Absent on a plan recorded
   * once, and on plans saved before 20 Oct 2026 (overall review: edits used to overwrite
   * `recordedAt`, so the ED timeline, chronology and pilot measures showed the latest edit as the
   * first recording).
   */
  updatedAt?: Instant;
  updatedBy?: WardFlowRole;
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
/** Fixed reasons for correcting a transcribed paper expiry; no narrative is stored. */
export const LEGAL_FORM_EXPIRY_CORRECTION_REASONS = ["transcription_error", "paper_rechecked"] as const;
export type LegalFormExpiryCorrectionReason = (typeof LEGAL_FORM_EXPIRY_CORRECTION_REASONS)[number];

export type LegalForm = {
  code: string;
  /** Setting recorded from the current paper, never inferred from geography. */
  region?: "metro" | "country";
  /**
   * Age band recorded from the current paper (review 18 Oct 2026, item 1). Kept as recorded; no
   * Act period is computed from it (D-70). Never inferred.
   */
  ageBand?: "adult" | "under_18";
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
  /**
   * Audit 2 E-15 (20 Oct 2026): earlier 5B continuations of the same 5A, oldest first, kept when a
   * later 5B is recorded so no first-recorded time is overwritten. Typed facts only.
   */
  earlierContinuations?: ReadonlyArray<NonNullable<LegalForm["continuedBy"]>>;
  /**
   * Audit 2 E-16 (Josh, 20 Oct 2026): the forms this one replaced, oldest first, each as it was
   * recorded, with when (`at`) and by whom it was replaced. `writtenAt` and `receivedAt` copy the
   * movement's `formedAt` and `legalFormReceivedAt` for that form. History only: nothing reads an
   * expiry from it and nothing is computed.
   */
  earlierForms?: ReadonlyArray<
    Omit<LegalForm, "earlierForms"> & { writtenAt?: Instant; receivedAt?: Instant; at: Instant; by: WardFlowRole }
  >;
};

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
  /** DEC-L5-04: how many times the ward has confirmed it; only `CONFIRM_CAPACITY` moves it on. */
  confirmations?: number;
};
