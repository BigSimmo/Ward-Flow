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
  DischargeDelayClearReason,
  LegalFormReceiptCorrectionReason,
  UrgentMarkReason,
  OverrideReason,
  WithdrawalReason,
  WardRequestWithdrawalReason,
  WardIntakeConstraint,
} from "@/components/ward-management/ward-change-reasons";
import type {
  ClinicalReassessmentEntry,
  ExaminationOutcome,
  GenderPlacement,
  MovementId,
  MovementReferralAbsence,
  MovementTransportNeed,
  Override,
  StageChange,
  StatusChange,
  TransportException,
  TransportJob,
  TurnaroundPriority,
  UnwindRecord,
  UrgencyChange,
} from "@/components/ward-management/ward-model-movement-parts";
import type {
  CommunityDeclineReason,
  HomeRegion,
  ReferralAddressingState,
  ReferralCorrection,
  ReferralPurpose,
  ReferralSource,
  ReferralSuburb,
} from "@/components/ward-management/ward-model-referral-parts";
import type {
  AtsCategory,
  CapacityFigure,
  Cohort,
  HealthService,
  LegalForm,
  LegalStatus,
  MovementArrivalDetails,
  MovementStage,
  MovementUploadedForm,
  RecordedSex,
  ReferralGender,
  Security,
  Sex,
  SexDesignation,
  UrgencyLevel,
} from "@/components/ward-management/ward-model-vocabulary";

// Split for the line cap (18 Oct 2026): the vocabulary, the parts a movement and a referral are
// built from, leave beds and notices live in sibling files, re-exported here so importers are unchanged.
export * from "@/components/ward-management/ward-model-vocabulary";
export * from "@/components/ward-management/ward-model-movement-parts";
export * from "@/components/ward-management/ward-model-leave";
export * from "@/components/ward-management/ward-model-referral-parts";
export * from "@/components/ward-management/ward-model-notices";

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
  /** Whether the ward is closed to new allocations while retaining its physical bed count. */
  isClosed?: boolean;
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

export type MovementClosure = {
  at: Instant;
  outcome: "arrived" | "did_not_proceed";
  reason: string;
};

export type Movement = {
  turnaroundPriority?: TurnaroundPriority;
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
  /** Units currently holding a live referral. Longer than the referral cap only with a recorded `overCapReason` (Top 25 item 2). */
  referredUnitIds: string[];
  acceptedUnitId?: string;
  /**
   * v10 pass 3 (Josh, 10 Oct 2026): the numbered bed the accepting ward placed this person in on its
   * Bed board (`ACCEPT_IN_PRINCIPLE.bedNumber`). Optional: absent is no bed named yet, the ordinary
   * case, and every seeded movement. Cleared with the acceptance by `UNDO_ACCEPT_IN_PRINCIPLE`.
   */
  heldBedNumber?: number;
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
   * v10 pass 3 (Josh, 10 Oct 2026): the demo seed now gives referred movements a synthetic
   * `referredAt`, and accepted ones `acceptedAt`, through `withDemoStageTimes`
   * (`ward-demo-stage-times.ts`), so the Journey strip shows real stages. The hand-authored fixture
   * itself still carries neither, and a movement without one still says so, as below.
   *
   * ⚠️ **OPTIONAL, AND ABSENT ON EVERY HAND-AUTHORED MOVEMENT.** Same discipline as
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
  /**
   * Ordered ward answers, including answers recorded in the same provider minute. This is kept
   * separately from the per-answer history below because timestamps alone cannot order a waitlist
   * answer and a subsequent decline when both clocks report the same minute.
   */
  referralAnswerHistory?: {
    unitId: string;
    at: Instant;
    answer: "waitlisted" | "declined" | "withdrawn";
  }[];
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
  /**
   * Audit r1 item 4 (13 Oct 2026): a journey with no transport leg confirmed arrived while fit to
   * travel was not recorded. Never blocks; records the open check and a coded reason.
   */
  arrivalException?: TransportException;
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
  /** Bed allocated to this movement, if any. */
  allocatedBed?: string | number;
  /** Statutory examination revoked flag, protected from generic clear. */
  examRevoked?: boolean;
  /** Append-only log of evolving clinical reassessments recorded while awaiting placement. */
  reassessmentHistory?: ReadonlyArray<ClinicalReassessmentEntry>;
  reassessmentNote?: string;
  /** Top 25 item 14: whether the pre-transfer contraband search has been completed. */
  contrabandSearchDone?: boolean;
  /** Top 25 item 14: whether the pre-transfer medication chart is ready for the receiving ward. */
  medicationChartDone?: boolean;
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
  /** Reason the most recent discharge blocker was cleared, chosen from `DISCHARGE_DELAY_CLEAR_REASONS`. */
  lastClearedBlockReason?: DischargeDelayClearReason;
  /** Append-only history of cleared discharge blockers on this bed release. */
  clearedBlockHistory?: ReadonlyArray<{
    readonly at: Instant;
    readonly by: WardFlowRole;
    /** Absent when the clearing event named no reason; never defaulted. */
    readonly reason?: DischargeDelayClearReason;
    readonly blocker?: BedReleaseBlocker | null;
  }>;
};

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

export type ReferralAddressing = {
  /** Explicitly placed on a recipient waitlist; still awaiting an answer. */
  waitlistedAt?: Instant;
  /** When this specific destination was referred. */
  referredAt?: Instant;
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
  /**
   * v10 pass 2 (Josh, 10 Oct 2026, ward Bed board "Place here"): the bed number, 1 to `Unit.beds`,
   * the accepting ward placed this referral in. Only ever beside `acceptedUnitId`, and only when the
   * acceptance named a bed (`ACCEPT_REFERRAL.bedNumber`). A fact about the ward's act, not the person.
   */
  heldBedNumber?: number;
  /** Append-only log of evolving clinical reassessments recorded on this destination addressing. */
  reassessmentHistory?: ReadonlyArray<ClinicalReassessmentEntry>;
  reassessmentNote?: string;
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

export type Referral = {
  /** Opaque submission correlation across JSON snapshots. */
  submissionId?: string;
  turnaroundPriority?: TurnaroundPriority;
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
  readonly [key: `reassessmentHistory${string}`]: ReadonlyArray<ClinicalReassessmentEntry> | undefined;
  readonly [key: `reassessmentNote${string}`]: string | undefined;
};
