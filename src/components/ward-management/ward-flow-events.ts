import type { BedMeetingActionKind, BedMeetingActionOwner, BedMeetingSubject } from "./bed-meeting/bed-meeting-actions";
import type { CareChange } from "./ward-care-journey";
import type {
  DischargeBarrier,
  LeavingDestination,
  FollowUpState,
  PlannedAdmissionCancelReason,
  PlannedAdmissionReason,
} from "@/components/ward-management/ward-admissions";
import type { Gender, PatientId } from "@/components/ward-management/ward-patients";
import type { ArchivePatientEvent } from "./ward-patient-archive";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { LegalFormExpiryCorrectionReason, UploadedFileType } from "./ward-model-vocabulary";
import type { UndoBedMeetingActionEvent } from "./ward-bed-meeting-undo-event-type";
import type { ReferralInformationNeed } from "@/components/ward-management/referrals/referral-information-needs";
import type {
  ReferralContactOutcome,
  ReferralContactTarget,
  ReferralOwnerDesk,
} from "@/components/ward-management/referrals/referral-owner-and-calls";
import type { WardClosureReason } from "@/components/ward-management/capacity/ward-closure";
// Closing-the-loop package A (24 Oct 2026): response commitments.
import type { ReferralCommitmentStep } from "@/components/ward-management/referrals/referral-commitments";
import type { TentativeDiagnosisBlock } from "@/components/ward-management/ward-diagnosis";
import type { CommunityReferralPurpose } from "@/components/ward-management/ward-model-referral-parts";
import type {
  SupportNotificationOccasion,
  SupportNotificationOutcome,
  SupportNotificationParty,
} from "@/components/ward-management/ward-support-notifications";
import type {
  BroadcastAnswer,
  BroadcastCategory,
  BroadcastSeverity,
  BroadcastTargetScope,
} from "@/components/ward-management/alerts/ward-broadcast-model";
import type {
  BedPreparationNote,
  BedReleaseBlocker,
  DischargeDelayClearReason,
  OverrideReason,
  ReferralCapReason,
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
  AtsCategory,
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
  RecordedSex,
  StepBackReason,
  TransportExceptionGap,
  TransportExceptionReason,
  TransportLegalStatus,
  TransportProvider,
  AbsenceStep,
  OverrideSignOff,
} from "@/components/ward-management/ward-model";
import type { WardScenario } from "@/components/ward-management/ward-scenarios";
import type { InboxSnoozeReason } from "@/components/ward-management/ward-inbox-snooze";

/**
 * `WardFlowRole` and `WARD_FLOW_ROLE_LABELS` live in `ward-flow-roles.ts` now (Spec D15
 * restoration, 2026-09-11) — re-exported from here, unchanged, so `ward-flow-reducer.ts` and
 * `ward-tasks-drawer.tsx` need no change. `ward-model.ts` imports the role type directly from
 * `ward-flow-roles.ts` instead of from here, which is the actual fix: this module also declares
 * the bed-release event types and imports `BedReleaseWaitingOn`, so a type-only edge from
 * `ward-model.ts` into this whole file put the release model inside the module graph the D15
 * contract (`tests/ward-referral-matching.test.ts`) walks from matching's own entry points.
 */

/** The open checks a transport step went ahead with, and the coded reason the person chose. */
export type TransportExceptionInput = { gaps: TransportExceptionGap[]; reason: TransportExceptionReason };

export type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
export { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { ObservationLevelEvent } from "@/components/ward-management/ward-flow-observation-events";
import type { RestrictivePracticeWardFlowEvent } from "@/components/ward-management/restrictive-practice/ward-restrictive-practice";
// Closing the loop, package D (24 Oct 2026).
import type { LoopCheckWardFlowEvent } from "@/components/ward-management/loop-checks/ward-loop-checks";
import type { ArrivalCheckEvent, ReleaseNoticeEvent } from "./ward-flow-release-notice-events";
import type { RecordWardDiagnosisEvent } from "@/components/ward-management/ward-flow-diagnosis-events";
// The role table lives in its own file (line cap, 18 Oct 2026), re-exported here.
export { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";

// The ED's intake form type lives in its own file (line cap, 22 Oct 2026), re-exported here.
import type { ReferralDraft } from "@/components/ward-management/ward-referral-draft";
export type { ReferralDraft };

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
      requestNamespace?: string;
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
      /**
       * The ED the journey starts at. D-76: absent only when an accepting ward or the coordinator
       * starts the journey of an accepted community referral, which starts at the referring team.
       */
      edId?: string;
      draft: ReferralDraft;
      /** Explicitly continue an accepted direct ED-to-ward referral. Acceptance itself still
       * creates no movement or bed. The accepting ward must name its own acting unit. */
      acceptedUnitId?: string;
      /** WT-08: also pull the accepted ward's bed in the same tap. A refused pull starts nothing. */
      pullBed?: boolean;
      actingUnitId?: string;
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
      actingUnitId?: string;
      /** The ED desk raising it; must be the movement's origin ED. */
      actingPlaceId?: string;
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
       * v10 pass 3 (Josh, 10 Oct 2026): who gave the override's second sign-off, the acting role
       * and a typed name or initials. Optional, kept only with a recorded override, and typed text:
       * a dispatch carrying it locks browser storage (`eventCarriesTypedTextPayload`).
       */
      overrideSignOff?: OverrideSignOff;
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
      /**
       * Top 25 item 2 (owner ruling 15 Oct 2026): the reason for asking more
       * wards at once than `WardConfiguration.parallelReferralCap`. Without it the cap still refuses,
       * exactly as before; with a reason from `REFERRAL_CAP_REASONS` the extra ward is asked and the
       * reason is kept in the audit trail. Only a screen with the flag on sends it.
       */
      overCapReason?: ReferralCapReason;
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
      /** v10 pass 3: the second sign-off on an override (see `REFER_TO_UNITS.overrideSignOff`). */
      overrideSignOff?: OverrideSignOff;
      /**
       * v10 pass 3 (Josh, 10 Oct 2026): the ward Bed board places a coordinator-sent person in a
       * numbered bed as it accepts. Stored as `Movement.heldBedNumber`; 1 to `Unit.beds`, and not a
       * bed a current stay or another accepted movement on the unit already holds.
       */
      bedNumber?: number;
      /** D-72: the extra-travel bed hold, stored as `Movement.extendedHoldAt`. `true` or absent. */
      extendedHold?: true;
      /** B1: a ward answering names itself; refused when it answers for another ward. The
       *  coordinator acts for any ward and sends none. */
      actingUnitId?: string;
    }
  | {
      type: "PULL_PATIENT";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      unitId: string;
      overrideReason?: OverrideReason;
      /** v10 pass 3: the second sign-off on an override (see `REFER_TO_UNITS.overrideSignOff`). */
      overrideSignOff?: OverrideSignOff;
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
      /** B1: a ward pulling names itself; refused when it pulls for another ward. The
       *  coordinator acts for any ward and sends none. */
      actingUnitId?: string;
    }
  | {
      type: "DECLINE";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      unitId: string;
      /** From `DECLINE_REASONS`, and nothing beside it — see `Decline`'s own doc comment (PD-6). */
      reason: DeclineReason;
      /** B1: a ward declining names itself; refused when it declines for another ward. The
       *  coordinator acts for any ward and sends none. */
      actingUnitId?: string;
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
  | {
      type: "PATIENT_COLLECTED";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      /** Audit fix (13 Oct 2026): collected with a check open (no Form 4A, no clearance), and why. */
      exception?: TransportExceptionInput;
    }
  | {
      type: "PATIENT_ARRIVED";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      actingUnitId?: string;
      /** Audit r1 item 4: arrived with no transport leg and fit to travel not recorded, and why. */
      exception?: TransportExceptionInput;
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
      /** Explicit transcription correction; ordinary expiry entries remain later-only extensions. */
      correction?: {
        expectedFormCode: string;
        expectedFormWrittenAt: Instant | null;
        expectedDueAt: Instant;
        reason: LegalFormExpiryCorrectionReason;
      };
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
       * `/ward-flow/ward/[unitId]`, so a caller always has one to state; the reducer
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
  | {
      type: "SET_CONFIGURATION";
      role: WardFlowRole;
      now: Instant;
      payload: unknown;
      baseConfiguration?: unknown;
      replaceAll?: boolean;
    }
  /**
   * ADD A PATIENT. The owner's flow: search for somebody, and if nobody comes up, add them.
   *
   * The person being added has never been referred, never moved and never arrived - which is the
   * whole reason this event exists rather than a patient falling out of one of those. A record
   * created by arrival is correct on every screen showing admitted people and absent at exactly the
   * moment the flow describes. Identity lives on `Patient` alone (PD-1, 2026-08-30). WT-05: optional
   * `sex` is checked like `gender`. H-0372: optional `demoToday` (YYYY-MM-DD) is the caller's demo
   * day, which can only tighten the reducer's future birth date check.
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
      registrationScope?: import("./ward-patient-registration").PatientRegistrationScope;
      role: WardFlowRole;
      now: Instant;
      umrn: string;
      givenName: string;
      familyName: string;
      dateOfBirth: string;
      demoToday?: string;
      gender?: Gender;
      sex?: string;
      suburb?: string;
    }
  | {
      type: "FLAG_MOVEMENT_TURNAROUND_PRIORITY";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      unitId: string;
      /** The displayed source, revalidated by the reducer; omission keeps the default source selection. */
      source?: "cld" | "departure";
    }
  | {
      type: "FLAG_REFERRAL_TURNAROUND_PRIORITY";
      role: WardFlowRole;
      now: Instant;
      referralId: string;
      unitId: string;
      source?: "cld" | "departure";
    }
  | {
      /**
       * Smart features idea 3 (19 Oct 2026): the addressed ward opened this referral. Stamps
       * `ReferralAddressing.openedAt` once, so the sender sees "Opened by <ward>". A receipt, not an
       * answer: no state moves and the decision clock keeps running. Raised for one ward's own copy:
       * by that ward, or by the coordinator on its behalf (every action is the coordinator's, Josh
       * 10 Oct 2026). Screens raise it only when the ward itself shows the referral.
       */
      type: "MARK_REFERRAL_OPENED";
      role: WardFlowRole;
      now: Instant;
      referralId: string;
      unitId: string;
      actingUnitId: string;
    }
  | {
      /**
       * Smart features idea 4 (19 Oct 2026): a ward asks for items from a fixed list before it
       * decides. Each item is membership-checked; none is typed. Does not decide the referral and
       * does not stop the decision clock. The ward for its own copy, or the coordinator for any ward.
       */
      type: "REQUEST_REFERRAL_INFORMATION";
      role: WardFlowRole;
      now: Instant;
      referralId: string;
      unitId: string;
      /** The ward's own claim, refused when it is not `unitId`. Absent for the coordinator. */
      actingUnitId?: string;
      needs: readonly ReferralInformationNeed[];
    }
  | ({
      /** Smart features idea 4: the referrer or the coordinator ticks off one item a ward asked for. */
      type: "MARK_REFERRAL_INFORMATION_MET";
      role: WardFlowRole;
      now: Instant;
      referralId: string;
      need: ReferralInformationNeed;
    } & (
      | {
          /** The named ward's existing request. This is a destination, not the sender's acting place. */
          wardUnitId: string;
          allRequestingWards?: never;
        }
      | {
          /** Sender privacy: supply this category to all current eligible requests without recipient IDs. */
          allRequestingWards: true;
          wardUnitId?: never;
        }
    ))
  | {
      /**
       * Fix plan item 4 (Josh, 21 Oct 2026): assign a front-door referral to the desk chasing it.
       * Appends to `Referral.ownerHistory`; the last entry is the owner. A desk, never a person.
       * The coordinator assigns to any desk in `REFERRAL_OWNER_DESKS`; an ED or community desk
       * takes a referral only for itself. Not a lock: anyone can still act on the referral.
       */
      type: "ASSIGN_REFERRAL";
      role: WardFlowRole;
      now: Instant;
      referralId: string;
      owner: ReferralOwnerDesk;
    }
  | {
      /**
       * Fix plan item 4: log a call made about a referral. Records who was rung (a ward, a community
       * team or the referrer), what they said from a closed list, the time and the calling desk.
       * Never typed. A call never answers the referral or stops its decision clock; a ward's answer
       * is still `ACCEPT_REFERRAL` or `DECLINE_REFERRAL`. Replaces the unwired "Call" button.
       * `contact` names the place rung, not a place the sender acts from, so it sits in its own
       * object rather than a top-level `unitId`.
       */
      type: "LOG_REFERRAL_CONTACT";
      role: WardFlowRole;
      now: Instant;
      referralId: string;
      contact: ReferralContactTarget;
      outcome: ReferralContactOutcome;
    }
  // ── Closing-the-loop package A (24 Oct 2026): response commitments ──
  | {
      /**
       * Record a commitment on one ward's copy of a referral still waiting on its answer: a step
       * from `REFERRAL_COMMITMENT_STEPS` (response requested, acknowledged, promised by a time,
       * resolved), a next callback time, or both. Appends to `ReferralAddressing.commitments`.
       * Steps only move forward; a promise may be re-recorded with a new time. The coordinator
       * records any step; a ward records acknowledged or promised for its own copy. Never typed,
       * never an answer: `state` and the decision clock are untouched.
       */
      type: "RECORD_REFERRAL_COMMITMENT";
      role: WardFlowRole;
      now: Instant;
      referralId: string;
      unitId: string;
      /** The ward's own claim, refused when it is not `unitId`. Absent for the coordinator. */
      actingUnitId?: string;
      step?: ReferralCommitmentStep;
      /** Required with `step: "promised"`, refused otherwise. */
      promisedFor?: Instant;
      nextCallbackAt?: Instant;
    }
  | {
      /**
       * Smart features idea 7 (19 Oct 2026): close a whole ward to new admissions. Sets
       * `Unit.isClosed` and `Unit.admissionsClosure`. `reason` is chosen from `WARD_CLOSURE_REASONS`,
       * never typed; `until` is an expected reopening that only prompts. Existing holds and
       * acceptances stand. The ward for itself, or the coordinator for any ward.
       */
      type: "CLOSE_WARD_TO_ADMISSIONS";
      role: WardFlowRole;
      now: Instant;
      unitId: string;
      /** The ward's own claim, refused when it is not `unitId`. Absent for the coordinator. */
      actingUnitId?: string;
      reason: WardClosureReason;
      until?: Instant;
    }
  | {
      /** Smart features idea 7: a person reopens a closed ward to admissions. Never automatic. */
      type: "REOPEN_WARD_TO_ADMISSIONS";
      role: WardFlowRole;
      now: Instant;
      unitId: string;
      actingUnitId?: string;
    }
  | {
      /** H-0978 / WS-15: close or reopen one empty bed (`Unit.closedBeds`), see ward-flow-bed-closure-events.ts. */
      type: "SET_BED_CLOSED";
      role: WardFlowRole;
      now: Instant;
      unitId: string;
      actingUnitId: string; // Claim-not-proof pair, as for CONFIRM_CAPACITY. `reason` is from WARD_CLOSURE_REASONS.
      bedNumber: number;
      closed: boolean;
      reason?: WardClosureReason;
    }
  | {
      /**
       * Smart features idea 5 (19 Oct 2026): the bed meeting chair records an agreed action against
       * a bed request or a stay. `action` is chosen from `BED_MEETING_ACTION_KINDS`, `owner` from
       * `BED_MEETING_ACTION_OWNERS`; nothing typed. A task for a person, never a change to the
       * record it is about. The coordinator only.
       */
      type: "RECORD_BED_MEETING_ACTION";
      role: WardFlowRole;
      now: Instant;
      subject: BedMeetingSubject;
      action: BedMeetingActionKind;
      owner: BedMeetingActionOwner;
      /** The owning ward. Required when `owner` is `ward`. */
      unitId?: string;
      dueAt: Instant;
    }
  | {
      /**
       * Smart features idea 5: the open action of this kind is done. The coordinator, or the owner
       * (a ward only for its own action, by `actingUnitId`).
       */
      type: "COMPLETE_BED_MEETING_ACTION";
      role: WardFlowRole;
      now: Instant;
      subject: BedMeetingSubject;
      action: BedMeetingActionKind;
      actingUnitId?: string;
    }
  // D-72 (21 Oct 2026): seclusion, restraint and incidents, operational only.
  | RestrictivePracticeWardFlowEvent
  // Closing the loop, package D (24 Oct 2026): cancelled-move checks, acceptance conditions,
  // restriction reviews and closure transition marks. Records only.
  | LoopCheckWardFlowEvent
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
      /**
       * Audit 24-7 (CT-06): the pull an Undo was offered for — the unit and the index of its
       * `to: "pulled"` entry in `stageChanges`. When given, the release is refused unless that entry
       * is still the movement's latest stage change at that unit, so an Undo never releases a
       * different pull made since. Absent for every other caller, which behave as before.
       */
      expectedPull?: { unitId: string; stageIndex: number };
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
      /** Audit fix (13 Oct 2026): booked with a check open (status differs from Legal now), and why. */
      exception?: TransportExceptionInput;
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
      /** D-74: follow-up or assess for admission. The ED form always sends it; absent reads as follow-up. */
      purpose?: CommunityReferralPurpose;
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
      /** Optional reason the discharge delay blocker was cleared, from `DISCHARGE_DELAY_CLEAR_REASONS`. */
      reason?: DischargeDelayClearReason;
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
      /**
       * Absent without leave (owner approval 9 Oct 2026). The stay's bed stays held: an existing
       * leave becomes an absence, or a held bed is created for a stay that was on the ward. Ended by
       * `END_LEAVE_BED` when they return. Ids and the caller's role only, no typed text.
       */
      type: "RECORD_ABSENT_WITHOUT_LEAVE";
      role: WardFlowRole;
      now: Instant;
      admissionId: string;
      /** Same claim-not-proof discipline as `RECORD_LEAVE_BED`'s own field. */
      actingUnitId: string;
    }
  | {
      /** One missing person step, chosen from `ABSENCE_STEPS`, recorded as done at `now`. */
      type: "RECORD_ABSENCE_STEP";
      role: WardFlowRole;
      now: Instant;
      admissionId: string;
      actingUnitId: string;
      step: AbsenceStep;
    }
  | {
      /** A community treatment order (Form 5A) recorded in force on the patient record. No lapse time (D5). */
      type: "RECORD_COMMUNITY_TREATMENT_ORDER";
      role: WardFlowRole;
      now: Instant;
      patientId: PatientId;
    }
  | {
      /** A person records that the community treatment order has ended. */
      type: "END_COMMUNITY_TREATMENT_ORDER";
      role: WardFlowRole;
      now: Instant;
      patientId: PatientId;
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
      /** Opaque client correlation only; never patient text. */
      submissionId?: string;
      intake?: import("./referrals/referral-submission").ReferralIntakeDetails;
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
      /** The ward raising it, when the role is `ward`. The reducer refuses a ward caller unless this
       *  matches `originUnitId`, so a ward sends only in its own name. */
      actingUnitId?: string;
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
      atsCategory?: AtsCategory;
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
      type: "HOLD_REFERRAL_BED";
      role: WardFlowRole;
      now: Instant;
      referralId: string;
      unitId: string;
      actingUnitId: string;
      bedNumber: number;
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
      /**
       * v10 pass 2 (ward Bed board "Place here"): the bed, 1 to `Unit.beds`, the ward places this
       * referral in. Only for a `psychiatric_ward` answer naming `unitId`; refused when out of range
       * or when a current stay on that unit is already recorded in that bed. Kept on the accepted
       * addressing as `heldBedNumber`.
       */
      bedNumber?: number;
      /** B1: a ward answering names itself; refused when it answers for another ward. The
       *  coordinator acts for any ward and sends none. */
      actingUnitId?: string;
      /** Optional fields for reassessment of clinical decisions */
      clinicalUpdate?: boolean;
      reassessment?: boolean;
      clearanceUpdated?: boolean;
      reassessmentNote?: string;
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
      /** Keep a targeted ward request live when explicitly waitlisting for a bed. */
      waitlist?: boolean;
      /** Required to answer one of several explicitly addressed wards. */
      unitId?: string;
      /** B1: as `ACCEPT_REFERRAL.actingUnitId`. */
      actingUnitId?: string;
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
      actingUnitId?: string;
      actingPlaceId?: string;
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
      actingPlaceId?: string;
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
       * A STAY-LEVEL DISCHARGE BLOCKER: WHAT IS HOLDING THIS PATIENT'S DISCHARGE UP, BEFORE ANY
       * BED RELEASE EXISTS.
       *
       * Writes `Admission.blockReason` and nothing else. `BLOCK_BED_RELEASE` needs a pending
       * release; a ward often knows the discharge is stuck before anybody has flagged the bed, and
       * until this event the bed dossier could only show that for the open tab. It moves no
       * capacity figure and no bed stage.
       *
       * `blocker` is chosen from `BED_RELEASE_BLOCKERS`, never typed - the same closed list the
       * release event uses, so the reasons cannot drift into two vocabularies. Only somebody
       * occupying a bed can have a discharge held up.
       */
      type: "RECORD_STAY_DISCHARGE_BLOCKER";
      role: WardFlowRole;
      now: Instant;
      /** The admission whose discharge is held up. */
      admissionId: string;
      /** Same claim-not-proof discipline as `RECORD_AWAY_AT_EMERGENCY_DEPARTMENT`. */
      actingUnitId: string;
      /** Chosen from `BED_RELEASE_BLOCKERS`; the reducer refuses anything else. */
      blocker: BedReleaseBlocker;
    }
  | {
      /** The other half: the stay's discharge is no longer held up. Refused when none is recorded. */
      type: "CLEAR_STAY_DISCHARGE_BLOCKER";
      role: WardFlowRole;
      now: Instant;
      admissionId: string;
      /** Same claim-not-proof discipline as the event above. */
      actingUnitId: string;
      /** Optional reason the discharge delay blocker was cleared, from `DISCHARGE_DELAY_CLEAR_REASONS`. */
      reason?: DischargeDelayClearReason;
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
      /** Required for non-coordinators; must match the originating ED or sending admission's unit. */
      actingPlaceId?: string;
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
       * ⚠️ **GATED TO `accepted_awaiting_bed` AND `pulled`, PLUS ANY EARLIER STAGE A MOVEMENT WAS
       * STEPPED BACK TO WHILE STILL HOLDING ITS BED** (owner answer Q16, 2026-09-16, widening ruling
       * 2 of 2026-09-04; such a movement keeps its stage). When a bed is held, the same act releases
       * the bed (as `RELEASE_PULL` does) and records both a
       * `pull_released` and an `acceptance_withdrawn` unwind; the referring ED is told as well as
       * the ward. Still refused from `handover_ready` on, where a patient may be moving, and while a
       * transport job is booked or the patient has been collected.
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
      /**
       * Stream A, 9 Oct 2026: the acting role takes ownership of an inbox row. Recorded as the
       * role's label (`WARD_FLOW_ROLE_LABELS`), never a person. Append-only history on
       * `WardFlowState.inboxOwnership`; refused when the same role already owns the row.
       */
      type: "TAKE_INBOX_ITEM_OWNERSHIP";
      role: WardFlowRole;
      now: Instant;
      inboxItemId: string;
    }
  | {
      /**
       * Stream A, 9 Oct 2026: hides an inbox row from the active list until `until`, with a
       * reason from the closed `SNOOZE_REASONS` list. The row returns by itself when `until`
       * passes. An act-now (red) row may not be snoozed past `RED_ROW_SNOOZE_CAP_MINUTES`; the
       * reducer refuses it. Snoozing never resolves the fact behind the row.
       */
      type: "SNOOZE_INBOX_ITEM";
      role: WardFlowRole;
      now: Instant;
      inboxItemId: string;
      until: Instant;
      reason: InboxSnoozeReason;
    }
  | {
      /** The undo for `SNOOZE_INBOX_ITEM`: returns a snoozed row to the active list now. Recorded, never a delete. */
      type: "UNSNOOZE_INBOX_ITEM";
      role: WardFlowRole;
      now: Instant;
      inboxItemId: string;
    }
  | {
      type: "SET_ARRIVAL_DETAILS";
      role: WardFlowRole;
      now: Instant;
      actingUnitId?: string;
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
      /** D-60: sets, ticks or clears a voluntary patient's discharge criteria. */
      type: "SET_DISCHARGE_CRITERIA";
      role: WardFlowRole;
      now: Instant;
      actingUnitId?: string;
      admissionId: string;
      /**
       * The chosen criteria in order, or null to clear them. A ward tick or change also lists the
       * stored patient specific criteria, which are typed text (D-65).
       */
      criteria: string[] | null;
      /** The chosen criteria now met. */
      met: string[];
      /** The ward records that the treating psychiatrist set this list. Needed to set or change it. */
      setByTreatingPsychiatrist: boolean;
      /**
       * D-65: typed patient specific criteria the treating psychiatrist set, added after the fixed
       * ones. A dispatch carrying typed criteria locks browser storage (`eventCarriesTypedTextPayload`).
       */
      patientSpecific?: string[];
      /** One criterion ticked or unticked, applied to the stored list rather than replacing it. */
      tick?: { criterion: string; met: boolean };
    }
  | {
      type: "RECORD_ED_MEDICAL_DETERIORATION";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
      /** Explicit originating ED identity; never defaulted. Pre-collection only. */
      actingPlaceId: string;
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
      /** The kind of file (H-0049). The file's name is never sent. */
      fileType?: UploadedFileType;
      /** Legacy events recorded before 26 Oct 2026 carry the file's name. It is read for its type and dropped. */
      fileName?: string;
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
      /** `null` clears a recorded band ("Not recorded"); omitted keeps it on a same-form time edit. */
      ageBand?: "adult" | "under_18" | null;
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
      /** Record that a team was contacted: the contact itself, not a sent message. Stores team, time and role. */
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
      /** Absent means a directive. `bed_call` asks wards a set question (10 Oct 2026). */
      kind?: "directive" | "bed_call";
    }
  | {
      /** Acknowledge receipt of an active statewide broadcast alert for a specific ward/unit. */
      type: "ACKNOWLEDGE_BROADCAST_ALERT";
      role: WardFlowRole;
      now: Instant;
      alertId: string;
      unitId: string;
    }
  | {
      /** Stand down an active broadcast directive once network pressure resolves. */
      type: "STAND_DOWN_BROADCAST_ALERT";
      role: WardFlowRole;
      now: Instant;
      alertId: string;
      stoodDownByRole?: WardFlowRole;
    }
  | {
      /**
       * Top 25 item 25: keep an active broadcast alert live for longer. The added time is the
       * fixed `DEFAULT_BROADCAST_EXTENSION_MINUTES`, never a typed value. Ids only.
       */
      type: "EXTEND_BROADCAST_ALERT";
      role: WardFlowRole;
      now: Instant;
      alertId: string;
    }
  | {
      /**
       * Global alerts, 10 Oct 2026: the coordinator asks the accepting ward (or the wards still
       * considering the referral) to pull one patient now. Ids only, no typed text.
       */
      type: "RAISE_PULL_NOW";
      role: WardFlowRole;
      now: Instant;
      movementId: string;
    }
  | {
      /**
       * A ward or ED desk answers a bed call or a Pull now from a fixed list. Every field is an id,
       * an enum, a whole number or an instant. Never typed text.
       */
      type: "REPLY_BROADCAST_ALERT";
      role: WardFlowRole;
      now: Instant;
      alertId: string;
      unitId: string;
      answer: BroadcastAnswer;
      beds?: number;
      readyAt?: Instant;
      reason?: ReferralDeclineReason;
    }
  | {
      /**
       * Book a known future admission (stream D, 9 October 2026). Names either an existing
       * synthetic patient or initials only, never both. `initials` is typed text, so this event is
       * on the typed-text persistence list. Holds no bed until `CONVERT_PLANNED_ADMISSION`.
       */
      type: "BOOK_PLANNED_ADMISSION";
      role: WardFlowRole;
      now: Instant;
      patientId?: PatientId | null;
      initials?: string | null;
      sex: RecordedSex;
      /**
       * Gender identity for an initials-only booking, picked by the person booking; absent means
       * not recorded. Ignored for a linked patient: the reducer takes `Patient.gender` instead.
       */
      gender?: ReferralGender;
      reason: PlannedAdmissionReason;
      unitId: string;
      expectedArrivalAt: Instant;
      expectedStayDays: number;
      legalStatus: LegalStatus;
      /** The age group booked for: from the record for a linked patient, recorded for initials. */
      ageBand: Cohort;
      /**
       * Audit 24-1 CS2-19: required, from `OVERRIDE_REASONS`, when the ward is not authorised for
       * involuntary admissions and the legal status needs one; ignored otherwise.
       */
      overrideReason?: OverrideReason;
      /**
       * The demo calendar's date at `now` ("yyyy-mm-dd", from `calendarDateOf(now, dayZero)`).
       * Required with `patientId`: the reducer holds no calendar, and refuses an `ageBand` that the
       * record's date of birth does not give on the expected arrival's date, counted from this one.
       * Not about the person; never displayed.
       */
      calendarDate?: string;
      /** Required when the caller is a ward: the ward it is booking for. */
      actingUnitId?: string;
    }
  | {
      /** Change a booked planned admission's ward, reason, arrival, stay, legal status or gender. */
      type: "CHANGE_PLANNED_ADMISSION";
      role: WardFlowRole;
      now: Instant;
      plannedAdmissionId: string;
      /**
       * A gender to record on an initials-only booking; absent keeps the booking's own. Ignored for
       * a linked patient, whose gender is always the record's.
       */
      gender?: ReferralGender;
      reason: PlannedAdmissionReason;
      unitId: string;
      expectedArrivalAt: Instant;
      expectedStayDays: number;
      legalStatus: LegalStatus;
      /** As on `BOOK_PLANNED_ADMISSION`: required when a linked booking's arrival moves to another day. */
      calendarDate?: string;
      /** As on `BOOK_PLANNED_ADMISSION`: the reason a change onto an unauthorised ward needs. */
      overrideReason?: OverrideReason;
      actingUnitId?: string;
    }
  | {
      /** Cancel a booked planned admission, with a reason chosen from a fixed list. */
      type: "CANCEL_PLANNED_ADMISSION";
      role: WardFlowRole;
      now: Instant;
      plannedAdmissionId: string;
      /** The booking's own ward, so bed history finds the event; refused if it is not the booking's. */
      unitId: string;
      reason: PlannedAdmissionCancelReason;
      actingUnitId?: string;
    }
  | {
      /**
       * The planned person has arrived: the booking becomes an ordinary occupied `Admission` on its
       * ward, taking one empty and allocatable bed. Refused when the ward has no bed to give.
       */
      type: "CONVERT_PLANNED_ADMISSION";
      role: WardFlowRole;
      now: Instant;
      plannedAdmissionId: string;
      /** The booking's own ward, so bed history finds the event; refused if it is not the booking's. */
      unitId: string;
      actingUnitId?: string;
    }
  | {
      /**
       * Advisory checklist (9 Oct 2026): records that a carer, personal support person or the
       * Mental Health Advocacy Service was told about an involuntary patient's admission, transfer
       * or discharge, or that it does not apply. A record of what a person says happened; nothing
       * here decides whether a notice is legally required or when. See `ward-support-notifications.ts`.
       *
       * 🔴 `who` and `reason` are typed text, so this event is on the typed-text persistence list.
       */
      type: "RECORD_SUPPORT_NOTIFICATION";
      role: WardFlowRole;
      now: Instant;
      occasion: SupportNotificationOccasion;
      /** The arriving movement, for an admission or transfer. Named so the event log and history link it. */
      movementId?: string;
      /** The discharged stay, for a discharge. */
      admissionId?: string;
      party: SupportNotificationParty;
      outcome: SupportNotificationOutcome;
      /** Who was told. Required, non-blank, when `outcome` is `told`. */
      who?: string;
      /** When they were told. Defaults to `now`; never after `now`. */
      contactedAt?: Instant;
      /** Why it does not apply. Required, non-blank, when `outcome` is `not_applicable`. */
      reason?: string;
    }
  // #398, the arrival checklist (D-72) and Ask more wards (D-76): declared beside their reducer cases.
  | ReleaseNoticeEvent
  | ArrivalCheckEvent
  // Closing-the-loop package B (24 Oct 2026): discharge dependencies and plan changes.
  | import("./discharges/discharge-dependency-events").DischargeDependencyEvent
  | ObservationLevelEvent
  | RecordWardDiagnosisEvent
  | import("./ward-flow-referral-ask-events").ReferralAskEvent
  // Closing-the-loop (package E): return requested vs home service agreed.
  | import("./out-of-area/home-service-return").HomeServiceReturnEvent
  // Closing-the-loop (package E): an on-call directory entry checked now.
  | import("./on-call/on-call-checks").DirectoryCheckEvent
  /*
   * v10 pass 2 (Josh, 10 Oct 2026): the build guide's "Toast with Undo". Each undo is a proper,
   * role-gated, audited event that restores the state its decision changed EXACTLY, and only within
   * `UNDO_WINDOW_MINUTES` (`ward-undo.ts`) of the decision and only while nothing has changed it
   * since. Who made the decision may undo it, and the coordinator may undo anyone's. None carries
   * typed text.
   */
  | {
      /** Takes back the newest `ACCEPT_REFERRAL` or `DECLINE_REFERRAL` on this referral. */
      type: "UNDO_REFERRAL_DECISION";
      role: WardFlowRole;
      now: Instant;
      /** The record number of the step this Undo is for; a newer one on the same subject refuses it. */
      recordSeq?: number;
      referralId: string;
      /** A ward undoing its own decision names itself; refused when it is not the unit that answered. */
      actingUnitId?: string;
    }
  | {
      /** Takes back one `REVIEW_AUDIT_EVENT` review (the newest on its captured event). */
      type: "UNDO_AUDIT_REVIEW";
      role: WardFlowRole;
      now: Instant;
      reviewId: string;
      expectedGeneration: number;
    }
  | {
      /** The ward Bed board's pick up and place: puts a stay in a numbered bed on its own unit. */
      type: "PLACE_IN_BED";
      role: WardFlowRole;
      now: Instant;
      admissionId: string;
      /** 1 to `Unit.beds`, and not a bed another current stay on the unit is recorded in. */
      bedNumber: number;
      /** A ward names itself and may only place stays on its own unit. */
      actingUnitId?: string;
      /** Audit CS3-12: why a stay needing a locked bed may move to an open one. */
      overrideReason?: OverrideReason;
    }
  | {
      /** Returns the stay to the bed (or no recorded bed) it had before the newest `PLACE_IN_BED`. */
      type: "UNDO_PLACE_IN_BED";
      role: WardFlowRole;
      now: Instant;
      /** The record number of the step this Undo is for; a newer one on the same subject refuses it. */
      recordSeq?: number;
      admissionId: string;
      actingUnitId?: string;
    }
  /*
   * v10 pass 3 (Josh, 10 Oct 2026): the undoable steps (`UNDO_STEP_ACTIONS`, `ward-undo.ts`). Each
   * takes back the newest of its listed actions on the subject it names, exactly, under the same
   * three rules. Ids and instants only.
   */
  | {
      /** Takes back the newest `REFER_TO_UNITS` on this movement (Home's Offer). */
      type: "UNDO_REFER_TO_UNITS";
      role: WardFlowRole;
      now: Instant;
      /** The record number of the step this Undo is for; a newer step on the same subject refuses it. */
      recordSeq?: number;
      movementId: string;
    }
  | {
      /** Takes back the newest `ACCEPT_IN_PRINCIPLE` on this movement, its held bed with it. */
      type: "UNDO_ACCEPT_IN_PRINCIPLE";
      role: WardFlowRole;
      now: Instant;
      /** The record number of the step this Undo is for; a newer step on the same subject refuses it. */
      recordSeq?: number;
      movementId: string;
      /** A ward undoing its own acceptance names itself. */
      actingUnitId?: string;
    }
  | {
      /** Takes back the newest `RECORD_LEGAL_FORM_WRITTEN` or `RECORD_LEGAL_FORM_RECEIVED` on this movement. */
      type: "UNDO_LEGAL_FORM_RECORD";
      role: WardFlowRole;
      now: Instant;
      /** The record number of the step this Undo is for; a newer step on the same subject refuses it. */
      recordSeq?: number;
      movementId: string;
    }
  | {
      /** Takes back the newest Tell record (`RECORD_SUPPORT_NOTIFICATION`) on this move or stay. */
      type: "UNDO_SUPPORT_NOTIFICATION";
      role: WardFlowRole;
      now: Instant;
      /** The record number of the step this Undo is for; a newer step on the same subject refuses it. */
      recordSeq?: number;
      movementId?: string;
      admissionId?: string;
    }
  | {
      /** Takes back the newest `RECORD_REPATRIATION` on this stay. */
      type: "UNDO_REPATRIATION";
      role: WardFlowRole;
      now: Instant;
      /** The record number of the step this Undo is for; a newer step on the same subject refuses it. */
      recordSeq?: number;
      admissionId: string;
    }
  | {
      /** Takes back the newest handover sign-off. */
      type: "UNDO_HANDOVER_SIGN_OFF";
      role: WardFlowRole;
      now: Instant;
      /** The record number of the step this Undo is for; a newer step on the same subject refuses it. */
      recordSeq?: number;
    }
  | {
      /**
       * Takes back the newest ED board step on this movement or referral: arrived in the
       * department, examination, medical clearance, transport need or handover ready.
       */
      type: "UNDO_ED_STEP";
      role: WardFlowRole;
      now: Instant;
      /** The record number of the step this Undo is for; a newer step on the same subject refuses it. */
      recordSeq?: number;
      movementId?: string;
      referralId?: string;
    }
  | {
      /** Takes back the newest transport stage step (accepted, en route, collected, arrived). */
      type: "UNDO_TRANSPORT_STEP";
      role: WardFlowRole;
      now: Instant;
      /** The record number of the step this Undo is for; a newer step on the same subject refuses it. */
      recordSeq?: number;
      movementId: string;
      /** A ward undoing its own recorded arrival names itself. */
      actingUnitId?: string;
    }
  | {
      /** Takes back the newest recorded departure ("Has left") of this stay (audit A1-12). */
      type: "UNDO_DEPARTURE";
      role: WardFlowRole;
      now: Instant;
      /** The record number of the step this Undo is for; a newer step on the same subject refuses it. */
      recordSeq?: number;
      admissionId: string;
      /** A ward undoing its own recorded departure names itself. */
      actingUnitId?: string;
    }
  | {
      /** Takes back the newest `RECORD_ABSENT_WITHOUT_LEAVE` on this stay (audit A3-10, 13 Oct 2026). */
      type: "UNDO_ABSENT_WITHOUT_LEAVE";
      role: WardFlowRole;
      now: Instant;
      /** The record number of the step this Undo is for; a newer step on the same subject refuses it. */
      recordSeq?: number;
      admissionId: string;
      /** A ward undoing its own record names itself. */
      actingUnitId?: string;
    }
  | UndoBedMeetingActionEvent
  | ArchivePatientEvent;

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
