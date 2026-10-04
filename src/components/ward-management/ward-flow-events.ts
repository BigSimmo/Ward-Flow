import type { CareChange } from "./ward-care-journey";
import type { DischargeBarrier, LeavingDestination, FollowUpState } from "@/components/ward-management/ward-admissions";
import type { Gender, PatientId } from "@/components/ward-management/ward-patients";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { TentativeDiagnosisBlock } from "@/components/ward-management/ward-diagnosis";
import type {
  BroadcastCategory,
  BroadcastSeverity,
  BroadcastTargetScope,
} from "@/components/ward-management/alerts/ward-broadcast-model";
import type {
  BedPreparationNote,
  BedReleaseBlocker,
  OverrideReason,
  CancelTransportReason,
  GenderPlacementReason,
  LegalFormReceiptCorrectionReason,
  LegalStatusChangeReason,
  ReleasePullReason,
  StopTransportReason,
  TransportWhereabouts,
  DiversionReason,
  UrgencyChangeReason,
  UrgentMarkReason,
  WardRequestWithdrawalReason,
  WardIntakeConstraint,
} from "@/components/ward-management/ward-change-reasons";
import type {
  ArrivalMode,
  BedReleaseWaitingOn,
  Cohort,
  CommunityDeclineReason,
  DeclineReason,
  ExaminationOutcome,
  HomeRegion,
  LegalStatus,
  MovementStage,
  ReferralDeclineReason,
  ReferralDestination,
  ReferralDestinationKind,
  ReferralGender,
  ReferralSource,
  ReferralSuburb,
  Security,
  RecordedSex,
  StepBackReason,
  TransportLegalStatus,
  TransportProvider,
} from "@/components/ward-management/ward-model";
import type { WardScenario } from "@/components/ward-management/ward-scenarios";

/**
 * `WardFlowRole` and `WARD_FLOW_ROLE_LABELS` live in `ward-flow-roles.ts` now (Spec D15
 * restoration, 2026-09-11) — re-exported from here, unchanged, so `ward-flow-reducer.ts` and
 * `ward-tasks-drawer.tsx` need no change. `ward-model.ts` imports the role type directly from
 * `ward-flow-roles.ts` instead of from here, which is the actual fix: this module also declares
 * the bed-release event types and imports `BedReleaseWaitingOn`, so a type-only edge from
 * `ward-model.ts` into this whole file put the release model inside the module graph the D15
 * contract (`tests/ward-referral-matching.test.ts`) walks from matching's own entry points.
 */
export type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
export { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";

/** The short form an ED fills in to raise a brand-new referral. */
export type ReferralDraft = {
  cohort: Cohort;
  security: Security;
  /** Recorded sex (R7, 25 September 2026) — see `RECORDED_SEXES`. */
  sex: RecordedSex;
  /**
   * T10, item 8 (owner answer, 17 September 2026): the gender recorded at referral — see
   * `Movement.gender`'s doc comment (`ward-model.ts`) for why this is a separate, wider fact from
   * `sex` above. Optional, and absent means not yet recorded — the same convention `sex`'s
   * neighbours on this draft hold to; T11's intake screen is what requires an active choice
   * (including an explicit "Not yet recorded") before a referral can be raised, which is a
   * screen-level rule and not one this type can express.
   */
  gender?: ReferralGender;
  /**
   * T15 (item 12): the ED's own choice at intake, which REPLACES whatever a linked referral
   * carried (the 29 Aug ruling: "easy to continually adjust and refine along the way"). Optional
   * — most journeys are raised with no referral to inherit from and no ED choice either, and
   * absent leaves `Movement.tentativeDiagnosis` unset rather than forcing a guess.
   */
  tentativeDiagnosis?: TentativeDiagnosisBlock;
  specialling: boolean;
  /**
   * Whether high-acuity nursing is requested. **The referring clinician marks it — owner ruling,
   * 2026-09-10**, chosen over the system working it out, which would have been the first thing
   * Ward Flow ever did that assessed a patient.
   *
   * A plain `boolean` with `false` as the ordinary state, exactly like `specialling` above. It is
   * never inferred from `urgency`, `security` or `legalStatus` on this same draft.
   */
  highAcuity: boolean;
  legalStatus: LegalStatus;
  urgency: 1 | 2 | 3;
  /**
   * The legal form the clinician selected, as a code from `SELECTABLE_LEGAL_FORMS`, or `null`
   * for no form at all. Explicitly nullable rather than optional or an empty string so that
   * "this patient is on no form" is a first-class choice the clinician made, indistinguishable
   * from neither a field the caller forgot to fill in nor a blank that could be read as a
   * default. Nothing derives this from `legalStatus` any more (product owner, 2026-08-24).
   */
  legalFormCode: string | null;
  /**
   * The expiry written on the legal form, **as typed by the clinician raising this referral** —
   * minutes since midnight, like every other `Instant`. May be supplied beside ANY
   * `legalFormCode`, not only a transport or transfer order — see the correction below.
   *
   * 🔴 **CAPTURED, NEVER COMPUTED, AND THAT IS THE WHOLE DESIGN OF THIS FIELD.** The product
   * owner was asked on 2026-09-07, in one sentence — *"when a coordinator raises a transport (4A)
   * or transfer (4C) order, should the screen ask them to type the due time?"* — and answered
   * **"Yes"**. That answer authorises ASKING. It does not authorise deriving a deadline from a
   * statutory interval, which he declined separately on **2026-08-23**: *"please can you leave the
   * legal part and just start a clock once the patient arrives to ED. Keep it simple for now."*
   *
   * ⚠️ **So nothing may ever populate this from a duration.** A prototype that computes a
   * statutory deadline is making a claim about the Mental Health Act on a clinician's screen, and
   * `ward-model.ts`'s `LegalForm` records that this model once carried exactly such a figure on a
   * Form 1A *"on the strength of an unverified figure an earlier agent wrote into this file from
   * its own recollection"*. It was removed. Do not reintroduce it in this direction either.
   *
   * ⚠️ **AND DO NOT TAKE A DEFAULT FROM THE FIXTURE.** `ward-movements.ts` seeds four deadlines —
   * 4A at `NOW_ANCHOR + 60` and `+ 90`, 4C at `+ 300` and `+ 340`. **They disagree with each
   * other, so they cannot be intervals: a statute does not give two answers for one form.** They
   * are illustrative figures for the demonstration corpus. Anyone reading them to recover "the"
   * interval gets two, and the one they pick will look authoritative on screen.
   *
   * 🔴 **CORRECTED 2026-09-17, T2 — "ONLY 4A AND 4C MAY CARRY ONE" IS NOW FALSE.** Until this date
   * the reducer dropped this value for every code but `transport`/`transfer` kinds, and
   * `tests/ward-legal-figure-guard.test.ts` held an allowlist that made that binding. Owner answer
   * 1, 2026-09-17: the clinician types the expiry written on whichever form they hold — 1A, 3B,
   * 3D, 4A or 4C alike. The reducer now captures this value for any selected code; the guard's
   * allowlist was replaced by a provenance property (every `dueAt` the guard's sweep ever produces
   * must trace to a value the test itself supplied or an authored fixture value, never a computed
   * one) — see that file's own header for the current shape of the check.
   *
   * **Optional, and it stays optional.** A required due time would block the intake form, which is
   * a larger behaviour change than the owner authorised, and `ward-model.ts`'s `LegalForm` comment
   * is emphatic that an absent `dueAt` must be rendered as absent — never as "clear" and never as
   * "not yet due".
   */
  legalFormDueAt?: Instant;
};

/**
 * One variant per row of spec §6. Every event carries `role` (checked against `EVENT_ROLE`
 * before anything else happens) and `now` (the reducer never reads a clock itself).
 */
export const WARD_BUZZ_MESSAGES = [
  "Please review and confirm ward capacity.",
  "Please review the current placement request.",
  "Synthetic ward count request",
] as const;

export type WardFlowEvent =
  | {
      type: "RECORD_ADMISSION_CARE";
      role: WardFlowRole;
      now: Instant;
      actingUnitId?: string;
      actingTeamId?: string;
      admissionId: string;
      patientId: PatientId;
      expectedGeneration: number;
      expectedRevision: number;
      change: CareChange;
    }
  | {
      type: "RECORD_ADMISSION_FOLLOW_UP";
      role: WardFlowRole;
      now: Instant;
      actingUnitId?: string;
      admissionId: string;
      patientId: PatientId;
      expectedGeneration: number;
      expectedRevision: number;
      followUpState: FollowUpState;
    }
  | {
      type: "RECORD_PATIENT_DISCHARGE";
      role: WardFlowRole;
      now: Instant;
      actingUnitId: string;
      admissionId: string;
      patientId: PatientId;
      expectedGeneration: number;
      expectedRevision: number;
      leavingDestination: LeavingDestination;
    }
  | {
      type: "UPDATE_EXPECTED_DISCHARGE";
      role: WardFlowRole;
      now: Instant;
      admissionId: string;
      expectedDischargeAt: Instant;
      actingUnitId?: string;
    }
  | {
      type: "OPEN_DISCHARGE_RECORD";
      actingTeamId?: string;
      role: WardFlowRole;
      now: Instant;
      actingUnitId?: string;
      admissionId: string;
      expectedGeneration: number;
      requestId: number;
    }
  | {
      type: "REVIEW_AUDIT_EVENT";
      role: WardFlowRole;
      now: Instant;
      eventId: string;
      expectedGeneration: number;
      expectedReviewCount: number;
      decision: "reviewed" | "follow-up-required";
    }
  | {
      type: "RAISE_REFERRAL";
      role: WardFlowRole;
      now: Instant;
      edId: string;
      draft: ReferralDraft;
      /**
       * THE FRONT-DOOR REFERRAL THIS JOURNEY IS BEING RAISED FROM, when there is one.
       *
       * Owner ruling 8, 2026-09-01: a community team refers a patient TO an emergency department,
       * the patient attends it, and the department then raises the journey. Those are two records
       * and this is the link between them — see `Movement.referralId`.
       *
       * ⚠️ **OPTIONAL BECAUSE MOST JOURNEYS HAVE NO REFERRAL**, not because it may be skipped when
       * one exists. A person who walked in was referred by nobody, and omitting this says exactly
       * that. When it IS present the reducer RESOLVES it — an id naming no referral, or a referral
       * that was never addressed to `edId`, is refused with a visible `Rejection` rather than
       * stored. A stored id that joins to nothing is the `Admission.referralId` defect
       *
       * 🔴 CORRECTED 2026-09-11: `Admission.referralId` IS NO LONGER A STANDING DEFECT CLASS.
       * Repaired at a6e5208b85 - 10 non-null values, all resolving, zero dangling, 257 honest nulls.
       * ✅ The still-true point, and the one this comment is actually for: RAISE_REFERRAL refuses a
       * dangling id rather than storing it. Name the BEHAVIOUR, not a sibling field, when citing why.
       * (`docs/ward-flow/fields-with-no-producer-2026-09-01.md`), and refusing here is what keeps
       * this field out of that class.
       */
      referralId?: string;
      patientId?: PatientId;
    }
  | {
      /**
       * Owner item 7 (2026-09-17) adds `"further_examination_ordered"` to `ExaminationOutcome`
       * (`ward-model.ts`) — a repeat examination is a NEW record, not an edit to the old one. See
       * that type's own doc comment for what each outcome means, and `RECORD_EXAMINATION`'s own
       * case for the guard that allows a second examination only after this outcome.
       */
      type: "RECORD_EXAMINATION";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      outcome: ExaminationOutcome;
    }
  | {
      /**
       * The emergency department records whether this patient's medical workup is done.
       * `cleared` is the clinician's stated answer; the ABSENCE of `Referral.medicalClearance`
       * means nobody has assessed it, and no event ever writes that absence back.
       */
      type: "RECORD_MEDICAL_CLEARANCE";
      role: WardFlowRole;
      now: Instant;
      referralId: string;
      cleared: boolean;
    }
  | {
      /**
       * The ED psychiatry team records that a referred person is PHYSICALLY IN the department.
       *
       * 🔴 **THIS EVENT EXISTS BECAUSE THE FIELD IT WRITES HAD NO PRODUCER AND COULD HAVE NONE.**
       * `Referral.triagedAt` is settable only inside `RECEIVE_REFERRAL`, at the moment a referral is
       * created — measured 2026-09-07, all three of its reducer mentions are in that one case. So a
       * referral created without a triage time could never acquire one, and an "expect" built on
       * triage could never stop being an expect: the list would only grow, and no action in the
       * running prototype could move anybody off it. **Same shape as `LegalForm.dueAt`, whose only
       * writer was the seed fixture, found the same day.**
       *
       * ⚠️ **`PATIENT_ARRIVED` IS NOT THIS EVENT AND CANNOT BE MADE INTO IT.** That one takes a
       * `movementId`, requires `stage === "moving"` with a `transport.collectedAt`, and marks a
       * patient arriving at their destination WARD at the end of the ED→ward journey. An emergency
       * department can never be a movement destination. **It is the opposite direction of travel**,
       * and reaching for it here would record a ward arrival for a person who has not left the
       * community yet.
       *
       * ⚠️ **A HUMAN OBSERVATION.** Product owner, 2026-09-07: *"Marking the patient is done manually
       * when the ED psychiatry doctors notice the patient has arrived in ED."* Nothing feeds it —
       * no ambulance dispatch, no triage system — so it is exactly as timely as somebody noticing,
       * and his *"for now"* is recorded rather than smoothed away.
       *
       * Idempotent by design: recording arrival for somebody already recorded as present is a
       * no-op rather than a rejection, because two clinicians noticing the same patient is ordinary
       * and a refusal would read on screen as though the first recording had failed.
       */
      type: "RECORD_ARRIVED_IN_DEPARTMENT";
      role: WardFlowRole;
      now: Instant;
      referralId: string;
    }
  | {
      /**
       * The sending team records whether this patient needs transport at all — owner ruling
       * R-2026-09-04-C, the third state.
       *
       * `needed: false` is a stated answer ("this patient needs no transport"), NOT the same thing
       * as `Movement.transportNeed` being absent, which means nobody has said. No event ever
       * writes the absence back, exactly as no event un-records a medical clearance.
       */
      type: "RECORD_TRANSPORT_NEED";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      needed: boolean;
    }
  | {
      /**
       * The department holding the patient records that NOBODY referred them — owner ruling
       * R-2026-09-04-D, the clinical one of the three causes an absent `Movement.referralId` had.
       *
       * ⚠️ **THIS IS THE ASSERTION, NOT THE ABSENCE.** Before it, "nobody raised a referral for
       * this person" and "this record predates the link" and "the raiser was never asked" were one
       * indistinguishable empty field. Refused for a movement that already names a referral: the
       * two answers contradict each other, and a stored contradiction is worse than a refusal.
       */
      type: "RECORD_NO_REFERRAL";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
    }
  | {
      /**
       * RB3, item 19 (owner answers 2026-09-17): "'For discharge' and 'For community follow-up'
       * are recorded outcomes." The department records that this patient no longer needs a
       * psychiatric bed — either they are going home, or they need community follow-up rather
       * than admission. Recording an outcome unwinds a live bed search exactly like
       * `WITHDRAW_REFERRAL`'s pre-collection path: any live ward requests are withdrawn, a
       * pulled bed and its admission are released, and an uncollected transport job is
       * cancelled — then the movement closes `did_not_proceed`, with the outcome as the reason.
       * The patient stays on this department's own board (see `edOutcome` on `Movement`) until
       * `RECORD_LEFT_DEPARTMENT` marks them as having physically left.
       *
       * Refused once the patient has been collected — `STOP_TRANSPORT` is the event for a
       * journey already under way — and once the movement has already closed by any other path.
       */
      type: "RECORD_ED_OUTCOME";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      outcome: "for_discharge" | "for_community_follow_up";
    }
  | {
      type: "REFER_TO_UNITS";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      unitIds: string[];
      /**
       * Present when the coordinator is referring DESPITE a failing gate — an override.
       *
       * Optional because most referrals are not overrides, and absent means exactly that: no
       * override happened and none is recorded. When present the reducer keeps it on the movement
       * (`Movement.overrides`), which is the whole of owner decision OD-3: the reason used to be
       * collected in a textarea, held in the screen's own state and discarded on the next
       * selection, while the governance page said override reasons were recorded.
       *
       * From `OVERRIDE_REASONS`, never free text, and never an "other, please specify" (WB-DB-16).
       */
      overrideReason?: OverrideReason;
      /**
       * T12 (item 9, owner answer 9, 17 September 2026): the coordinator's own "checked with the
       * ward" confirmation for a `Non-binary` movement, paired with `genderPlacementChecked`
       * below — see `GenderPlacement`'s own doc comment (`ward-model.ts`) for the full rule.
       * Optional because most movements are never `Non-binary`, and a `Non-binary` referral to a
       * unit already cleared by an earlier record needs neither field again.
       */
      genderPlacementReason?: GenderPlacementReason;
      /**
       * The tick — a SECOND fact beside `genderPlacementReason`, neither standing in for the
       * other, the identical discipline `PULL_PATIENT.numConsulted` already holds to for the
       * high-acuity override. `true` when the coordinator ticked it; never `false`.
       */
      genderPlacementChecked?: true;
    }
  /**
   * ⚠️ `overrideReason` is on all three placement events, not just `REFER_TO_UNITS`, because of the
   * owner's ruling of 2026-09-02: *"the engine should refuse, screen checks are not enough"*, then
   * *"refuse unless a reason is recorded"*. Before that ruling these two events could not EXPRESS an
   * override at all, so the ruling was unimplementable for them until the field existed.
   *
   * **An ineligible placement is made ACCOUNTABLE, never impossible.** A coordinator at three in the
   * morning with a patient who must go somewhere is a real situation, and an override that is
   * refused becomes a phone call — the placement then happens outside the system, where nothing is
   * recorded at all. **A rule that cannot be overridden does not stop the placement; it stops the
   * RECORD of the placement.**
   */
  | {
      type: "ACCEPT_IN_PRINCIPLE";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      unitId: string;
      overrideReason?: OverrideReason;
    }
  | {
      type: "PULL_PATIENT";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      unitId: string;
      overrideReason?: OverrideReason;
      /**
       * Item 10 (owner answers, 17 September 2026): the "Nurse unit manager consulted" tick, a
       * SECOND fact beside `overrideReason` — the high-acuity staffing gate needs both, and
       * neither answers for the other. Optional because most pulls are not this override at all;
       * `true` when ticked, never `false` — see `Override.numConsulted`'s own doc comment. Read
       * only by `PULL_PATIENT`'s acuity block; every other gate this event can answer (specialling,
       * eligibility) is unchanged and never reads this field.
       */
      numConsulted?: true;
      patientId?: PatientId;
    }
  | {
      type: "DECLINE";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      unitId: string;
      /** From `DECLINE_REASONS`, and nothing beside it — see `Decline`'s own doc comment (PD-6). */
      reason: DeclineReason;
    }
  | {
      type: "HANDOVER_READY";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      /**
       * ⚠️ **NOTHING WRITES THIS AND NOTHING READS IT.** Who collects the patient is chosen on the
       * booking control (`ed/ed-screen.tsx`) and stored by `BOOK_TRANSPORT`, the only event that
       * creates a `TransportJob`. `HANDOVER_READY` requires that job to exist already and does
       * nothing but move the movement to `handover_ready`; its reducer case never reads this field,
       * and the one dispatch site sets `type`, `role`, `now` and `movementId` only.
       *
       * Inert rather than misleading — nothing computes with it, so no screen can render a value
       * derived from it — but it is a field with no producer and no consumer either way. Recorded
       * in `docs/ward-flow/fields-with-no-producer-2026-09-01.md`.
       */
      provider?: TransportProvider;
    }
  | { type: "TRANSPORT_ACCEPTED"; role: WardFlowRole; now: Instant; movementId: string }
  | { type: "TRANSPORT_EN_ROUTE"; role: WardFlowRole; now: Instant; movementId: string }
  | { type: "PATIENT_COLLECTED"; role: WardFlowRole; now: Instant; movementId: string }
  | {
      type: "PATIENT_ARRIVED";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      actingUnitId?: string;
    }
  | {
      /**
       * Physical receipt of a form this prototype owns a clock for: 1A, 3A, 3C, 3D, 6A, 6B, 6C,
       * 5A or 5B. Refused for any other code, and for a movement carrying no form at all. The
       * receipt instant is stored; the clock comes from `ward-legal-clock`, never invented here.
       */
      type: "RECORD_LEGAL_FORM_RECEIVED";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      /**
       * Metro vs country for the examination window after receipt. Defaults to metro (24 hours).
       * Country extension of that window is a separate recorded act, not automatic.
       */
      region?: "metro" | "country";
    }
  | {
      /**
       * T4 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`): the undo
       * `RECORD_LEGAL_FORM_RECEIVED` has never had. Clears `Movement.legalFormReceivedAt` and
       * appends the original instant, who corrected it and the fixed reason
       * (`LegalFormReceiptCorrectionReason`) to `Movement.legalFormReceiptCorrections`, so a
       * second `RECORD_LEGAL_FORM_RECEIVED` can succeed without the fact a receipt was once
       * recorded being lost. Refused for a closed movement, for a movement carrying no recorded
       * receipt to correct, and for a reason outside the fixed list.
       */
      type: "CORRECT_LEGAL_FORM_RECEIPT";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      reason: LegalFormReceiptCorrectionReason;
    }
  | {
      /**
       * T2 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`), owner answer 1 and
       * item 5 (regional extensions): the clinician types the expiry written on the form they are
       * holding, and — later, for the same movement — a further extension written on a fresh form.
       * One event carries both: the reducer decides which this is from what `movement.legalForm`
       * already holds. No `dueAt` yet on the movement's legal form → this is the first typed
       * expiry (`basis: "written_on_form"`, any value accepted, nothing to be later than yet). A
       * `dueAt` already recorded → this is an extension (`basis: "extension"`), refused unless
       * `dueAt` is strictly later than the one already there — "an extension's new expiry must be
       * later than the expiry already recorded" is the exact sentence build plan §2 gives for that
       * refusal. Refused outright for a closed movement or a movement carrying no legal form at
       * all: there is nothing to attach an expiry to. Never computed from a duration — this event
       * exists so the reducer never has to be.
       */
      type: "RECORD_LEGAL_FORM_EXPIRY";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      dueAt: Instant;
    }
  | {
      /**
       * Opus review round 2, 17 September 2026 (P2): the `gender_designation` gate's own refusal
       * says "Record gender first", but until this event nothing could — `Movement.gender` was
       * writable only at `RAISE_REFERRAL`/`RECEIVE_REFERRAL`, before the movement this refusal
       * fires against even exists. This is the only writer of `Movement.gender` after that point,
       * and appends `{ at, by, from, to }` to `Movement.genderChanges` in the same update, so a
       * correction is never silent. Refused for a closed movement, a `gender` outside
       * `REFERRAL_GENDERS`, or a `gender` equal to what the movement already carries — the
       * membership check is the same discipline every other closed-list field on this file holds
       * to, and the unchanged-value refusal is what keeps this an actual CHANGE event rather than
       * a way to pad `genderChanges` with no-op entries.
       */
      type: "RECORD_MOVEMENT_GENDER";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      gender: ReferralGender;
    }
  | {
      /**
       * Owner Answer 18 (second round, 2026-09-17): the ward screen's replacement for its old
       * free-text "Anything limiting who can come in right now" box. `codes` is chosen, never
       * typed — a subset of `WARD_INTAKE_CONSTRAINTS`, membership-checked by the reducer, and may
       * be empty (nothing currently limiting intake). Same `unitId`/`actingUnitId` claim-not-proof
       * pair as `CONFIRM_CAPACITY` below, for the same reason: this restates one ward's own
       * answer, and the reducer refuses a caller stating a different ward than it acts as.
       */
      type: "RECORD_WARD_INTAKE_CONSTRAINTS";
      role: WardFlowRole;
      now: Instant;
      unitId: string;
      actingUnitId: string;
      codes: readonly WardIntakeConstraint[];
    }
  | {
      type: "CONFIRM_CAPACITY";
      role: WardFlowRole;
      now: Instant;
      /** The unit whose allocatable count is being restated. */
      unitId: string;
      /**
       * The unit the caller stated it was acting as. The ward screen is routed as
       * `/mockups/ward-flow/ward/[unitId]`, so a caller always has one to state; the reducer
       * refuses the event when this and `unitId` differ.
       *
       * This is a claim the caller makes about itself, recorded and compared. It is **not** an
       * authenticated identity and this model has none: nothing here verifies that the caller
       * really is that unit, and anything able to dispatch an event can state whichever acting
       * unit it likes. Required rather than optional so a caller cannot omit it and skip the
       * comparison silently.
       */
      actingUnitId: string;
      value: number;
      /** Revision captured when the observation draft starts. Missing or stale values are refused. */
      expectedRevision?: number;
    }
  | {
      type: "RECORD_ESCALATION";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      triedUnitIds: string[];
      contact: string;
    }
  | { type: "ADVANCE_CLOCK"; role: WardFlowRole; now: Instant; minutes: number }
  | { type: "RESET_SCENARIO"; role: WardFlowRole; now: Instant }
  | { type: "SET_SCENARIO"; role: WardFlowRole; now: Instant; scenario: WardScenario }
  /**
   * Task 3 of the audit-wiring plan, 2026-09-16: a coordinator saves an edited draft of
   * `WardFlowState.configuration` from the settings screen. `payload` is `unknown` on the event
   * itself — the reducer is the only place that trusts a shape, via `validateConfiguration`
   * (`ward-configuration.ts`) — so an invalid draft is refused with a reason naming the field,
   * never partially applied.
   */
  | { type: "SET_CONFIGURATION"; role: WardFlowRole; now: Instant; payload: unknown }
  /**
   * ADD A PATIENT. The owner's flow: search for somebody, and if nobody comes up, add them.
   *
   * The person being added has never been referred, never moved and never arrived - which is the
   * whole reason this event exists rather than a patient falling out of one of those. A record
   * created by arrival is correct on every screen showing admitted people and absent at exactly the
   * moment the flow describes.
   *
   * Carries identity because identity lives on `Patient` and nowhere else, by owner ruling PD-1
   * (2026-08-30). It does not carry a referral, a movement or a unit: a patient exists before any of
   * them and outlives all of them.
   *
   * `gender` ADDED, owner ruling 2026-09-09/2026-09-10 — OPTIONAL, unlike the four identity fields
   * above. Most callers of this event do not know a new patient's gender yet, and omitting it is the
   * ordinary case: the reducer leaves `Patient.gender` `undefined` ("not yet recorded"), never
   * defaulted from anything. When a caller does supply it, membership is checked against `GENDERS`
   * at the reducer (never trusted from the type alone — see the sibling `sex` check on
   * `RECEIVE_REFERRAL`), because a type-only guarantee does not run under a plain `vitest run`.
   *
   * `suburb` ADDED, R-2026-09-04-A — OPTIONAL, same shape as `gender`. The add-patient screen
   * already collects it; omitting it leaves `Patient.suburb` unrecorded. When supplied, it is the
   * catchment-lookup key held as a string on `Patient` (see that field's own comment) — not a
   * `ReferralSuburb` union, and not validated against the catchment table here.
   */
  | {
      type: "ADD_PATIENT";
      role: WardFlowRole;
      now: Instant;
      umrn: string;
      givenName: string;
      familyName: string;
      dateOfBirth: string;
      gender?: Gender;
      suburb?: string;
    }
  | {
      type: "CHANGE_URGENCY";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      urgency: 1 | 2 | 3;
      reason: UrgencyChangeReason;
    }
  | {
      /**
       * THE URGENT FLAG GOES ON. The mechanism the owner asked for on 2026-08-30 and that nobody
       * could reach until 2026-09-01.
       *
       * His words: *"A long wait always is prioritised… however… in certain cases patients can be
       * marked as urgent for many reasons which outranks everything."* `Movement.flaggedUrgent` was
       * added, `queueOrder` (ward-priority.ts) puts it ABOVE all three urgency tiers, and the
       * coordinator queue renders a "Flagged urgent" badge for it. But the only writer was the
       * literal `false` at creation, exactly one seeded movement carried `true`, and there was no
       * flagging event among the thirty-nine. **The feature was fully built and entirely
       * unreachable** — the ordering rule existed, the badge existed, and nobody could ever cause
       * either to happen.
       *
       * ⚠️ **A REASON IS NOW REQUIRED — item 37, 2026-09-17, closing the part of "for many
       * reasons" that used to keep this event from carrying one.** Chosen from `URGENT_MARK_REASONS`
       * (`ward-change-reasons.ts`), never typed, the same discipline every other reason list in this
       * file holds to. A missing or unlisted reason is refused by the reducer's runtime membership
       * check — the type alone cannot enforce this, per this file's own precedent on every other
       * reason-carrying event.
       *
       * ⚠️ **WHO FLAGGED IT AND WHEN ARE NOW RECORDED TOO**, on `Movement.urgentFlag` — see that
       * field's own doc comment in `ward-model.ts`. The reducer writes `{ at: event.now, by:
       * event.role, reason: event.reason }` alongside `flaggedUrgent: true`, so a flag raised
       * through this event always carries provenance; only movements flagged before this change
       * (the fixture's WF-018) carry none.
       */
      type: "FLAG_MOVEMENT_URGENT";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      reason: UrgentMarkReason;
    }
  | {
      /**
       * THE URGENT FLAG COMES OFF, AND THIS HALF IS NOT OPTIONAL.
       *
       * A flag nobody can remove is a permanent-state defect of exactly the kind this change set is
       * repairing elsewhere: it would sit above every tier for the rest of the demonstration, on a
       * patient whose situation had resolved, and the one seeded movement carrying `true` could
       * never be cleared at all.
       *
       * Same roles as flagging. Whoever may put a patient above every tier may take them back
       * down — a raising permission wider than the lowering one is how a queue fills with flags
       * nobody present is allowed to clear.
       */
      type: "CLEAR_MOVEMENT_URGENT_FLAG";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
    }
  | {
      type: "CHANGE_LEGAL_STATUS";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      legalStatus: LegalStatus;
      reason: LegalStatusChangeReason;
    }
  | {
      type: "RELEASE_PULL";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      reason: ReleasePullReason;
      /**
       * The unit the caller stated it was acting as. Required for a `ward` caller, unused for a
       * `coordinator` caller. This records the caller's CLAIM about itself and does not prove it:
       * nothing here authenticates anything, and this model has no identity model. The comparison
       * constrains future callers rather than this one.
       */
      actingUnitId?: string;
    }
  | {
      /**
       * The sending team books the transport out — `TR-D1` (OWNER, 2026-08-30). Once a receiving
       * ward accepts, the team currently holding the patient arranges the move.
       *
       * ⚠️ **HIS REASON IS THE DESIGN: the sending team knows the facts the booking needs** —
       * whether an escort is required, whether the patient is settled enough to travel. **The bed
       * coordinator was rejected by name**, because it owns the bed search and does not know the
       * patient's state. `TR-D5` generalises it beyond bed placement, which is why a ward books too
       * and not only an emergency department.
       */
      type: "BOOK_TRANSPORT";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      /** From `TRANSPORT_PROVIDERS`, membership-checked by the reducer. Never free text. */
      provider: TransportProvider;
      /**
       * ⚠️ **ANSWERED BY A PERSON, NEVER DERIVED, AND REQUIRED SO THERE IS NO VALUE TO OMIT.**
       * This event is the only writer of `TransportJob.escortRequired`, and nothing anywhere
       * derives it. Deriving it — from `movement.legalStatus`, or from anything else — would be a
       * clinical judgement made by nobody and shown on screen as though a clinician had made it,
       * and wrong in both directions: a voluntary patient can need an escort, and a detained one
       * settled enough to travel may not. The reducer refuses the event outright when the answer is
       * absent rather than storing `false`. The booking control opens BLANK (owner, relayed); a
       * pre-filled answer is the same defect moved into the UI where it looks like a default.
       */
      escortRequired: boolean;
      /**
       * THE CLAIM A `ward` BOOKER MAKES ABOUT ITSELF — owner ruling WLQ-11 (2026-09-15), added so
       * `CANCEL_TRANSPORT` can later tell the booking ward from any other. Same claim-not-proof
       * discipline as `actingUnitId` everywhere else in this file: read from the ward screen's own
       * route parameter, never authenticated, and REQUIRED when `role` is `"ward"` — the reducer
       * refuses a `ward` booking that omits it, because a booker this field cannot name could never
       * be matched against a later cancellation claim.
       *
       * Unused for `ed` bookers, which have no equivalent identity in this model. `community`
       * bookers use `actingPlaceId` instead — see that field's own comment just below.
       */
      actingUnitId?: string;
      /**
       * THE CLAIM A `community` BOOKER MAKES ABOUT ITSELF — owner's third ruling, 2026-09-17
       * (answer 9): "only the community team that booked transport may cancel it." Same
       * claim-not-proof discipline as `actingPlaceId` on `MARK_NOTICE_READ` above: read from the
       * community screen's own `teamId` route parameter, never authenticated, and REQUIRED when
       * `role` is `"community"` — the reducer refuses a `community` booking that omits it, for the
       * identical reason `actingUnitId` is required of a `ward` booker just above.
       */
      actingPlaceId?: string;
      /**
       * THE CAD TRANSPORT NUMBER, VOLUNTARY/INVOLUNTARY STATUS AND ESTIMATED TIME — owner's third
       * ruling, 2026-09-17, verbatim: *"there is no screen that books transport... instead you
       * click a button saying it is booked and a popup pops up and you enter the CAD transport
       * number, state voluntary or involuntary, state estimated time as well. This is the booking.
       * it is logging the booking you made over the phone."* All three are answered by a person,
       * never derived, and REQUIRED so there is no value to omit — the same discipline
       * `escortRequired` above already holds to. See each field's own doc comment on `TransportJob`
       * (`ward-model.ts`) for what it means and why it is optional THERE despite being required
       * HERE.
       */
      cadNumber: string;
      transportLegalStatus: TransportLegalStatus;
      estimatedAt: Instant;
    }
  | {
      type: "CANCEL_TRANSPORT";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      reason: CancelTransportReason;
      /**
       * The unit the caller stated it was acting as. Required for a `ward` caller, unused for a
       * `coordinator` caller. This records the caller's CLAIM about itself and does not prove it:
       * nothing here authenticates anything, and this model has no identity model. The comparison
       * constrains future callers rather than this one.
       */
      actingUnitId?: string;
      /**
       * THE TEAM THE CALLER STATED IT WAS ACTING AS — owner's third ruling, 2026-09-17 (answer 9),
       * closing the gap `EVENT_ROLE.CANCEL_TRANSPORT`'s own comment used to describe: a community
       * team now has an identity claim to cancel with, the same claim-not-proof discipline as
       * `actingUnitId` above and as `MARK_NOTICE_READ.actingPlaceId`. Required for a `community`
       * caller, unused for anyone else. Compared against `transport.bookedBy.placeId`; a
       * `community` caller whose claim does not match the recorded booker is refused, the same
       * shape the `ward` branch already uses against `bookedBy.unitId`.
       */
      actingPlaceId?: string;
    }
  | {
      /**
       * Direct ED-to-CMHT referral pathway (Owner ruling 16, 2026-09-16).
       * Refers a patient in ED directly to a community mental health team when admission is not required.
       */
      type: "REFER_TO_COMMUNITY_TEAM";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      team: string;
      reason?: string;
    }
  | {
      /**
       * Records that a patient who was referred for community follow-up or discharged has physically left the ED (Item 19, owner answers 2026-09-17).
       */
      type: "RECORD_LEFT_DEPARTMENT";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
    }
  | {
      /**
       * THE REFERRER OR THE COORDINATOR STOPS A JOURNEY ALREADY UNDER WAY — WLQ-38 (owner,
       * 2026-09-15), his words: *"This should also be the referring doctors responsibility as well
       * to be able to revoke the transport as well as referral in addition to the coordinator."*
       *
       * `CANCEL_TRANSPORT` refuses once `transport.collectedAt` is set ("the patient has
       * departed"), and until this event existed nothing else could stop a collected journey — a
       * revoked examination or a withdrawn referral discovered only after collection left the
       * patient still travelling towards a bed nobody meant to hold for them any more.
       *
       * ⚠️ **SAME REFERRER SCOPING AS A POST-ACCEPTANCE `WITHDRAW_REFERRAL`, AND THE SAME LIMIT.**
       * `EVENT_ROLE.STOP_TRANSPORT` below permits `coordinator` and `ed`. The referrer for a
       * movement is the emergency department it began in (`Movement.originEdId`), but no ED-raised
       * event in this file carries an acting-ED identity claim the way a `ward` caller carries
       * `actingUnitId` — the same absence `EVENT_ROLE.CANCEL_TRANSPORT`'s own comment already names
       * for `community` ("no event carries which community team is acting", R2, no viewer
       * identity). So `ed` is permitted by ROLE ALONE here, unchecked against `originEdId`, exactly
       * as `ed` already is everywhere else this model cannot tell one department from another.
       *
       * Valid only once the transport has been COLLECTED, the patient has not yet ARRIVED, and the
       * movement is still OPEN — a job not yet collected is `CANCEL_TRANSPORT`'s own case, and an
       * arrived or otherwise closed movement has nothing left to stop.
       */
      type: "STOP_TRANSPORT";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      /** From `STOP_TRANSPORT_REASONS`, membership-checked by the reducer. Never free text. */
      reason: StopTransportReason;
      /**
       * Build plan item 31 (T3, 2026-09-17): where the patient actually is once the job stopped —
       * a stop is about the job, not the person, and this records the person separately. Required,
       * not optional: a stop with nothing recorded about where the patient is would be exactly the
       * gap this task exists to close. From `TRANSPORT_WHEREABOUTS`, membership-checked by the
       * reducer. Never free text.
       */
      whereabouts: TransportWhereabouts;
    }
  | {
      /**
       * OWNER ANSWER 8 (second round, 2026-09-17): *"A stop after collection keeps the bed held
       * until the coordinator, the ward or the referrer releases it."* `STOP_TRANSPORT` above no
       * longer refunds the bed itself; this is the event that does, once a person — not the system
       * — decides to. Mirrors `RELEASE_PULL`'s own effect (refunds `unit.allocatable` and deletes
       * the `Admission` `PULL_PATIENT` created, via the same `releasePulledBedAndAdmission`
       * helper), but `RELEASE_PULL` refuses a closed movement and requires stage `pulled` —
       * exactly wrong for a movement `STOP_TRANSPORT` has already closed `did_not_proceed` — so
       * this is a new case rather than a loosened `RELEASE_PULL`.
       *
       * Permitted roles are `coordinator`, `ward` and `ed` — the same three the owner named. `ward`
       * carries the same claim-not-proof `actingUnitId` discipline `RELEASE_PULL` and
       * `CANCEL_TRANSPORT` already use; `ed` is permitted by role alone, the same reasoning
       * `STOP_TRANSPORT`'s own doc comment gives (no ED-raised event in this file carries an
       * acting-ED identity claim).
       *
       * Refused unless the movement was actually stopped by `STOP_TRANSPORT` and still holds a
       * bed (`movement.transport?.stoppedAt !== undefined && movement.admissionId !== undefined`)
       * — a movement with no such hold has nothing this event does.
       */
      type: "RELEASE_HELD_BED";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      /** Required for a `ward` caller, unused for `coordinator`/`ed` — same discipline as
       *  `RELEASE_PULL`'s own field of the same name. */
      actingUnitId?: string;
    }
  | {
      /**
       * Build plan item 29 (T4a, 2026-09-17) / R2-7: a collected journey is diverted to a place
       * other than the accepting ward. The transport officer or the coordinator records the new
       * destination (from `TRANSPORT_WHEREABOUTS`) and one of the four `DIVERSION_REASONS`. The
       * bed stays held and the movement stays OPEN — unlike `STOP_TRANSPORT`, which closes the
       * journey in the same write. `RELEASE_DIVERTED_BED` is the event that then ends it.
       *
       * Allowed only after collection, and refused after arrival, after a stop, when already
       * diverted, or from a ward. `EVENT_ROLE.RECORD_DIVERSION` permits `officer` and
       * `coordinator` only.
       */
      type: "RECORD_DIVERSION";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      /** From `DIVERSION_REASONS`, membership-checked by the reducer. Never free text. */
      reason: DiversionReason;
      /** From `TRANSPORT_WHEREABOUTS`, membership-checked by the reducer. Never free text. */
      place: TransportWhereabouts;
    }
  | {
      /**
       * Build plan item 29 (T4a, 2026-09-17) / OA-29: releases a bed `RECORD_DIVERSION` left held.
       * The coordinator, the accepting ward, or the referring ED may release. Calls the same
       * `releasePulledBedAndAdmission` helper `RELEASE_HELD_BED` uses, closes the journey
       * `did_not_proceed`, and tells the ward unless the ward itself released it.
       *
       * `ward` carries the same claim-not-proof `actingUnitId` discipline; `ed` is permitted by
       * role alone, the same gap already recorded for `RELEASE_HELD_BED` / `STOP_TRANSPORT`.
       */
      type: "RELEASE_DIVERTED_BED";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      /** Required for a `ward` caller, unused for `coordinator`/`ed`. */
      actingUnitId?: string;
    }
  | {
      type: "FLAG_BED_RELEASE";
      role: WardFlowRole;
      now: Instant;
      /** The unit a bed is being flagged as coming free at. */
      unitId: string;
      /**
       * The unit the caller stated it was acting as, same claim-not-proof discipline as
       * `CONFIRM_CAPACITY`'s own field (see its doc comment). `FLAG_BED_RELEASE` is `ward`-only
       * (there is no coordinator caller to exempt), so this is always required and always
       * compared against `unitId`.
       */
      actingUnitId: string;
      /**
       * The stay this discharge belongs to — an `Admission.id` on `unitId`, currently occupying a
       * bed, with no other live release. Required (owner decision 2026-09-25: a bed release is a
       * named patient's discharge). The reducer refuses an unknown id, one on another unit, one that
       * has already left, one not in a bed, and a second live release for the same person.
       */
      admissionId: string;
      /**
       * What this discharge is still waiting on, chosen from `BED_RELEASE_WAITING_ON`. Renamed
       * from `confidence` by the Q1 axis change of 2026-08-28: a ward states a FACT about what is
       * outstanding rather than estimating a probability two wards cannot mean the same thing by.
       * `"Nothing outstanding"` is the value for a prediction with no obstacle — it is a real
       * choice, not the absence of one, so the picker never has to be left blank.
       */
      waitingOn: BedReleaseWaitingOn;
      /**
       * The ward's own estimate of when this bed will actually be free — a fact about the BED,
       * the same category `expectedReturn` on `RECORD_LEAVE_BED` already sits in (binding spec
       * §4 forbids timing that could identify the departing PATIENT, not an operational estimate
       * about the bed itself). Collected on the ward screen's flag form exactly like
       * `expectedReturn` is, and carried through to `BedRelease.expectedAt` unchanged — see the
       * reducer's own comment on this case for why `confirmedAt` stays a separate field.
       */
      expectedAt: Instant;
      /**
       * Chosen from `BED_RELEASE_BLOCKERS`, never free text — an operational fact about the
       * BED, never about the departing patient (binding spec §4). Optional: a ward may report a
       * bed coming free that is ALREADY stuck.
       *
       * Bed-model rework (2026-08-28): supplying this no longer changes which STATE the release
       * is created in. Every `FLAG_BED_RELEASE` creates a `"expected"` release, and a blocker
       * sets the blocked FLAG on it. Before the rework a flagged blocker produced a release in
       * the fourth state `"blocked"`, which `capacityBreakdown` then counted nowhere at all.
       */
      blocker?: BedReleaseBlocker;
    }
  | {
      type: "CONFIRM_BED_RELEASE";
      role: WardFlowRole;
      now: Instant;
      /** The release moving from `expected` into `confirmed`. Any blocked flag it carries is
       *  deliberately KEPT — a discharge that is decided and stuck is exactly that, and losing
       *  the flag here would recreate the count defect this rework closed from the other side. */
      releaseId: string;
      /**
       * The unit the caller stated it was acting as, same claim-not-proof discipline as
       * `FLAG_BED_RELEASE`'s own field (see its doc comment). `CONFIRM_BED_RELEASE` is
       * `ward`-only, so this is always required and always compared against the release's own
       * `unitId`.
       */
      actingUnitId: string;
    }
  | {
      type: "REVERT_BED_RELEASE";
      role: WardFlowRole;
      now: Instant;
      /**
       * The release moving from `confirmed` back to `expected` — the reversal the four-stage
       * model forbade (bed-model rework, 2026-08-28). Forbidding it never stopped a decision
       * being reversed on a ward; it only made the ward record the reversal dishonestly, by
       * leaving a confirmed row standing that everybody knew was no longer true. Any blocked flag
       * survives the reversal untouched: reversing the decision does not unstick the bed.
       */
      releaseId: string;
      /** Same claim-not-proof discipline as `CONFIRM_BED_RELEASE`'s own field. */
      actingUnitId: string;
      /**
       * A `"expected"` release carries a waiting-on value and a `"confirmed"` one does not, so
       * the reversal has to restate it — there is no earlier value to restore, and inventing one
       * would be the reducer asserting something the ward never said. Moved with the Q1 axis
       * change of 2026-08-28, exactly as the bed-model rework said it would.
       */
      waitingOn: BedReleaseWaitingOn;
    }
  | {
      type: "BLOCK_BED_RELEASE";
      role: WardFlowRole;
      now: Instant;
      /**
       * The release gaining the blocked FLAG. Bed-model rework (2026-08-28): this no longer
       * changes `state` at all — a blocked release stays `expected` or `confirmed`, and a
       * blocked-but-confirmed bed keeps counting as confirmed. `discharged` is refused: there is
       * nothing left to hold up once the bed is free.
       */
      releaseId: string;
      /** Same claim-not-proof discipline as `CONFIRM_BED_RELEASE`'s own field. */
      actingUnitId: string;
      /**
       * Chosen from `BED_RELEASE_BLOCKERS`, never free text — required here (unlike
       * `FLAG_BED_RELEASE`'s optional field) because a `BLOCK_BED_RELEASE` with no blocker is a
       * contradiction in terms. A typed caller cannot omit this; the reducer still refuses a
       * missing or empty value at runtime rather than trusting the type alone.
       */
      blocker: BedReleaseBlocker;
    }
  | {
      type: "CLEAR_BED_RELEASE_BLOCK";
      role: WardFlowRole;
      now: Instant;
      /**
       * The release whose blocked flag is being lifted — the bed is unstuck, and its stage is
       * whatever it already was. A flag that can only ever be set is not a flag; before the
       * rework the only way out of `"blocked"` was a state change, which is precisely the
       * conflation being undone here.
       */
      releaseId: string;
      /** Same claim-not-proof discipline as `CONFIRM_BED_RELEASE`'s own field. */
      actingUnitId: string;
    }
  | {
      type: "SET_BED_PREPARATION";
      role: WardFlowRole;
      now: Instant;
      /** The release whose bed is being made ready, or has finished being made ready. */
      releaseId: string;
      /** Same claim-not-proof discipline as `CONFIRM_BED_RELEASE`'s own field. */
      actingUnitId: string;
      /**
       * Whether this bed is currently being made ready. **Purely informational** (Q4): nothing
       * in this codebase may read it to decide whether the bed can be offered, counted or
       * allocated — see `BED_PREPARATION_NOTES` for the owner's own reasoning.
       */
      preparing: boolean;
      /**
       * What the bed is waiting on to be ready, chosen from `BED_PREPARATION_NOTES` — the owner
       * supplied that list on 2026-08-28, so a caller may now name a note. Optional: "being made
       * ready, reason not stated" stays legal. Omitted or `undefined` stores `null`, and the
       * reducer forces `null` whenever `preparing` is false.
       */
      note?: BedPreparationNote;
    }
  | {
      type: "RELEASE_BED";
      role: WardFlowRole;
      now: Instant;
      /**
       * Completes a release only when its named admission has already left. While the person is
       * still in the bed it is refused — record the leaving (`RECORD_LEAVING`), which completes the
       * release itself. Changes no bed figure.
       */
      releaseId: string;
      /** Same claim-not-proof discipline as `CONFIRM_BED_RELEASE`'s own field. */
      actingUnitId: string;
    }
  | {
      type: "RECORD_LEAVE_BED";
      role: WardFlowRole;
      now: Instant;
      /** The unit whose bed is being reported as occupied by someone on approved leave. */
      unitId: string;
      /** Same claim-not-proof discipline as `FLAG_BED_RELEASE`'s own field, compared against `unitId`. */
      actingUnitId: string;
      /**
       * The stay going on leave — an `Admission.id` on `unitId`, currently occupying a bed, and not
       * already on leave. Required (owner ruling 2026-09-25). The reducer refuses an unknown id, one
       * on another unit, one not occupying a bed, and a second leave for the same stay.
       */
      admissionId: string;
      /*
       * 🔴 **`usable: boolean` WAS REMOVED HERE 2026-09-06 — OWNER RULING 11.** It carried "the ward's
       * statement that this bed can be filled while its occupant is away", and the ruling is that a
       * bed on leave is **not** one a ward would offer. **The event was asking a ward to assert
       * exactly what the ruling denies**, so the question is gone rather than the answer defaulted.
       */
      expectedReturn: Instant;
      /** Off-ward leave or medical trip — both count as leave beds with a 24-hour open warning. */
      kind?: "off_ward" | "medical_trip";
    }
  | {
      type: "END_LEAVE_BED";
      role: WardFlowRole;
      now: Instant;
      /** The leave bed record ending — the occupant has returned or the leave has ended. */
      leaveBedId: string;
      /** Same claim-not-proof discipline as `CONFIRM_BED_RELEASE`'s own field, compared against
       *  the found leave bed's own `unitId`. */
      actingUnitId: string;
    }
  | {
      type: "REQUEST_CAPACITY_REFRESH";
      role: WardFlowRole;
      now: Instant;
      /** The unit a coordinator is asking to restate its numbers. */
      unitId: string;
    }
  | {
      type: "RECEIVE_REFERRAL";
      role: WardFlowRole;
      now: Instant;
      /**
       * ⚠️ WHICH PERSON, AS A POINTER. Owner ruling 2026-09-02: a referral may remember its
       * patient. OPTIONAL, because a referral raised outside the patient flow legitimately has
       * nobody on file, and a required field would force one to be invented.
       *
       * An id and nothing else — see `Referral.patientId` for why a name carried alongside it
       * would satisfy the privacy guard's letter and destroy its purpose.
       */
      patientId?: PatientId;
      /** The permitted facts about the person referred, unchanged from `Referral`'s own field set
       *  (`ward-model.ts`) — see that type's own doc comment for why nothing else may ever be
       *  added here. */
      ageBand: Cohort;
      /**
       * Where this referral is addressed, and the criteria that destination can answer. Carries
       * the ward arm's `sex`, `secureBedNeeded` and `involuntaryBedNeeded`, which sat flat on this
       * event until 2026-08-30.
       *
       * One to `PARALLEL_REFERRAL_CAP` of them, chosen in ONE act (FD-21). The reducer refuses an
       * empty list, more than the cap, and two of the same kind — asking one kind twice is asking
       * twice, not addressing two destinations.
       *
       * **The event carries the destinations because otherwise the union would be decorative.** If
       * this event could only express bed criteria, every referral it created would be a ward
       * referral by construction, and the three arms that carry no bed criteria would be
       * unreachable — a type distinction nothing could ever produce. Making the caller name the
       * destination is what puts the choice at the front door, where the referrer makes it.
       */
      destinations: ReferralDestination[];
      /** The broad area this person is from — one of `HOME_REGIONS`, never an address. See
       *  `Referral.homeRegion`'s own doc comment. */
      homeRegion: HomeRegion;
      /** The suburb, resolved against the catchment table by the reducer — never free text, and
       *  never an address. ⚠️ A UNION, not a string, so **"not known" is an answer rather than a
       *  failure to answer**: a patient of no fixed abode must be referable, and for the hour this
       *  was a bare `string` they were not. See `ReferralSuburb`'s own doc comment. */
      suburb: ReferralSuburb;
      /**
       * When this person was triaged into the department, when they were already in one — the
       * start of `P9-D2`'s second clock. Absent for a community expect who has not arrived.
       *
       * ⚠️ **THIS EXISTS BECAUSE THE FIELD HAD NO PRODUCER.** `Referral.triagedAt` landed with
       * nothing that could write it: `RECEIVE_REFERRAL` is the only event that creates a referral
       * and it had no such field, so a triage instant could reach the model only on a hand-authored
       * fixture. **The department clock's present branch was live code with no reachable caller** —
       * and a screen rendering "not in department yet" for every patient looks like correct
       * handling of a legitimate case rather than a feature with no data. Measured and reported by
       * Ward Referrals; third instance of that shape in one night.
       */
      triagedAt?: Instant;
      /** Where the referral arrived from — one of `REFERRAL_SOURCES`. */
      source: ReferralSource;
      /**
       * Required when `source` is `psychiatric_ward` — the sending ward. The sending bed stays
       * occupied until arrival.
       */
      originUnitId?: string;
      /**
       * WHICH TEAM OR SERVICE SENT IT, by name. Owner, 2026-09-12: **"Yes it should."**
       *
       * ⚠️ **THIS EXISTS SO THE FIELD HAS A PRODUCER ON THE DAY IT LANDS**, which is the whole
       * lesson of `Referral.triagedAt` two fields above: that one arrived with nothing able to
       * write it, so the model's present branch was live code no dispatch could reach, and a screen
       * reporting the absence for every patient looked like correct handling rather than a feature
       * with no data.
       *
       * Optional, because police, ambulance and an emergency department's own medical staff are
       * real sources with no sending team to name. **A blank-but-present value is refused** rather
       * than stored: "" would be a third state meaning neither "this team" nor "nobody recorded
       * one", and the reducer will not carry a distinction nothing can read.
       *
       * A NAME, never an id — see `Referral.sendingTeamName` for why this application may not mint
       * team identities, and `SENDING_TEAM_NAME_LIMIT` for the length the reducer refuses past.
       */
      sendingTeamName?: string;
      urgency: 1 | 2 | 3;
      /** A synthetic site code (see `wardSites`), never an address. */
      originSiteCode: string;
      transportNeeded: boolean;
      /**
       * ⚠️ THE WRITTEN HISTORY. The only free text this event carries, and the only part of a
       * referral that arrives unvalidated.
       *
       * Every other field on this event is a closed union, a boolean, a membership-checked code or
       * an id, and the reducer refuses anything outside the set. **This one is whatever a person
       * typed.** The reducer checks its LENGTH and nothing else — it cannot check meaning, and it
       * must not try.
       *
       * ⚠️ **PASSED THROUGH UNTOUCHED.** No trim, no collapse of whitespace, no normalisation. A
       * referrer's paragraph breaks are part of what they wrote. `RECEIVE_REFERRAL` rejects an
       * over-length value rather than shortening it.
       *
       * ⚠️ **AND IT NO LONGER REJECTS AN EMPTY ONE.** It did until the owner's ruling of
       * 2026-09-05 — one story box, optional. `""` is a valid, complete answer on this event.
       *
       * See `Referral.history` for the full contract, including the rule that nothing may ever be
       * derived from it.
       */
      history: string;
      /**
       * T15 (item 12): the front door's own optional diagnosis category — see
       * `Referral.tentativeDiagnosis`'s own doc comment for the vocabulary and why it starts here.
       * Absent means nobody has recorded one.
       */
      tentativeDiagnosis?: TentativeDiagnosisBlock;
    }
  | {
      type: "ACCEPT_REFERRAL";
      role: WardFlowRole;
      now: Instant;
      /** The referral being decided. */
      referralId: string;
      /**
       * WHICH of the referral's destinations is answering (FD-21). A referral may be addressed to
       * several at once, so "accept this referral" is no longer a complete instruction — without
       * this the reducer would have to guess which destination replied, and the only guess
       * available (the ward, because it is the one with a unit) would have made the other three
       * unable to answer at all.
       */
      destinationKind: ReferralDestinationKind;
      /** The accepting unit. REQUIRED for `psychiatric_ward` and meaningless for the other three,
       *  which are answered by a person or a team and have no bed to name. Refused unless
       *  `referralEligibility` (ward-eligibility.ts) says that unit accepts this referral. */
      unitId?: string;
      /**
       * Lets a ward accept a referral that fails a JUDGEMENT gate — age, legal status, sex
       * designation, forensic, security, sex mix — by recording why. Without it the acceptance is
       * refused, so the reason is a condition of the acceptance rather than a note attached after.
       *
       * ⚠️ It buys past NOTHING physical. `allocatable_bed`, `capacity_freshness` and `specialling`
       * refuse whatever is recorded here, and so does any gate added later that is not on the
       * judgement list — see `referralAcceptanceRefusal` in the reducer, which fails closed.
       * The owner's ruling, in his words: no reason typed into a form creates a bed.
       *
       * Same `OVERRIDE_REASONS` vocabulary as the three placement events. A second vocabulary for
       * the front door would be worse than the block it replaces.
       */
      overrideReason?: OverrideReason;
      /**
       * T12 (item 9): the front door's own "checked with the ward" pair, the identical shape
       * `REFER_TO_UNITS` carries — see `GenderPlacement`'s own doc comment (`ward-model.ts`).
       * Optional because most accepted referrals are not `Non-binary`, and a `Non-binary` referral
       * accepted at a unit already cleared by an earlier record needs neither field again.
       */
      genderPlacementReason?: GenderPlacementReason;
      /** The tick — see `REFER_TO_UNITS.genderPlacementChecked`'s own doc comment. */
      genderPlacementChecked?: true;
      /** Optional fields for reassessment of clinical decisions (WF-17) */
      clinicalUpdate?: boolean;
      reassessment?: boolean;
      clearanceUpdated?: boolean;
    }
  | {
      type: "RECORD_LOCAL_BED_SOUGHT";
      role: WardFlowRole;
      now: Instant;
      /**
       * The QUEUED referral a coordinator is recording a closer-to-home search against. Phase 8
       * (spec D8-6): a step that MAY have happened, recorded if it did — never a stage the
       * pathway requires and never a gate on `ACCEPT_REFERRAL`.
       *
       * No outcome, reason or note field, deliberately: the record states only that the search
       * happened, at a time, by a role. `by` is taken from the event's own `role` in the reducer
       * rather than supplied here, so a caller cannot write a person's name into it.
       */
      referralId: string;
    }
  | {
      type: "DECLINE_REFERRAL";
      role: WardFlowRole;
      now: Instant;
      /** The referral being decided. */
      referralId: string;
      /** WHICH destination is declining — see `ACCEPT_REFERRAL`'s own comment. A decline locks
       *  nobody out and leaves every other destination live (FD-24), so it must say which one. */
      destinationKind: ReferralDestinationKind;
      /**
       * Never free text — refused by a membership check, not a truthiness test (Phase 5 shipped a
       * truthiness test in this exact position). Widened 2026-09-17 (community-decline engine fix,
       * O-16.6) from `ReferralDeclineReason` alone: a community team declines from
       * `COMMUNITY_DECLINE_REASONS`, a ward or an ED from `REFERRAL_DECLINE_REASONS` (an ED further
       * narrowed by convention to `ED_DECLINE_REASONS`). The reducer's own membership check is
       * scoped to the list for `destinationKind` above — never the union of both — so a reason
       * valid for one destination kind is refused outright for the other, per O-16.6's own
       * measurement that the two vocabularies share zero overlap in meaning.
       */
      reason: ReferralDeclineReason | CommunityDeclineReason;
    }
  | {
      /**
       * 🔴 **THE REFERRER TOOK THE REFERRAL BACK — FD-5, and until 2026-09-12 nothing could record
       * it (O-17.11).**
       *
       * ⚠️ **UNSCOPED, THIS CARRIES NO `destinationKind`, AND THAT IS THE MODELLING, NOT AN
       * OMISSION.** A decline is one destination answering, so it must say which. **A whole-referral
       * withdrawal is the SENDER taking back the whole referral**, so it marks every destination
       * still waiting and leaves every destination that already answered exactly as it is. A refusal
       * is a recorded clinical decision and is never unmade by somebody else changing their mind.
       *
       * 🔴 **OWNER RULING 11 (2026-09-17): `destinationKind` MAY NOW NAME `"community_team"`, FOR ONE
       * NARROW CASE.** "A referral normally doesn't go to a community team when a ward is sought. If
       * it does, the referrer may withdraw the community part alone; it's rare." Front-door referrals
       * can hold several destinations at once (FD-21), and a ward accepting does NOT cancel a live
       * community arm (FD-22's own exemption — `tests/ward-referral-reducer.test.ts`, "a community
       * team is not competing for the bed"). So a referral can sit with its ward arm ACCEPTED and its
       * community arm still QUEUED, and until this ruling the unscoped path above refused outright
       * the moment `referralState` read `"accepted"` — leaving no way to take back the community ask
       * without also (falsely) implying the ward's acceptance was in doubt.
       *
       * Scoped this way, the event touches ONLY the named destination's own `ReferralAddressing`: the
       * ward's acceptance is untouched, and the same accepted-referral refusal below is exempted for
       * `community_team` exactly as `DECLINE_REFERRAL`'s own RB5 (item 16) exemption already reads —
       * "a community team is not in the race FD-22 governs". Restricted to `community_team` alone:
       * the owner named only that arm, and a ward or ED arm's own scoped withdrawal is a separate,
       * unruled product decision.
       *
       * 🔴 **THREE EVENTS NOW LIVE IN THIS NEIGHBOURHOOD AND TWO OF THEM ARE THE SAME ACT ON
       * DIFFERENT SUBJECTS. READ THIS BEFORE DISPATCHING ANY OF THEM:**
       *
       *     WITHDRAW_ACCEPTANCE          a WARD takes back its own yes                 movementId
       *     WITHDRAW_REFERRAL            the REFERRER takes back a bed search for a
       *                                  person ALREADY INSIDE A DEPARTMENT            movementId
       *     RECORD_REFERRER_WITHDRAWAL   the REFERRER takes back a REFERRAL, before
       *                                  any movement exists                           referralId
       *
       * ⚠️ **`WITHDRAW_REFERRAL` and this event are the same act on two subjects, and that is
       * deliberate rather than duplication** — `ward-model.ts` says so in its own words above
       * `REFERRAL_ADDRESSING_STATES`: *"`Movement.withdrawnReferrals` holds the same meaning for its
       * own subject — a person already inside a department — and keeps it. One meaning on two
       * subjects is not a duplicated concept; two different NAMES for one meaning would be."* **That
       * comment also predicted this event, saying FD-5 "has no event yet". It does now.**
       *
       * 🔴 **THE PAYLOAD IS THE ONLY THING KEEPING THEM APART AT A CALL SITE** — `movementId` against
       * `referralId` — and `tsc` enforces it. **The names do not, and a reader who knows one of the
       * three may not know the other two exist.** Whether these three should be renamed as a set is a
       * product decision, flagged rather than taken.
       *
       * The `RECORD_` prefix says the true thing about the act: somebody here is writing down a
       * decision taken elsewhere, by a person this system never names.
       */
      type: "RECORD_REFERRER_WITHDRAWAL";
      role: WardFlowRole;
      now: Instant;
      /** The referral the referrer took back. */
      referralId: string;
      /** Owner ruling 11 — see the doc comment above. Omitted, this is the original whole-referral
       *  act. `"community_team"` scopes it to that one arm alone. */
      destinationKind?: "community_team";
      /**
       * Required exactly when `destinationKind` is given. Reuses `WARD_REQUEST_WITHDRAWAL_REASONS`
       * — the one existing fixed vocabulary in this file for "why a person is taking back one
       * destination's own live request" (`WITHDRAW_WARD_REQUEST`'s own reason) — rather than
       * inventing a second list for this narrower act. The unscoped whole-referral withdrawal above
       * deliberately carries no reason at all (its own governance note: that vocabulary, if the
       * referrer's clinical reason for withdrawing entirely is ever wanted, is the owner's to write),
       * which this does not disturb.
       */
      reason?: WardRequestWithdrawalReason;
    }
  | {
      /**
       * 🔴 **RB7 — CORRECTION NOTES, build plan item 27 (2026-09-17).** A referrer, the receiving
       * community team, or the coordinator adds a note to a referral after the fact — a typo caught,
       * a fact that changed, a clarification — as a NEW, timestamped, attributed entry, never a
       * rewrite of `Referral.history`. See `Referral.corrections`'s own doc comment for why the two
       * are kept structurally apart, and `tests/ward-referral-history-immutable.test.ts` for the
       * static proof that this case never touches `history` itself.
       *
       * 🔴 **D-11 CRITICAL.** `note` is human-typed prose — this event type belongs on
       * `WARD_FLOW_TYPED_TEXT_EVENT_TYPES` (`ward-flow-persistence-classification.ts`), never the
       * text-safe list, so dispatching it (accepted or refused) locks session persistence for the
       * rest of the session exactly as a typed `history` on `RECEIVE_REFERRAL` already does.
       */
      type: "ADD_REFERRAL_CORRECTION";
      role: WardFlowRole;
      now: Instant;
      referralId: string;
      /** Refused blank or over `REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS` characters. Never truncated. */
      note: string;
    }
  | {
      /**
       * A patient LEAVES the ward. Until this event existed the prototype could admit somebody and
       * never discharge them: 36 events, and the only person who had ever left a bed was one
       * written that way in the seed. The discharge half of this project's own argument — following
       * one person from the decision to admit through to their bed being free again — had never
       * been seen working.
       */
      type: "RECORD_LEAVING";
      role: WardFlowRole;
      now: Instant;
      /** The admission ending. Not a movement and not a bed: an `Admission` records the ward and
       *  never a bed, so there is no bed identity to name here. */
      admissionId: string;
      /**
       * Same claim-not-proof discipline every other unit-scoped event carries, compared against the
       * admission's own `unitId`. Without it one ward could discharge another ward's patient, which
       * is the kind of thing a prototype makes look easy and a real system must refuse.
       */
      actingUnitId: string;
      /**
       * Chosen from `LEAVING_DESTINATIONS`, never free text. It is not decoration: exactly one of
       * the five (`transferred-to-another-psychiatric-ward`) does NOT count as a statewide release,
       * because that bed is still occupied somewhere in the system. Recording the destination is
       * what makes the difference between a bed freed and a bed moved.
       */
      leavingDestination: LeavingDestination;
    }
  | {
      /**
       * A WARD SENDS ONE OF ITS OWN OCCUPANTS OUT TO AN EMERGENCY DEPARTMENT, AND KEEPS THE BED.
       *
       * `Admission.awayAtEmergencyDepartmentSince` existed from 2026-08-30 with no writer and, worse,
       * no clearer: the seed could mark somebody away and nothing in the model could ever mark them
       * back. The board renders "At an emergency department for N hours — the bed is still theirs"
       * from `now - awayAtEmergencyDepartmentSince`, so those seeded rows counted upward without
       * bound for the whole life of the demonstration, and every occupant WITHOUT the badge read as
       * physically in their bed — the exact conclusion the field's own comment says it exists to
       * prevent.
       *
       * ⚠️ **THIS EVENT MOVES NO CAPACITY FIGURE, AND MUST NOT.** The ward is holding the bed
       * because the person is coming back. The reducer touches `Admission` only; it does not go
       * near `Unit.empty`, `Unit.allocatable` or `sexMix`, and `bedIsOccupied` never reads this
       * field. Freeing a bed a ward is still keeping is the single failure this model exists to
       * prevent — see `Admission.awayAtEmergencyDepartmentSince` for the full ruling.
       *
       * It carries no reason and no destination. Which emergency department, and why, are facts
       * this record has never held and this event is not the place to start inventing them.
       */
      type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT";
      role: WardFlowRole;
      now: Instant;
      /** The admission going out. Not a movement and not a bed — the same reasoning
       *  `RECORD_LEAVING`'s own `admissionId` carries. */
      admissionId: string;
      /** Same claim-not-proof discipline every other unit-scoped event carries, compared against
       *  the admission's own `unitId`, so one ward cannot record a fact about another ward's
       *  patient. */
      actingUnitId: string;
    }
  | {
      /**
       * THE OTHER HALF, AND IT IS NOT OPTIONAL. A way to mark somebody away with no way to mark
       * them back is the same defect turned round: a badge nobody can remove, and an hour count
       * that only ever grows.
       *
       * Clears `Admission.awayAtEmergencyDepartmentSince` back to `null`, which is the field's
       * ordinary state and means "on the ward". Nothing else changes: the bed was never given up,
       * so there is nothing to give back.
       *
       * ⚠️ **The return is NOT recorded as a second instant anywhere.** This model holds when the
       * person left the ward and nothing about when they came back, so a "returned at" would be a
       * field with one writer and no reader — the class of defect this whole change is repairing.
       * If the length of an ED trip is ever wanted, it is a new field with its own ruling, not a
       * side effect of this one.
       */
      type: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT";
      role: WardFlowRole;
      now: Instant;
      /** The admission coming back. */
      admissionId: string;
      /** Same claim-not-proof discipline as the event above. */
      actingUnitId: string;
    }
  | {
      /**
       * SOMEBODY SAYS WHAT IS ACTUALLY HOLDING THIS PATIENT UP.
       *
       * ⚠️ **`Movement.blocker`, NOT `BedRelease.blocker`.** Two different fields share that name:
       * this one is free prose about a movement; the other is a `BedReleaseBlocker` enum about a
       * bed being freed, written by `BLOCK_BED_RELEASE`/`CLEAR_BED_RELEASE_BLOCK`. Nothing here
       * touches those.
       *
       * `Movement.blocker` was written once — `"Awaiting coordinator referral"`, at creation — and
       * by nothing afterwards. It renders on the movement console as **Response** and as **Current
       * blocker**, so a patient whose transport was already en route still read as waiting for a
       * coordinator, and somebody chased the wrong patient.
       *
       * ⚠️ **FREE PROSE, DELIBERATELY, AND IT MUST NOT BE NARROWED TO A CHOSEN LIST.** Owner
       * ruling, 2026-09-01. The field carries things no vocabulary and no derivation can produce:
       * an absence WITH its reason (`"None — in transit"` against `"None — handover complete"` —
       * two different situations that both have no blocker), and activity by parties the model has
       * no field for (a family, a specialling roster, an escort provider). Constraining this to a
       * fixed set would lose exactly what deriving it would lose, by a different route. See
       * `Movement.blocker`'s own doc comment and `tests/ward-movement-blocker.test.ts`, which
       * asserts five such values stay expressible.
       *
       * ⚠️ **THE ONE THING FREE PROSE MUST STILL NOT CARRY IS A PERSON.** This model names wards,
       * roles and jobs and never a patient — no name, date of birth, record number, address or
       * clinical narrative — and a text box is the easiest place in the whole prototype to break
       * that. The reducer cannot enforce it (it cannot read English), so it is stated here, stated
       * on the control, and pinned against the fixture by `tests/ward-model.test.ts`'s own
       * forbidden-substring check. That is a real limit of this event and is recorded rather than
       * papered over.
       */
      type: "RECORD_MOVEMENT_BLOCKER";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      /**
       * What is holding it up, in the caller's own words. Refused when blank: `Movement.blocker`
       * has no null, so an empty string would be indistinguishable from a field nobody had reached
       * — the exact ambiguity this event exists to end.
       */
      blocker: string;
    }
  | {
      /**
       * NOTHING IS HOLDING THIS PATIENT UP ANY MORE — and it needs its own event rather than a
       * magic word typed into the box above.
       *
       * ⚠️ **THIS EXISTS BECAUSE `RECORD_MOVEMENT_BLOCKER` OPENED A HOLE THE SAME DAY IT CLOSED
       * ONE.** `hasActiveBlocker` (ward-priority.ts) recognised "nothing is blocking" by
       * case-sensitive match against a small fixed vocabulary — safe while only the fixture and the
       * reducer wrote the field. Once a person could type any prose, a nurse clearing a blocker
       * with `"none — resolved"`, `"no blocker"` or `"Nothing outstanding"` left the movement
       * scoring ten points as actively obstructed, and so ranked above patients who really were.
       * Silently: a wrong SCORE, which a system acts on, rather than a wrong sentence, which a
       * person can disbelieve.
       *
       * The remedy is not a wider pattern — the next phrasing is missed too, and a
       * case-insensitive `/^none/i` would swallow `"None of the secure units can take him"`, a real
       * blocker the priority tests pin. So clearing is REPRESENTED rather than INTERPRETED: this
       * event writes one reducer-owned sentinel, and the recogniser only ever has to know a closed
       * set (`BLOCKERS_MEANING_NOTHING_IS_BLOCKING`) that cannot grow by invention.
       *
       * Same roles as `RECORD_MOVEMENT_BLOCKER`, and deliberately not narrower: whoever may say
       * what is holding a patient up may say it has stopped. A clearing permission narrower than
       * the recording one is how a queue fills with obstructions nobody present can remove.
       */
      type: "CLEAR_MOVEMENT_BLOCKER";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
    }
  | {
      /**
       * THE REFERRER TAKES THE REFERRAL BACK. Until this existed a referral could be ended by
       * exactly one thing — another unit accepting it — so a patient who improved, went home or
       * went somewhere else left the request sitting live in every receiving ward's list with no
       * way for anyone to say it was over.
       *
       * It withdraws EVERY live referral for this movement at once, because that is what the
       * referrer is saying: this patient no longer needs a bed. Withdrawing from one ward while
       * leaving others live is a different act and does not exist yet.
       */
      type: "WITHDRAW_REFERRAL";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
    }
  | {
      /**
       * THE COORDINATOR'S OWN RECORD CORRECTION — Task 5 (ward-flow movement step-track plan,
       * 2026-09-04), owner rulings E and F. Moves `movement.stage` strictly BACKWARDS, appends one
       * `stageChanges` entry and one `unwinds` entry (`kind: "stage_corrected"`), and touches
       * NOTHING else — no bed is released, no transport is cancelled, no timestamp elsewhere on the
       * movement moves. F3's whole content in one sentence: stepping back past Accepted does not
       * un-accept, and stepping back past Bed pulled does not un-pull. See the reducer's own case
       * for the full list of fields this deliberately never writes.
       *
       * ⚠️ **NOT `WITHDRAW_ACCEPTANCE` below.** This event corrects a RECORD; that one tells a WARD
       * its earlier "yes" no longer holds. They read as the same English verb ("undo") and are
       * unrelated acts on unrelated actors' decisions.
       *
       * Coordinator-only (`EVENT_ROLE.STEP_BACK_STAGE` below) — F1's entire enforcement, since the
       * generic role check in `wardFlowReducer`'s switch preamble already rejects every other role
       * before this event's payload is even inspected, exactly as it does for every other
       * role-gated event in this file.
       */
      type: "STEP_BACK_STAGE";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      /** Must be strictly earlier than `movement.stage` in `MOVEMENT_STAGES` array order — covers
       *  both a same-stage attempt and a forward "skip a step", which is explicitly OUT OF SCOPE
       *  for this event (owner ruling 4 of 2026-09-04: authorised by ruling E's own words but
       *  unspecced by ruling F, and recorded as owed rather than built). */
      to: MovementStage;
      reason: StepBackReason;
    }
  | {
      /**
       * THE COORDINATOR UNDOES A WARD'S "YES" — Task 5, same plan and rulings as `STEP_BACK_STAGE`
       * above. Clears `movement.acceptedUnitId` and `acceptedAt`, reverts `stage` to
       * `"destination_review"`, and appends one `stageChanges` entry and one `unwinds` entry
       * (`kind: "acceptance_withdrawn"`, carrying the withdrawn unit's id — see `UnwindRecord`'s
       * own doc comment).
       *
       * ⚠️ **GATED TO `movement.stage === "accepted_awaiting_bed"` ONLY** (owner ruling 2 of
       * 2026-09-04, deliberately narrow: a withdrawal from `pulled` or later is a bigger act with
       * different consequences — a bed is physically held and, past `handover_ready`, a patient
       * may be moving — and the owner recorded this as an OPEN QUESTION for himself, not a settled
       * boundary: "the bed was lost" is exactly the reason that would arise at `pulled`, so the
       * narrow gate probably excludes a real case. Widening it later is his call, not this build's).
       *
       * ⚠️ **DOES NOT RE-ADD THE WITHDRAWN UNIT TO `referredUnitIds`** (owner ruling 3 of
       * 2026-09-04): withdrawing an acceptance is not the same act as re-referring, and reviving a
       * "live referral" the ward never re-received would be a false claim on that ward's own
       * screen. `REFER_TO_UNITS` is the existing path if the coordinator wants to re-approach.
       *
       * ⚠️ **REUSES `StepBackReason`/`STEP_BACK_REASONS`, not a reason list of its own** (owner
       * ruling 1 of 2026-09-04) — see that list's own doc comment in `ward-model.ts` for why, and
       * for the note that the WARD reads these reasons while `STEP_BACK_STAGE`'s reader does not.
       *
       * Coordinator-only, same enforcement shape as `STEP_BACK_STAGE` above.
       */
      type: "WITHDRAW_ACCEPTANCE";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      reason: StepBackReason;
    }
  | {
      /**
       * THE ADDRESSEE MARKS A NOTICE AS READ — Item 48, Q2 (owner answer 48, 2026-09-17). The
       * ONLY way `Notice.readAt` (`ward-model.ts`) is ever written; see the reducer's own doc
       * comment on `case "MARK_NOTICE_READ"` for the two refusals (wrong addressee, already read).
       *
       * ⚠️ **VISIBILITY AND AUTHORITY ARE DIFFERENT QUESTIONS.** `noticeIsForWardChrome`
       * (`ward-chrome-role.ts`) already scopes which chrome a notice APPEARS on; this event is the
       * separate act of marking it read, and the reducer checks the addressee itself rather than
       * trusting that whoever can see it may act on it.
       *
       * `actingPlaceId` is the same claim-not-proof discipline `actingUnitId` holds throughout
       * this file (see `FLAG_BED_RELEASE`'s own doc comment) — generalised to `placeId` because a
       * notice's addressee (`Addressee`, `ward-model.ts`) may be a ward, an emergency department,
       * or (once a community screen dispatches this) a team, never only a ward. Optional for the
       * same reason `Addressee.placeId` itself is optional: `officer` has no place in this model,
       * so an officer-addressed notice is only markable by a caller who supplies no place either.
       */
      type: "MARK_NOTICE_READ";
      role: WardFlowRole;
      now: Instant;
      noticeId: string;
      actingPlaceId?: string;
    }
  | {
      /**
       * THE COORDINATOR TAKES BACK ONE WARD'S LIVE REQUEST — RA1 (item 18, owner answer 18,
       * 2026-09-17). `REFER_TO_UNITS` now ADDS wards to `referredUnitIds` rather than silently
       * replacing the list on a re-referral (see that event's own doc comment), so there is a real
       * gap this event closes: a coordinator who asked three wards and now wants to stop asking ONE
       * of them, without ending the whole search the way `WITHDRAW_REFERRAL` does.
       *
       * ⚠️ **NOT `WITHDRAW_REFERRAL` ABOVE, AND NOT A SMALLER VERSION OF IT.** That event withdraws
       * EVERY live referral at once and closes the movement `did_not_proceed` — the referrer saying
       * "this patient no longer needs a bed". This event removes exactly `unitId` from
       * `referredUnitIds`, leaves every other live referral untouched, and never closes the
       * movement. Withdrawing the LAST live ward sets `STAGE_TRANSITION_BLOCKERS.wardRequestWithdrawn`
       * ("No ward is being asked") rather than a closure — the coordinator may refer again.
       *
       * ⚠️ **NOT `WITHDRAW_ACCEPTANCE` ABOVE EITHER.** That event undoes a WARD's "yes"; this one
       * undoes the COORDINATOR's own request before any ward has answered. `unitId` here must hold
       * a LIVE referral (a member of `referredUnitIds`) — an accepted, declined or already-withdrawn
       * unit is refused, the same membership discipline `DECLINE`/`ACCEPT_IN_PRINCIPLE` already hold.
       *
       * `reason` is a code from `WARD_REQUEST_WITHDRAWAL_REASONS` (`ward-change-reasons.ts`) — the
       * plan's own §2 list, never free text and never a place (`FD-23`: the withdrawn ward reads
       * this back). Recorded on `withdrawnReferrals` as `{ reason: "coordinator_withdrew", detail:
       * event.reason }` — `reason` says WHO (a role, never a person, the same discipline
       * `another_unit_accepted`/`referrer_withdrew` already hold to) and `detail` says WHY.
       *
       * Coordinator-only (`EVENT_ROLE.WITHDRAW_WARD_REQUEST` below) — the shortlist is the
       * coordinator's own tool, and nobody else has a live request on this movement to take back.
       */
      type: "WITHDRAW_WARD_REQUEST";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      unitId: string;
      reason: WardRequestWithdrawalReason;
    }
  | {
      /**
       * THE ACTION INBOX GAINS A WAY TO SAY "I AM ON THIS" — ward-lead task, 2026-09-06. The owner
       * asked for the coordinator's action inbox (`buildActionInbox`, `ward-derivations.ts`) to
       * become a real to-do list, in the same sentence as *"care must be taken to tick off"*. That
       * sentence is why this is a SEPARATE event from `COMPLETE_INBOX_ITEM` below rather than one
       * generic "handle this row" action — see that event's own doc comment for the distinction.
       *
       * 🔴 **THIS EVENT NEVER REMOVES OR HIDES THE ROW, AND NOTHING MAY BE CHANGED TO MAKE IT DO
       * SO.** `buildActionInbox` computes its list from `movements` and `units` alone
       * (`ward-derivations.ts`); the reducer case for this event touches neither. A breached
       * statutory form or an accepted destination that is no longer lawful is a live FACT about the
       * world, and a coordinator saying "I've seen this" does not make the fact stop being true — it
       * records that a person is now answerable for it, which is a different thing entirely from the
       * fact being resolved. See `tests/ward-inbox-events.test.ts` for the proof: the row set
       * `buildActionInbox` returns is asserted byte-for-byte identical before and after this event.
       *
       * Records WHO and WHEN, never a boolean — see `InboxAcknowledgement` in `ward-flow-reducer.ts`.
       *
       * ⚠️ **APPEND-ONLY, AND DELIBERATELY NOT IDEMPOTENT.** A second coordinator acknowledging the
       * same row after the first is a real, distinct fact (a second person is now also aware of it),
       * not a duplicate to be collapsed — the same discipline `Override[]`/`StageChange[]`
       * (`ward-model.ts`) already hold to. There is no un-acknowledge event, on purpose: an
       * acknowledgement is a historical record of who looked at something, and unlike a completion
       * (below) there is nothing about it to undo.
       *
       * ⚠️ **CARRIES NO CATEGORY, AND CANNOT.** Which inbox rows are FACTS that only resolve
       * themselves and which are COMMITMENTS a human can finish is a clinical judgement this task
       * does not make (see this file's own module-level context, if one exists, or the task brief —
       * the classification is being decided separately). `inboxItemId` is `InboxItem.id`
       * (`ward-derivations.ts`), opaque here: nothing in this event or its reducer case inspects it
       * to decide what kind of row it names. Enforcing "this category may only ever be acknowledged,
       * never completed" belongs to whichever layer is handed that classification later.
       */
      type: "ACKNOWLEDGE_INBOX_ITEM";
      role: WardFlowRole;
      now: Instant;
      /** `InboxItem.id` (`ward-derivations.ts`) — opaque here, see the comment above. */
      inboxItemId: string;
    }
  | {
      /**
       * THE ROW GETS TICKED OFF — a human COMMITMENT is done (rang the ward, booked transport,
       * wrote the handover). Ward-lead task, 2026-09-06, alongside `ACKNOWLEDGE_INBOX_ITEM` above.
       *
       * ⚠️ **THIS EVENT DOES NOT TOUCH `movements` OR `units` EITHER — THE ONLY TWO INPUTS
       * `buildActionInbox` READS.** Completing a row records that a PERSON finished a task; it does
       * not and cannot change the underlying fact `buildActionInbox` computes from live state. If
       * that fact still holds the next time the inbox is built, the row reappears — ticking this off
       * is a statement about the human task, never a way to make the computation stop reporting.
       *
       * ⚠️ **UNDOABLE, AND THE REVERSAL (`REOPEN_INBOX_ITEM` below) IS ITSELF RECORDED, NEVER A
       * DELETE.** A completion recorded in error, or a commitment that turned out not to have
       * happened after all, must be correctable without erasing the fact that it was once marked
       * done — see `REOPEN_INBOX_ITEM`'s own doc comment and `InboxCompletionEntry`
       * (`ward-flow-reducer.ts`).
       *
       * Refused when the row is already complete — the same discipline `FLAG_MOVEMENT_URGENT`
       * refuses a second flag with: ticking an already-ticked box is not a new fact, and recording it
       * as one would double-count a single piece of work.
       *
       * Same "no hard-coded category" discipline as `ACKNOWLEDGE_INBOX_ITEM` above: `inboxItemId` is
       * opaque, and nothing here or in the reducer decides which rows may be completed at all.
       */
      type: "COMPLETE_INBOX_ITEM";
      role: WardFlowRole;
      now: Instant;
      /** `InboxItem.id` (`ward-derivations.ts`) — opaque here, see `ACKNOWLEDGE_INBOX_ITEM`'s comment. */
      inboxItemId: string;
    }
  | {
      /**
       * THE UNDO `COMPLETE_INBOX_ITEM` REQUIRES — a completion is one human's account of what they
       * did, and a human can be wrong or can act too soon. Mirrors
       * `FLAG_MOVEMENT_URGENT`/`CLEAR_MOVEMENT_URGENT_FLAG` and
       * `BLOCK_BED_RELEASE`/`CLEAR_BED_RELEASE_BLOCK`: a state that can only ever be SET is not a
       * real state, it is a one-way door with a flag painted on it.
       *
       * Appends its OWN entry to the same append-only history `COMPLETE_INBOX_ITEM` writes to
       * (`InboxCompletionEntry[]`, keyed by `inboxItemId` on `WardFlowState.inboxCompletions`)
       * rather than deleting the completion it reverses — the same discipline `STEP_BACK_STAGE`
       * holds to for `stageChanges` and `WITHDRAW_ACCEPTANCE` holds to for `acceptedAt`: correcting a
       * record is itself a recorded act, never a silent rewrite of history.
       *
       * Refused when the row is not currently complete — there is nothing to reopen, the same
       * precondition `CLEAR_MOVEMENT_URGENT_FLAG` checks before clearing a flag that was never set.
       *
       * Same role list as `COMPLETE_INBOX_ITEM` (see `EVENT_ROLE` below): whoever may tick a row off
       * may take that back, on the same reasoning `CLEAR_MOVEMENT_URGENT_FLAG`'s own comment gives
       * for why a clearing permission narrower than the raising one is how mistakes become
       * permanent.
       */
      type: "REOPEN_INBOX_ITEM";
      role: WardFlowRole;
      now: Instant;
      /** `InboxItem.id` (`ward-derivations.ts`) — opaque here, see `ACKNOWLEDGE_INBOX_ITEM`'s comment. */
      inboxItemId: string;
    }
  | {
      type: "SET_ARRIVAL_DETAILS";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      arrivalMode: ArrivalMode;
      trackingNumber?: string;
      estimatedArrivalAt: Instant;
    }
  | {
      type: "SET_STEP_DOWN_CANDIDATE";
      role: WardFlowRole;
      now: Instant;
      actingUnitId?: string;
      admissionId: string;
      stepDownCandidate: boolean;
    }
  | {
      type: "SET_DISCHARGE_BARRIER";
      role: WardFlowRole;
      now: Instant;
      actingUnitId?: string;
      admissionId: string;
      barrier: DischargeBarrier | "None" | null;
    }
  | {
      type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      cleared: boolean;
    }
  | {
      type: "UPLOAD_PATIENT_FORM";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      formName: string;
      fileName: string;
      sizeBytes?: number;
    }
  | {
      /** Person enters when the form was written and, optionally, the expiry printed on it. */
      type: "RECORD_LEGAL_FORM_WRITTEN";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      formCode: string;
      writtenAt: Instant;
      region?: "metro" | "country";
      ageBand?: "adult" | "under_18";
      /** Optional expiry typed from the paper; no statutory maximum is computed. */
      paperExpiresAt?: Instant;
    }
  | {
      /** Recorded country extension for Form 1A — never automatic. */
      type: "RECORD_COUNTRY_EXTENSION";
      paperExpiresAt?: Instant;
      role: WardFlowRole;
      now: Instant;
      movementId: string;
    }
  | {
      /** Continuation replaces the current form; missing paper expiry remains unknown. */
      type: "RECORD_LEGAL_FORM_CONTINUATION";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      formCode: string;
      startedAt: Instant;
      region?: "metro" | "country";
      ageBand?: "adult" | "under_18";
      paperExpiresAt?: Instant;
    }
  | {
      /** Raise late-arrival notices when past estimated arrival by more than an hour. */
      type: "EVALUATE_ARRIVAL_LATENESS";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
    }
  | {
      /** Release a held bed and reopen the search in one action. */
      type: "RELEASE_AND_REOPEN_SEARCH";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      actingUnitId: string;
      reason: ReleasePullReason;
    }
  | {
      type: "CLEAR_EXPECT_FLAG";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
    }
  | {
      type: "RAISE_EXPECT_FLAG";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      kind: "voluntary_48h" | "involuntary_7d";
    }
  | {
      type: "FLAG_LEGAL_MISMATCH";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      unitId: string;
      kind: "involuntary_on_voluntary_ward" | "voluntary_on_locked_ward";
    }
  | {
      type: "EVALUATE_LEAVE_BED_WARNINGS";
      role: WardFlowRole;
      now: Instant;
    }
  | {
      type: "CONFIRM_MORNING_ROLLUP";
      role: WardFlowRole;
      now: Instant;
      unitId: string;
      actingUnitId?: string;
      expectedDischarges: number;
    }
  | {
      type: "SEND_WARD_BUZZ";
      role: WardFlowRole;
      now: Instant;
      unitId: string;
      message: (typeof WARD_BUZZ_MESSAGES)[number];
      urgent?: boolean;
    }
  | {
      /**
       * Phone-log of a repatriation arranged off-system. Not an in-app booking and never creates a
       * transport job. Stores home hospital, that the receiving ward agreed, road or flight, and
       * the same phone-log fields `BOOK_TRANSPORT` already records (provider, CAD or tracking
       * number, voluntary or not, estimated time).
       */
      type: "RECORD_REPATRIATION";
      role: WardFlowRole;
      now: Instant;
      admissionId: string;
      /** Site code from `wardSites` — membership-checked by the reducer. */
      homeHospital: string;
      receivingWardAgreed: boolean;
      mode: RepatriationMode;
      provider: TransportProvider;
      /** CAD or tracking number from the phone call, same field as `BOOK_TRANSPORT.cadNumber`. */
      cadNumber: string;
      transportLegalStatus: TransportLegalStatus;
      estimatedAt: Instant;
    }
  | {
      /**
       * Shift handover sign-off. Stores the caller's role and the time only — never a note, a
       * name, or a claim that the sheet was transmitted.
       */
      type: "RECORD_HANDOVER_SIGN_OFF";
      role: WardFlowRole;
      now: Instant;
    }
  | {
      /**
       * Record that a team was contacted. This is the contact itself, not a sent message.
       * Stores the team, the time, and the caller's role.
       */
      type: "RECORD_CLINICAL_CONTACT";
      role: WardFlowRole;
      now: Instant;
      /** Community-team id from `communityTeamById` — membership-checked by the reducer. */
      teamId: string;
    }
  | {
      /**
       * Dispatch a statewide network broadcast directive across inpatient units and ED desks.
       */
      type: "DISPATCH_BROADCAST_ALERT";
      role: WardFlowRole;
      now: Instant;
      title: string;
      message: string;
      severity: BroadcastSeverity;
      category: BroadcastCategory;
      targetScope: BroadcastTargetScope;
      targetScopeLabel: string;
      durationMinutes: number;
      dispatchedByName: string;
    }
  | {
      /**
       * Acknowledge receipt of an active statewide broadcast alert for a specific ward/unit.
       */
      type: "ACKNOWLEDGE_BROADCAST_ALERT";
      role: WardFlowRole;
      now: Instant;
      alertId: string;
      unitId: string;
    }
  | {
      /**
       * Stand down an active broadcast directive once network pressure resolves.
       */
      type: "STAND_DOWN_BROADCAST_ALERT";
      role: WardFlowRole;
      now: Instant;
      alertId: string;
      stoodDownByRole?: WardFlowRole;
    };

/** Road or flight — the two repatriation modes this prototype records. Never free text. */
export const REPATRIATION_MODES = ["road", "flight"] as const;
export type RepatriationMode = (typeof REPATRIATION_MODES)[number];

/**
 * ⚠️ THE EVENTS A RECORDED REASON CAN GET PAST — AND THE POINT IS THAT IT IS DERIVED, NOT LISTED.
 *
 * `Extract` reads the union itself, so this cannot drift from `WardFlowEvent`. The reducer's two
 * refusal helpers take THIS rather than `WardFlowEvent & { overrideReason?: OverrideReason }`.
 *
 * That intersection was the defect: it RE-ADDED the field regardless of what the union member
 * declared, so deleting `overrideReason?: OverrideReason` from an event produced no type error
 * anywhere. The declaration was load-bearing for CALLERS constructing the event and NOT for the
 * reducer reading it — a deletion would have left screens unable to pass a reason while the
 * reducer went on reading one that could never arrive. A field with no producer, arriving by
 * deletion, invisible to tsc.
 *
 * ⚠️ AND A STRUCTURAL CHECK WOULD NOT HAVE CAUGHT IT EITHER. `Member extends { overrideReason?:
 * OverrideReason }` stays TRUE when the field is deleted, because a type missing an OPTIONAL
 * property is still structurally assignable to one that declares it optional. That check would
 * compile for ever and report nothing — a check that cannot fail, in the type system.
 */
export type OverridableWardFlowEvent = Extract<
  WardFlowEvent,
  { type: "REFER_TO_UNITS" | "ACCEPT_IN_PRINCIPLE" | "PULL_PATIENT" | "ACCEPT_REFERRAL" }
>;

/**
 * One table, read by the reducer's role check, rather than a `switch` repeated at every call
 * site. Adding an event here without an entry is a compile error, which is the point.
 *
 * Widened from one role per event to a non-empty list of permitted roles (this task, spec D2).
 * `CHANGE_URGENCY` and `CHANGE_LEGAL_STATUS` are the first events with more than one — both a
 * coordinator and the referring ED clinician may record either change — and Task 3's events need
 * the same shape, so the table is widened here rather than special-cased per event.
 */
export const EVENT_ROLE: Record<WardFlowEvent["type"], readonly WardFlowRole[]> = {
  RECORD_ADMISSION_CARE: ["ward", "coordinator", "community"],
  RECORD_ADMISSION_FOLLOW_UP: ["ward", "coordinator"],
  RECORD_PATIENT_DISCHARGE: ["ward"],
  UPDATE_EXPECTED_DISCHARGE: ["ward", "coordinator"],
  OPEN_DISCHARGE_RECORD: ["coordinator", "ward", "community"],
  REVIEW_AUDIT_EVENT: ["coordinator"],
  /**
   * Owner ruling FD-25, 2026-08-30: a referral is raised by whoever is with the patient, and that
   * is not only an ED. A ward refers to a medical ward or to a community team; a community service
   * refers in. Widened from `["ed"]` accordingly.
   *
   * `edId` on this event is now an ORIGIN of any kind, not an emergency department — the name is
   * left alone in this pass because renaming it touches every raise path, and a half-renamed field
   * is worse than an accurate comment. Recorded here so the next reader does not take the name as
   * a constraint.
   */
  RAISE_REFERRAL: ["ed", "community", "ward"],
  RECORD_EXAMINATION: ["ed"],
  RECORD_MEDICAL_CLEARANCE: ["ed"],
  /* The ED psychiatry team is the only party that can see whether somebody is standing in their
     department, and the owner named them specifically (2026-09-07): "the ED psychiatry doctors
     notice the patient has arrived in ED". Not the coordinator, who is not in the building. */
  RECORD_ARRIVED_IN_DEPARTMENT: ["ed"],
  /*
   * MIRRORS `BOOK_TRANSPORT` BELOW, INCLUDING ITS EXCLUSION — the sending team, and not the
   * coordinator. `TR-D1` rejects the coordinator from booking BY NAME because "it owns the bed
   * search and does not know whether this patient needs an escort or is settled enough to travel".
   * Whether transport is needed at all is the same knowledge one step earlier, so the same three
   * senders may answer it and the same role may not. A coordinator who could record "no transport
   * needed" would be answering a question about a patient it has never seen.
   */
  RECORD_TRANSPORT_NEED: ["ed", "ward", "community"],
  /*
   * `ed` ALONE: the department physically holding the form is who can mark it received. Widened
   * codes (1A, 3A, 3C, 3D, 6A, 6B, 6C, 5A, 5B) do not widen the role.
   */
  RECORD_LEGAL_FORM_RECEIVED: ["ed"],
  /*
   * T4 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`). `ed` alone, on
   * `RECORD_LEGAL_FORM_RECEIVED`'s own reasoning immediately above: the department physically
   * holding the form is who can say a receipt was recorded in error.
   */
  CORRECT_LEGAL_FORM_RECEIPT: ["ed"],
  /*
   * T2 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`). `ed`, on
   * `RECORD_LEGAL_FORM_RECEIVED`'s own reasoning: the department physically holding the form is
   * who reads the expiry off it. `coordinator` joins it here — unlike that event, this one is also
   * how a regional EXTENSION gets recorded, and item 5's own wording ("the clinician records the
   * extension") does not name the department alone the way Ruling 1 named `ed` for receipt.
   */
  RECORD_LEGAL_FORM_EXPIRY: ["ed", "coordinator"],
  // Opus review round 2, 17 September 2026 (P2). `ed` and `coordinator`, named explicitly in the
  // brief this event answers — both are places a gender_designation refusal is actually seen (the
  // ED intake screen and the coordinator's movement drawer), and both are roles that already
  // record gender elsewhere on this file (`RAISE_REFERRAL`'s `draft.gender`).
  RECORD_MOVEMENT_GENDER: ["ed", "coordinator"],
  RECORD_NO_REFERRAL: ["ed"],
  // RB3, item 19: the department that holds the patient records the outcome — the same "who
  // physically holds the patient" reasoning RECORD_LEFT_DEPARTMENT's own entry uses below.
  RECORD_ED_OUTCOME: ["ed"],
  REFER_TO_UNITS: ["coordinator"],
  ACCEPT_IN_PRINCIPLE: ["ward"],
  /* Owner ruling 2026-09-01: a pull is always a person's act — *"only a person can do this who is
   * interacting from the ward menu or the coordinator"*. Widened from ward-only deliberately, and the
   * reducer refuses it against a bed that is not ready whichever role raises it. */
  PULL_PATIENT: ["ward", "coordinator"],
  DECLINE: ["ward"],
  HANDOVER_READY: ["ed"],
  TRANSPORT_ACCEPTED: ["officer"],
  TRANSPORT_EN_ROUTE: ["officer"],
  PATIENT_COLLECTED: ["officer"],
  PATIENT_ARRIVED: ["officer", "ward"],
  CONFIRM_CAPACITY: ["ward"],
  // Owner Answer 18, second round, 2026-09-17: the ward's own answer to what is currently
  // limiting its intake, same role as CONFIRM_CAPACITY above.
  RECORD_WARD_INTAKE_CONSTRAINTS: ["ward"],
  RECORD_ESCALATION: ["coordinator"],
  ADVANCE_CLOCK: ["demo"],
  RESET_SCENARIO: ["demo"],
  SET_SCENARIO: ["demo"],
  // Task 3 of the audit-wiring plan: only a coordinator may save the settings-screen draft.
  SET_CONFIGURATION: ["coordinator"],
  CHANGE_URGENCY: ["coordinator", "ed"],
  CHANGE_LEGAL_STATUS: ["coordinator", "ed"],
  RELEASE_PULL: ["coordinator", "ward"],
  // TR-D6 (owner, 2026-08-30): the team that BOOKED it, and the coordinator. The sending team
  // owns the job (TR-D5) and every movement originates at an emergency department
  // (`Movement.originEdId` is required), so the booking team is `ed`. ⚠️ `ward` is the
  // RECEIVING side and is excluded BY NAME: it did not book the job, and a booking cancelled
  // by the destination is indistinguishable on the sending board from one that failed — so
  // the sending team cannot tell "they changed their mind" from "it never went through".
  // This list read ["coordinator", "ward"] until 2026-08-30, which was TR-D6 inverted.
  // `TR-D1`: the sending ward or ED, and the coordinator REJECTED BY NAME — it owns the bed search
  // and does not know whether this patient needs an escort or is settled enough to travel. Note the
  // asymmetry with `CANCEL_TRANSPORT` below, which the coordinator MAY do (`TR-D6`): it is the only
  // role that sees the whole picture and so the only one positioned to notice a booking that has
  // become wrong. Booking needs knowledge of the patient; cancelling needs knowledge of the network.
  //
  // `community` ADDED 2026-09-01 (OWNER): transport booking belongs to whoever is SENDING the
  // patient, and a community team is one of those senders.
  //
  // ⚠️ **THE MODEL CANNOT YET REPRESENT THE SENDER THAT RULING NAMES, AND THIS ROW DOES NOT
  // PRETEND OTHERWISE.** `Movement.originEdId` is REQUIRED (`ward-model.ts` — "where the patient
  // physically is"), and `RAISE_REFERRAL`, the ONLY event that creates a movement, refuses an
  // `edId` that is not in `allEmergencyDepartments()`. So every movement is sent FROM an emergency
  // department whoever raised it: **there is no community-origin movement, at `pulled` or at any
  // other stage.** The two lines directly above still hold as a statement of fact and are left
  // standing for that reason.
  //
  // What the widening actually grants is a `community` caller booking transport for a patient
  // sitting in an ED. That is a LIVE permission and not a dead one — `case "BOOK_TRANSPORT"` gates
  // on `movement.stage` alone and never compares the caller against `originEdId` — but it is
  // UNSCOPED for exactly the same reason: a community team may book for any pulled movement in the
  // state, not only for one it sent. Scoping it needs a community origin on `Movement` first, which
  // is the owner's decision and not an implementer's. Pinned in `tests/ward-book-transport.test.ts`.
  // 🔴 CORRECTED 2026-09-15 under WLQ-11 (owner): `case "BOOK_TRANSPORT"` used to store `provider`
  // and `escortRequired` and nothing about the caller. It now also stores `transport.bookedBy: {
  // role, unitId? }` for every booker — `role` always, `unitId` only for a `ward` booker (from its
  // own `actingUnitId` claim) — because `CANCEL_TRANSPORT` below needs to tell the booker from
  // anyone else. `ed` and `community` bookings are no longer byte-identical to each other; see the
  // superseded assertion in `tests/ward-book-transport.test.ts`.
  BOOK_TRANSPORT: ["ed", "ward", "community"],
  // 🔴 CHANGED AGAIN 2026-09-15 under WLQ-11 (owner): *"whoever booked transport may cancel it;
  // the receiving ward still may not."* `ward` is back in this list. The comment block above (the
  // one still headed "THIS CHECK USED TO BE TR-D6 INVERTED") explained why `ward` was removed
  // outright rather than merely re-scoped: the role gate alone could not tell the RECEIVING ward
  // from the BOOKING one, so excluding every ward was the only safe fix available at the time.
  //
  // WLQ-11 makes the finer distinction possible: `BOOK_TRANSPORT` now records `transport.bookedBy`
  // (see its own comment just above), so `case "CANCEL_TRANSPORT"` can compare a `ward` caller's
  // `actingUnitId` claim against the recorded booker and refuse only when they differ — including
  // when they differ because there is no recorded booker at all (every job booked before this
  // ruling). The receiving ward is therefore STILL refused whenever it did not book, which is every
  // case TR-D6 originally worried about; it is a narrower rule, not a reversed one.
  //
  // 🔴 **`community` ADDED — owner's third ruling, 2026-09-17 (answer 9): "only the community team
  // that booked transport may cancel it."** This used to say `community` was handed back for want
  // of an identity claim (`actingPlaceId` had never been plumbed into `BOOK_TRANSPORT` or
  // `CANCEL_TRANSPORT`). It now has one — the same claim-not-proof discipline `actingUnitId` gives
  // a `ward` caller — so `case "CANCEL_TRANSPORT"` can compare a `community` caller's
  // `actingPlaceId` claim against `transport.bookedBy.placeId`, exactly the way the `ward` branch
  // already compares `actingUnitId` against `bookedBy.unitId`. Pinned in
  // `tests/ward-transport-cancel-permission.test.ts`.
  CANCEL_TRANSPORT: ["coordinator", "ed", "ward", "community"],
  /*
   * WLQ-38 (owner, 2026-09-15): the referrer or the coordinator may stop a journey already under
   * way, once the patient has been collected — see this event's own doc comment above for the full
   * ruling and for why `ed` is permitted by role alone rather than checked against
   * `movement.originEdId`. `ward` is deliberately NOT here: the receiving ward is the one party the
   * ruling names as unable to act (the same shape `CANCEL_TRANSPORT`'s own `ward` scoping exists to
   * get right, but this event has no booker-identity field to check a ward claim against, and the
   * ruling did not ask for the receiving ward to have this power at all).
   */
  STOP_TRANSPORT: ["coordinator", "ed"],
  // Owner answer 8 (second round, 2026-09-17): the coordinator, the ward, or the referrer.
  RELEASE_HELD_BED: ["coordinator", "ward", "ed"],
  // Build plan item 29 (T4a) / R2-7: the transport officer or the coordinator.
  RECORD_DIVERSION: ["officer", "coordinator"],
  // Build plan item 29 (T4a) / OA-29: the coordinator, the accepting ward, or the original referrer.
  RELEASE_DIVERTED_BED: ["coordinator", "ward", "ed"],
  REFER_TO_COMMUNITY_TEAM: ["ed"],
  RECORD_LEFT_DEPARTMENT: ["ed"],
  FLAG_BED_RELEASE: ["ward"],
  CONFIRM_BED_RELEASE: ["ward"],
  // Bed-model rework (2026-08-28). All three are `ward`-only for the same reason the four above
  // are: only the ward moves a bed between stages, flags it stuck or unstuck, or says it is being
  // made ready. A coordinator sees every one of them and changes none of them.
  REVERT_BED_RELEASE: ["ward"],
  BLOCK_BED_RELEASE: ["ward"],
  CLEAR_BED_RELEASE_BLOCK: ["ward"],
  SET_BED_PREPARATION: ["ward"],
  RELEASE_BED: ["ward"],
  RECORD_LEAVE_BED: ["ward"],
  END_LEAVE_BED: ["ward"],
  // The ward the patient is leaving records it. Not the coordinator: a statewide view does not
  // know that somebody walked out of a building, and a coordinator recording a discharge it
  // cannot observe is the shape this project refuses everywhere else.
  RECORD_LEAVING: ["ward"],
  // The ward that holds the bed, and nobody else. A ward is the only party that observes one of
  // its own occupants leaving the building for an emergency department and coming back, and it is
  // the party still holding the bed while they are gone. The coordinator is excluded on exactly
  // the reasoning `RECORD_LEAVING` above already uses: a statewide view does not know that
  // somebody walked out of a ward, and it would be recording something it cannot see. `ed` is
  // excluded too, and that one is worth stating because it looks like the obvious candidate — the
  // patient is physically IN an emergency department while this is true. But the fact being
  // recorded is about the WARD'S OWN BED ("the bed is still theirs"), the reducer refuses any
  // acting unit other than the one holding the admission, and an emergency department holds no
  // ward bed to act as. Neither event writes a role name onto any record, so no false attribution
  // can enter with either.
  RECORD_AWAY_AT_EMERGENCY_DEPARTMENT: ["ward"],
  RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT: ["ward"],
  /*
   * Mirrors `WITHDRAW_REFERRAL` below exactly, and for the same reason: whoever may raise a
   * movement may say what is holding it up, plus the coordinator. The four are not
   * interchangeable observers — a ward knows its bed is not clean, an emergency department knows a
   * family has not been reached, a community team knows what it is waiting on, and the
   * coordinator is the only one who can say no bed exists anywhere in the network. Narrowing this
   * to one of them would make the other three's observation unrecordable, and the field's whole
   * purpose is to hold a fact the model cannot compute.
   *
   * ⚠️ **`officer` ADDED 2026-09-01, AND THE REASON IT HAD BEEN EXCLUDED WAS FALSE WHEN WRITTEN.**
   * This comment said the transport legs "already restate this field on their own", so an
   * officer's view was written by the events they raise. An officer raises exactly four events —
   * `TRANSPORT_ACCEPTED`, `TRANSPORT_EN_ROUTE`, `PATIENT_COLLECTED`, `PATIENT_ARRIVED` — and until
   * the same day only the last two restated anything. The two legs that made the standing sentence
   * false were the two that left it alone, and the only party who observes them could not correct
   * it. Both legs restate now, so the premise is finally true — and it still does not carry the
   * exclusion, for two reasons:
   *
   *   - **Applied consistently it excludes everybody.** Every permitted role also raises events
   *     that restate this field: the coordinator `REFER_TO_UNITS`, the ward `ACCEPT_IN_PRINCIPLE`,
   *     the emergency department `BOOK_TRANSPORT` and `RECORD_EXAMINATION`. "Your events already
   *     write it" is true of all five, so it discriminates between none of them.
   *   - **It answers the stage-level case and not the one this field exists for.** Between
   *     `TRANSPORT_EN_ROUTE` and `PATIENT_COLLECTED` the vehicle is the only thing moving and the
   *     officer is the only party watching it. An ambulance diverted to a higher-priority job, or a
   *     crew stood down, has NO event in this model — the movement sits reading "Awaiting
   *     collection — transport is en route" while the vehicle turned around. That is the same
   *     staleness one layer down, and the test above ("narrowing this would make an observation
   *     unrecordable") admits the officer on exactly the reasoning it admits the other four.
   *
   * The second half of the old reason — "an officer does not own the placement" — is not the test
   * this table uses either. The ward does not own the placement (the coordinator does) and is here
   * anyway, because it can see its own bed. Unique observation earns the seat, not ownership.
   *
   * What the reducer writes for these roles, as this guard demands: THE CALLER'S OWN PROSE AND
   * NOTHING ELSE. No role name, no team, no person is recorded alongside it, so no false
   * attribution can enter with any of the five — the record does not claim who said it, and the
   * screen does not either. That is what makes the widening safe as well as right.
   */
  RECORD_MOVEMENT_BLOCKER: ["ed", "community", "ward", "coordinator", "officer"],
  // Identical to `RECORD_MOVEMENT_BLOCKER` above and never narrower: whoever may say what is
  // holding a patient up may say it has stopped. Writes one reducer-owned sentinel and no role,
  // team or person — so, like its partner, it can introduce no false attribution. `officer` added
  // with its partner on 2026-09-01 for that reason: an officer who may record "ambulance diverted"
  // and may not then say it is resolved leaves a sentence only somebody who cannot see the vehicle
  // can retract.
  CLEAR_MOVEMENT_BLOCKER: ["ed", "community", "ward", "coordinator", "officer"],
  /*
   * ⚠️ MIRRORS `CHANGE_URGENCY` EXACTLY, AND THAT IS THE ARGUMENT RATHER THAN A CONVENIENCE.
   * `queueOrder` puts this flag ABOVE all three urgency tiers, so it MUST NOT be easier to raise
   * than the tier it outranks: a control available to more roles than `CHANGE_URGENCY` would let
   * somebody who may not move a patient from tier 3 to tier 1 put them above every tier 1 instead.
   * The coordinator sees the whole network and the referring emergency department is with the
   * patient; those are the two who may already move a tier, and they are the two here.
   *
   * `ward` is excluded BY NAME, and it is the one that looks like it belongs: a receiving ward
   * has an obvious view on how urgent an admission is. But a ward that may flag can promote the
   * patient it is about to accept above every other ward's, and the flag carries no reason and no
   * author for anybody to review that against. Widening this is an owner decision.
   *
   * What the reducer writes for these roles, as this guard demands: `flaggedUrgent: true` or
   * `false` and NOTHING else — no role, no reason, no timestamp. So neither role can introduce a
   * false attribution, because the record makes no attribution at all. That absence is itself a
   * known limit, recorded on the events' own doc comments.
   */
  FLAG_MOVEMENT_URGENT: ["coordinator", "ed"],
  CLEAR_MOVEMENT_URGENT_FLAG: ["coordinator", "ed"],
  /*
   * Whoever referred may un-refer, so this mirrors RAISE_REFERRAL's own role list rather than
   * narrowing it — a referral raised by a community team that only an ED could withdraw would be a
   * request nobody present can take back. The coordinator is included on the same reasoning as
   * FD-25: it overrides, and an override nobody can exercise is not an override.
   *
   * ⚠️ **THIS TABLE ENTRY STOPPED BEING THE WHOLE STORY ON 2026-09-15, WLQ-38.** Before it, the
   * reducer refused every one of these four roles once `movement.acceptedUnitId` was set — "a
   * withdrawal cannot undo an acceptance" — so the four-role list above was accurate for every
   * reachable case. His ruling: *"This should also be the referring doctors responsibility as well
   * to be able to revoke the transport as well as referral in addition to the coordinator."* The
   * reducer now permits `coordinator` and `ed` to withdraw an ACCEPTED referral too (refusing
   * `community` and `ward` at that point, and refusing everyone once the patient has been
   * collected — see `STOP_TRANSPORT` for that case instead), so this list is still the full set of
   * roles that may ever raise the event, but which of them succeed now depends on
   * `movement.acceptedUnitId` as well as on the pre-existing referredUnitIds/closure checks. See
   * the reducer's own `WITHDRAW_REFERRAL` case for the state-scoped narrowing this list cannot
   * express.
   */
  WITHDRAW_REFERRAL: ["ed", "community", "ward", "coordinator"],
  // The one thing a coordinator may do to a ward's bed data. It changes no number: it marks that
  // somebody asked. Spec D12.
  REQUEST_CAPACITY_REFRESH: ["coordinator"],
  // Task 3 (Phase 7, "The front door"): the community role raises a referral; only the
  // coordinator decides whether the service takes it. Two different decisions, kept apart from
  // `DECLINE` (a ward declining a specific movement, downstream) — see this file's own top-level
  // comment on `WardFlowRole`.
  //
  // R9 (owner item 23, 2026-09-17): "Police, ambulance and crisis stay 'community'. … only
  // `ed_medical` is raised as `ed`, and `ed` with any other source is refused. Everything else,
  // including GP, stays `community`." `ed` widens the table here; the reducer's own
  // `case "RECEIVE_REFERRAL"` couples it back to `source` — this list alone cannot express "only
  // when the source is ed_medical".
  RECEIVE_REFERRAL: ["community", "ed"],
  // Anyone at the front door may add a patient who is not yet known - that IS the front door.
  ADD_PATIENT: ["ed", "community", "coordinator"],
  /**
   * Owner ruling FD-25: a WARD answers a referral addressed to it. The coordinator keeps the role
   * too — it overrides, and an override nobody can exercise is not an override.
   */
  // `ed` added 2026-08-30 under FD-3 as SUPERSEDED by the owner: "every referral is declinable,
  // and NO CODE PATH MAY RENDER A REFERRAL WITH NO DECLINE AFFORDANCE". The ED hub acts as
  // `ed`, so without it an emergency department could not answer a referral addressed to it,
  // and the available workaround was to dispatch as `ward` — which writes a false `decidedBy`.
  // ⚠️ The widening is scoped in the reducer: a role answers its OWN destination kind and
  // nothing else, so this list alone does not let an ED decide on a ward bed.
  /*
   * 🔴 `community` MAY NOW ACCEPT, FOR FOLLOW-UP ONLY — RB5 (item 16), superseding the
   * 2026-09-06 ruling recorded below, which held for a time that a community team could
   * decline but never accept.
   *
   * The owner's 2026-09-17 answer ("a community team may accept, for follow-up only") is
   * exactly the mirror-image ruling that comment once said "nobody made". Accepting still
   * commits a service to taking the patient, but a COMMUNITY acceptance commits it to
   * FOLLOW-UP, never to a bed: `referralState` (`ward-referrals.ts`) is the one place that
   * distinction is kept, deciding from the non-community destinations whenever any exist, so a
   * community acceptance alone never flips a referral to `"accepted"`, never cancels a queued
   * ward or ED arm (see the reducer's own comment on that, unchanged), and never blocks a later
   * ward/ED accept, decline or referrer withdrawal.
   *
   * The role half is still not the dangerous half on its own: `answerableBy` in the reducer
   * already carried `community: "community_team"` (not `"any"`) in BOTH the accept and decline
   * handlers before this change, exactly so widening this list alone could not let a community
   * team decide a psychiatric ward bed.
   */
  ACCEPT_REFERRAL: ["ward", "coordinator", "ed", "community"],
  /*
   * `community` MAY ALSO DECLINE — owner ruling 2026-09-06. The two lists are one line apart on
   * purpose: `answerableBy` in the reducer carries `community: "community_team"` for BOTH events
   * (never `"any"`), which skips the destination-ownership check entirely for a role that has
   * one — so `community` on either line without that map holding is what would let a community
   * team decide a PSYCHIATRIC WARD bed, recorded as a legitimate decision on a ward it has
   * nothing to do with. The reducer's own comment called this shot when `ed` was added:
   * "`community_team` has no acting role yet; when one arrives it joins this map rather than
   * widening the lists."
   */
  DECLINE_REFERRAL: ["ward", "coordinator", "ed", "community"],
  // `coordinator` only, and this one is a PLAN JUDGEMENT rather than a spec ruling — the spec
  // says only "role-gated like every other referral event", and the control sits on the
  // coordinator's own match view. The owner may want `community` here as well (a community team
  // is plausibly who actually rang round for a local bed); adding it is a product decision, not
  // an implementer's, so it is flagged rather than taken.
  RECORD_LOCAL_BED_SOUGHT: ["coordinator"],
  /*
   * 🔴 `coordinator` ONLY, AND THIS IS A PLAN JUDGEMENT FLAGGED RATHER THAN TAKEN — the same shape
   * as `RECORD_LOCAL_BED_SOUGHT` directly above, and flagged for the same reason.
   *
   * ⚠️ A referrer withdrawing rings SOMEBODY, and who that is is a product question nobody has
   * answered: plausibly the coordinator who holds the referral, plausibly the ward or the emergency
   * department the referral was addressed to. **Starting narrow is the reversible direction** — a
   * role added later changes one line, while a role wrongly permitted writes
   * `withdrawalRecordedBy` entries that misattribute who took the call, and those cannot be
   * un-recorded.
   *
   * ⚠️ **NO `answerableBy` ENTRY IS NEEDED and its absence is deliberate**, unlike the trap recorded
   * above `DECLINE_REFERRAL`: that map exists so a role may only answer ITS OWN destination kind,
   * and this event answers no destination at all. It marks every destination still waiting, because
   * the referrer takes back the whole referral rather than one service's copy of it.
   *
   * ⚠️ **UNCHANGED BY OWNER RULING 11's `destinationKind: "community_team"` VARIANT.** Every
   * destination-level referral act this app can raise (`ACCEPT_REFERRAL`, `DECLINE_REFERRAL`,
   * `RECORD_LOCAL_BED_SOUGHT`, `ADD_REFERRAL_CORRECTION`) dispatches from exactly one place —
   * `ReferralMatchView` (`referral-match.tsx`), the coordinator's own referral register — hardcoded
   * to `role: "coordinator"` at every call site because that view carries no other viewer-role to
   * select (see `ReferralHistoryAndCorrections`'s own comment on that same shape). The scoped
   * withdrawal control lives there too, so it needs no wider role than this list already grants.
   */
  /*
   * ✅ ANSWERED 4 October 2026 — the owner: "Let the community team and the ED record it as well,
   * if they are cancelling their referral." So `community` and `ed` join, and the reducer scopes
   * each to referrals its own side sent (`referralSenderRole`, `ward-referrals.ts`): a community
   * team cannot withdraw an ED's referral, nor an ED a community one. The coordinator keeps the
   * role for any referral.
   */
  RECORD_REFERRER_WITHDRAWAL: ["coordinator", "community", "ed"],
  /**
   * RB7, build plan item 27 (2026-09-17): the three parties who could plausibly need to correct a
   * referral after the fact — the referrer's own team (`community` or `ed`, whichever raised it),
   * and the coordinator who may be handling it. `ward` is excluded: a ward answers a referral, it
   * does not author or amend the referrer's own account of it.
   */
  ADD_REFERRAL_CORRECTION: ["community", "ed", "coordinator"],
  /**
   * F1 (Task 5, 2026-09-04): only the coordinator may raise either event. This table entry is the
   * ENTIRE enforcement — the generic role check in `wardFlowReducer`'s switch preamble rejects any
   * other role before either event's payload is inspected at all, exactly as it does for every
   * other role-gated event above.
   */
  STEP_BACK_STAGE: ["coordinator"],
  WITHDRAW_ACCEPTANCE: ["coordinator"],
  // RA1 (item 18): the shortlist is the coordinator's own tool, and nobody else holds a live
  // request on this movement to take back — see the event's own doc comment above.
  WITHDRAW_WARD_REQUEST: ["coordinator"],
  /*
   * Item 48, Q2 (owner answer 48, 2026-09-17): every role a notice can be addressed to may mark
   * ITS OWN notice read — `community` is included even though no community screen dispatches
   * anything through this bar yet (`ward-chrome-role.ts`'s `WardChromeRole` has no community
   * member, RB4's gap, not this task's), because the reducer's addressee check below is the real
   * gate: a `community` caller can still only mark a notice whose `to.role` is `community` AND
   * whose `to.placeId` matches its own claim. Widening this list costs nothing a role could not
   * already be refused for by that check.
   */
  MARK_NOTICE_READ: ["coordinator", "ed", "ward", "officer", "community"],
  /*
   * COORDINATOR-ONLY, ALL THREE — read from where the row is OBSERVED, not assumed. `buildActionInbox`
   * (`ward-derivations.ts`) is rendered by exactly one screen in this codebase today:
   * `coordinator/exception-drawer.tsx`, mounted from `coordinator/coordinator-screen.tsx`. No ward
   * screen and no emergency-department screen renders a single `InboxItem` anywhere. The same
   * "unique observation earns the seat" test `RECORD_MOVEMENT_BLOCKER`'s own comment states above
   * would grant a ward or an ED a seat here IF either could see the row — neither can today, so
   * granting write access to a role that cannot see the state of the thing it would be acting on is
   * exactly the failure mode this file's own role comments warn against elsewhere.
   *
   * ⚠️ THIS IS A STARTING POINT, NOT A CEILING, AND IS STATED HERE RATHER THAN LEFT IMPLICIT.
   * Nothing about acknowledging or completing an inbox row is coordinator-specific in the way
   * `REQUEST_CAPACITY_REFRESH` genuinely is (see that entry's own comment, "the one thing a
   * coordinator may do to a ward's bed data") — a ward asked to ring transport for a stalled leg is
   * squarely the kind of commitment `COMPLETE_INBOX_ITEM` exists to tick off. The day the action
   * inbox is surfaced on a ward or ED screen, THIS LIST is what should widen, not the reducer's
   * shape or the events themselves. Left narrow now rather than guessed wide, because deciding who
   * may tick off a clinical to-do item without that item ever having been shown to them is exactly
   * the kind of call this task's brief says to hand back rather than take.
   */
  ACKNOWLEDGE_INBOX_ITEM: ["coordinator"],
  COMPLETE_INBOX_ITEM: ["coordinator"],
  REOPEN_INBOX_ITEM: ["coordinator"],
  SET_ARRIVAL_DETAILS: ["coordinator", "ed", "ward", "community"],
  SET_STEP_DOWN_CANDIDATE: ["ward", "coordinator"],
  SET_DISCHARGE_BARRIER: ["ward", "coordinator"],
  RECORD_MOVEMENT_MEDICAL_CLEARANCE: ["ed", "coordinator", "ward", "community"],
  UPLOAD_PATIENT_FORM: ["coordinator", "ed", "ward", "community", "officer"],
  RECORD_LEGAL_FORM_WRITTEN: ["ed", "coordinator", "ward", "community"],
  RECORD_COUNTRY_EXTENSION: ["ed", "coordinator"],
  RECORD_LEGAL_FORM_CONTINUATION: ["ed", "coordinator", "ward", "community"],
  EVALUATE_ARRIVAL_LATENESS: ["coordinator", "ed", "ward"],
  RELEASE_AND_REOPEN_SEARCH: ["coordinator", "ward"],
  CLEAR_EXPECT_FLAG: ["ward", "coordinator", "ed", "community"],
  RAISE_EXPECT_FLAG: ["ward", "coordinator", "ed", "community"],
  FLAG_LEGAL_MISMATCH: ["ward", "coordinator"],
  EVALUATE_LEAVE_BED_WARNINGS: ["ward", "coordinator"],
  CONFIRM_MORNING_ROLLUP: ["ward", "coordinator"],
  SEND_WARD_BUZZ: ["coordinator", "bed_manager", "executive"],
  // Out-of-area board is the coordinator's tool. This is a phone-log, not a booking.
  RECORD_REPATRIATION: ["coordinator"],
  // The handover sheet is signed by whoever is handing over — coordinator or the ward.
  RECORD_HANDOVER_SIGN_OFF: ["coordinator", "ward"],
  // Contacting a team is this record. The team that made the call, or the coordinator logging it.
  RECORD_CLINICAL_CONTACT: ["community", "coordinator", "ed"],
  // Statewide broadcast directives — coordinators, bed managers, and executives dispatch; all roles may acknowledge for their unit.
  DISPATCH_BROADCAST_ALERT: ["coordinator", "bed_manager", "executive"],
  ACKNOWLEDGE_BROADCAST_ALERT: ["coordinator", "ward", "ed", "officer", "community", "bed_manager", "executive"],
  STAND_DOWN_BROADCAST_ALERT: ["coordinator", "bed_manager", "executive"],
};
