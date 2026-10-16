import { referralIntakeError } from "./referrals/referral-submission";
import { transportExceptionRecord } from "@/components/ward-management/ward-transport-checks";
import { recordedMovementMedicalClearance } from "./ward-medical-clearance";
import { withoutRecordNumbers, withUmrnInPlaceOfMovementIds } from "./ward-patient-resolver";
import {
  validCareChange,
  careChangeRefusal,
  applyCareChange,
  emptyCareJourney,
  recordedCommunityTransition,
} from "./ward-care-journey";
import {
  appendAudit,
  classifyAuditEvent,
  finiteInstant,
  governanceAuditEvents,
  reviewDecision,
  type AuditDecision,
  type WardAuditState,
} from "./ward-audit";
import {
  undoWindowRefusal,
  withUndoRecord,
  type UndoRecord,
  diffForStepUndo,
  nextStepUndoSeq,
  undoStepSubjectId,
  undoStepTypeFor,
  type StepUndo,
  type UndoStepType,
} from "./ward-undo";
import {
  dischargeIdentity,
  readOpenedDischargeRecord,
  safeCounter,
  selectDischargeRecord,
  uniqueRecord,
  validRecordActor,
  type WardRecordActor,
} from "./ward-discharge-records";
import {
  isDischargeBarrier,
  isLeavingDestination,
  isFollowUpState,
  daysInBed,
  PLANNED_ADMISSION_CANCEL_REASONS,
  PLANNED_ADMISSION_REASONS,
  type LeavingDestination,
} from "./ward-admissions";
import { lockedBedsFree, openBedsFree } from "@/components/ward-management/ward-bed-designation";
import type { Instant } from "@/components/ward-management/ward-clock";
import { type BroadcastAlert } from "./alerts/ward-broadcast-model";
import { reduceBroadcastAlertEvent } from "./alerts/ward-broadcast-reducer";
import { reducePlannedAdmissionEvent } from "./capacity/planned-admissions-reducer";
import { reduceInboxEvent } from "./ward-inbox-reducer";
import { type RecordedFactEventHelpers, reduceRecordedFactEvent } from "./ward-flow-record-events";
import { type UndoEventHelpers, reduceUndoEvent } from "./ward-flow-undo-events";
import type { InboxOwnershipEntry, InboxSnoozeEntry } from "./ward-inbox-snooze";
import {
  BED_PREPARATION_NOTES,
  BED_RELEASE_BLOCKERS,
  type BedReleaseBlocker,
  CANCEL_TRANSPORT_REASONS,
  DISCHARGE_DELAY_CLEAR_REASONS,
  type DischargeDelayClearReason,
  LEGAL_FORM_RECEIPT_CORRECTION_REASONS,
  LEGAL_STATUS_CHANGE_REASONS,
  RELEASE_PULL_REASONS,
  STOP_TRANSPORT_REASONS,
  TRANSPORT_WHEREABOUTS,
  URGENCY_CHANGE_REASONS,
  URGENT_MARK_REASONS,
  GENDER_PLACEMENT_REASONS,
  GENDER_PLACEMENT_REFUSAL,
  GENDER_NO_LONGER_SUITS_REFUSAL,
  GENDER_NO_LONGER_SUITS_NON_BINARY_REFUSAL,
  OVERRIDE_REASONS,
  REFERRAL_CAP_REASONS,
  WARD_REQUEST_WITHDRAWAL_REASONS,
  wardRequestWithdrawalReasonLabels,
} from "@/components/ward-management/ward-change-reasons";
import {
  candidateReason,
  eligibility,
  adjustSexMix,
  mixSexOf,
  referralEligibility,
  type EligibilityGate,
} from "@/components/ward-management/ward-eligibility";
import {
  COMMUNITY_DECLINE_REASON_LABELS,
  DECLINE_REASON_LABELS,
  referralState,
  referralSuburbIsAnswered,
  wardTransferNeedsCoordinator,
} from "@/components/ward-management/ward-referrals";
import {
  EVENT_ROLE,
  WARD_BUZZ_MESSAGES,
  WARD_FLOW_ROLE_LABELS,
  type RepatriationMode,
  type WardFlowEvent,
  type OverridableWardFlowEvent,
  type WardFlowRole,
} from "@/components/ward-management/ward-flow-events";
import { SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import {
  ARRIVAL_LATE_AFTER_MINUTES,
  WAITLIST_INSTEAD_OF_DECLINE_REASONS,
  GENDER_MISMATCH_DECLINE_REASON,
  isArrivalLate,
  leaveBedNeedsOpenWarning,
} from "@/components/ward-management/ward-legal-clock";
import { isTentativeDiagnosisBlock } from "@/components/ward-management/ward-diagnosis";
import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";
import { communityTeamById, communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import {
  BLOCKERS_MEANING_NOTHING_IS_BLOCKING,
  BED_RELEASE_WAITING_ON,
  type ClinicalReassessmentEntry,
  COHORTS,
  COMMUNITY_DECLINE_REASONS,
  DECLINE_REASONS,
  ED_DECLINE_REASONS,
  HOME_REGIONS,
  MOVEMENT_STAGES,
  REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS,
  REFERRAL_DECLINE_REASONS,
  REFERRAL_HISTORY_LIMITS,
  SENDING_TEAM_NAME_LIMIT,
  type CommunityDeclineReason,
  type ReferralCorrection,
  type ReferralHistoryField,
  REFERRAL_SOURCES,
  RECORDED_SEXES,
  genderReviewNeeded,
  REFERRAL_GENDERS,
  REFERRAL_DESTINATION_KINDS,
  REFERRAL_PURPOSES,
  STEP_BACK_REASONS,
  type ReferralAddressing,
  type ReferralDeclineReason,
  TRANSPORT_LEGAL_STATUSES,
  TRANSPORT_PROVIDERS,
  OVERRIDE_SIGN_OFF_NAME_MAX,
  type OverrideSignOff,
  URGENCY_LEVELS,
  type CapacityRefreshRequest,
} from "@/components/ward-management/ward-model";
import type {
  MovementId,
  Addressee,
  BedRelease,
  LeaveBed,
  Movement,
  MovementStage,
  Notice,
  NoticeKind,
  Referral,
  WardReferralDestination,
  ReferralDestinationKind,
  Rejection,
  TransportLegalStatus,
  TransportProvider,
  Unit,
} from "@/components/ward-management/ward-model";
import {
  defaultWardConfiguration,
  describeInvalidConfiguration,
  validateConfiguration,
  type WardConfiguration,
} from "@/components/ward-management/ward-configuration";
import {
  bedReleases,
  generatedMovementPatients,
  leaveBeds,
  referrals,
  wardMovements,
} from "@/components/ward-management/ward-movements";
import { applyRulingsDemoOverlay } from "@/components/ward-management/ward-rulings-demo";
import { bedsPendingPreparation, openBedsNow } from "@/components/ward-management/ward-bed-availability";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import {
  WARD_SCENARIOS,
  scenarioNetwork,
  scenarioUnits,
  type WardScenario,
} from "@/components/ward-management/ward-scenarios";
import { shiftInstants } from "@/components/ward-management/ward-reanchor";
import {
  remainingHighAcuityCapacity,
  remainingSpeciallingCapacity,
  bedIsOccupied,
  type Admission,
  type PlannedAdmission,
} from "@/components/ward-management/ward-admissions";
import { GENDERS } from "@/components/ward-management/ward-patients";
import type { Patient } from "@/components/ward-management/ward-patients";
import { combineWardPatients } from "@/components/ward-management/ward-patients-seed";
import {
  generatedOccupantPatients,
  wardAdmissions,
  wardPlannedAdmissions,
} from "@/components/ward-management/ward-admissions-seed";

/**
 * Every seeded person: the hand-authored patients plus the generated ones the admission and
 * movement seeds name (owner rule: every record belongs to a patient who exists). A person on both
 * a pulled bed and its movement is listed once.
 */
const wardPatients: Patient[] = [
  ...new Map(
    combineWardPatients(generatedOccupantPatients, generatedMovementPatients).map((patient) => [patient.id, patient]),
  ).values(),
];
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { withDemoPlannedMoveTimes } from "@/components/ward-management/ward-demo-planned-moves";
import { withDemoStageTimes } from "@/components/ward-management/ward-demo-stage-times";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";
import { type SupportNotificationRecord } from "@/components/ward-management/ward-support-notifications";

/**
 * Stages `REFER_TO_UNITS` accepts, exported so a UI can pre-check referability before dispatching
 * rather than claiming a referral that the reducer then refuses. Shared with
 * `ward-derivations.ts`'s `referralBlockedReason` so the two checks cannot drift.
 */
export const REFERRABLE_MOVEMENT_STAGES: readonly MovementStage[] = ["placement_requested", "destination_review"];

/**
 * What the reducer writes into `Movement.blocker` (the free-prose field, not the
 * `BedRelease.blocker` enum) when a movement's situation changes.
 *
 * The property is "never contradicted by the record beside it", not "never older than the stage". A
 * transition restates the blocker only where it has just been told something the standing sentence
 * contradicts; `PULL_PATIENT` and `HANDOVER_READY` deliberately leave a ward's own observation in
 * place.
 *
 * These sentences restate only what the model has been told and invent no fact about a ward, person
 * or provider; richer prose is only ever written by `RECORD_MOVEMENT_BLOCKER`. A human's prose is
 * overwritten by the next transition by design. The seed is not derived from this table and must
 * not be: a stage does not determine this field.
 *
 * `hasActiveBlocker` (ward-priority.ts) must recognise every "nothing is blocking" phrasing here as
 * inactive; they all use the `"None — …"` shape it matches.
 */
export const STAGE_TRANSITION_BLOCKERS = {
  /** `REFER_TO_UNITS`: referrals are live and nobody has answered yet. */
  referred: "Awaiting destination response",
  /** `ACCEPT_IN_PRINCIPLE`: a unit has accepted; the bed itself is what is outstanding. */
  accepted: "Awaiting a bed at the accepting ward",
  /** `BOOK_TRANSPORT`: a job exists and the provider has not accepted it. */
  transportBooked: "Awaiting a transport provider response",
  /**
   * `CANCEL_TRANSPORT`, bed-held branch only (owner answer 30): "no automatic rebooking; a person
   * books again." An active blocker: somebody still has to book again.
   */
  transportCancelled: "Transport cancelled; not booked again yet",
  /**
   * `TRANSPORT_ACCEPTED`: the provider answered (`transport.acceptedAt` set) and has not set off.
   */
  transportAccepted: "Awaiting the transport provider's departure",
  /**
   * `TRANSPORT_EN_ROUTE`: `enRouteAt` set, `collectedAt` not. Active, because nobody has been
   * collected yet.
   */
  transportEnRoute: "Awaiting collection — transport is en route",
  /**
   * `PATIENT_COLLECTED`. Reuses the seed's own wording verbatim so the fixture and reducer never
   * describe one situation with two sentences.
   */
  collected: "None — in transit",
  /** `PATIENT_ARRIVED`. The seed's other absence-with-reason value, again verbatim. */
  arrived: "None — handover complete",
  /** `RECORD_EXAMINATION` and `WITHDRAW_REFERRAL`, the two closures that are not an arrival.
   *  Nothing is blocking because there is no longer anything to block. */
  didNotProceed: "None — the movement did not proceed",
  /**
   * `RECORD_EXAMINATION` (`community_order`/`revoked`) at `handover_ready` or `moving` (owner
   * ruling WLQ-4). The movement stays open here, so this describes an active situation.
   */
  examinationRevokedAwaitingRelease: "Awaiting a coordinator to release the bed, because the examination was revoked",
  /**
   * `WITHDRAW_WARD_REQUEST` (RA1), only when it empties `referredUnitIds`. Deliberately not "None —
   * …": a fresh `REFER_TO_UNITS` is outstanding, so `hasActiveBlocker` must keep scoring it as
   * active. Withdrawing one ward while others stay live does not touch `blocker`.
   */
  wardRequestWithdrawn: "No ward is being asked",
  /**
   * `STOP_TRANSPORT` (owner answer 8): "A stop after collection keeps the bed held until the
   * coordinator, the ward or the referrer releases it." The movement closes `did_not_proceed` but
   * the bed stays reserved. Active: `RELEASE_HELD_BED`, and only it, clears it.
   */
  transportStoppedAwaitingRelease:
    "Awaiting the coordinator, the ward or the referrer to release the bed, because transport was stopped",
  /**
   * `RECORD_DIVERSION` (OA-29): a collected journey was diverted; the bed stays held and the
   * movement open until `RELEASE_DIVERTED_BED`. Active: a release decision is outstanding.
   */
  divertedAwaitingRelease:
    "Awaiting the coordinator, the ward or the referrer to release the bed, because the patient was diverted",
} as const;

/**
 * Units live in state, not just movements: a ward whose capacity never moves as it accepts, holds
 * and receives patients makes the primary screen less true the more it is used.
 */
export type WardFlowState = WardAuditState & {
  dischargeRevisions: Record<string, number>;
  movements: Movement[];
  units: Unit[];
  /** Refused transitions, newest first. */
  rejections: Rejection[];
  /** Demo jump-forward control. `now` is NOW_ANCHOR + elapsed + this offset, derived outside the reducer. */
  clockOffsetMinutes: number;
  /** Deterministic id source for referrals raised through RAISE_REFERRAL. No Math.random(). */
  referralSequence: number;
  /**
   * Monotonic id source for leave beds raised through `RECORD_LEAVE_BED`. Never derived from
   * `leaveBeds.length`: `END_LEAVE_BED` removes entries, so a length-derived id would repeat and
   * the id-filter would delete the wrong record. No `Math.random()`.
   */
  leaveBedSequence: number;
  /** Which synthetic night is seeded — `ward-scenarios.ts`'s operational-numbers-only variants. */
  scenario: WardScenario;
  /**
   * Beds expected to free up. `FLAG_BED_RELEASE` appends here, so a ward's flag moves
   * `unitCapacity()`'s `potential` figure. Seeded from `ward-movements.ts`'s `bedReleases`.
   */
  bedReleases: BedRelease[];
  /**
   * Beds occupied by someone on approved leave. `RECORD_LEAVE_BED`/`END_LEAVE_BED` append and
   * remove. Seeded from `ward-movements.ts`'s `leaveBeds`. Never merged into availability (spec
   * D4).
   */
  leaveBeds: LeaveBed[];
  /**
   * Spec D12: the one thing a coordinator may do to a ward's bed data. A request changes no bed
   * figure; it records who asked and when. `REQUEST_CAPACITY_REFRESH` appends here.
   */
  refreshRequests: CapacityRefreshRequest[];
  /** Morning bed rollup confirmations per unit. */
  morningRollupConfirmations: Record<
    string,
    { confirmedAt: Instant; confirmedByRole: string; expectedDischarges: number }
  >;
  /**
   * Front-door referrals. `RECEIVE_REFERRAL` appends; `ACCEPT_REFERRAL`/`DECLINE_REFERRAL`
   * transition an entry in place via `replaceReferral`. Nothing ever removes a referral. Seeded
   * from `ward-movements.ts`'s `referrals`.
   */
  referrals: Referral[];
  /**
   * Monotonic id source for `RECEIVE_REFERRAL` ("RF-9NN"), never derived from `referrals.length`.
   * Kept separate from `referralSequence`, which mints `Movement` ids ("WF-9NN") for
   * `RAISE_REFERRAL`: the two are different concepts and their id supplies stay uncoupled.
   */
  frontDoorReferralSequence: number;
  /**
   * The people in the beds. Without an admission record, a patient who reached a ward became only a
   * closed movement and disappeared from every screen. Seeded from `ward-admissions-seed.ts`; an
   * arrival appends a record of the same shape.
   *
   * The people themselves (owner ruling PD-1). Separate from `admissions` because the lifecycles
   * differ: an admission is one stay in one bed, while a patient exists before any referral and
   * outlives every admission ("search a patient, and if nobody comes up, ADD them").
   */
  patients: Patient[];
  /** Monotonic id source for added patients - same discipline as the other sequences here: only
   *  ever increases, never derived from `state.patients.length`, which the seed makes non-zero. */
  patientSequence: number;
  admissions: Admission[];
  /**
   * Monotonic id source for admissions created by arrival; never derived from `admissions.length`,
   * which the seed already makes non-zero.
   */
  admissionSequence: number;
  /**
   * Who has acknowledged which action-inbox row (`InboxItem.id`), and since when.
   * `ACKNOWLEDGE_INBOX_ITEM` appends; nothing removes an entry.
   *
   * Never read by `buildActionInbox`, and must never be: acknowledging a row must not change
   * whether the inbox returns it. Screens read this map alongside the inbox output.
   */
  inboxAcknowledgements: Record<string, InboxAcknowledgement[]>;
  /**
   * The completion history of each action-inbox row, keyed by `InboxItem.id`. `COMPLETE_INBOX_ITEM`
   * and its undo `REOPEN_INBOX_ITEM` append here; see `InboxCompletionEntry` for why this is a
   * history rather than a boolean.
   */
  inboxCompletions: Record<string, InboxCompletionEntry[]>;
  /**
   * Who took ownership of each inbox row (`TAKE_INBOX_ITEM_OWNERSHIP`) and each row's snooze
   * history (`SNOOZE_INBOX_ITEM`/`UNSNOOZE_INBOX_ITEM`), keyed by `InboxItem.id`. Append-only.
   * Never read by `buildActionInbox`: a snooze hides a row on screen, it never changes whether the
   * fact is true.
   */
  inboxOwnership: Record<string, InboxOwnershipEntry[]>;
  inboxSnoozes: Record<string, InboxSnoozeEntry[]>;
  /**
   * Authored notices (owner ruling D-2), beside `buildActionInbox`'s derived list. Appended only
   * through `appendNotices`, which refuses a `demo`-addressed notice. Never read or written by
   * `buildActionInbox`, so inbox actions cannot raise a notice and a notice cannot change the
   * derived inbox.
   */
  notices: Notice[];
  /**
   * The coordinator-tunable figures engine read sites consult. `SET_CONFIGURATION` is the only
   * writer; `RESET_SCENARIO`/`SET_SCENARIO` reseed it to `defaultWardConfiguration()`.
   */
  configuration: WardConfiguration;
  /**
   * Phone-logged repatriations. `RECORD_REPATRIATION` appends here and never creates a transport
   * job. One record per admission; a second is refused.
   */
  repatriations: RepatriationRecord[];
  /** Handover sign-offs — role and time only. `RECORD_HANDOVER_SIGN_OFF` appends here. */
  handoverSignOffs: HandoverSignOffRecord[];
  /**
   * Clinical contacts — team, time, and role. Contacting a team is this record, not a sent
   * message. `RECORD_CLINICAL_CONTACT` appends here.
   */
  clinicalContacts: ClinicalContactRecord[];
  /** Active and historical statewide broadcast directives. */
  broadcastAlerts: BroadcastAlert[];
  /** Monotonic sequence counter for broadcast IDs (e.g. BCAST-1). */
  broadcastSequence: number;
  /**
   * Known future admissions (stream D, 9 October 2026), booked ahead of arrival. A booking holds
   * no bed; `CONVERT_PLANNED_ADMISSION` turns one into an occupied admission. Never removed: a
   * cancelled or arrived booking stays, marked, so the calendar's history holds.
   */
  plannedAdmissions: PlannedAdmission[];
  /** Monotonic id source for `BOOK_PLANNED_ADMISSION` ("PA-NN"), the same discipline as the others. */
  plannedAdmissionSequence: number;
  /**
   * Advisory carer, personal support person and MHAS notification records.
   * `RECORD_SUPPORT_NOTIFICATION` appends here. Optional so older stored sessions load; holds typed
   * text, so a non-empty list is never persisted (see storage validation).
   */
  supportNotifications?: SupportNotificationRecord[];
  /**
   * What the newest referral decision and Bed board placement on each subject changed, so
   * `UNDO_REFERRAL_DECISION` and `UNDO_PLACE_IN_BED` can restore it exactly (`ward-undo.ts`).
   * Optional: absent is an empty list.
   */
  undoRecords?: UndoRecord[];
};

/** Phone-log of a repatriation arranged off-system. Never a booked transport job. */
export type RepatriationRecord = {
  admissionId: string;
  at: Instant;
  by: WardFlowRole;
  homeHospital: string;
  receivingWardAgreed: boolean;
  agreedAt?: Instant;
  agreedBy?: WardFlowRole;
  mode: RepatriationMode;
  provider: TransportProvider;
  cadNumber: string;
  transportLegalStatus: TransportLegalStatus;
  estimatedAt: Instant;
};

/** Shift handover sign-off. Role and time only. */
export type HandoverSignOffRecord = {
  at: Instant;
  by: WardFlowRole;
};

/** Record that a team was contacted. Not a sent message. */
export type ClinicalContactRecord = {
  teamId: string;
  at: Instant;
  by: WardFlowRole;
};

/**
 * One acknowledgement of one action-inbox row, written only by `ACKNOWLEDGE_INBOX_ITEM`. `by` is a
 * role, never a person, taken from the event's own `role`.
 *
 * Append-only, and identity is array position, never `at`: several dispatches in one tick share one
 * instant. Never look up, sort or deduplicate entries by `at`.
 */
export type InboxAcknowledgement = {
  at: Instant;
  by: string;
};

/**
 * One entry in an action-inbox row's completion history, written by `COMPLETE_INBOX_ITEM` and its
 * undo `REOPEN_INBOX_ITEM`. Append-only, position is identity (see `InboxAcknowledgement`).
 *
 * Not a boolean, on purpose: "is this row complete" is read from the last entry
 * (`inboxItemCompletionState`), so no history is ever rewritten in place.
 */
export type InboxCompletionEntry = {
  at: Instant;
  by: string;
  kind: "completed" | "reopened";
};

export {
  inboxItemCompletionState,
  type InboxItemKind,
  INBOX_CATEGORIES,
  inboxItemKindOf,
  inboxItemIsActNow,
  reduceInboxEvent,
} from "./ward-inbox-reducer";

/**
 * Deep-copies the frozen fixture so callers never alias or mutate it. Defaults to the standard
 * night so `RESET_SCENARIO` always returns there (a product-owner decision).
 */
export function seedWardFlowState(scenario: WardScenario = "standard"): WardFlowState {
  // The EMHS demo and surge scenarios bring their own wards and linked patients
  // (`ward-demo-network.ts`), and none of the standard night's rulings-demo overlay.
  const network = scenarioNetwork(scenario);
  const seed: WardFlowState = {
    worldGeneration: 0,
    dischargeRevisions: {},
    auditEvents: [],
    auditReviews: [],
    auditSequence: 0,
    auditReviewSequence: 0,
    auditCaptureStartedAt: NOW_ANCHOR,
    movements: withDemoStageTimes(
      withDemoPlannedMoveTimes(structuredClone(network?.movements ?? wardMovements), NOW_ANCHOR),
      NOW_ANCHOR,
    ),
    units: scenarioUnits(scenario),
    rejections: [],
    clockOffsetMinutes: 0,
    referralSequence: 0,
    leaveBedSequence: 0,
    scenario,
    bedReleases: structuredClone(network?.bedReleases ?? bedReleases),
    leaveBeds: structuredClone(network?.leaveBeds ?? leaveBeds),
    refreshRequests: [],
    morningRollupConfirmations: {},
    referrals: structuredClone(network?.referrals ?? referrals),
    frontDoorReferralSequence: 0,
    patients: structuredClone(network?.patients ?? wardPatients),
    patientSequence: 0,
    admissions: structuredClone(network?.admissions ?? wardAdmissions),
    admissionSequence: 0,
    inboxAcknowledgements: {},
    inboxCompletions: {},
    inboxOwnership: {},
    inboxSnoozes: {},
    notices: [],
    configuration: defaultWardConfiguration(),
    repatriations: [],
    handoverSignOffs: [],
    clinicalContacts: [],
    broadcastAlerts: [],
    broadcastSequence: 0,
    // Seeded bookings name standard-night wards, so the network scenarios start with none.
    plannedAdmissions: network ? [] : structuredClone(wardPlannedAdmissions),
    plannedAdmissionSequence: 0,
  };
  return network ? seed : applyRulingsDemoOverlay(seed, NOW_ANCHOR);
}

/**
 * A fresh seed, already moved to the demonstration's clock: the only door application code uses.
 *
 * `shiftInstants` carries no already-shifted marker, so applying it twice doubles every offset and
 * produces plausible but wrong lengths of stay. This function takes no state, so it cannot be
 * handed an already-shifted one. `tests/ward-reanchor-single-application.test.ts` guards that
 * application code never reaches around it. Offset zero still returns a copy, so the pinned and
 * live paths differ only in the offset.
 */
export function seedWardFlowStateAt(offsetMinutes: number, scenario: WardScenario = "standard"): WardFlowState {
  return shiftInstants(seedWardFlowState(scenario), offsetMinutes);
}

/** The id a rejection is filed against, for events that are not about one specific movement. */
export function subjectId(event: WardFlowEvent): string {
  switch (event.type) {
    case "RECORD_PATIENT_DISCHARGE":
    case "RECORD_ADMISSION_CARE":
    case "RECORD_ADMISSION_FOLLOW_UP":
    case "OPEN_DISCHARGE_RECORD":
    case "REVIEW_AUDIT_EVENT":
    case "UNDO_AUDIT_REVIEW":
    case "SET_CONFIGURATION":
      return "none";
    // v10 pass 2: undo and Bed board placement name the referral or the stay they act on.
    case "UNDO_REFERRAL_DECISION":
      return event.referralId;
    case "PLACE_IN_BED":
    case "UNDO_PLACE_IN_BED":
      return event.admissionId;
    // v10 pass 3: a step undo is filed against the subject it names; a handover sign-off has none.
    case "UNDO_REPATRIATION":
    case "UNDO_DEPARTURE":
    case "UNDO_ABSENT_WITHOUT_LEAVE":
    case "UNDO_ED_STEP":
    case "UNDO_SUPPORT_NOTIFICATION":
      return undoStepSubjectId(event);
    case "UNDO_HANDOVER_SIGN_OFF":
      return "none";
    case "RAISE_REFERRAL":
      return event.edId;
    case "CONFIRM_CAPACITY":
    case "RECORD_WARD_INTAKE_CONSTRAINTS":
    case "FLAG_BED_RELEASE":
    case "RECORD_LEAVE_BED":
    case "REQUEST_CAPACITY_REFRESH":
    case "CONFIRM_MORNING_ROLLUP":
    case "SEND_WARD_BUZZ":
      return event.unitId;
    case "CONFIRM_BED_RELEASE":
    case "REVERT_BED_RELEASE":
    case "BLOCK_BED_RELEASE":
    case "CLEAR_BED_RELEASE_BLOCK":
    case "SET_BED_PREPARATION":
      return event.releaseId;
    case "RELEASE_BED":
      return event.releaseId;
    // Admission-scoped: an admission id is not a unit or release id, so these keep their own group.
    case "RECORD_LEAVING":
    case "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT":
    case "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT":
    case "RECORD_STAY_DISCHARGE_BLOCKER":
    case "CLEAR_STAY_DISCHARGE_BLOCKER":
    case "RECORD_REPATRIATION":
      return event.admissionId;
    case "END_LEAVE_BED":
      return event.leaveBedId;
    case "RECORD_ABSENT_WITHOUT_LEAVE":
    case "RECORD_ABSENCE_STEP":
      return event.admissionId;
    case "RECORD_COMMUNITY_TREATMENT_ORDER":
    case "END_COMMUNITY_TREATMENT_ORDER":
      return event.patientId;
    case "ACCEPT_REFERRAL":
    case "DECLINE_REFERRAL":
    case "RECORD_LOCAL_BED_SOUGHT":
    // Referral-scoped with no `movementId`: the `default` branch would stamp a rejection whose
    // subject is `undefined`.
    case "RECORD_REFERRER_WITHDRAWAL":
    // RB7: referral-scoped too, carrying `referralId` and no `movementId`.
    case "ADD_REFERRAL_CORRECTION":
      return event.referralId;
    case "ADVANCE_CLOCK":
    case "RESET_SCENARIO":
    case "SET_SCENARIO":
    // No referral exists yet to name a rejection against; the intake itself is what is rejected.
    case "RECEIVE_REFERRAL":
    // A patient is not filed against a movement, and that is the point of the record rather than an
    // omission: they exist before any movement does.
    case "ADD_PATIENT":
      return "none";
    // Referral-scoped, not movement-scoped: a clearance is recorded against the referral the
    // inbox renders, and this event carries no `movementId` to return.
    case "RECORD_MEDICAL_CLEARANCE":
    // This event carries no `movementId`, so without this line `default` would stamp a rejection
    // with an `undefined` subject, and only on the unhappy path.
    case "RECORD_ARRIVED_IN_DEPARTMENT":
      return event.referralId;
    // These carry no `movementId`: the subject is the action-inbox row (`InboxItem.id`), which may
    // no longer match an open movement.
    case "ACKNOWLEDGE_INBOX_ITEM":
    case "COMPLETE_INBOX_ITEM":
    case "REOPEN_INBOX_ITEM":
    case "TAKE_INBOX_ITEM_OWNERSHIP":
    case "SNOOZE_INBOX_ITEM":
    case "UNSNOOZE_INBOX_ITEM":
      return event.inboxItemId;
    // Notice-scoped (owner answer 48): carries no `movementId`.
    case "MARK_NOTICE_READ":
      return event.noticeId;
    case "SET_STEP_DOWN_CANDIDATE":
    case "SET_DISCHARGE_BARRIER":
      return event.admissionId;
    case "RECORD_SUPPORT_NOTIFICATION":
      return event.movementId ?? event.admissionId ?? "none";
    case "EVALUATE_LEAVE_BED_WARNINGS":
    case "EVALUATE_ARRIVAL_LATENESS":
    case "RECORD_HANDOVER_SIGN_OFF":
      return "none";
    case "RECORD_CLINICAL_CONTACT":
      return event.teamId;
    case "DISPATCH_BROADCAST_ALERT":
      return "broadcast";
    case "ACKNOWLEDGE_BROADCAST_ALERT":
    case "STAND_DOWN_BROADCAST_ALERT":
    case "EXTEND_BROADCAST_ALERT":
    case "REPLY_BROADCAST_ALERT":
      return event.alertId;
    case "RAISE_PULL_NOW":
      return event.movementId;
    case "BOOK_PLANNED_ADMISSION":
      return event.unitId;
    case "CHANGE_PLANNED_ADMISSION":
    case "CANCEL_PLANNED_ADMISSION":
    case "CONVERT_PLANNED_ADMISSION":
      return event.plannedAdmissionId;
    default:
      return "movementId" in event ? (event.movementId as string) : "none";
  }
}

/**
 * Stable, non-random id derived from the subject, the event type and the rejection count. Never a
 * module-level counter, which would break the reducer's purity.
 */
function makeRejection(state: WardFlowState, event: WardFlowEvent, reason: string): Rejection {
  const subject = subjectId(event);
  return {
    id: `rejection-${subject}-${event.type}-${state.rejections.length}`,
    at: event.now,
    movementId: subject,
    attempted: event.type,
    // D-39: a refusal names the patient by UMRN, never by the WF journey number it was keyed on,
    // and says "this referral" or "this stay" in place of any other record number.
    reason: withoutRecordNumbers(withUmrnInPlaceOfMovementIds(reason, state)),
  };
}

export function reject(state: WardFlowState, event: WardFlowEvent, reason: string): WardFlowState {
  return { ...state, rejections: [...state.rejections, makeRejection(state, event, reason)] };
}

/**
 * The eligibility gate (owner ruling): "the engine should refuse, screen checks are not enough",
 * "refuse unless a reason is recorded", and "The coordinator can over ride all rules". Returns the
 * refusal message, or `null` to allow.
 *
 * An ineligible placement is made accountable, never impossible: ineligible with no reason is
 * refused naming the gate; ineligible with a valid reason is placed and the reason recorded; a
 * reason outside `OVERRIDE_REASONS` is refused by membership, never truthiness. Do not tighten
 * this: a refused override becomes an unrecorded phone call. Making a gate un-overridable reverses
 * an owner ruling.
 *
 * The boundary: "all rules" covers eligibility gates only, never the capacity refusals (allocatable
 * beds, a bed being prepared, specialling capacity). No reason typed into a form creates a bed.
 *
 * This reducer enforces the suitability gates only. World-fact gates are refused separately and are
 * not overridable; `prior_decline` (history) is not enforced, since beds free up and no override
 * reason fits a re-approach. Whether a re-approach should need a recorded reason is an open owner
 * question.
 *
 * `OVERRIDE_REASON_REQUIRED` is the one fragment a screen may match on to know a refusal is
 * answerable. `ward-screen.tsx` matches on this export, never its own literal. It names a state,
 * not an action; the exact clinical wording is the owner's to confirm.
 */
export const OVERRIDE_REASON_REQUIRED = "needs a recorded override reason";

/**
 * The fragment unique to `PULL_PATIENT`'s acuity block (item 10). That refusal needs a second fact
 * beside the reason (the nurse unit manager consulted), shown only beside this refusal.
 * `ward-screen.tsx` matches on this export, never its own literal.
 */
export const HIGH_ACUITY_STAFFING_REFUSAL = "has no high-acuity nursing capacity left";

/**
 * The gates a recorded reason may get past. Imported by `tests/ward-referral-reducer.test.ts`
 * (asserts it is disjoint from the world-fact gates) and by `ward-derivations.ts`'s
 * `shortlistCandidates`, so the screen and engine share one list.
 *
 * T10 (owner answer, item 8): "There is no override path on the gender gate." The `satisfies`
 * clause below makes adding `"gender_designation"` a compile error, while the exported type stays
 * the full gate union so `.includes(gate.gate)` call sites still compile.
 */
export const SUITABILITY_GATES: readonly EligibilityGate[] = [
  "age",
  "authorisation",
  "cohort",
  "forensic",
  "legal_status",
  "security",
  "sex_mix",
  // Added by owner ruling: the only gate moved out of the world-fact group. A stale bed count is
  // information, and "I have confirmed the current bed state with the ward directly" is a named
  // person taking responsibility. It buys past a stale count, never past `allocatable_bed`. See
  // docs/ward-flow/owner-rulings-2026-09-02-staleness-and-legal-status.md.
  "capacity_freshness",
] as const satisfies readonly Exclude<EligibilityGate, "gender_designation">[];

/** Record only gates actually answered by this pull, against the same pre-pull resources. */
function pullOverrides(
  movement: Movement,
  unit: Unit,
  admissions: WardFlowState["admissions"],
  event: Extract<WardFlowEvent, { type: "PULL_PATIENT" }>,
  checkEligibility: boolean,
): Movement["overrides"] {
  if (event.overrideReason === undefined || !OVERRIDE_REASONS.includes(event.overrideReason)) return movement.overrides;
  const gates: NonNullable<Movement["overrides"][number]["gate"]>[] = [];
  if (movement.specialling && remainingSpeciallingCapacity(unit, admissions) <= 0) gates.push("specialling_staffing");
  if (movement.highAcuity && remainingHighAcuityCapacity(unit, admissions) <= 0) gates.push("high_acuity_staffing");
  if (checkEligibility) {
    if (movement.security === "Secure" && lockedBedsFree(unit) <= 0) gates.push("locked_bed_capacity");
    gates.push(
      ...eligibility(movement, unit, event.now)
        .gates.filter((gate) => !gate.pass && SUITABILITY_GATES.includes(gate.gate))
        .map((gate) => gate.gate),
    );
  }
  return [
    ...movement.overrides,
    ...gates.map((gate) => ({
      at: event.now,
      by: WARD_FLOW_ROLE_LABELS[event.role],
      reason: event.overrideReason!,
      unitIds: [unit.id],
      ...overrideSignOffField(event),
      gate,
      ...(gate === "high_acuity_staffing" && event.numConsulted === true ? { numConsulted: true as const } : {}),
    })),
  ];
}

/** The planned admissions module, handed this reducer's own rejection and placement refusal. */
function reducePlannedAdmission(state: WardFlowState, event: WardFlowEvent, decision: AuditDecision): WardFlowState {
  return (
    reducePlannedAdmissionEvent(state, event, decision, reject, (movement, unit, now) =>
      eligibilityRefusal({ type: "CONVERT_PLANNED_ADMISSION" }, movement, unit, now),
    ) ?? state
  );
}

/**
 * v10 pass 3: the override's second sign-off as stored on `Override.secondSignOff`, trimmed, or
 * nothing. Validated before any placement event runs (`overrideSignOffRefusal`).
 */
function overrideSignOffField(event: { overrideSignOff?: OverrideSignOff }): { secondSignOff?: OverrideSignOff } {
  const signOff = event.overrideSignOff;
  return signOff === undefined ? {} : { secondSignOff: { role: signOff.role, name: signOff.name.trim() } };
}

/** Why an event's override sign-off cannot be kept, or null (absent is always fine). */
function overrideSignOffRefusal(event: WardFlowEvent): string | null {
  if (!("overrideSignOff" in event) || event.overrideSignOff === undefined) return null;
  const signOff = event.overrideSignOff as unknown;
  if (typeof signOff !== "object" || signOff === null) return "The second sign-off must name a role and a person";
  const { role, name } = signOff as { role?: unknown; name?: unknown };
  if (typeof role !== "string" || !(role in WARD_FLOW_ROLE_LABELS))
    return "The second sign-off must name the role it was given in";
  if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > OVERRIDE_SIGN_OFF_NAME_MAX)
    return `The second sign-off needs a name or initials, up to ${OVERRIDE_SIGN_OFF_NAME_MAX} characters`;
  if (!("overrideReason" in event) || event.overrideReason === undefined)
    return "A second sign-off is recorded only with an override reason";
  return null;
}

function eligibilityRefusal(
  // A planned-admission conversion reuses this refusal with no override path at all.
  event:
    | Pick<OverridableWardFlowEvent, "type" | "overrideReason">
    | { type: "CONVERT_PLANNED_ADMISSION"; overrideReason?: undefined },
  movement: Movement,
  unit: Unit,
  now: Instant,
): string | null {
  /**
   * T10 (item 8): the `gender_designation` check runs first, before the override early return
   * below. That ordering is the fix: no typed reason can buy past a gate with no override path.
   */
  const verdict = eligibility(movement, unit, now);
  const genderFailure = verdict.gates.find((gate) => gate.gate === "gender_designation" && !gate.pass);
  if (genderFailure) {
    return (
      `${unit.name} is not eligible for movement ${movement.id} — failed gate gender_designation: ` +
      `${genderFailure.detail}. This is not something a recorded reason can override.`
    );
  }
  if (event.overrideReason !== undefined) {
    // Membership-checked, never truthiness-checked — the same discipline as `REFER_TO_UNITS`'s own
    // override validation. An unrecognised string must not buy its way past a clinical gate.
    if (!OVERRIDE_REASONS.includes(event.overrideReason)) {
      return `${event.type} overrideReason must be chosen from OVERRIDE_REASONS`;
    }
    // This return skips the verdict entirely, including physical gates (`specialling`,
    // `prior_decline`, `capacity_freshness`, `allocatable_bed`). It is safe only because
    // `PULL_PATIENT`, the only event that consumes a bed, refuses on allocatable beds, specialling
    // and high-acuity capacity before it calls this function, and none of those reads
    // `overrideReason`. `REFER_TO_UNITS` and `ACCEPT_IN_PRINCIPLE` consume no bed.
    //
    // Preserve those guards and their order. Folding them into the eligibility verdict would
    // silently let a typed reason create a bed;
    // `tests/ward-physical-facts-are-not-overridable.test.ts` goes red if that happens.
    return null;
  }
  // `verdict` was already computed above, before the gender check — not recomputed here.
  const failed = verdict.gates.find((gate) => !gate.pass && SUITABILITY_GATES.includes(gate.gate));
  if (!failed) return null;
  return (
    `${unit.name} is not eligible for movement ${movement.id} — failed gate ${failed?.gate}: ` +
    `${candidateReason(verdict)}. This placement ${OVERRIDE_REASON_REQUIRED}.`
  );
}

/**
 * P1-3 (Ward Lead ruling): a gender corrected after placement is re-checked. Re-asks
 * `gender_designation` (no override path) and the Non-binary placement-record check
 * (`GENDER_PLACEMENT_REFUSAL`) against the unit a movement is already held or accepted at. Called
 * by `PULL_PATIENT`, `HANDOVER_READY`, `TRANSPORT_ACCEPTED` and `PATIENT_COLLECTED`; never by
 * `PATIENT_ARRIVED`, since blocking an arrival strands a patient in transit (the coordinator notice
 * from `RECORD_MOVEMENT_GENDER` covers that).
 *
 * Checks only these two judgements, not the full `SUITABILITY_GATES` list. Returns `null` when the
 * held unit still suits.
 */
export function heldUnitGenderRefusal(
  state: Pick<WardFlowState, "units">,
  movement: Movement,
  now: Instant,
): string | null {
  if (!movement.acceptedUnitId) return null;
  const unit = state.units.find((candidate) => candidate.id === movement.acceptedUnitId);
  if (!unit) return null;
  const genderGate = eligibility(movement, unit, now).gates.find((gate) => gate.gate === "gender_designation");
  if (genderGate && !genderGate.pass) {
    return GENDER_NO_LONGER_SUITS_REFUSAL;
  }
  if (
    genderReviewNeeded(movement.gender, movement.sex) &&
    !(movement.genderPlacements ?? []).some((record) => record.unitIds.includes(movement.acceptedUnitId as string))
  ) {
    return GENDER_NO_LONGER_SUITS_NON_BINARY_REFUSAL;
  }
  return null;
}

/**
 * `referralAcceptanceRefusal` below is the front door's half of the `eligibilityRefusal` ruling: a
 * judgement about the patient is overridable by a named human with a recorded reason; a fact about
 * the world is not.
 *
 * Fail-closed by construction: a gate is overridable only by appearing in `SUITABILITY_GATES`, so
 * any new gate refuses outright by default. The non-overridable set is derived (`ELIGIBILITY_GATES`
 * minus `SUITABILITY_GATES`); do not transcribe it here.
 *
 * B1: a ward answering a referral names itself with `actingUnitId` and is refused when that ward is
 * not its own. The coordinator acts for any ward and sends none.
 */
function wardActingUnitRefusal(
  event: Extract<WardFlowEvent, { type: "ACCEPT_REFERRAL" | "DECLINE_REFERRAL" }>,
  addressing: ReferralAddressing,
): string | undefined {
  if (event.role !== "ward" || event.actingUnitId === undefined) return undefined;
  const answering =
    event.unitId ?? (addressing.destination.kind === "psychiatric_ward" ? addressing.destination.unitId : undefined);
  if (answering === event.actingUnitId) return undefined;
  return `${event.type} was raised acting as unit ${event.actingUnitId} but answers for ${answering ?? "no named ward"}; a ward answers only its own referrals`;
}

/**
 * A1-1, A1-3, S2-11: a ward caller acting on a movement names itself with `actingUnitId`, and is
 * refused when that unit is not its own.
 */
function wardActingMovementRefusal(
  event: Extract<WardFlowEvent, { type: "ACCEPT_IN_PRINCIPLE" | "PULL_PATIENT" | "DECLINE" }>,
): string | undefined {
  if (event.role !== "ward" || event.actingUnitId === undefined) return undefined;
  if (event.unitId === event.actingUnitId) return undefined;
  return `${event.type} was raised acting as unit ${event.actingUnitId} but answers for ${event.unitId}; a ward answers only its own referrals`;
}

function referralAcceptanceRefusal(
  event: OverridableWardFlowEvent,
  referral: Referral,
  destination: WardReferralDestination,
  unit: Unit,
  now: Instant,
): { refusal: string; overrideApplied?: undefined } | { refusal: null; overrideApplied: boolean } {
  const verdict = referralEligibility(referral, destination, unit, now);
  // `overrideApplied: false` on a clean verdict even with a reason, so no false override record is
  // written.
  if (verdict.eligible) return { refusal: null, overrideApplied: false };
  const failed = verdict.gates.filter((gate) => !gate.pass);

  // Checked BEFORE the reason is even read, so no ordering accident can let one through.
  const unbypassable = failed.find((gate) => !SUITABILITY_GATES.includes(gate.gate));
  if (unbypassable) {
    return {
      refusal:
        `${unit.name} cannot accept referral ${referral.id} — failed gate ${unbypassable.gate}: ` +
        `${unbypassable.detail}. This is not something a recorded reason can override.`,
    };
  }

  // Everything still failing is a judgement gate, so a recorded reason is the way through — and
  // the refusal has to SAY so, or the reader is left believing the door is shut.
  if (event.overrideReason === undefined) {
    const judgement = failed[0];
    return {
      refusal:
        `${unit.name} does not accept referral ${referral.id} — failed gate ${judgement?.gate}: ` +
        `${judgement?.detail}. This acceptance ${OVERRIDE_REASON_REQUIRED}.`,
    };
  }
  if (!OVERRIDE_REASONS.includes(event.overrideReason)) {
    return { refusal: `${event.type} overrideReason must be chosen from OVERRIDE_REASONS` };
  }
  return { refusal: null, overrideApplied: true };
}

export function findMovement(state: WardFlowState, movementId: string): Movement | undefined {
  return state.movements.find((candidate) => candidate.id === movementId);
}

export function findUnit(state: WardFlowState, unitId: string): Unit | undefined {
  return state.units.find((candidate) => candidate.id === unitId);
}

function findBedRelease(state: WardFlowState, releaseId: string): BedRelease | undefined {
  return state.bedReleases.find((candidate) => candidate.id === releaseId);
}

/** Replaces one bed release in the array by id, leaving every other element untouched. */
function replaceBedRelease(state: WardFlowState, releaseId: string, next: BedRelease): WardFlowState {
  return {
    ...state,
    bedReleases: state.bedReleases.map((candidate) => (candidate.id === releaseId ? next : candidate)),
  };
}

/**
 * Keeps the stay's own discharge decision in step with its bed release. Screens that read the stay
 * (the bed board's shift list, the patient card, the discharge board) read
 * `Admission.dischargeConfirmedAt`; the ward's Confirm and Revert act on the release. Without this,
 * one discharge carried two answers (release gate, 15 Oct 2026).
 *
 * Only the ward is named as the confirmer: "Ward manager" is the one label `DISCHARGE_ROLE_LABELS`
 * holds, so a coordinator's confirmation records the time with the role left unrecorded rather
 * than naming the wrong person. The change moves the stay's discharge revision, so an edit made
 * against the record as it stood before is refused as stale.
 */
function withAdmissionDischargeDecision(
  state: WardFlowState,
  admissionId: string,
  at: Instant | null,
  role: WardFlowRole,
): WardFlowState {
  const admission = findAdmission(state, admissionId);
  if (!admission) return state;
  // A stay already confirmed keeps its own confirmation time: the release agrees with it, so
  // restamping would rewrite when the discharge was decided. A revert still clears it, because the
  // ward has said the discharge is no longer decided.
  if (at !== null && admission.dischargeConfirmedAt !== null) return state;
  if (at === null && admission.dischargeConfirmedAt === null) return state;
  const withStay = replaceAdmission(state, admissionId, {
    ...admission,
    dischargeConfirmedAt: at,
    dischargeConfirmedBy: at !== null && role === "ward" ? "Ward manager" : null,
  });
  return {
    ...withStay,
    dischargeRevisions: {
      ...withStay.dischargeRevisions,
      [admissionId]: (state.dischargeRevisions[admissionId] ?? 0) + 1,
    },
  };
}

export function findAdmission(state: WardFlowState, admissionId: string): Admission | undefined {
  return state.admissions.find((candidate) => candidate.id === admissionId);
}

/** Replaces one admission in the array by id, leaving every other element untouched — the same
 *  discipline `replaceBedRelease` and `replaceUnit` already use. */
export function replaceAdmission(state: WardFlowState, admissionId: string, next: Admission): WardFlowState {
  return {
    ...state,
    admissions: state.admissions.map((candidate) => (candidate.id === admissionId ? next : candidate)),
    dischargeRevisions: state.admissions.some(
      (candidate) => candidate.id === admissionId && candidate.state !== next.state,
    )
      ? { ...state.dischargeRevisions, [admissionId]: (state.dischargeRevisions[admissionId] ?? 0) + 1 }
      : state.dischargeRevisions,
  };
}

/**
 * One discharge blocker, two records: the release's own `blocker` and the stay's `blockReason`.
 * Whenever a release-level event changes the first, the linked stay follows, so a blocker set on one
 * screen is never left behind on the handover, stranded list or statistics by another screen's clear.
 */
function withStayBlocker(state: WardFlowState, admissionId: string, blocker: BedReleaseBlocker | null): WardFlowState {
  const stay = findAdmission(state, admissionId);
  if (!stay || stay.blockReason === blocker) return state;
  return replaceAdmission(state, stay.id, { ...stay, blockReason: blocker });
}

function findLeaveBed(state: WardFlowState, leaveBedId: string): LeaveBed | undefined {
  return state.leaveBeds.find((candidate) => candidate.id === leaveBedId);
}

export function findReferral(state: WardFlowState, referralId: string): Referral | undefined {
  return state.referrals.find((candidate) => candidate.id === referralId);
}

/** Replaces one referral in the array by id, leaving every other element untouched — the same
 *  shape as `replaceBedRelease`/`replaceMovement` below. */
export function replaceReferral(state: WardFlowState, referralId: string, next: Referral): WardFlowState {
  return {
    ...state,
    referrals: state.referrals.map((candidate) => (candidate.id === referralId ? next : candidate)),
  };
}

/** Replaces one movement in the array by id, leaving every other element untouched. */
export function replaceMovement(state: WardFlowState, movementId: string, next: Movement): WardFlowState {
  return {
    ...state,
    movements: state.movements.map((candidate) => (candidate.id === movementId ? next : candidate)),
  };
}

export function replaceUnit(state: WardFlowState, unitId: string, next: Unit): WardFlowState {
  return { ...state, units: state.units.map((candidate) => (candidate.id === unitId ? next : candidate)) };
}

/** A recorded sending ward is the only exception to the one-current-stay placement rule. */
export function movementSourceAdmission(state: WardFlowState, movement: Movement): Admission | undefined {
  if (movement.sourceAdmissionId) return findAdmission(state, movement.sourceAdmissionId);
  const referral = movement.referralId ? findReferral(state, movement.referralId) : undefined;
  if (referral?.source !== "psychiatric_ward" || !referral.originUnitId) return undefined;
  const patientId = movement.patientId ?? referral.patientId;
  return state.admissions.find(
    (a) => a.patientId === patientId && a.unitId === referral.originUnitId && a.state === "occupied",
  );
}

/**
 * `releasePulledBedAndAdmission` below refunds a held bed and deletes the `Admission`
 * `PULL_PATIENT` created for it: the exact inverse of `PULL_PATIENT`'s writes (ruling P4-1), shared
 * by `RELEASE_PULL`, a post-acceptance `WITHDRAW_REFERRAL` and `STOP_TRANSPORT` (WLQ-38).
 *
 * A bed is held when the stage is `pulled`, `handover_ready` or `moving`, OR `admissionId` is set;
 * never either alone. Seeded movements authored at those stages carry no `admissionId`, and
 * `STEP_BACK_STAGE` back to `accepted_awaiting_bed` keeps both the admission and the bed (rulings
 * E/F). Gating on either half alone leaks a bed or leaves a phantom occupant.
 * `RECORD_EXAMINATION`'s `holdsBed` uses the same rule.
 *
 * A no-op when neither half holds, or when the accepted unit is missing, so callers may call it
 * unconditionally. Callers clear `movement.admissionId` themselves; this only touches `units`,
 * `admissions` and `dischargeRevisions`.
 *
 * `movementHoldsBedByStage` answers the stage half: a seeded journey authored at `pulled` or later
 * carries no `admissionId` (review finding S2-1).
 */
export function movementHoldsBedByStage(movement: Movement): boolean {
  return (
    movement.stage === "pulled" ||
    movement.stage === "handover_ready" ||
    movement.stage === "moving" ||
    movement.admissionId !== undefined
  );
}

export function releasePulledBedAndAdmission(state: WardFlowState, movement: Movement, now: Instant): WardFlowState {
  if (!movement.acceptedUnitId) return state;
  // Held by stage OR `admissionId`: a movement stepped back to `accepted_awaiting_bed` still holds
  // its bed and admission (rulings E/F). Same rule as `RECORD_EXAMINATION`'s `holdsBed`.
  const bedCurrentlyHeld =
    movement.stage === "pulled" ||
    movement.stage === "handover_ready" ||
    movement.stage === "moving" ||
    movement.admissionId !== undefined;
  if (!bedCurrentlyHeld) return state;
  const unit = findUnit(state, movement.acceptedUnitId);
  if (!unit) return state;
  /**
   * Item 11 (owner answer 11): restore the bed kind `PULL_PATIENT` took. `admission.bedKind` is the
   * only record of it, so read it before the admission is filtered out below. A hand-authored seed
   * movement with no `admissionId`, or a seeded admission without `bedKind`, cannot say whether the
   * bed was locked, so `allocatableLocked` is left untouched for those.
   */
  const heldAdmission =
    movement.admissionId === undefined
      ? undefined
      : state.admissions.find((candidate) => candidate.id === movement.admissionId);
  if (
    movement.admissionId !== undefined &&
    (!heldAdmission ||
      heldAdmission.state !== "pulled" ||
      heldAdmission.unitId !== unit.id ||
      (heldAdmission.movementId !== null && heldAdmission.movementId !== movement.id))
  )
    return state;
  const lockedBedReleased = heldAdmission?.bedKind === "locked";
  // A newer ward observation may already report the building/designation ceiling while this
  // reservation still exists. Release the actual hold, but do not manufacture a bed above that
  // ceiling or rewrite physical empty. Record the disagreement for explicit re-confirmation.
  const releaseCountDisagrees =
    unit.allocatable.value === unit.beds || (lockedBedReleased && unit.allocatableLocked === unit.lockedBeds);
  const releasedUnit: Unit = {
    ...unit,
    allocatable: {
      ...unit.allocatable,
      value: Math.min(unit.beds, unit.allocatable.value + 1),
    },
    allocatableLocked: Math.min(unit.lockedBeds, unit.allocatableLocked + (lockedBedReleased ? 1 : 0)),
    ...(releaseCountDisagrees
      ? {
          reservationReleaseCapacityConflicts: [
            ...(unit.reservationReleaseCapacityConflicts ?? []).filter((entry) => entry.movementId !== movement.id),
            {
              movementId: movement.id,
              ...(movement.admissionId === undefined ? {} : { admissionId: movement.admissionId }),
              at: now,
              allocatableBefore: unit.allocatable.value,
              allocatableLockedBefore: unit.allocatableLocked,
              lockedBedReleased,
            },
          ],
        }
      : {}),
  };
  const withUnit = replaceUnit(state, unit.id, releasedUnit);
  if (movement.admissionId === undefined) return withUnit;
  return {
    ...withUnit,
    admissions: withUnit.admissions.filter((candidate) => candidate.id !== movement.admissionId),
    // A Bed board placement on the removed stay has nothing left to undo, and a saved world still
    // naming that stay is refused on reload (found by tests/ward-engine-safety.test.ts).
    ...(withUnit.undoRecords === undefined
      ? {}
      : {
          undoRecords: withUnit.undoRecords.filter(
            (record) => record.kind !== "bed-placement" || record.admissionId !== movement.admissionId,
          ),
        }),
    dischargeRevisions: Object.fromEntries(
      Object.entries(withUnit.dischargeRevisions).filter(([id]) => id !== movement.admissionId),
    ),
  };
}

export function nextReferralId(sequence: number): MovementId {
  // "WF-9NN" — the 9 prefix keeps runtime-raised referrals visibly distinct from the
  // hand-authored and generated WF-0xx/WF-1xx..WF-4xx fixture ids.
  return `WF-9${String(sequence).padStart(2, "0")}`;
}

/**
 * Mirrors `nextReferralId`, but from `leaveBedSequence`, never `leaveBeds.length` (see that field
 * on `WardFlowState`).
 */
export function nextLeaveBedId(sequence: number): string {
  // "WL-9NN" mirrors FLAG_BED_RELEASE's own "WR-9NN" — visibly distinct from the hand-authored
  // "WL-00N" fixture ids.
  return `WL-9${String(sequence).padStart(2, "0")}`;
}

/**
 * Derived from `frontDoorReferralSequence`, never `referrals.length`. "RF-9NN": the "9" prefix
 * marks a runtime-created id, distinct from the fixture's "RF-00N".
 */
function nextFrontDoorReferralId(sequence: number): string {
  return `RF-9${String(sequence).padStart(2, "0")}`;
}

// ── Communication addendum (docs/ward-flow/plans/2026-09-1x-communication-addendum.md) ──────────

/**
 * Like `subjectId`, but reads an already-built `Notice.about` (movement, referral, unit, then
 * patient). Kept separate because `subjectId` reads an event and this reads a decision about a
 * notice.
 */
function noticeSubject(about: Notice["about"]): string {
  return about.movementId ?? about.referralId ?? about.unitId ?? about.patientId ?? "none";
}

/**
 * A unit's display name for a notice, falling back to its bare id: a notice naming the wrong ward
 * is worse than one naming a searchable id.
 */
function unitName(state: WardFlowState, unitId: string): string {
  return findUnit(state, unitId)?.name ?? unitId;
}

/**
 * Stable, non-random, derived from `(subject, kind, count)`, like `makeRejection`, to keep the
 * reducer pure.
 *
 * `count` is `state.notices.length` before the current event's notices are appended. An event
 * raising two notices gives each addressee its own `NoticeKind`, or the ids would collide and one
 * would be dropped.
 */
export function makeNotice(
  now: Instant,
  count: number,
  kind: NoticeKind,
  to: Addressee,
  about: Notice["about"],
  sentence: string,
): Notice {
  return {
    id: `notice-${noticeSubject(about)}-${kind}-${count}`,
    raisedAt: now,
    to,
    about,
    kind,
    // D-39: a notice says "this referral" or "this stay", never the record number. The ids stay in
    // `about` for the link.
    sentence: withoutRecordNumbers(sentence),
    readAt: undefined,
  };
}

/**
 * The one gate every notice passes through before reaching `state.notices`, and where `demo` is
 * refused (addendum §1.2: "`demo` … must never receive a notice… refuse it in the reducer, not in a
 * screen").
 *
 * Silently drops a `demo`-addressed notice rather than rejecting the event: the underlying decision
 * is real and already recorded; only the courtesy notice is refused. Never touches
 * `state.rejections`. Exported so `tests/ward-notices.test.ts` can exercise the drop branch
 * directly, since no public dispatch can construct such a notice.
 */
export function appendNotices(state: WardFlowState, notices: readonly Notice[]): WardFlowState {
  const notifiable = notices.filter((notice) => notice.to.role !== "demo");
  if (notifiable.length === 0) return state;
  return { ...state, notices: [...state.notices, ...notifiable] };
}

/**
 * Who referred this front-door request, resolved to a role at a place, or `undefined`. Only
 * `ed_medical` resolves (to `ed` at the origin site's emergency department, which
 * `RECEIVE_REFERRAL` guarantees exists).
 *
 * The other sources are left unresolved on purpose: none names a specific team this application can
 * address, and FD-23 (addendum §1.3) requires a decline to reach the referrer's own team and no
 * other. Absent is safer than wrong.
 */
export function referralReferrer(referral: Referral): Addressee | undefined {
  if (referral.source !== "ed_medical") return undefined;
  const edId = siteByCode(referral.originSiteCode)?.emergencyDepartment?.id;
  return edId === undefined ? undefined : { role: "ed", placeId: edId };
}

/** The established departure arithmetic, shared by the legacy and patient-linked commands. */
export function departAdmission(
  state: WardFlowState,
  admission: Admission,
  unit: Unit,
  now: Instant,
  leavingDestination: LeavingDestination,
  role: WardFlowRole,
): WardFlowState {
  // Owner decision: a bed release is a named patient's discharge, so pairing is by admission, never
  // by ward-wide counts. `releaseAlreadyIncremented` should be unreachable (RELEASE_BED refuses
  // while the person is in the bed, and storage validation refuses it); if met, not raising the
  // figures again can only under-state free beds.
  const liveRelease = state.bedReleases.find((r) => r.admissionId === admission.id && r.state !== "discharged");
  const releaseAlreadyIncremented = state.bedReleases.some(
    (r) => r.admissionId === admission.id && r.state === "discharged",
  );

  // Item 11 / WFA-003: `PULL_PATIENT` decrements `allocatableLocked` when the bed taken was locked;
  // departure restores it on both branches, since `RELEASE_BED` never touches that field.
  //
  // S2-3: a departure resolves one over-capacity arrival (this admission's, or the unit's earliest
  // pending conflict), so bed figures do not rise above true capacity.
  const admittingMovement = state.movements.find((m) => m.admissionId === admission.id);
  const matchingConflictIndex =
    unit.arrivalCapacityConflicts?.findIndex(
      (entry) =>
        entry.admissionId === admission.id ||
        (admittingMovement?.id !== undefined && entry.movementId === admittingMovement.id),
    ) ?? -1;
  const conflictToResolveIndex =
    matchingConflictIndex >= 0 ? matchingConflictIndex : (unit.arrivalCapacityConflicts?.length ?? 0) > 0 ? 0 : -1;
  const arrivalAwaitingCapacity = conflictToResolveIndex >= 0;
  const remainingArrivalConflicts =
    conflictToResolveIndex >= 0 && unit.arrivalCapacityConflicts
      ? unit.arrivalCapacityConflicts.filter((_, idx) => idx !== conflictToResolveIndex)
      : unit.arrivalCapacityConflicts;
  const restoreLocked = !arrivalAwaitingCapacity && admission.bedKind === "locked" ? 1 : 0;
  // Owner ruling 2026-09-25: occupant counts follow gender (recorded sex for a non-binary person).
  // An admission carries only `sex`, so the gender comes from the movement that admitted it.
  const leaverSex = mixSexOf(admission.gender ?? admittingMovement?.gender, admission.sex);
  // Audit A1-11 (13 Oct 2026): a departure moves the figures but never stamps them as confirmed;
  // only the ward's own Confirm numbers (`CONFIRM_CAPACITY`) sets `confirmedAt`.
  const updatedUnit: Unit =
    releaseAlreadyIncremented || arrivalAwaitingCapacity
      ? {
          ...unit,
          allocatableLocked: unit.allocatableLocked + restoreLocked,
          sexMix: adjustSexMix(unit.sexMix, leaverSex, -1),
          ...(remainingArrivalConflicts === undefined ? {} : { arrivalCapacityConflicts: remainingArrivalConflicts }),
        }
      : {
          ...unit,
          empty: { ...unit.empty, value: Math.min(unit.beds, unit.empty.value + 1) },
          allocatable: {
            ...unit.allocatable,
            value: Math.min(unit.beds, unit.allocatable.value + 1),
          },
          allocatableLocked: unit.allocatableLocked + restoreLocked,
          sexMix: adjustSexMix(unit.sexMix, leaverSex, -1),
          ...(remainingArrivalConflicts === undefined ? {} : { arrivalCapacityConflicts: remainingArrivalConflicts }),
        };
  // Leaving ends any discharge blocker too: the stay is over, so it must not carry a "held up" reason
  // into history, the same way its bed release loses its blocker below.
  const departed: Admission = { ...admission, state: "departed", leftAt: now, leavingDestination, blockReason: null };
  const departedState = replaceAdmission(replaceUnit(state, unit.id, updatedUnit), admission.id, departed);
  // Owner ruling: a leave bed belongs to one stay, so leaving ends it in the same write. No bed
  // figure moves here.
  const withPerson: WardFlowState = departedState.leaveBeds.some((bed) => bed.admissionId === admission.id)
    ? { ...departedState, leaveBeds: departedState.leaveBeds.filter((bed) => bed.admissionId !== admission.id) }
    : departedState;
  // A4-24 (owner decision): a vacated bed goes to "Being made ready" (`preparing: true` on the
  // discharged release) until one tap of Ready (`SET_BED_PREPARATION`, `preparing: false`). When no
  // bed came free here, nothing is marked.
  const bedCameFree = !releaseAlreadyIncremented && !arrivalAwaitingCapacity;
  if (!liveRelease) {
    if (!bedCameFree) return withPerson;
    // A departure nobody flagged still vacates a bed: record its release, already discharged, to
    // carry "Being made ready". Same id scheme as FLAG_BED_RELEASE.
    const vacated: BedRelease = {
      id: `WR-9${String(withPerson.bedReleases.length).padStart(2, "0")}`,
      unitId: unit.id,
      admissionId: admission.id,
      state: "discharged",
      expectedAt: now,
      waitingOn: null,
      blocker: null,
      blockedBy: null,
      preparing: true,
      preparationNote: null,
      confirmedAt: now,
      confirmedBy: recordedByLabel(role, unit.name),
    };
    return { ...withPerson, bedReleases: [...withPerson.bedReleases, vacated] };
  }
  // Leaving completes this person's release — the same fields RELEASE_BED used to write. A stuck flag
  // comes off, because the bed is no longer held up.
  return replaceBedRelease(withPerson, liveRelease.id, {
    ...liveRelease,
    state: "discharged",
    waitingOn: null,
    blocker: null,
    blockedBy: null,
    preparing: bedCameFree,
    preparationNote: null,
    confirmedAt: now,
  });
}

type ProtectedRecordEvent = Extract<
  WardFlowEvent,
  {
    type:
      | "OPEN_DISCHARGE_RECORD"
      | "REVIEW_AUDIT_EVENT"
      | "UNDO_AUDIT_REVIEW"
      | "RECORD_PATIENT_DISCHARGE"
      | "RECORD_ADMISSION_FOLLOW_UP"
      | "RECORD_ADMISSION_CARE";
  }
>;

function protectedRefusal(
  state: WardFlowState,
  event: ProtectedRecordEvent,
  decision: AuditDecision,
  rejectionReason = "Request could not be completed",
): WardFlowState {
  const rejected =
    finiteInstant(event.now) === null
      ? state
      : {
          ...state,
          rejections: [
            ...state.rejections,
            {
              id: `record-rejection-${state.auditSequence + 1}`,
              at: event.now,
              movementId: "none",
              attempted: event.type,
              reason: withoutRecordNumbers(rejectionReason),
            },
          ],
        };
  return appendAudit(state, rejected, event, decision);
}

/**
 * Whether a patient record's free-text legal status is involuntary, for the two discharge guards
 * below. Deliberately wide: anything starting "Involuntary", plus "Detained awaiting examination".
 * Refusing a discharge that needs a revocation first is the conservative failure.
 */
export function patientRecordIsInvoluntary(legalStatus: string | undefined): boolean {
  if (legalStatus === undefined) return false;
  return /^involuntary\b/i.test(legalStatus.trim()) || legalStatus === "Detained awaiting examination";
}

/** A previous stay must never decide this admission's discharge or transport state. */
export function dischargeMovement(state: WardFlowState, admission: Admission): Movement | undefined {
  return (
    state.movements.find((movement) => movement.admissionId === admission.id) ??
    state.movements.find(
      (movement) =>
        admission.patientId !== null &&
        movement.patientId === admission.patientId &&
        movement.admissionId === undefined &&
        movement.closure === undefined,
    )
  );
}

/** A collected journey whose vehicle has not yet arrived or been stood down. */
function movementInTransit(movement: Movement): boolean {
  return (
    movement.stage === "moving" ||
    (movement.transport?.collectedAt !== undefined &&
      movement.transport.arrivedAt === undefined &&
      movement.transport.cancelledAt === undefined)
  );
}

/**
 * The journey that makes a discharge unsafe: the stay's own inbound movement, or an open journey
 * leaving this stay that is on the road. Otherwise a patient collected for a transfer could be
 * discharged and the receiving ward's arrival could never close (review finding S1-1).
 */
export function dischargeBlockingTransit(state: WardFlowState, admission: Admission): Movement | undefined {
  const linked = dischargeMovement(state, admission);
  if (linked && movementInTransit(linked)) return linked;
  return state.movements.find(
    (movement) =>
      movement.closure === undefined &&
      movementInTransit(movement) &&
      movementSourceAdmission(state, movement)?.id === admission.id,
  );
}

/** "NUM <ward>" when the ward recorded it, otherwise the role's own label (the coordinator acts too). */
export function recordedByLabel(role: WardFlowRole, unitName: string): string {
  return role === "ward" ? `NUM ${unitName}` : WARD_FLOW_ROLE_LABELS[role];
}

function reduceRecordEvent(state: WardFlowState, event: ProtectedRecordEvent): WardFlowState {
  const deny = (
    reasonCode: AuditDecision["reasonCode"],
    outcome: AuditDecision["outcome"] = "denied",
    rejectionReason?: string,
  ) => protectedRefusal(state, event, { outcome, reasonCode }, rejectionReason);
  // Role is inspected before any protected payload or legacy rejection helper.
  if (!EVENT_ROLE[event.type].includes(event.role))
    return deny("role", "denied", event.type === "UNDO_AUDIT_REVIEW" ? "Coordinator only" : undefined);
  if (finiteInstant(event.now) === null || !safeCounter(event.expectedGeneration)) return deny("invalid-payload");
  if (event.expectedGeneration !== state.worldGeneration) return deny("generation", "stale");

  if (event.type === "UNDO_AUDIT_REVIEW") {
    // v10 pass 2: takes back one review exactly — the review list returns to what it was before it.
    // The audit log keeps both the review and this undo; review ids are never reused.
    const review = uniqueRecord(state.auditReviews, event.reviewId);
    if (!review || review.generation !== state.worldGeneration)
      return deny("missing-or-inaccessible", "denied", "That review is not on record, so it cannot be undone");
    const index = state.auditReviews.indexOf(review);
    if (
      state.auditReviews.some(
        (other, at) => at > index && other.eventId === review.eventId && other.generation === review.generation,
      )
    )
      return deny("revision", "stale", "A later review of this event is on record; undo that one first");
    const windowRefusal = undoWindowRefusal(review.at, event.now);
    if (windowRefusal) return deny("transition", "denied", windowRefusal);
    return appendAudit(
      state,
      { ...state, auditReviews: state.auditReviews.filter((other) => other !== review) },
      event,
      { outcome: "accepted", reasonCode: "none" },
    );
  }

  if (event.type === "REVIEW_AUDIT_EVENT") {
    if (!safeCounter(event.expectedReviewCount) || !reviewDecision(event.decision)) return deny("invalid-payload");
    // v10 pass 2: the synthetic seeded governance entries (`ward-governance-seed.ts`) are reviewable too.
    const entry = uniqueRecord(governanceAuditEvents(state), event.eventId);
    if (!entry || entry.generation !== state.worldGeneration || entry.category === "review")
      return deny("missing-or-inaccessible");
    const count = state.auditReviews.filter(
      (review) => review.eventId === entry.id && review.generation === state.worldGeneration,
    ).length;
    if (count !== event.expectedReviewCount) return deny("revision", "stale");
    if (!safeCounter(state.auditReviewSequence) || state.auditReviewSequence >= Number.MAX_SAFE_INTEGER)
      return deny("invalid-payload");
    const sequence = state.auditReviewSequence + 1;
    return appendAudit(
      state,
      {
        ...state,
        auditReviewSequence: sequence,
        auditReviews: [
          ...state.auditReviews,
          {
            id: `audit-review-${sequence}`,
            eventId: entry.id,
            generation: state.worldGeneration,
            at: event.now,
            byRole: "coordinator",
            decision: event.decision,
          },
        ],
      },
      event,
      { outcome: "accepted", reasonCode: "none" },
    );
  }

  // The coordinator may take every action (Josh, 10 Oct 2026) and acts for no single ward, so it is
  // scoped by role alone and its unit comes from the admission below.
  const actor = (
    event.role === "coordinator"
      ? { role: event.role }
      : "actingUnitId" in event
        ? { role: event.role, actingUnitId: event.actingUnitId }
        : "actingTeamId" in event
          ? { role: event.role, actingTeamId: event.actingTeamId }
          : { role: event.role }
  ) as WardRecordActor;
  if (!validRecordActor(actor)) return deny("scope");
  if (event.type === "OPEN_DISCHARGE_RECORD") {
    if (!safeCounter(event.requestId)) return deny("invalid-payload");
    const previous = state.auditEvents.find(
      (entry) =>
        entry.category === "record-access" &&
        entry.generation === state.worldGeneration &&
        entry.details.requestId === event.requestId,
    );
    if (previous) {
      const read = readOpenedDischargeRecord(state, actor, event.admissionId, {
        generation: event.expectedGeneration,
        requestId: event.requestId,
      });
      return read.status === "allowed" ? state : deny("missing-or-inaccessible");
    }
    if (selectDischargeRecord(state, actor, event.admissionId).status === "denied")
      return deny("missing-or-inaccessible");
    return appendAudit(state, state, event, { outcome: "accepted", reasonCode: "none" });
  }

  if (!safeCounter(event.expectedRevision)) return deny("invalid-payload");
  const admission = uniqueRecord(state.admissions, event.admissionId);
  const unit = uniqueRecord(
    state.units,
    event.role === "coordinator" ||
      ((event.type === "RECORD_ADMISSION_FOLLOW_UP" || event.type === "RECORD_ADMISSION_CARE") &&
        event.role === "community")
      ? admission?.unitId
      : event.actingUnitId,
  );
  if (!unit || !admission || !uniqueRecord(state.units, admission.unitId)) return deny("missing-or-inaccessible");
  if (admission.unitId !== unit.id) return deny("scope");
  const identity = dischargeIdentity(state, admission);
  if (identity.kind !== "linked" || identity.patient.id !== event.patientId) return deny("identity-link");
  const revision = state.dischargeRevisions[admission.id] ?? 0;
  if (!safeCounter(revision) || revision >= Number.MAX_SAFE_INTEGER) return deny("invalid-payload");
  if (revision !== event.expectedRevision) return deny("revision", "stale");
  if (event.type === "RECORD_ADMISSION_CARE") {
    if (selectDischargeRecord(state, actor, admission.id).status === "denied") return deny("scope");
    if (!validCareChange(event.change)) return deny("invalid-payload");
    if (event.role === "community" && !["follow_up", "contact", "plan", "document"].includes(event.change.kind))
      return deny("role");
    if (
      (admission.state !== "occupied" && admission.state !== "departed") ||
      (admission.arrivedAt !== null && event.now < admission.arrivedAt)
    )
      return deny("transition");
    if (
      event.role === "community" &&
      ((event.change.kind === "follow_up" && event.change.serviceId !== event.actingTeamId) ||
        (event.change.kind === "contact" &&
          admission.careJourney?.followUp &&
          admission.careJourney.followUp.serviceId !== event.actingTeamId))
    )
      return deny("scope");
    // D-30: only the central bed coordinator accepts an inter-ward transfer.
    if (event.change.kind === "transfer" && event.change.step === "accepted" && event.role !== "coordinator")
      return deny("role");
    const refusal = careChangeRefusal(admission, event.change, event.now);
    if (refusal) return deny("transition", "denied", refusal);
    if (event.change.kind === "transfer" && !uniqueRecord(state.units, event.change.receivingUnitId))
      return deny("missing-or-inaccessible");
    if (
      event.change.kind === "transport" &&
      event.change.authority === "none" &&
      ["ambulance", "service_vehicle", "police", "rfds"].includes(event.change.mode)
    ) {
      const movement = dischargeMovement(state, admission);
      const patient = uniqueRecord(state.patients, admission.patientId);
      if (patientRecordIsInvoluntary(patient?.legalStatus) || (movement && movement.legalStatus !== "Voluntary"))
        return deny("transition", "denied", "Record the checked transport authority for this involuntary arrangement.");
    }
    if (event.change.kind === "legal" && event.change.authority === "5B") {
      const previous = admission.careJourney?.legal?.authority ?? dischargeMovement(state, admission)?.legalForm?.code;
      if (previous !== "5A" && previous !== "5B")
        return deny(
          "transition",
          "denied",
          "A Form 5B continuation needs a recorded Form 5A or earlier Form 5B for this stay.",
        );
    }
    const careJourney = applyCareChange(
      admission.careJourney ?? emptyCareJourney(),
      event.change,
      event.now,
      WARD_FLOW_ROLE_LABELS[event.role],
    );
    let next = replaceAdmission(state, admission.id, {
      ...admission,
      careJourney,
      ...(event.change.kind === "follow_up"
        ? {
            followUp: {
              state: "arranged" as const,
              recordedAt: event.now,
              recordedBy: WARD_FLOW_ROLE_LABELS[event.role],
            },
          }
        : {}),
    });
    if (event.change.kind === "transfer" && event.change.step === "arrived") {
      if (event.role !== "coordinator" || admission.state !== "occupied") return deny("role");
      const receiving = uniqueRecord(state.units, event.change.receivingUnitId);
      const movement = dischargeMovement(state, admission);
      if (
        !receiving ||
        !safeCounter(receiving.empty.value) ||
        receiving.empty.value <= 0 ||
        !movement ||
        !eligibility(movement, receiving, event.now).eligible
      )
        return deny(
          "transition",
          "denied",
          "The receiving ward must have a suitable available bed and a linked placement record.",
        );
      if (
        state.admissions.some(
          (a) =>
            a.id !== admission.id &&
            a.patientId === admission.patientId &&
            (a.state === "occupied" || a.state === "pulled"),
        )
      )
        return deny("transition", "denied", "The patient already has another occupied or held bed.");
      if (
        (admission.specialling && remainingSpeciallingCapacity(receiving, state.admissions) <= 0) ||
        (admission.highAcuity && remainingHighAcuityCapacity(receiving, state.admissions) <= 0)
      )
        return deny("transition", "denied", "The receiving ward must have the required staffing capacity.");
      const bedKind =
        movement.legalStatus === "Voluntary" && openBedsFree(receiving) > 0 ? ("open" as const) : ("locked" as const);
      if (bedKind === "locked" && lockedBedsFree(receiving) <= 0) return deny("transition");
      const id = `transfer-${admission.id}-${revision + 1}`;
      const movementId: MovementId = `WF-${id}`;
      if (state.admissions.some((a) => a.id === id) || state.movements.some((m) => m.id === movementId))
        return deny("invalid-payload");
      next = departAdmission(
        next,
        { ...admission, careJourney },
        unit,
        event.now,
        "transferred-to-another-psychiatric-ward",
        event.role,
      );
      next = replaceUnit(next, receiving.id, {
        ...receiving,
        empty: { ...receiving.empty, value: receiving.empty.value - 1 },
        allocatable: { ...receiving.allocatable, value: receiving.allocatable.value - 1 },
        allocatableLocked: receiving.allocatableLocked - (bedKind === "locked" ? 1 : 0),
        sexMix: adjustSexMix(receiving.sexMix, mixSexOf(admission.gender, admission.sex), 1),
      });
      next = {
        ...next,
        admissions: [
          ...next.admissions,
          {
            ...admission,
            id,
            unitId: receiving.id,
            movementId,
            state: "occupied",
            bedKind,
            pulledAt: event.now,
            arrivedAt: event.now,
            leftAt: null,
            leavingDestination: null,
            expectedDischargeAt: null,
            dischargeConfirmedAt: null,
            dischargeDateSetAt: null,
            dischargeDateSetBy: null,
            dischargeConfirmedBy: null,
            dischargeDateMoves: 0,
            blockReason: null,
            awayAtEmergencyDepartmentSince: null,
            careJourney: { ...emptyCareJourney(), followUp: careJourney.followUp },
          },
        ],
        movements: [
          ...next.movements,
          {
            ...movement,
            id: movementId,
            admissionId: id,
            acceptedUnitId: receiving.id,
            stage: "arrived",
            openedAt: event.now,
            referredAt: undefined,
            acceptedAt: undefined,
            referredUnitIds: [receiving.id],
            arrivalDetails: undefined,
            arrivalLateNotifiedAt: undefined,
            expectFlag: undefined,
            stageChanges: [{ at: event.now, to: "arrived", by: event.role, reason: "Recorded ward transfer arrival" }],
            transport: undefined,
            closure: { at: event.now, outcome: "arrived", reason: "Recorded ward transfer arrival" },
          },
        ],
        dischargeRevisions: { ...next.dischargeRevisions, [id]: 0 },
      };
    }
    return appendAudit(
      state,
      { ...next, dischargeRevisions: { ...next.dischargeRevisions, [admission.id]: revision + 1 } },
      event,
      { outcome: "accepted", reasonCode: "none" },
    );
  }
  if (event.type === "RECORD_ADMISSION_FOLLOW_UP") {
    if (typeof event.followUpState !== "string" || !isFollowUpState(event.followUpState))
      return deny("invalid-payload");
    if (
      (admission.state !== "occupied" && admission.state !== "departed") ||
      admission.leavingDestination === "died-on-the-ward"
    )
      return deny("transition");
    if (admission.arrivedAt !== null && event.now < admission.arrivedAt) return deny("invalid-payload");
    const next = replaceAdmission(state, admission.id, {
      ...admission,
      followUp: { state: event.followUpState, recordedAt: event.now, recordedBy: WARD_FLOW_ROLE_LABELS[event.role] },
    });
    return appendAudit(
      state,
      {
        ...next,
        dischargeRevisions: { ...next.dischargeRevisions, [admission.id]: revision + 1 },
      },
      event,
      { outcome: "accepted", reasonCode: "none" },
    );
  }
  if (!isLeavingDestination(event.leavingDestination)) return deny("invalid-payload");
  if (admission.state !== "occupied") return deny("transition");
  if (admission.arrivedAt !== null && event.now < admission.arrivedAt) return deny("invalid-payload");

  // Involuntary patient discharge boundary (WA Mental Health Act 2014)
  const fullPatient = uniqueRecord(state.patients, identity.patient.id);
  const linkedMovement = dischargeMovement(state, admission);
  if (
    patientRecordIsInvoluntary(fullPatient?.legalStatus) ||
    (linkedMovement?.legalStatus !== undefined && linkedMovement.legalStatus !== "Voluntary")
  ) {
    if (
      event.leavingDestination === "discharged-to-the-community" ||
      event.leavingDestination === "left-against-advice"
    ) {
      if (!recordedCommunityTransition(admission, linkedMovement?.statusChanges.at(-1)?.at, event.leavingDestination)) {
        return deny(
          "transition",
          "denied",
          "Cannot discharge an involuntary patient without an explicit revocation order or recorded community treatment order transition.",
        );
      }
    }
  }

  // Discharge blocked while in transit, inbound or outbound
  if (dischargeBlockingTransit(state, admission)) {
    return deny("transition", "denied", "Patient is currently in transit to another facility.");
  }
  return appendAudit(
    state,
    departAdmission(state, admission, unit, event.now, event.leavingDestination, event.role),
    event,
    {
      outcome: "accepted",
      reasonCode: "none",
    },
  );
}

/** Any ward-resource update invalidates a capacity draft, including protected departures. */
function advanceResourceRevisions(before: WardFlowState, after: WardFlowState): WardFlowState {
  if (after.units === before.units) return after;
  return {
    ...after,
    units: after.units.map((unit) => {
      const previous = before.units.find((candidate) => candidate.id === unit.id);
      if (!previous || previous === unit || (unit.allocatable.revision ?? 0) !== (previous.allocatable.revision ?? 0))
        return unit;
      return { ...unit, allocatable: { ...unit.allocatable, revision: (previous.allocatable.revision ?? 0) + 1 } };
    }),
  };
}

/**
 * Why a stay cannot go in bed `bedNumber` of `unit` (v10 pass 2, Bed board), or null. The number
 * must be a whole bed on the unit, and no other current stay on the unit may be recorded in it.
 */
export function bedNumberRefusal(
  state: WardFlowState,
  unit: Unit,
  bedNumber: number,
  exceptAdmissionId: string | undefined,
): string | null {
  if (!Number.isInteger(bedNumber) || bedNumber < 1 || bedNumber > unit.beds)
    return `Bed ${String(bedNumber)} is not one of ${unit.name}'s ${unit.beds} beds`;
  const holder = state.admissions.find(
    (candidate) =>
      candidate.id !== exceptAdmissionId &&
      candidate.unitId === unit.id &&
      candidate.bedNumber === bedNumber &&
      bedIsOccupied(candidate),
  );
  return holder ? `Bed ${bedNumber} on ${unit.name} is already taken` : null;
}

/**
 * v10 pass 3: why bed `bedNumber` of `unit` is already held for somebody on their way, or null. A
 * bed is held by another open movement this ward accepted into it, or by an accepted referral.
 */
export function heldBedRefusal(
  state: WardFlowState,
  unit: Unit,
  bedNumber: number,
  exceptMovementId?: string,
  exceptReferralId?: string,
): string | null {
  const heldByMovement = state.movements.some(
    (other) =>
      other.id !== exceptMovementId &&
      other.closure === undefined &&
      other.acceptedUnitId === unit.id &&
      other.heldBedNumber === bedNumber,
  );
  const heldByReferral = state.referrals.some(
    (referral) =>
      referral.id !== exceptReferralId &&
      // A patient who has arrived on THIS ward no longer needs the bed held; an arrival elsewhere does.
      !state.movements.some(
        (movement) =>
          movement.referralId === referral.id && movement.stage === "arrived" && movement.acceptedUnitId === unit.id,
      ) &&
      referral.destinations.some(
        (arm) =>
          arm.state === "accepted" &&
          arm.heldBedNumber === bedNumber &&
          arm.destination.kind === "psychiatric_ward" &&
          // A referral sent to any ward names its ward only once accepted (`acceptedUnitId`).
          (arm.acceptedUnitId ?? arm.destination.unitId) === unit.id,
      ),
  );
  return heldByMovement || heldByReferral ? `Bed ${bedNumber} on ${unit.name} is already held for someone` : null;
}

/**
 * v10 pass 2: after an ACCEPTED `ACCEPT_REFERRAL` or `DECLINE_REFERRAL`, keeps what it changed so
 * `UNDO_REFERRAL_DECISION` can restore it exactly. A refused decision changes nothing to undo.
 */
function withReferralDecisionUndo(state: WardFlowState, next: WardFlowState, event: WardFlowEvent): WardFlowState {
  if (event.type !== "ACCEPT_REFERRAL" && event.type !== "DECLINE_REFERRAL") return next;
  if (next.rejections.length !== state.rejections.length) return next;
  const before = findReferral(state, event.referralId);
  const after = findReferral(next, event.referralId);
  if (!before || !after || before === after) return next;
  return {
    ...next,
    undoRecords: withUndoRecord(next.undoRecords, {
      kind: "referral-decision",
      action: event.type,
      referralId: before.id,
      at: event.now,
      role: event.role,
      // The ward that answered: named on the event, or the one ward this referral was addressed to.
      unitId:
        event.destinationKind === "psychiatric_ward"
          ? (event.unitId ??
            before.destinations
              .map((arm) => (arm.destination.kind === "psychiatric_ward" ? arm.destination.unitId : undefined))
              .find((unitId) => unitId !== undefined) ??
            null)
          : null,
      before,
      after,
      noticeIds: next.notices.slice(state.notices.length).map((notice) => notice.id),
    }),
  };
}

/** What each step undo says when there is nothing of its kind on the subject to take back. */
export const UNDO_STEP_NOTHING: Record<UndoStepType, string> = {
  UNDO_REFER_TO_UNITS: "There is no referral to wards on this patient to undo",
  UNDO_ACCEPT_IN_PRINCIPLE: "There is no acceptance on this patient to undo",
  UNDO_LEGAL_FORM_RECORD: "There is no legal form record on this patient to undo",
  UNDO_SUPPORT_NOTIFICATION: "There is no Tell record on this move to undo",
  UNDO_REPATRIATION: "There is no repatriation on this stay to undo",
  UNDO_HANDOVER_SIGN_OFF: "There is no handover sign-off to undo",
  UNDO_ED_STEP: "There is no ED step on this patient to undo",
  UNDO_TRANSPORT_STEP: "There is no transport step on this journey to undo",
  UNDO_DEPARTURE: "There is no recorded departure on this stay to undo",
  UNDO_ABSENT_WITHOUT_LEAVE: "There is no absence on this stay to undo",
};

/**
 * v10 pass 3: after an undoable step that changed something, keeps exactly what it changed so its
 * undo event can restore it (`UNDO_STEP_ACTIONS`). A refused step changes nothing to undo; a partly
 * refused one (a ward held back from a referral) keeps what it did do.
 */
function withStepUndo(state: WardFlowState, next: WardFlowState, event: WardFlowEvent): WardFlowState {
  const undoType = undoStepTypeFor(event.type);
  if (!undoType) return next;
  const changes = diffForStepUndo(state, next);
  if (changes.length === 0) return next;
  const acting = "actingUnitId" in event && typeof event.actingUnitId === "string" ? event.actingUnitId : undefined;
  const unitId = event.role !== "ward" ? null : event.type === "ACCEPT_IN_PRINCIPLE" ? event.unitId : (acting ?? null);
  return {
    ...next,
    undoRecords: withUndoRecord(next.undoRecords, {
      kind: "step",
      undoType,
      action: event.type as StepUndo["action"],
      subjectId: undoStepSubjectId(event),
      at: event.now,
      seq: nextStepUndoSeq(next.undoRecords, state.auditSequence),
      role: event.role,
      unitId,
      changes,
    }),
  };
}

/** Capture is one reducer-boundary append; clinical branches supply their actual verdict. */
export function wardFlowReducer(state: WardFlowState, event: WardFlowEvent): WardFlowState {
  const protectedEvent =
    event.type === "OPEN_DISCHARGE_RECORD" ||
    event.type === "REVIEW_AUDIT_EVENT" ||
    event.type === "UNDO_AUDIT_REVIEW" ||
    event.type === "RECORD_PATIENT_DISCHARGE" ||
    event.type === "RECORD_ADMISSION_FOLLOW_UP" ||
    event.type === "RECORD_ADMISSION_CARE";
  if (
    classifyAuditEvent(event) &&
    (!safeCounter(state.auditSequence) || state.auditSequence >= Number.MAX_SAFE_INTEGER)
  )
    return state;
  if (protectedEvent) {
    const recorded = advanceResourceRevisions(state, reduceRecordEvent(state, event));
    // Audit A1-12: a recorded discharge ("Has left") keeps what it changed, so its toast can undo it.
    return event.type === "RECORD_PATIENT_DISCHARGE" ? withStepUndo(state, recorded, event) : recorded;
  }
  if (
    (event.type === "RESET_SCENARIO" || event.type === "SET_SCENARIO") &&
    (!safeCounter(state.worldGeneration) || state.worldGeneration >= Number.MAX_SAFE_INTEGER)
  )
    return state;
  // Refuse counter exhaustion before either legacy projection writer changes clinical state.
  const admissionId =
    event.type === "RECORD_LEAVING"
      ? event.admissionId
      : event.type === "PATIENT_ARRIVED"
        ? state.movements.find((movement) => movement.id === event.movementId)?.admissionId
        : undefined;
  if (admissionId !== undefined && EVENT_ROLE[event.type].includes(event.role)) {
    const revision = state.dischargeRevisions[admissionId] ?? 0;
    if (!safeCounter(revision) || revision >= Number.MAX_SAFE_INTEGER) return state;
  }
  const decision: AuditDecision = { outcome: "denied", reasonCode: "transition" };
  let next = withReferralDecisionUndo(state, reduceClinicalEvent(state, event, decision), event);
  if (event.type !== "RESET_SCENARIO" && event.type !== "SET_SCENARIO") {
    next = withStepUndo(state, advanceResourceRevisions(state, next), event);
  }
  // `next.movements !== state.movements` (Y4 privacy fix): only a genuine reseed produces a fresh
  // `movements` array; a rejected `SET_SCENARIO` keeps the original reference. Without it, a
  // refused dispatch would bump `worldGeneration` and wrongly clear the provider's typed-text lock.
  if (
    (event.type === "RESET_SCENARIO" || event.type === "SET_SCENARIO") &&
    EVENT_ROLE[event.type].includes(event.role) &&
    next.movements !== state.movements
  )
    return { ...next, worldGeneration: state.worldGeneration + 1 };
  return appendAudit(state, next, event, decision);
}

/**
 * The single writer for a referrer's own withdrawal (`WITHDRAW_REFERRAL` before acceptance and the
 * `RECORD_REFERRER_WITHDRAWAL` cascade): every live ward request is recorded as `referrer_withdrew`
 * and the movement no longer names an accepting or reviewing ward.
 */
export function withdrawAllLiveRequestsForReferrer(
  movement: Movement,
  now: Instant,
  /** Who ended the referral. A coordinator withdrawing it is recorded as such, not as the referrer. */
  reason: "referrer_withdrew" | "coordinator_withdrew" = "referrer_withdrew",
): Pick<Movement, "acceptedUnitId" | "referredUnitIds" | "withdrawnReferrals" | "referralAnswerHistory"> {
  return {
    acceptedUnitId: undefined,
    referredUnitIds: [],
    withdrawnReferrals: [
      ...movement.withdrawnReferrals,
      ...movement.referredUnitIds.map((unitId) => ({ unitId, at: now, reason })),
    ],
    referralAnswerHistory: [
      ...(movement.referralAnswerHistory ?? []),
      ...movement.referredUnitIds.map((unitId) => ({ unitId, at: now, answer: "withdrawn" as const })),
    ],
  };
}

export function reduceClinicalEvent(
  state: WardFlowState,
  event: WardFlowEvent,
  decision: AuditDecision,
): WardFlowState {
  // 1. Role check first, before the event's payload is inspected at all.
  const permittedRoles = EVENT_ROLE[event.type] ?? [];
  if (!permittedRoles.includes(event.role)) {
    decision.reasonCode = "role";
    return reject(
      state,
      event,
      permittedRoles.length > 0
        ? `${event.type} requires role ${permittedRoles.join(" or ")}, but was raised by role ${event.role}`
        : `Unknown or unpermitted event type: ${event.type}`,
    );
  }

  // v10 pass 3: a malformed second sign-off is refused whole, before anything is recorded.
  const signOffRefusal = overrideSignOffRefusal(event);
  if (signOffRefusal) return reject(state, event, signOffRefusal);

  // D-34 is an explicit recorded pause, not an inference from absent clearance.
  const pausedPlacementEvents: readonly WardFlowEvent["type"][] = [
    "REFER_TO_UNITS",
    "ACCEPT_IN_PRINCIPLE",
    "ACCEPT_REFERRAL",
    "PULL_PATIENT",
    "BOOK_TRANSPORT",
    "HANDOVER_READY",
    "TRANSPORT_ACCEPTED",
    "TRANSPORT_EN_ROUTE",
    "PATIENT_COLLECTED",
    "PATIENT_ARRIVED",
  ];
  if ("movementId" in event && event.movementId !== undefined && pausedPlacementEvents.includes(event.type)) {
    const movement = findMovement(state, event.movementId);
    if (movement?.medicalDeterioration && movement.medicalDeterioration.resumedAt === undefined) {
      return reject(
        state,
        event,
        "Medical Deterioration - ED Resuscitation Required: placement is paused until fresh medical re-clearance.",
      );
    }
  }

  // Explicitly not medically cleared blocks onward transfer, but is not authority to
  // refund a reservation. Only the separately recorded D-34 event performs that unwind.
  const medicalTransferEvents: readonly WardFlowEvent["type"][] = [
    "BOOK_TRANSPORT",
    "HANDOVER_READY",
    "TRANSPORT_ACCEPTED",
    "TRANSPORT_EN_ROUTE",
    "PATIENT_COLLECTED",
    "PATIENT_ARRIVED",
  ];
  if (
    "movementId" in event &&
    event.movementId !== undefined &&
    medicalTransferEvents.includes(event.type) &&
    (() => {
      const movement = findMovement(state, event.movementId);
      if (!movement) return false;
      // Arrival records physical presence. A later negative clearance cannot erase an
      // already collected person's arrival; it still blocks departure before collection.
      if (
        event.type === "PATIENT_ARRIVED" &&
        movement.stage === "moving" &&
        movement.transport?.collectedAt !== undefined
      )
        return false;
      return recordedMovementMedicalClearance(movement, state.referrals)?.cleared === false;
    })()
  ) {
    return reject(
      state,
      event,
      "Medical clearance is explicitly not granted; onward transfer is paused until clinical re-clearance.",
    );
  }

  switch (event.type) {
    case "RECORD_PATIENT_DISCHARGE":
    case "RECORD_ADMISSION_CARE":
    case "RECORD_ADMISSION_FOLLOW_UP":
    case "OPEN_DISCHARGE_RECORD":
    case "REVIEW_AUDIT_EVENT":
    case "UNDO_AUDIT_REVIEW":
      return state;
    case "UNDO_REFERRAL_DECISION":
    case "UNDO_PLACE_IN_BED":
    case "UNDO_REFER_TO_UNITS":
    case "UNDO_ACCEPT_IN_PRINCIPLE":
    case "UNDO_LEGAL_FORM_RECORD":
    case "UNDO_SUPPORT_NOTIFICATION":
    case "UNDO_REPATRIATION":
    case "UNDO_HANDOVER_SIGN_OFF":
    case "UNDO_ED_STEP":
    case "UNDO_TRANSPORT_STEP":
    case "UNDO_DEPARTURE":
    case "UNDO_ABSENT_WITHOUT_LEAVE":
      return reduceUndoEvent(state, event, decision, UNDO_EVENT_HELPERS);

    case "PLACE_IN_BED": {
      const admission = findAdmission(state, event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.role === "ward" && event.actingUnitId !== admission.unitId)
        return reject(state, event, "A ward may only move patients between its own beds");
      if (!bedIsOccupied(admission)) return reject(state, event, "Only a current stay can be placed in a bed");
      const unit = findUnit(state, admission.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${admission.unitId}`);
      if (admission.bedNumber === event.bedNumber)
        return reject(state, event, `This stay is already recorded in bed ${event.bedNumber}`);
      const bedRefusal = bedNumberRefusal(state, unit, event.bedNumber, admission.id);
      if (bedRefusal) return reject(state, event, bedRefusal);
      const heldRefusal = heldBedRefusal(state, unit, event.bedNumber);
      if (heldRefusal) return reject(state, event, heldRefusal);
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const placed = replaceAdmission(state, admission.id, { ...admission, bedNumber: event.bedNumber });
      return {
        ...placed,
        undoRecords: withUndoRecord(state.undoRecords, {
          kind: "bed-placement",
          admissionId: admission.id,
          unitId: admission.unitId,
          at: event.now,
          role: event.role,
          beforeBed: admission.bedNumber ?? null,
          afterBed: event.bedNumber,
        }),
      };
    }

    case "UPDATE_EXPECTED_DISCHARGE": {
      const admission = findAdmission(state, event.admissionId);
      if (!admission) {
        return reject(state, event, `no admission found for id ${event.admissionId}`);
      }
      if (admission.state === "departed") {
        return reject(state, event, `cannot update expected discharge for departed admission ${event.admissionId}`);
      }
      if (event.role === "ward" && (!event.actingUnitId || event.actingUnitId !== admission.unitId)) {
        return reject(
          state,
          event,
          `UPDATE_EXPECTED_DISCHARGE was raised acting as unit ${event.actingUnitId ?? "unspecified"} but admission ${admission.id} belongs to unit ${admission.unitId}`,
        );
      }
      if (typeof event.expectedDischargeAt !== "number" || !Number.isFinite(event.expectedDischargeAt)) {
        return reject(state, event, `UPDATE_EXPECTED_DISCHARGE expectedDischargeAt must be a valid timestamp`);
      }
      const isDateMove =
        admission.expectedDischargeAt !== null && admission.expectedDischargeAt !== event.expectedDischargeAt;
      const updated: Admission = {
        ...admission,
        expectedDischargeAt: event.expectedDischargeAt,
        dischargeDateMoves: isDateMove ? admission.dischargeDateMoves + 1 : admission.dischargeDateMoves,
        dischargeDateSetAt: event.now,
        // Walkthrough D8 (25 Sept 2026): "Ward manager" only when a ward set it. A coordinator is not
        // a ward manager, and the approved role list has no other label, so the role is not recorded.
        dischargeDateSetBy: event.role === "ward" ? "Ward manager" : null,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceAdmission(state, admission.id, updated);
    }
    // A reset re-anchors onto the demo's current now rather than handing back a fixture authored at
    // NOW_ANCHOR, so predictions are not already lapsed. `event.now` includes `clockOffsetMinutes`,
    // which a reset clears; subtracting it keeps the visible clock from jumping.
    case "ADD_PATIENT": {
      // Adding a patient links to nothing (no movement, referral, unit or admission): somebody
      // searched, nobody came up, and this is the person who did not exist yet.
      //
      // `event.gender` is optional; membership-checked rather than trusted from the type.
      if (event.gender !== undefined && !GENDERS.includes(event.gender)) {
        return reject(state, event, "ADD_PATIENT gender must be chosen from GENDERS");
      }
      // Defensive uniqueness check: Reject duplicate UMRNs to prevent split clinical records
      const existingPatient = state.patients.find(
        (p) => p.umrn.trim().toLowerCase() === event.umrn.trim().toLowerCase(),
      );
      if (existingPatient) {
        return reject(
          state,
          event,
          `ADD_PATIENT UMRN collision: ${event.umrn.trim()} already belongs to patient ${existingPatient.id}`,
        );
      }
      // Optional suburb: blank/whitespace means "not yet recorded" (key absent), never store "".
      const suburb =
        typeof event.suburb === "string" && event.suburb.trim().length > 0 ? event.suburb.trim() : undefined;
      const patient: Patient = {
        id: `PT-A${String(state.patientSequence + 1).padStart(2, "0")}`,
        umrn: event.umrn,
        givenName: event.givenName,
        familyName: event.familyName,
        dateOfBirth: event.dateOfBirth,
        // Spread in only when supplied: "not yet recorded" is the key absent, never
        // present-and-`undefined`.
        ...(event.gender === undefined ? {} : { gender: event.gender }),
        ...(suburb === undefined ? {} : { suburb }),
        // v10 pass 2: when the record was added, so Add patient can count "Added today".
        addedAt: event.now,
      };
      return { ...state, patients: [...state.patients, patient], patientSequence: state.patientSequence + 1 };
    }

    case "RESET_SCENARIO":
      return seedWardFlowStateAt(event.now - state.clockOffsetMinutes - NOW_ANCHOR);

    case "SET_SCENARIO": {
      // Y4 privacy fix: membership-checked against `WARD_SCENARIOS`, the same list the restore-side
      // check reads, rather than trusted from the type.
      if (!WARD_SCENARIOS.includes(event.scenario)) {
        decision.reasonCode = "invalid-payload";
        return reject(state, event, `SET_SCENARIO scenario must be chosen from WARD_SCENARIOS`);
      }
      return seedWardFlowStateAt(event.now - state.clockOffsetMinutes - NOW_ANCHOR, event.scenario);
    }

    case "ADVANCE_CLOCK": {
      // Refuse a non-finite or negative amount, which would corrupt every deadline read off the
      // clock.
      if (finiteInstant(event.minutes) === null || event.minutes < 0) {
        return reject(state, event, "ADVANCE_CLOCK minutes must be a finite, non-negative number");
      }
      return { ...state, clockOffsetMinutes: state.clockOffsetMinutes + event.minutes };
    }

    // The settings screen dispatches this once with the whole draft. `validateConfiguration` is the
    // only door: an invalid payload is refused naming the field, never partially applied.
    case "SET_CONFIGURATION": {
      const requested = validateConfiguration(event.payload);
      if (!requested) {
        decision.reasonCode = "invalid-payload";
        return reject(state, event, describeInvalidConfiguration(event.payload));
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return { ...state, configuration: requested };
    }

    case "RAISE_REFERRAL": {
      if (event.draft.atsCategory !== undefined && ![1, 2, 3, 4, 5].includes(event.draft.atsCategory))
        return reject(state, event, "RAISE_REFERRAL ATS category must be a recorded integer from 1 to 5.");
      const department = allEmergencyDepartments().find((ed) => ed.id === event.edId);
      if (!department) {
        return reject(state, event, `no emergency department found for id ${event.edId}`);
      }
      const sequence = state.referralSequence + 1;
      // The clinician chooses the form; nothing derives one from `legalStatus` (product owner:
      // "avoid any hard rules now please"). `null` means the clinician chose no form, a real
      // answer. A code the picker cannot offer is refused rather than dropped or invented.
      const chosenCode = event.draft.legalFormCode;
      const chosenForm =
        chosenCode === null ? undefined : SELECTABLE_LEGAL_FORMS.find((form) => form.code === chosenCode);
      if (chosenCode !== null && chosenForm === undefined) {
        return reject(state, event, `no selectable legal form found for code ${chosenCode}`);
      }
      /**
       * The only place this reducer writes a `dueAt` on creation;
       * `tests/ward-legal-form-due-at-capture.test.ts` keeps it so. Typed by the clinician, never
       * computed: nothing here may turn a statutory interval into a deadline (owner: "just start a
       * clock once the patient arrives to ED").
       *
       * T2 (owner answer 1): the clinician types the expiry written on whichever form they hold, of
       * any code, so this keeps whatever was supplied regardless of the form's `kind`.
       * `RECORD_LEGAL_FORM_EXPIRY` records later expiries or extensions.
       */
      const capturedDueAt = event.draft.legalFormDueAt;
      /**
       * The link back to the front door: the only writer of `Movement.referralId` (owner ruling 8:
       * a community referral and the journey the ED raises are two linked records). It resolves
       * rather than stores: an id naming no referral is refused, since a plausible-looking id that
       * joins to nothing typechecks and renders.
       *
       * The referral must name this department: a journey at one ED claiming a referral addressed
       * to another is a false join. The purpose is deliberately not checked (owner: nobody declines
       * an ED notification on purpose).
       *
       * R5: a journey cannot be raised from an addressing its referrer withdrew or its
       * department declined, and a referral cannot fund two live journeys (checked below).
       */
      let raisedFrom: Referral | undefined;
      if (event.referralId !== undefined) {
        raisedFrom = findReferral(state, event.referralId);
        if (!raisedFrom) {
          return reject(
            state,
            event,
            `RAISE_REFERRAL referralId must name a referral this system already holds, and ${event.referralId} names none`,
          );
        }
        const referral = raisedFrom;
        const addressing = referral.destinations.find(
          (candidate) =>
            candidate.destination.kind === "emergency_department" && candidate.destination.edId === event.edId,
        );
        if (!addressing) {
          return reject(
            state,
            event,
            `referral ${referral.id} was never addressed to ${department.name}, so a journey raised there did not come from it`,
          );
        }
        /**
         * Withdrawal is checked separately from `state` (the O-17.11 split):
         * `RECORD_REFERRER_WITHDRAWAL` stamps `withdrawnAt` and never touches `state`. Checked
         * first: a withdrawn referral is dead whatever `state` reads.
         */
        if (addressing.withdrawnAt !== undefined) {
          return reject(
            state,
            event,
            `referral ${referral.id} was withdrawn by its referrer, so no journey can be raised from it`,
          );
        }
        // Declined specifically: `accepted` and `cancelled` do not say this department turned the
        // referral away. A decline on this destination is what must stop this department raising a
        // journey from it.
        if (addressing.state === "declined") {
          return reject(
            state,
            event,
            `${department.name} declined referral ${referral.id}, so no journey can be raised from it`,
          );
        }
        /**
         * Owner Q11: a second journey from the same referral is refused while an earlier
         * one blocks, and permitted once that earlier one closed `did_not_proceed`. P2-6: an
         * arrival also blocks, since it fulfilled the referral.
         * `tests/ward-raise-referral-uniqueness.test.ts` covers the Q11 case.
         *
         * `isOpen` (`ward-derivations.ts`) is not imported: that module imports from this file, so
         * importing back would be circular. Scoped to this referral's id, never `edId` alone.
         */
        const blockingLinkedMovement = state.movements.find(
          (movement) => movement.referralId === referral.id && movement.closure?.outcome !== "did_not_proceed",
        );
        if (blockingLinkedMovement) {
          return reject(
            state,
            event,
            `referral ${referral.id} already has a linked movement (${blockingLinkedMovement.id}) that did not close as "did not proceed"; a second journey cannot be raised while it stands`,
          );
        }
      }
      // Membership-checked like `RECEIVE_REFERRAL`'s `gender` and `tentativeDiagnosis`, so a caller
      // bypassing the picker's type cannot write an invented value.
      if (event.draft.gender !== undefined && !REFERRAL_GENDERS.includes(event.draft.gender)) {
        return reject(state, event, `RAISE_REFERRAL gender must be chosen from REFERRAL_GENDERS`);
      }
      if (
        event.draft.urgency !== undefined &&
        !URGENCY_LEVELS.includes(event.draft.urgency as (typeof URGENCY_LEVELS)[number])
      ) {
        return reject(state, event, `RAISE_REFERRAL urgency must be chosen from URGENCY_LEVELS`);
      }
      if (event.draft.tentativeDiagnosis !== undefined && !isTentativeDiagnosisBlock(event.draft.tentativeDiagnosis)) {
        return reject(state, event, `RAISE_REFERRAL tentativeDiagnosis must be chosen from TENTATIVE_DIAGNOSIS_BLOCKS`);
      }
      // A journey raised from a referral is for that referral's patient; naming someone else could
      // leave a person holding two beds (review finding S1-2).
      if (
        event.patientId !== undefined &&
        raisedFrom?.patientId !== undefined &&
        event.patientId !== raisedFrom.patientId
      ) {
        return reject(state, event, "RAISE_REFERRAL names a different patient from the one this referral is for");
      }
      const created: Movement = {
        id: nextReferralId(sequence),
        originEdId: event.edId,
        openedAt: event.now,
        patientId: event.patientId ?? raisedFrom?.patientId,
        // `undefined` when nobody referred this person, a real answer. Never a manufactured id: the
        // guard above refuses anything that does not resolve.
        referralId: raisedFrom?.id ?? event.referralId,
        /**
         * Owner ruling R-2026-09-04-D: the absence is written down, not left empty. A runtime
         * movement with no id says `not_asked`; only `RECORD_NO_REFERRAL`, where somebody answers
         * the question, writes `none_raised`. Exactly one of `referralId` and `referralAbsence` is
         * ever set.
         */
        referralAbsence: raisedFrom === undefined ? { reason: "not_asked" as const, at: event.now } : undefined,
        // A newly raised movement is never flagged. The flag is an act somebody takes on a
        // patient already in the queue, not a property of arriving.
        flaggedUrgent: false,
        urgency: event.draft.urgency,
        ...(raisedFrom?.medicalClearance === undefined ? {} : { medicalClearance: { ...raisedFrom.medicalClearance } }),
        ...(event.draft.atsCategory === undefined && raisedFrom?.atsCategory === undefined
          ? {}
          : { atsCategory: event.draft.atsCategory ?? raisedFrom?.atsCategory }),
        cohort: event.draft.cohort,
        security: event.draft.security,
        sex: event.draft.sex,
        gender: event.draft.gender,
        // T15 (item 12): the ED's own choice replaces whatever the linked referral carried.
        tentativeDiagnosis: event.draft.tentativeDiagnosis ?? raisedFrom?.tentativeDiagnosis,
        specialling: event.draft.specialling,
        highAcuity: event.draft.highAcuity,
        legalStatus: event.draft.legalStatus,
        // Spread-copied, never aliased: `SELECTABLE_LEGAL_FORMS` entries must not become mutable
        // state. The spread keeps `dueAt` off the object when none was typed, so absent and
        // explicitly-nothing are one shape.
        legalForm:
          chosenForm === undefined
            ? undefined
            : { ...chosenForm, ...(capturedDueAt === undefined ? {} : { dueAt: capturedDueAt }) },
        /**
         * T2r: a captured `dueAt` also gets its first history entry, so `dueAt` always equals the
         * last `legalFormExpiryHistory` entry. Written only when a due time was captured ("absent
         * means untouched").
         */
        legalFormExpiryHistory:
          capturedDueAt === undefined
            ? undefined
            : [{ at: event.now, by: event.role, dueAt: capturedDueAt, basis: "written_on_form" as const }],
        statusChanges: [],
        urgencyChanges: [],
        overrides: [],
        stage: "placement_requested",
        owner: department.name,
        referredUnitIds: [],
        declines: [],
        blocker: "Awaiting coordinator referral",
        withdrawnReferrals: [],
        unwinds: [],
        // The creation moment is the first entry, with no `from`.
        stageChanges: [{ at: event.now, to: "placement_requested", by: event.role }],
        // `formedAt` is deliberately unset: when a patient was formed in the community is a fact
        // only a clinician holds, and no rule may invent it. The fixture keeps its authored values.
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return {
        ...state,
        movements: [...state.movements, created],
        referralSequence: sequence,
      };
    }
    case "RECORD_MEDICAL_CLEARANCE":
    case "RECORD_ARRIVED_IN_DEPARTMENT":
    case "RECORD_TRANSPORT_NEED":
    case "RECORD_NO_REFERRAL":
    case "RECORD_ED_OUTCOME":
    case "RECORD_LEGAL_FORM_RECEIVED":
    case "RECORD_LEGAL_FORM_EXPIRY":
    case "RECORD_MOVEMENT_GENDER":
    case "RECORD_LEFT_DEPARTMENT":
    case "RECORD_EXAMINATION":
    case "RECORD_LEAVING":
    case "RECORD_MOVEMENT_BLOCKER":
    case "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT":
    case "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT":
    case "RECORD_STAY_DISCHARGE_BLOCKER":
    case "RECORD_WARD_INTAKE_CONSTRAINTS":
    case "RECORD_LEAVE_BED":
    case "RECORD_ABSENT_WITHOUT_LEAVE":
    case "RECORD_ABSENCE_STEP":
    case "RECORD_COMMUNITY_TREATMENT_ORDER":
    case "RECORD_REFERRER_WITHDRAWAL":
    case "RECORD_LOCAL_BED_SOUGHT":
    case "RECORD_ESCALATION":
    case "RECORD_DIVERSION":
    case "RECORD_ED_MEDICAL_DETERIORATION":
    case "RECORD_MOVEMENT_MEDICAL_CLEARANCE":
    case "RECORD_LEGAL_FORM_WRITTEN":
    case "RECORD_COUNTRY_EXTENSION":
    case "RECORD_LEGAL_FORM_CONTINUATION":
    case "RECORD_HANDOVER_SIGN_OFF":
    case "RECORD_REPATRIATION":
    case "RECORD_CLINICAL_CONTACT":
    case "RECORD_SUPPORT_NOTIFICATION":
      return reduceRecordedFactEvent(state, event, decision, RECORDED_FACT_EVENT_HELPERS);

    /**
     * T4: the undo for `RECORD_LEGAL_FORM_RECEIVED`. Clears `legalFormReceivedAt` and appends the
     * original instant, who corrected it and the reason to `legalFormReceiptCorrections`, so the
     * fact a receipt was recorded is kept and a fresh receipt can follow.
     */
    case "CORRECT_LEGAL_FORM_RECEIPT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(
          state,
          event,
          `cannot correct a legal form receipt for a closed movement (${movement.closure.reason})`,
        );
      }
      if (movement.legalFormReceivedAt === undefined) {
        return reject(state, event, `movement ${movement.id} has no recorded legal form receipt to correct`);
      }
      if (!LEGAL_FORM_RECEIPT_CORRECTION_REASONS.includes(event.reason)) {
        return reject(
          state,
          event,
          `CORRECT_LEGAL_FORM_RECEIPT reason "${event.reason}" is not one of the fixed correction reasons`,
        );
      }
      const correction = {
        at: event.now,
        by: event.role,
        reason: event.reason,
        receivedAt: movement.legalFormReceivedAt,
      };
      const updated: Movement = {
        ...movement,
        legalFormReceivedAt: undefined,
        legalFormReceiptCorrections: [...(movement.legalFormReceiptCorrections ?? []), correction],
      };
      // Audited as "legal-form" (`classifyAuditEvent`); without this the stored change was
      // recorded in the audit trail as "denied".
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceMovement(state, movement.id, updated);
    }

    /**
     * Ruling 16, items 14 and 48: the direct ED-to-CMHT referral pathway when inpatient admission
     * is not needed. Creates a real community referral, notifies the destination team and records
     * the outcome.
     */
    case "REFER_TO_COMMUNITY_TEAM": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot refer a closed movement (${movement.closure.reason})`);
      }
      if (!communityTeamOptions().includes(event.team)) {
        return reject(state, event, `team "${event.team}" is not a valid community mental health team`);
      }
      // Refused once collected, as `WITHDRAW_REFERRAL` does: use `STOP_TRANSPORT`.
      if (movement.transport?.collectedAt !== undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id}'s patient has already been collected; use STOP_TRANSPORT to stop the journey instead of referring to a community team`,
        );
      }
      // F4 / owner answer 14: a patient on a legal form cannot be referred to a community team
      // until a conclusive examination outcome is recorded ("further examination ordered" does not
      // unlock it). Enforced here as well as by `communityReferralBlockedReason` (ed-screen.tsx).
      // Voluntary patients are never blocked.
      const isOnForm =
        !!movement.legalForm || (movement.legalStatus !== undefined && movement.legalStatus !== "Voluntary");
      if (isOnForm && (!movement.examination || movement.examination.outcome === "further_examination_ordered")) {
        return reject(
          state,
          event,
          `movement ${movement.id} is on a legal form; a conclusive examination outcome must be recorded before referring to a community team`,
        );
      }
      const withoutPulledBed = releasePulledBedAndAdmission(state, movement, event.now);
      const linkedReferral = withoutPulledBed.referrals.find((r) => r.id === movement.referralId);
      const originEd = allEmergencyDepartments().find((d) => d.id === movement.originEdId);
      const originSite = originEd ? siteByCode(originEd.siteCode) : undefined;

      // Reuse a queued arm to this exact team rather than asking the same team twice. Settled arms
      // are not reused.
      const existingQueuedArm = linkedReferral?.destinations.find(
        (addressing) =>
          addressing.destination.kind === "community_team" &&
          addressing.destination.teamName === event.team &&
          addressing.state === "queued" &&
          addressing.withdrawnAt === undefined,
      );

      const sequence = existingQueuedArm
        ? withoutPulledBed.frontDoorReferralSequence
        : withoutPulledBed.frontDoorReferralSequence + 1;
      const referralId = existingQueuedArm && linkedReferral ? linkedReferral.id : nextFrontDoorReferralId(sequence);

      // F6: with no linked referral, the suburb is a stated absence (`{ kind: "unknown", reason:
      // "not_known" }`), never a hospital's name. `HOME_REGIONS` has no unknown member, so
      // `homeRegion` keeps its "Perth Metropolitan" fallback.
      //
      // `undefined` when reusing an existing queued arm.
      const newReferral: Referral | undefined = existingQueuedArm
        ? undefined
        : {
            id: referralId,
            patientId: linkedReferral?.patientId ?? movement.patientId,
            ageBand: movement.cohort,
            homeRegion: linkedReferral?.homeRegion ?? "Perth Metropolitan",
            suburb: linkedReferral?.suburb ?? { kind: "unknown", reason: "not_known" },
            source: "ed_medical",
            originSiteCode: originSite?.code ?? "ARM",
            raisedAt: event.now,
            urgency: movement.urgency,
            ...(movement.atsCategory === undefined ? {} : { atsCategory: movement.atsCategory }),
            destinations: [
              {
                destination: { kind: "community_team", teamName: event.team },
                state: "queued",
                referredAt: event.now,
              },
            ],
            transportNeeded: false,
            // An unlinked movement states the absence rather than leaving `history` blank. A linked
            // referral's own `history` is never overwritten, even when empty.
            history: linkedReferral
              ? linkedReferral.history
              : "Referred from the emergency department; no written referral history was recorded.",
          };

      // F10: the plan's §4 wording. Reusing a queued arm says so.
      const communityNotice = makeNotice(
        event.now,
        withoutPulledBed.notices.length,
        "community_referral_received",
        { role: "community", placeId: communityTeamSlug(event.team) },
        { movementId: movement.id, referralId },
        existingQueuedArm
          ? `${originEd?.name ?? "Emergency Department"} referred a patient for community follow-up: reusing the existing queued referral rather than raising a second one to the same team.`
          : `${originEd?.name ?? "Emergency Department"} referred a patient for community follow-up.`,
      );

      // F5: live ward requests are withdrawn (recorded with `ed_outcome_recorded`, since the
      // department recorded an outcome rather than withdrawing) and an accepting ward is told, so
      // the movement does not stay queued or accepted at a ward.
      const acceptingUnitId = movement.acceptedUnitId;
      // P1-4: captured before `updated` overwrites it, so the officer can be told the journey
      // ended.
      const hadLiveTransportJob = movement.transport !== undefined && movement.transport.cancelledAt === undefined;
      // Truthful cause: the department recorded an outcome that ends the bed search, not the
      // referrer withdrawing (`WithdrawalReason.ed_outcome_recorded`, `ward-change-reasons.ts`).
      const withdrawnLiveRequests = movement.referredUnitIds.map((unitId) => ({
        unitId,
        at: event.now,
        reason: "ed_outcome_recorded" as const,
      }));
      const updated: Movement = {
        ...movement,
        admissionId: undefined,
        acceptedUnitId: undefined,
        referredUnitIds: [],
        withdrawnReferrals: [...movement.withdrawnReferrals, ...withdrawnLiveRequests],
        referralAnswerHistory: [
          ...(movement.referralAnswerHistory ?? []),
          ...withdrawnLiveRequests.map((referral) => ({ ...referral, answer: "withdrawn" as const })),
        ],
        edOutcome: "for_community_follow_up",
        transport:
          movement.transport && movement.transport.cancelledAt === undefined
            ? { ...movement.transport, cancelledAt: event.now }
            : movement.transport,
        closure: {
          at: event.now,
          outcome: "did_not_proceed",
          reason: event.reason ?? `Referred to community mental health team: ${event.team}`,
        },
        blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
      };

      const withMovement = replaceMovement(withoutPulledBed, movement.id, updated);
      // Finding 3: no `newReferral` at all when reusing an existing queued arm — the linked
      // referral's own array is left exactly as it was, never a second arm appended beside it.
      const withReferral: WardFlowState =
        newReferral === undefined
          ? withMovement
          : {
              ...withMovement,
              referrals: [...withMovement.referrals, newReferral],
              frontDoorReferralSequence: sequence,
            };
      const notices: Notice[] = [communityNotice];
      let noticeCount = withoutPulledBed.notices.length + 1;
      if (acceptingUnitId !== undefined) {
        notices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "referral_revoked_ward",
            { role: "ward", placeId: acceptingUnitId },
            { movementId: movement.id, unitId: acceptingUnitId },
            `The referral for ${movement.id} was referred to a community team instead; the patient is no longer coming.`,
          ),
        );
      }
      // P1-4: the officer's half, the same "job cancelled, nothing rebooked" shape
      // `CANCEL_TRANSPORT`'s own notice and `RECORD_ED_OUTCOME`'s P1-4 fix (above) already hold to.
      if (hadLiveTransportJob) {
        notices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "transport_cancelled_officer",
            { role: "officer" },
            { movementId: movement.id },
            `Transport for ${movement.id} was cancelled (referred to a community team instead); no bed is held and nothing has been rebooked.`,
          ),
        );
      }
      // P1-4: every ward still holding a live request is told, reusing `WITHDRAW_WARD_REQUEST`'s
      // `ward_request_withdrawn` shape.
      for (const unitId of movement.referredUnitIds) {
        notices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "ward_request_withdrawn",
            { role: "ward", placeId: unitId },
            { movementId: movement.id, unitId },
            `The request for ${movement.id} was withdrawn: referred to a community team instead.`,
          ),
        );
      }
      return appendNotices(withReferral, notices);
    }

    case "REFER_TO_UNITS": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot refer a closed movement (${movement.closure.reason})`);
      }
      /**
       * RA1 (owner answer 18): re-referring adds wards and never silently drops a live one.
       * `liveUnitIds` is the standing set; only `newUnitIds` enter the eligibility gate and cap
       * check, so a live ward is neither re-checked nor double-counted.
       */
      const liveUnitIds = movement.referredUnitIds;
      const uniqueUnitIds = Array.from(new Set(event.unitIds));
      const newUnitIds = uniqueUnitIds.filter((unitId) => !liveUnitIds.includes(unitId));
      // The cap counts live plus new, whether or not the caller re-sent the live ids.
      const combinedCount = liveUnitIds.length + newUnitIds.length;
      // Top 25 item 2 (owner ruling, 15 Oct 2026): the cap is a safety check, so a chosen reason
      // lets the extra ward be asked (kept in the audit trail). Without one it refuses, as before.
      if (event.overCapReason !== undefined && !REFERRAL_CAP_REASONS.includes(event.overCapReason)) {
        return reject(state, event, `REFER_TO_UNITS overCapReason must be chosen from REFERRAL_CAP_REASONS`);
      }
      if (combinedCount > state.configuration.parallelReferralCap && event.overCapReason === undefined) {
        return reject(
          state,
          event,
          `cannot refer to ${combinedCount} units at once — the parallel cap is ${state.configuration.parallelReferralCap}`,
        );
      }
      if (!REFERRABLE_MOVEMENT_STAGES.includes(movement.stage)) {
        return reject(
          state,
          event,
          `cannot refer a movement at its current stage (${stageCopy[movement.stage].label})`,
        );
      }
      const unknown = newUnitIds.find((unitId) => !findUnit(state, unitId));
      if (unknown) {
        return reject(state, event, `no unit found for id ${unknown}`);
      }
      // Membership-checked, not truthiness-checked: an unrecognised reason is never written into an
      // accountability record.
      if (event.overrideReason !== undefined && !OVERRIDE_REASONS.includes(event.overrideReason)) {
        return reject(state, event, `REFER_TO_UNITS overrideReason must be chosen from OVERRIDE_REASONS`);
      }
      /**
       * T12 (owner answer 9): a Non-binary movement may be referred only to units a coordinator has
       * already checked with the ward, or is checking now. Runs before the per-ward eligibility
       * loop and refuses the whole event: a procedural requirement, not a suitability judgement a
       * reason can buy past (see `GenderPlacement` in `ward-model.ts`).
       *
       * No role check here: `EVENT_ROLE.REFER_TO_UNITS` is coordinator-only. "Ward and ED staff
       * cannot bypass it" is enforced on `ACCEPT_REFERRAL`.
       */
      let genderPlacementAddition:
        | {
            at: Instant;
            by: WardFlowRole;
            unitIds: string[];
            reason: (typeof GENDER_PLACEMENT_REASONS)[number];
            wardChecked: true;
          }
        | undefined;
      // R7 (owner ruling, 25 September 2026): widened from `"Non-binary"` alone to any gender or
      // recorded sex that is not female or male, including not recorded (`genderReviewNeeded`).
      if (genderReviewNeeded(movement.gender, movement.sex)) {
        const uncovered = newUnitIds.filter(
          (unitId) => !(movement.genderPlacements ?? []).some((record) => record.unitIds.includes(unitId)),
        );
        if (uncovered.length > 0) {
          if (event.genderPlacementReason === undefined || event.genderPlacementChecked !== true) {
            return reject(state, event, GENDER_PLACEMENT_REFUSAL);
          }
          if (!GENDER_PLACEMENT_REASONS.includes(event.genderPlacementReason)) {
            return reject(
              state,
              event,
              `REFER_TO_UNITS genderPlacementReason must be chosen from GENDER_PLACEMENT_REASONS`,
            );
          }
          genderPlacementAddition = {
            at: event.now,
            by: event.role,
            unitIds: uncovered,
            reason: event.genderPlacementReason,
            // Stores the validated `genderPlacementChecked` fact on the record rather than leaving
            // it implied by the reason text.
            wardChecked: true,
          };
        }
      }

      /**
       * The eligibility gate, per ward (owner ruling): the suitable wards proceed; an unsuitable
       * one is held back unless a reason is given for it. Per ward, never per referral, and never
       * one reason covering the whole list.
       *
       * A held-back ward is recorded with its own rejection naming its failing gate, never silently
       * dropped. If every new ward is held back, nothing is referred.
       *
       * RA1: runs over `newUnitIds` only; an already-live ward passed this gate when first referred
       * and is carried forward unconditionally below.
       */
      const targets: NonNullable<AuditDecision["targets"]>[number][] = [];
      decision.targets = targets;
      const heldBack: string[] = [];
      const permitted: string[] = [];
      // Owner reversal, item 2: the per-unit `gender_designation` gate must see the placement
      // record this event is about to write, so both gates can be cleared in one act. Never
      // persisted from here.
      const movementForEligibility: Movement =
        genderPlacementAddition === undefined
          ? movement
          : { ...movement, genderPlacements: [...(movement.genderPlacements ?? []), genderPlacementAddition] };
      for (const unitId of newUnitIds) {
        const candidate = findUnit(state, unitId);
        const refusal = candidate ? eligibilityRefusal(event, movementForEligibility, candidate, event.now) : null;
        targets.push({
          unitId: uniqueRecord(state.units, unitId)?.id ?? null,
          outcome: refusal ? "denied" : "accepted",
          reasonCode: refusal ? "transition" : "none",
        });
        if (refusal) heldBack.push(refusal);
        else permitted.push(unitId);
      }
      const withHeldBack = heldBack.reduce((carried, refusal) => reject(carried, event, refusal), state);
      // Refuse when something new was attempted and all of it was held back; a call that attempted
      // nothing new falls through to the harmless re-assertion below.
      if (newUnitIds.length > 0 && permitted.length === 0) return withHeldBack;
      if (event.overrideReason !== undefined && permitted.length === 0) {
        return reject(withHeldBack, event, "cannot record a placement override when no new units are referred");
      }

      // Re-referral: this movement is ALREADY at `destination_review`, so adding wards is not a
      // fresh transition — see the `stageChanges` field below.
      const isReReferral = movement.stage === "destination_review";

      const updated: Movement = {
        ...movement,
        // RA1: the union of what was already live and what just got through the gate — never a
        // replacement. Order keeps every live ward's own position stable and appends new ones after.
        referredUnitIds: Array.from(new Set([...liveUnitIds, ...permitted])),
        // The first referral's own moment, never rewritten by a re-referral.
        referredAt: movement.referredAt ?? event.now,
        // Stream A decision targets: open a fresh wait when this act refers into an empty live set.
        // Adding wards while others are live keeps the standing clock. A decline alone never writes
        // this field.
        referralDecisionOpenedAt:
          permitted.length === 0
            ? movement.referralDecisionOpenedAt
            : liveUnitIds.length === 0
              ? event.now
              : (movement.referralDecisionOpenedAt ?? movement.referredAt ?? event.now),
        // OD-3: the override reason is kept, appended rather than replaced, since a movement can be
        // overridden more than once.
        overrides:
          event.overrideReason === undefined
            ? movement.overrides
            : [
                ...movement.overrides,
                {
                  at: event.now,
                  by: WARD_FLOW_ROLE_LABELS[event.role],
                  reason: event.overrideReason,
                  // The NEWLY added wards this call actually referred to, not the wards asked for and
                  // never a ward already live — an accountability record names what THIS act did.
                  unitIds: [...permitted],
                  ...overrideSignOffField(event),
                },
              ],
        // T12: narrowed to the units actually referred (`permitted`); a held-back unit was never
        // referred.
        genderPlacements:
          genderPlacementAddition === undefined
            ? movement.genderPlacements
            : [
                ...(movement.genderPlacements ?? []),
                {
                  ...genderPlacementAddition,
                  unitIds: genderPlacementAddition.unitIds.filter((unitId) => permitted.includes(unitId)),
                },
              ].filter((record) => record.unitIds.length > 0),
        stage: "destination_review",
        // Restated unconditionally, including on a re-referral: adding a ward can contradict a
        // standing sentence such as `wardRequestWithdrawn`.
        blocker: STAGE_TRANSITION_BLOCKERS.referred,
        // RA1: a re-referral adds wards without a stage transition, so it appends no stage change.
        // The first referral still appends exactly one (`ward-movement-stage-changes.test.ts`).
        stageChanges: isReReferral
          ? movement.stageChanges
          : [
              ...movement.stageChanges,
              { at: event.now, from: movement.stage, to: "destination_review", by: event.role },
            ],
      };
      // `withHeldBack`, not `state` — any ward refused above must survive into the returned state,
      // or the coordinator is told nothing and the referral silently shrank.
      decision.outcome = heldBack.length ? "partial" : "accepted";
      decision.reasonCode = heldBack.length ? "transition" : "none";
      decision.overrideFactRecorded = event.overrideReason !== undefined;
      decision.overCapRecorded = updated.referredUnitIds.length > state.configuration.parallelReferralCap;
      return replaceMovement(withHeldBack, movement.id, updated);
    }

    case "ACCEPT_IN_PRINCIPLE": {
      const actingRefusal = wardActingMovementRefusal(event);
      if (actingRefusal) return reject(state, event, actingRefusal);
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot accept a closed movement (${movement.closure.reason})`);
      }
      if (movement.acceptedUnitId) {
        const already = findUnit(state, movement.acceptedUnitId);
        const attemptedUnit = findUnit(state, event.unitId);
        return reject(
          state,
          event,
          `movement ${movement.id} is already accepted at ${already?.name ?? movement.acceptedUnitId}; the referral to ${attemptedUnit?.name ?? event.unitId} was withdrawn`,
        );
      }
      if (movement.stage !== "destination_review") {
        return reject(
          state,
          event,
          `cannot accept a movement at its current stage (${stageCopy[movement.stage].label})`,
        );
      }
      if (!movement.referredUnitIds.includes(event.unitId)) {
        return reject(state, event, `${event.unitId} does not hold a live referral for movement ${movement.id}`);
      }
      const acceptedUnit = findUnit(state, event.unitId);
      if (!acceptedUnit) return reject(state, event, `no unit found for id ${event.unitId}`);

      // T12: `ACCEPT_IN_PRINCIPLE` never writes a gender-placement record (only `REFER_TO_UNITS`
      // does); it refuses when nothing on the movement names this unit. See `GenderPlacement`
      // (`ward-model.ts`).
      if (
        genderReviewNeeded(movement.gender, movement.sex) &&
        !(movement.genderPlacements ?? []).some((record) => record.unitIds.includes(event.unitId))
      ) {
        return reject(state, event, GENDER_PLACEMENT_REFUSAL);
      }

      /**
       * The eligibility gate on the ward's yes to a bed, the closest thing to a placement on the
       * movement path. See `eligibilityRefusal` for the contract.
       */
      const acceptRefusal = eligibilityRefusal(event, movement, acceptedUnit, event.now);
      if (acceptRefusal) return reject(state, event, acceptRefusal);
      // v10 pass 3: the Bed board names a bed as it accepts; a taken or held bed is refused.
      if (event.bedNumber !== undefined) {
        const bedRefusal =
          bedNumberRefusal(state, acceptedUnit, event.bedNumber, undefined) ??
          heldBedRefusal(state, acceptedUnit, event.bedNumber, movement.id);
        if (bedRefusal) return reject(state, event, bedRefusal);
      }
      // An override is filed only when it is new: a gate genuinely fails for this unit and no
      // override already on the movement covers it (tests/ward-audit.test.ts).
      const overrideApplied =
        event.overrideReason !== undefined &&
        !eligibility(movement, acceptedUnit, event.now).eligible &&
        !movement.overrides.some((override) => override.unitIds.includes(event.unitId));

      const withdrawn = movement.referredUnitIds
        .filter((unitId) => unitId !== event.unitId)
        .map((unitId) => ({
          unitId,
          at: event.now,
          // FD-23: a code, never a sentence. The losing ward must not read the winner's name, and
          // "placed" would assert a transfer that has not happened. The coordinator reads
          // `acceptedUnitId` for the destination.
          reason: "another_unit_accepted" as const,
        }));

      const updated: Movement = {
        ...movement,
        acceptedUnitId: event.unitId,
        ...(event.bedNumber === undefined ? {} : { heldBedNumber: event.bedNumber }),
        waitlistedUnitIds: undefined,
        // OD-3 (2026-09-02): an overridden acceptance is made accountable, never impossible — the
        // reason that bought the gate past is recorded, exactly as REFER_TO_UNITS records its own.
        overrides:
          overrideApplied && event.overrideReason !== undefined
            ? [
                ...movement.overrides,
                {
                  at: event.now,
                  by: WARD_FLOW_ROLE_LABELS[event.role],
                  reason: event.overrideReason,
                  unitIds: [event.unitId],
                  ...overrideSignOffField(event),
                },
              ]
            : movement.overrides,
        // The instant this acceptance happened. See `Movement.acceptedAt`.
        acceptedAt: event.now,
        stage: "accepted_awaiting_bed",
        referredUnitIds: [],
        withdrawnReferrals: [...movement.withdrawnReferrals, ...withdrawn],
        referralAnswerHistory: [
          ...(movement.referralAnswerHistory ?? []),
          ...withdrawn.map((referral) => ({ ...referral, answer: "withdrawn" as const })),
        ],
        // A response arrived; what is outstanding is the bed. Richer prose is a ward's own
        // observation.
        blocker: STAGE_TRANSITION_BLOCKERS.accepted,
        // `acceptedAt` and this entry are written together and must agree (see `StageChange`).
        // RELEASE_PULL later adds a second entry without touching `acceptedAt`.
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: "accepted_awaiting_bed", by: event.role },
        ],
      };
      const next = replaceMovement(state, movement.id, updated);
      // Addendum §1.3: the referring emergency department is told a ward has said yes in principle.
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      decision.overrideFactRecorded = overrideApplied;
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "accepted_in_principle",
          { role: "ed", placeId: movement.originEdId },
          { movementId: movement.id, unitId: event.unitId },
          `${acceptedUnit.name} has accepted ${movement.id} in principle.`,
        ),
      ]);
    }

    /**
     * The referrer takes the referral back: a patient who improved, went home or went elsewhere no
     * longer needs a bed.
     *
     * Withdraws every live referral at once, because the referrer is saying the patient needs no
     * bed at all. The reason code is `referrer_withdrew`, never taken from the event: adding
     * `WITHDRAWAL_REASONS` members is a governance decision left to the owner.
     */
    case "WITHDRAW_REFERRAL": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // Already finished: withdrawing a closed movement would count a referral that was never live
      // at that moment.
      if (movement.closure) {
        return reject(state, event, `movement ${movement.id} has already closed and cannot be withdrawn`);
      }
      // A place claim must match the recorded sender before either closure path can run.
      // A ward transfer's sourceAdmissionId identifies a stay, not the caller who owns it.
      const caller = event as {
        role: WardFlowRole;
        placeId?: string;
        actingPlaceId?: string;
        actingUnitId?: string;
      };
      const callerPlaceId =
        caller.placeId ?? caller.actingPlaceId ?? (caller.role === "ward" ? caller.actingUnitId : undefined);
      const referral = movement.referralId ? findReferral(state, movement.referralId) : undefined;
      // Verified senders: a transfer from a recorded stay is the sending ward's alone. Otherwise
      // the ED that raised the journey (`originEdId`) owns it, and for a ward-sent referral the
      // sending ward may also withdraw. Community teams may also withdraw.
      const senders: { role: WardFlowRole; placeId: string | undefined }[] =
        movement.sourceAdmissionId !== undefined
          ? [{ role: "ward", placeId: movementSourceAdmission(state, movement)?.unitId }]
          : [
              { role: "ed", placeId: movement.originEdId },
              ...(referral?.source === "psychiatric_ward"
                ? [{ role: "ward" as WardFlowRole, placeId: referral.originUnitId }]
                : []),
              ...(referral?.sendingTeamName !== undefined
                ? [
                    {
                      role: "community" as WardFlowRole,
                      placeId: communityTeamSlug(referral.sendingTeamName),
                    },
                  ]
                : []),
            ];
      const senderPlaceId = senders.find((sender) => sender.role === event.role)?.placeId;
      if (
        event.role !== "coordinator" &&
        (!callerPlaceId ||
          !senders.some(
            (sender) =>
              sender.role === event.role &&
              sender.placeId !== undefined &&
              (sender.placeId === callerPlaceId ||
                (event.role === "community" &&
                  referral?.sendingTeamName !== undefined &&
                  callerPlaceId === referral.sendingTeamName)),
          ))
      ) {
        return reject(
          state,
          event,
          `caller ${callerPlaceId ?? "without a place ID"} is not the referral origin site (${senderPlaceId ?? "not recorded"}) for role ${event.role}; only the referrer or the coordinator may withdraw it`,
        );
      }

      /**
       * WLQ-38 (owner): "This should also be the referring doctors responsibility as well to be
       * able to revoke the transport as well as referral in addition to the coordinator." The
       * referrer (`ed`) or the coordinator may revoke an accepted referral, once, until the patient
       * is collected (then `STOP_TRANSPORT`). Still refused for `community` and `ward`.
       *
       * Runs before the `referredUnitIds.length === 0` guard below: acceptance empties
       * `referredUnitIds`, so that guard would refuse this happy path.
       */
      if (movement.acceptedUnitId) {
        if (event.role !== "coordinator" && event.role !== "ed") {
          return reject(
            state,
            event,
            `movement ${movement.id} has already been accepted by ${movement.acceptedUnitId}; only the referrer or the coordinator may revoke it now`,
          );
        }
        // Once the patient has been physically collected this is a journey under way, not a
        // referral to take back — `STOP_TRANSPORT` is the event for stopping it from here.
        if (movement.transport?.collectedAt !== undefined) {
          return reject(
            state,
            event,
            `movement ${movement.id}'s patient has already been collected; use STOP_TRANSPORT to stop the journey instead of withdrawing the referral`,
          );
        }

        // Gives back a pulled bed and its admission, or does nothing if none was pulled. Shared
        // with `RELEASE_PULL`.
        const withoutPulledBed = releasePulledBedAndAdmission(state, movement, event.now);
        const revokedByCoordinator = event.role === "coordinator";
        const acceptingUnitId = movement.acceptedUnitId;
        const liveTransport =
          movement.transport && movement.transport.cancelledAt === undefined ? movement.transport : undefined;
        const hadLiveTransport = liveTransport !== undefined;
        const revoked: Movement = {
          ...movement,
          admissionId: undefined,
          // A revoked acceptance holds no ward: cleared here, as RECORD_ED_OUTCOME and
          // REFER_TO_COMMUNITY_TEAM do, so no board reads a closed movement as still going to it.
          acceptedUnitId: undefined,
          // A booked-but-uncollected job is cancelled in the same update that closes the movement;
          // `orphanedTransport` assumes no live job outlives a closure.
          transport: liveTransport ? { ...liveTransport, cancelledAt: event.now } : movement.transport,
          closure: {
            at: event.now,
            outcome: "did_not_proceed",
            reason: revokedByCoordinator
              ? "The coordinator revoked the accepted referral"
              : "The referrer revoked the accepted referral",
          },
          // Nothing blocks a movement that is over; this also clears WLQ-4's
          // `examinationRevokedAwaitingRelease`.
          blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
        };
        const next = replaceMovement(withoutPulledBed, movement.id, revoked);
        // Addendum §1.3, extended by WLQ-38: a ward that believed it was getting this patient is
        // told it is not. `acceptingUnitId` was read before this handler's writes.
        let noticeCount = state.notices.length;
        const notices: Notice[] = [
          makeNotice(
            event.now,
            noticeCount++,
            "referral_revoked_ward",
            { role: "ward", placeId: acceptingUnitId },
            { movementId: movement.id, unitId: acceptingUnitId },
            `The referral for ${movement.id} was revoked after being accepted; the patient is no longer coming.`,
          ),
        ];
        if (hadLiveTransport) {
          notices.push(
            makeNotice(
              event.now,
              noticeCount++,
              "transport_cancelled_officer",
              { role: "officer" },
              { movementId: movement.id, unitId: acceptingUnitId },
              `Transport for ${movement.id} was cancelled: referral was revoked by ${revokedByCoordinator ? "coordinator" : "referrer"}.`,
            ),
          );
        }
        return appendNotices(next, notices);
      }

      if (movement.referredUnitIds.length === 0) {
        return reject(state, event, `movement ${movement.id} holds no live referral to withdraw`);
      }

      const liveTransport =
        movement.transport && movement.transport.cancelledAt === undefined ? movement.transport : undefined;
      const hadLiveTransport = liveTransport !== undefined;
      const updated: Movement = {
        ...movement,
        ...withdrawAllLiveRequestsForReferrer(
          movement,
          event.now,
          event.role === "coordinator" ? "coordinator_withdrew" : "referrer_withdrew",
        ),
        transport: liveTransport ? { ...liveTransport, cancelledAt: event.now } : movement.transport,
        closure: {
          at: event.now,
          outcome: "did_not_proceed",
          reason:
            event.role === "coordinator"
              ? "The coordinator withdrew the referral"
              : "The referrer withdrew the referral",
        },
        // Nothing is blocking a movement that is over. Left saying "Awaiting destination response"
        // it would keep a withdrawn patient looking like a live obstruction.
        blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
      };
      const next = replaceMovement(state, movement.id, updated);
      let noticeCount = state.notices.length;
      const actorLabel = event.role === "coordinator" ? "coordinator" : "referrer";
      const wardNotices = movement.referredUnitIds.map((unitId) =>
        makeNotice(
          event.now,
          noticeCount++,
          "ward_request_withdrawn",
          { role: "ward", placeId: unitId },
          { movementId: movement.id, unitId },
          `The referral for ${movement.id} was withdrawn by the ${actorLabel}.`,
        ),
      );
      if (hadLiveTransport) {
        wardNotices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "transport_cancelled_officer",
            { role: "officer" },
            { movementId: movement.id },
            `Transport for ${movement.id} was cancelled: referral was withdrawn by the ${actorLabel}.`,
          ),
        );
      }
      return appendNotices(next, wardNotices);
    }

    case "WITHDRAW_WARD_REQUEST": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(
          state,
          event,
          `cannot withdraw a ward request for a closed movement (${movement.closure.reason})`,
        );
      }
      // Membership, not truthiness: an accepted, declined or withdrawn unit holds no live referral
      // to take back.
      if (!movement.referredUnitIds.includes(event.unitId)) {
        return reject(state, event, `${event.unitId} does not hold a live referral for movement ${movement.id}`);
      }
      if (!WARD_REQUEST_WITHDRAWAL_REASONS.includes(event.reason)) {
        return reject(state, event, `WITHDRAW_WARD_REQUEST reason must be chosen from WARD_REQUEST_WITHDRAWAL_REASONS`);
      }

      const remainingUnitIds = movement.referredUnitIds.filter((unitId) => unitId !== event.unitId);
      const updated: Movement = {
        ...movement,
        referredUnitIds: remainingUnitIds,
        // `reason` says who (a role); `detail` says why, from the coordinator's §2 pick, and is
        // never folded into `reason`.
        withdrawnReferrals: [
          ...movement.withdrawnReferrals,
          { unitId: event.unitId, at: event.now, reason: "coordinator_withdrew", detail: event.reason },
        ],
        referralAnswerHistory: [
          ...(movement.referralAnswerHistory ?? []),
          { unitId: event.unitId, at: event.now, answer: "withdrawn" },
        ],
        // RA1: only the last live request going changes `blocker`.
        blocker: remainingUnitIds.length === 0 ? STAGE_TRANSITION_BLOCKERS.wardRequestWithdrawn : movement.blocker,
      };
      const next = replaceMovement(state, movement.id, updated);
      // Addendum §1.3, extended by RA1: the one ward named is told it is no longer being asked.
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "ward_request_withdrawn",
          { role: "ward", placeId: event.unitId },
          { movementId: movement.id, unitId: event.unitId },
          `The request for ${movement.id} was withdrawn: ${wardRequestWithdrawalReasonLabels[event.reason]}.`,
        ),
      ]);
    }

    case "PULL_PATIENT": {
      const actingRefusal = wardActingMovementRefusal(event);
      if (actingRefusal) return reject(state, event, actingRefusal);
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot pull a bed for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "accepted_awaiting_bed") {
        return reject(
          state,
          event,
          `cannot pull a bed at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      if (movement.acceptedUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `movement ${movement.id} was accepted at ${movement.acceptedUnitId ?? "no unit"}, not ${event.unitId}`,
        );
      }
      // P1-3 (Ward Lead ruling): by `PULL_PATIENT` the movement is already accepted at this unit,
      // so either gender judgement failing means a correction landed after acceptance. See
      // `heldUnitGenderRefusal`.
      const heldGenderRefusal = heldUnitGenderRefusal(state, movement, event.now);
      if (heldGenderRefusal) return reject(state, event, heldGenderRefusal);
      /**
       * A movement that still holds a bed is restored to `pulled`, never given a second bed (owner
       * decision). `STEP_BACK_STAGE` keeps the bed and `admissionId` (rulings E/F).
       *
       * Runs before every capacity and eligibility check: nothing is consumed, and those checks
       * would count the patient's own held bed against them.
       */
      const patientId =
        movement.patientId ?? state.referrals.find((r) => r.id === movement.referralId)?.patientId ?? event.patientId;
      const source = movementSourceAdmission(state, movement);
      if (
        (movement.sourceAdmissionId && !source) ||
        (source && (source.state !== "occupied" || source.patientId !== patientId || source.unitId === event.unitId))
      ) {
        return reject(state, event, "Repatriation needs the patient's occupied source stay at a different ward.");
      }
      if (
        patientId &&
        state.admissions.some(
          (a) =>
            a.patientId === patientId &&
            (a.state === "pulled" || a.state === "occupied") &&
            a.id !== movement.admissionId &&
            a.id !== source?.id,
        )
      ) {
        return reject(state, event, "This patient already holds a bed or occupies a ward; use a recorded transfer.");
      }
      if (movement.admissionId !== undefined) {
        const held = state.admissions.find((admission) => admission.id === movement.admissionId);
        if (!held || held.unitId !== event.unitId) {
          return reject(
            state,
            event,
            `movement ${movement.id} points at admission ${movement.admissionId}, which is not a bed held at ${event.unitId}; it cannot be restored or pulled again`,
          );
        }
        const restoreUnit = findUnit(state, event.unitId);
        if (!restoreUnit) return reject(state, event, `no unit found for id ${event.unitId}`);
        // Second pull re-runs one-to-one and acuity checks and does not count this person's own held bed.
        const admissionsExcludingOwn = state.admissions.filter((admission) => admission.id !== movement.admissionId);
        const speciallingAnsweredRestore =
          event.overrideReason !== undefined && OVERRIDE_REASONS.includes(event.overrideReason);
        if (
          !speciallingAnsweredRestore &&
          movement.specialling &&
          remainingSpeciallingCapacity(restoreUnit, admissionsExcludingOwn) <= 0
        ) {
          return reject(
            state,
            event,
            `${restoreUnit.name} has no one-to-one specialling capacity left; this patient needs specialling and the ward cannot staff another`,
          );
        }
        const acuityOverrideNeededRestore =
          movement.highAcuity && remainingHighAcuityCapacity(restoreUnit, admissionsExcludingOwn) <= 0;
        const acuityAnsweredRestore =
          event.overrideReason !== undefined &&
          OVERRIDE_REASONS.includes(event.overrideReason) &&
          event.numConsulted === true;
        if (!acuityAnsweredRestore && acuityOverrideNeededRestore) {
          return reject(
            state,
            event,
            `${restoreUnit.name} ${HIGH_ACUITY_STAFFING_REFUSAL}. This placement ${OVERRIDE_REASON_REQUIRED} and the nurse unit manager consulted.`,
          );
        }
        const restored: Movement = {
          ...movement,
          overrides: pullOverrides(movement, restoreUnit, admissionsExcludingOwn, event, false),
          stage: "pulled",
          waitlistedUnitIds: undefined,
          pullExpiresAt: event.now + state.configuration.pullHoldMinutes,
          allocatedBed: movement.allocatedBed ?? held.id,
          stageChanges: [
            ...movement.stageChanges,
            { at: event.now, from: movement.stage, to: "pulled", by: event.role },
          ],
        };
        decision.outcome = "accepted";
        decision.reasonCode = "none";
        decision.overrideFactRecorded = restored.overrides.length > movement.overrides.length;
        return replaceMovement(state, movement.id, restored);
      }
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      if (unit.allocatable.value <= 0) {
        /**
         * Reports only the fact it read (`allocatable.value <= 0`), never a cause.
         * `CONFIRM_CAPACITY` sets that value from a ward's self-report, and `allocatable.source`
         * cannot tell a pull from a ward correction, so naming an earlier pull as the cause could
         * be false.
         */
        return reject(
          state,
          event,
          `no allocatable bed remains at ${unit.name} (the ward's allocatable count is ${unit.allocatable.value})`,
        );
      }
      /**
       * A pull is refused against a bed that is not ready (owner ruling): "A pull cannot occur
       * unless the bed is actually available and open, not pending (i.e. being cleaned)". The
       * refusal lives here, not on a screen, so the transition itself cannot happen. `availableNow`
       * is deliberately unchanged: the owner chose refusing the pull over dropping the ward's
       * number.
       *
       * Only when preparation is the cause: a refusal must state the reason that actually applies,
       * not hijack the no-free-bed case.
       */
      const pending = bedsPendingPreparation(unit.id, state.bedReleases);
      if (pending > 0 && openBedsNow(unit, state.bedReleases) <= 0) {
        return reject(
          state,
          event,
          `every free bed at ${unit.name} is still being made ready (${pending} pending); a patient cannot be pulled to a bed that is not open`,
        );
      }
      /**
       * A pull for somebody needing one-to-one observation is refused when the ward has nobody left
       * to watch them (owner ruling 1). `eligibility()`'s `specialling` gate only asks whether the
       * ward has any capacity at all; this asks whether any is left, derived from the beds
       * (`remainingSpeciallingCapacity`), never a decremented counter. The refusal lives here so
       * the transition itself cannot happen, and only when specialling is the cause.
       *
       * Owner ruling: this refusal is answerable by a recorded reason (a gate nobody can pass stops
       * the record, not the admission); the bed check above is not and still runs first.
       * Membership-checked, never truthiness: an unrecognised string falls through to
       * `eligibilityRefusal`. `specialling` is deliberately not in `SUITABILITY_GATES`, which would
       * make the static question overridable instead of this one.
       */
      const speciallingAnswered = event.overrideReason !== undefined && OVERRIDE_REASONS.includes(event.overrideReason);
      if (!speciallingAnswered && movement.specialling && remainingSpeciallingCapacity(unit, state.admissions) <= 0) {
        return reject(
          state,
          event,
          `${unit.name} has no one-to-one specialling capacity left (${unit.speciallingCapacity} staffable, all in use); this patient needs specialling and the ward cannot staff another`,
        );
      }

      /**
       * Owner ruling (`docs/ward-flow/owner-decisions-2026-09-09.md` §5): high-acuity nursing is a
       * staffing-capacity check too. `eligibility()`'s `acuity` gate only sees the authored total;
       * `remainingHighAcuityCapacity` knows what is left. Mirrors the specialling guard, including
       * membership-checked overrides, and `acuity` is deliberately not in `SUITABILITY_GATES`.
       *
       * Item 10 (owner answers): unlike specialling, this override also needs "the nurse unit
       * manager consulted", and the answer is written to `overrides`. Captured once here so the
       * refusal and the movement update below cannot drift.
       */
      const acuityOverrideNeeded = movement.highAcuity && remainingHighAcuityCapacity(unit, state.admissions) <= 0;
      const acuityAnswered =
        event.overrideReason !== undefined &&
        OVERRIDE_REASONS.includes(event.overrideReason) &&
        event.numConsulted === true;
      if (!acuityAnswered && acuityOverrideNeeded) {
        return reject(
          state,
          event,
          `${unit.name} ${HIGH_ACUITY_STAFFING_REFUSAL} (${unit.highAcuityCapacity} staffable, all in use). This placement ${OVERRIDE_REASON_REQUIRED} and the nurse unit manager consulted.`,
        );
      }

      /**
       * Item 11 (owner answer 11): "voluntary patients take open beds first, and secure patients
       * take locked beds first." Bed kind belongs to the request (`movement.security`), so
       * "voluntary" is read as `security: "Open"`.
       *
       * A capacity check, not the `security` suitability gate, which only asks whether the ward has
       * any locked beds. It sits with the other physical capacity checks before
       * `eligibilityRefusal`.
       *
       * An Open request takes an open bed while one is free, else a locked one with no override. A
       * Secure request takes a locked bed while one is free; only when none is free does it need an
       * override to fall back to an open bed. `bedKindTaken` computes this once for the refusal
       * check, the capacity decrement and the admission literal.
       */
      const secureBedNeeded = movement.security === "Secure";
      const noLockedBedFree = lockedBedsFree(unit) <= 0;
      const bedKindOverrideNeeded = secureBedNeeded && noLockedBedFree;
      const bedKindAnswered = event.overrideReason !== undefined && OVERRIDE_REASONS.includes(event.overrideReason);
      if (!bedKindAnswered && bedKindOverrideNeeded) {
        return reject(
          state,
          event,
          `No locked bed is free at ${unit.name}. This placement ${OVERRIDE_REASON_REQUIRED} to use an open bed.`,
        );
      }
      const bedKindTaken: "locked" | "open" = secureBedNeeded
        ? noLockedBedFree
          ? "open"
          : "locked"
        : openBedsFree(unit) > 0
          ? "open"
          : "locked";

      /**
       * The eligibility gate goes last, after every existing refusal (Ward Lead ruling): a
       * coordinator who pulled at the wrong stage should be told that, not told about cohort. Test
       * this gate on a pair whose only failing gate is cohort, since the refusals above can fire
       * first.
       */
      const pullRefusal = eligibilityRefusal(event, movement, unit, event.now);
      if (pullRefusal) return reject(state, event, pullRefusal);

      const updatedUnit: Unit = {
        ...unit,
        // Audit A1-11: a pull moves the figure; only Confirm numbers stamps it confirmed.
        allocatable: { ...unit.allocatable, value: unit.allocatable.value - 1 },
        // Item 11: decremented only when a locked bed was taken, mirroring the restore in
        // `releasePulledBedAndAdmission`.
        allocatableLocked: bedKindTaken === "locked" ? unit.allocatableLocked - 1 : unit.allocatableLocked,
      };
      /**
       * The patient becomes a person in a bed, built in the same shape the seed builds so every
       * consumer renders it.
       *
       * R4: `referralId`, `patientId` and `homeRegion` are derived from `resolvedReferral`, never
       * invented, so a community team's referred patient stays on its team page
       * (`admissionBelongsToTeam`). `null` is the honest answer when no referral resolves; a home
       * region is never derived from the origin emergency department.
       *
       * `state` is `"pulled"` and `arrivedAt` is `null` (owner ruling: "a patient is not marked as
       * arrived until the ward says they have arrived. The pull just means the bed is allocated to
       * them."). Only `PATIENT_ARRIVED` writes `arrivedAt`, so `daysInBed` is not inflated by the
       * transport delay. `pulledAt` is `event.now`: this event is the pull.
       *
       * D-14 / R4: `resolvedReferral` inlines `referralForMovement`'s resolution (importing
       * `ward-derivations.ts` would be circular). `undefined` when the movement has no `referralId`
       * or it does not resolve. Computed once so every field below agrees.
       */
      const resolvedReferral =
        movement.referralId === undefined
          ? undefined
          : state.referrals.find((referral) => referral.id === movement.referralId);
      const admission: Admission = {
        id: `AD-ARR-${String(state.admissionSequence + 1).padStart(2, "0")}`,
        unitId: unit.id,
        // The ward's commitment to staff this bed one-to-one, copied from the movement where a
        // person ticked it at intake. The only runtime writer; see `Admission.specialling`.
        specialling: movement.specialling,
        // A high-acuity place, copied from the movement, where the referring clinician marked it
        // (owner ruling). Never derived from `specialling`.
        highAcuity: movement.highAcuity,
        referralId: resolvedReferral?.id ?? null,
        movementId: movement.id,
        patientId: resolvedReferral?.patientId ?? movement.patientId ?? event.patientId ?? null,
        sex: movement.sex,
        gender: movement.gender,
        // R4: a home region is a fact about the person, from the resolved referral; never invented
        // from the emergency department's location.
        homeRegion: resolvedReferral?.homeRegion ?? null,
        // T15 (item 12): copied from the movement (the referral's value, or the ED's own choice).
        // Never read from the referral directly, so a diagnosis added to the referral later does
        // not reach this admission.
        tentativeDiagnosis: movement.tentativeDiagnosis ?? null,
        // Item 11: the bed kind actually taken, shared with the refusal check and the decrement.
        // See `Admission.bedKind`.
        bedKind: bedKindTaken,
        state: "pulled",
        pulledAt: event.now,
        arrivedAt: null,
        // Null as a statement: this person has not reached the ward, so is not away at an emergency
        // department in this field's sense.
        awayAtEmergencyDepartmentSince: null,
        expectedDischargeAt: null,
        dischargeDateMoves: 0,
        dischargeDateSetAt: null,
        dischargeDateSetBy: null,
        dischargeConfirmedAt: null,
        dischargeConfirmedBy: null,
        blockReason: null,
        leavingDestination: null,
        leftAt: null,
        followUp: null,
        careJourney: emptyCareJourney(),
        dischargeBarrier: null,
        stepDownCandidate: false,
      };

      const updatedMovement: Movement = {
        ...movement,
        stage: "pulled",
        waitlistedUnitIds: undefined,
        pullExpiresAt: event.now + state.configuration.pullHoldMinutes,
        allocatedBed: admission.id,
        // The join `RELEASE_PULL` needs to undo exactly this record, and `PATIENT_ARRIVED` needs to
        // mark exactly this one as having arrived. See `Movement.admissionId`.
        admissionId: admission.id,
        stageChanges: [...movement.stageChanges, { at: event.now, from: movement.stage, to: "pulled", by: event.role }],
        overrides: pullOverrides(movement, unit, state.admissions, event, true),
      };
      const withUnit = replaceUnit(state, unit.id, updatedUnit);
      const withPerson: WardFlowState = {
        ...withUnit,
        admissions: [...withUnit.admissions, admission],
        admissionSequence: withUnit.admissionSequence + 1,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      decision.overrideFactRecorded = updatedMovement.overrides.length > movement.overrides.length;
      return replaceMovement(withPerson, movement.id, updatedMovement);
    }

    case "DECLINE": {
      const actingRefusal = wardActingMovementRefusal(event);
      if (actingRefusal) return reject(state, event, actingRefusal);
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot decline for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "destination_review") {
        return reject(
          state,
          event,
          `cannot decline at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      if (!movement.referredUnitIds.includes(event.unitId)) {
        return reject(state, event, `${event.unitId} does not hold a live referral for movement ${movement.id}`);
      }
      if (event.reason === GENDER_MISMATCH_DECLINE_REASON || (event.reason as string) === "sex_mix") {
        return reject(
          state,
          event,
          `Gender mismatch does not decline a referral; it only filters which bed can be offered`,
        );
      }
      if ((WAITLIST_INSTEAD_OF_DECLINE_REASONS as readonly string[]).includes(event.reason)) {
        const waitlistedUnitIds = [...(movement.waitlistedUnitIds ?? [])];
        if (!waitlistedUnitIds.includes(event.unitId)) {
          if (waitlistedUnitIds.length >= state.configuration.parallelReferralCap) {
            return reject(
              state,
              event,
              `movement ${movement.id} is already waitlisted at ${state.configuration.parallelReferralCap} wards; release one before waitlisting another`,
            );
          }
          waitlistedUnitIds.push(event.unitId);
        }
        const updated: Movement = {
          ...movement,
          waitlistedUnitIds,
          declines: [...movement.declines, { unitId: event.unitId, at: event.now, reason: event.reason }],
          referralAnswerHistory: [
            ...(movement.referralAnswerHistory ?? []),
            { unitId: event.unitId, at: event.now, answer: "waitlisted" },
          ],
        };
        const next = replaceMovement(state, movement.id, updated);
        return appendNotices(next, [
          makeNotice(
            event.now,
            state.notices.length,
            "referral_waitlisted",
            { role: "ed", placeId: movement.originEdId },
            { movementId: movement.id, unitId: event.unitId },
            `${unitName(state, event.unitId)} waitlisted ${movement.id} (no bed yet).`,
          ),
        ]);
      }
      if (!DECLINE_REASONS.includes(event.reason)) {
        /**
         * Runtime membership, not merely the type: a type-only guarantee passes `vitest run` with
         * no `tsc` involved.
         *
         * `DECLINE_REASONS`, not `REFERRAL_DECLINE_REASONS`: `DECLINE` refuses a movement,
         * `DECLINE_REFERRAL` a referral, and swapping the lists would look like a working check.
         * `tests/ward-reason-checks-use-their-own-list.test.ts` guards the pairing. The timeline
         * reads `declineReasonLabels[...]` with no fallback, so an off-list value would print
         * "undefined".
         */
        return reject(state, event, `DECLINE reason must be chosen from DECLINE_REASONS`);
      }
      const remainingReferredUnitIds = movement.referredUnitIds.filter((unitId) => unitId !== event.unitId);
      const updated: Movement = {
        ...movement,
        referredUnitIds: remainingReferredUnitIds,
        declines: [...movement.declines, { unitId: event.unitId, at: event.now, reason: event.reason }],
        stage: "destination_review",
        referralAnswerHistory: [
          ...(movement.referralAnswerHistory ?? []),
          { unitId: event.unitId, at: event.now, answer: "declined" },
        ],
        // Ruling 4: a decline leaves the stage unchanged and is labelled a Decline, never a
        // step-back. This entry exists for the floor that every stage-assigning case appends
        // exactly one entry.
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: "destination_review", by: event.role, reason: event.reason },
        ],
        // "Awaiting destination response" is only true while a live request stands; declining the
        // last one switches to `wardRequestWithdrawn`, as `WITHDRAW_WARD_REQUEST` does.
        blocker:
          remainingReferredUnitIds.length === 0 && !movement.acceptedUnitId
            ? STAGE_TRANSITION_BLOCKERS.wardRequestWithdrawn
            : movement.blocker,
      };
      const next = replaceMovement(state, movement.id, updated);
      // Addendum §1.3: the referring emergency department is told this unit said no. Shares
      // `NoticeKind` "referral_declined" with `DECLINE_REFERRAL`.
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "referral_declined",
          { role: "ed", placeId: movement.originEdId },
          { movementId: movement.id, unitId: event.unitId },
          `${unitName(state, event.unitId)} declined ${movement.id} (${event.reason.replace(/_/g, " ")}).`,
        ),
      ]);
    }

    case "HANDOVER_READY": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot ready a handover for a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "pulled") {
        return reject(
          state,
          event,
          `cannot ready a handover at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      /**
       * Handover ready requires a booked transport (or a recorded "no transport needed"); nothing
       * here invents a job, provider or escort answer. Escort is a fact the sending team knows and
       * books (TR-D1).
       */
      const noTransportNeeded = (movement.transportNeed?.needed ?? movement.transport?.needed) === false;
      if (!movement.transport && !noTransportNeeded) {
        return reject(state, event, `cannot ready a handover before transport is booked (BOOK_TRANSPORT)`);
      }
      // P1-3: re-run at every forward step while a bed is held; see `heldUnitGenderRefusal`.
      const handoverGenderRefusal = heldUnitGenderRefusal(state, movement, event.now);
      if (handoverGenderRefusal) return reject(state, event, handoverGenderRefusal);
      const updated: Movement = {
        ...movement,
        stage: "handover_ready",
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: "handover_ready", by: event.role },
        ],
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "TRANSPORT_ACCEPTED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot accept transport for a closed movement (${movement.closure.reason})`);
      }

      // WLQ-4: do not advance the transport pathway while a revoked or community_order examination
      // still holds a bed. PATIENT_ARRIVED stays reachable (owner answer 5).
      {
        const examinationOutcome = movement.examination?.outcome;
        const examinationRevokedHoldingBed =
          (examinationOutcome === "community_order" || examinationOutcome === "revoked") &&
          movementHoldsBedByStage(movement);
        const awaitingRelease = movement.blocker === STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease;
        if (examinationRevokedHoldingBed || awaitingRelease) {
          return reject(
            state,
            event,
            `cannot advance transport for movement ${movement.id}: the examination was revoked and the bed is still held — a coordinator must release the bed first`,
          );
        }
      }
      if (movement.stage !== "handover_ready" || !movement.transport) {
        return reject(
          state,
          event,
          `cannot accept transport at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      // Instant 0 is a recorded midnight, not "unset" — never truthiness-check timestamps.
      if (movement.transport.acceptedAt !== undefined) {
        return reject(state, event, `transport for movement ${movement.id} was already accepted`);
      }
      // P1-3 (Ward Lead ruling, 17 September 2026) — see `heldUnitGenderRefusal`'s own doc comment.
      const transportAcceptedGenderRefusal = heldUnitGenderRefusal(state, movement, event.now);
      if (transportAcceptedGenderRefusal) return reject(state, event, transportAcceptedGenderRefusal);
      const updated: Movement = {
        ...movement,
        transport: { ...movement.transport, acceptedAt: event.now },
        // The provider has answered, so "Awaiting a transport provider response" is contradicted by
        // `acceptedAt` beside it.
        blocker: STAGE_TRANSITION_BLOCKERS.transportAccepted,
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "TRANSPORT_EN_ROUTE": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot move transport for a closed movement (${movement.closure.reason})`);
      }

      // WLQ-4: do not advance the transport pathway while a revoked or community_order examination
      // still holds a bed. PATIENT_ARRIVED stays reachable (owner answer 5).
      {
        const examinationOutcome = movement.examination?.outcome;
        const examinationRevokedHoldingBed =
          (examinationOutcome === "community_order" || examinationOutcome === "revoked") &&
          movementHoldsBedByStage(movement);
        const awaitingRelease = movement.blocker === STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease;
        if (examinationRevokedHoldingBed || awaitingRelease) {
          return reject(
            state,
            event,
            `cannot advance transport for movement ${movement.id}: the examination was revoked and the bed is still held — a coordinator must release the bed first`,
          );
        }
      }
      /**
       * The message reports the two facts the guard checks rather than naming one as the cause: at
       * stage `moving`, `transport.acceptedAt` is already set. Do not restore the removed wording,
       * even quoted.
       *
       * Instant 0 is a recorded midnight — compare with `=== undefined`, never truthiness.
       */
      if (movement.stage !== "handover_ready" || movement.transport?.acceptedAt === undefined) {
        return reject(
          state,
          event,
          `cannot mark transport en route: the movement must be at ${stageCopy.handover_ready.label} ` +
            `with transport accepted (it is at ${stageCopy[movement.stage].label}, transport ` +
            `${movement.transport?.acceptedAt !== undefined ? "accepted" : "not accepted"})`,
        );
      }
      if (movement.transport.enRouteAt !== undefined) {
        return reject(state, event, `transport for movement ${movement.id} is already en route`);
      }
      const updated: Movement = {
        ...movement,
        transport: { ...movement.transport, enRouteAt: event.now },
        // The vehicle is moving. Still an active blocker: nobody has been collected.
        blocker: STAGE_TRANSITION_BLOCKERS.transportEnRoute,
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "PATIENT_COLLECTED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot collect a patient for a closed movement (${movement.closure.reason})`);
      }
      // T9 (owner answer 5): while a withdrawn or revoked examination still holds the bed,
      // collection is refused until someone releases the bed or records a repeat examination.
      // `PATIENT_ARRIVED` must stay reachable. Inlines `examinationRevokedWhileBedHeld`
      // (`ward-derivations.ts`) to avoid a circular import.
      const examinationOutcome = movement.examination?.outcome;
      const examinationRevokedHoldingBed =
        (examinationOutcome === "community_order" || examinationOutcome === "revoked") &&
        movementHoldsBedByStage(movement);
      const awaitingRelease = movement.blocker === STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease;
      if (examinationRevokedHoldingBed || awaitingRelease) {
        return reject(
          state,
          event,
          `cannot collect a patient for movement ${movement.id}: the examination was revoked and this movement still holds a bed — a person must release the bed first`,
        );
      }
      /**
       * As for `TRANSPORT_EN_ROUTE`: at `moving`, `enRouteAt` is already set, so the message
       * reports the facts checked rather than a cause.
       *
       * Instant 0 is a recorded midnight — compare with `=== undefined`, never truthiness.
       */
      if (movement.stage !== "handover_ready" || movement.transport?.enRouteAt === undefined) {
        return reject(
          state,
          event,
          `cannot collect a patient: the movement must be at ${stageCopy.handover_ready.label} ` +
            `with transport en route (it is at ${stageCopy[movement.stage].label}, transport ` +
            `${movement.transport?.enRouteAt !== undefined ? "en route" : "not en route"})`,
        );
      }
      // P1-3 (Ward Lead ruling, 17 September 2026) — see `heldUnitGenderRefusal`'s own doc comment.
      // The last of the four re-checks: `PATIENT_ARRIVED` deliberately has none.
      const collectedGenderRefusal = heldUnitGenderRefusal(state, movement, event.now);
      if (collectedGenderRefusal) return reject(state, event, collectedGenderRefusal);
      // Audit fix (13 Oct 2026): collected with a check open (no Form 4A, no clearance) records why.
      const collectedException =
        event.exception === undefined
          ? undefined
          : transportExceptionRecord(event.exception, event.now, event.role, "collected");
      if (typeof collectedException === "string")
        return reject(state, event, `PATIENT_COLLECTED ${collectedException}`);
      const updated: Movement = {
        ...movement,
        stage: "moving",
        transport: {
          ...movement.transport,
          collectedAt: event.now,
          ...(collectedException ? { exceptions: [...(movement.transport.exceptions ?? []), collectedException] } : {}),
        },
        // Nothing is blocking a patient who is in a vehicle — and the SEED already says so in these
        // exact words on its two `moving` movements. Reused verbatim rather than reworded.
        blocker: STAGE_TRANSITION_BLOCKERS.collected,
        // `transport.collectedAt` above and this entry's `at` are the same `event.now` — see
        // `StageChange`'s doc comment.
        stageChanges: [...movement.stageChanges, { at: event.now, from: movement.stage, to: "moving", by: event.role }],
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "PATIENT_ARRIVED": {
      // Refuse a non-finite `now` before any other logic, so NaN never reaches `closure.at`,
      // `transport.arrivedAt` or `stageChanges`.
      if (finiteInstant(event.now) === null) {
        return reject(state, event, "PATIENT_ARRIVED now must be a finite instant");
      }
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot arrive a patient for a closed movement (${movement.closure.reason})`);
      }
      if (movement.transport?.diversion) {
        return reject(
          state,
          event,
          `movement ${movement.id} was diverted; use RELEASE_DIVERTED_BED rather than recording arrival`,
        );
      }
      // Owner answer 10: "'No transport needed' is recorded at pull, booking is skipped, and the
      // ward records the arrival." When a person recorded no transport is needed and no live job
      // exists, the ward may record arrival straight from `pulled`. Both halves are required: a
      // live (uncancelled) job means the ordinary chain applies, whatever the need flag says (audit
      // §3 item 4).
      const liveTransportJob = movement.transport !== undefined && movement.transport.cancelledAt === undefined;
      const noTransportNeeded =
        (movement.transportNeed?.needed ?? movement.transport?.needed) === false &&
        !liveTransportJob &&
        movement.transport?.collectedAt === undefined;
      // Audit r1 item 4: arrival with no transport leg and fit to travel open records why.
      const arrivalException =
        event.exception === undefined
          ? undefined
          : transportExceptionRecord(event.exception, event.now, event.role, "arrived");
      if (typeof arrivalException === "string") return reject(state, event, `PATIENT_ARRIVED ${arrivalException}`);
      if (noTransportNeeded) {
        if (movement.stage !== "pulled" && movement.stage !== "handover_ready") {
          return reject(
            state,
            event,
            `cannot arrive a patient with no transport needed at the movement's current stage (${stageCopy[movement.stage].label}); the bed must be pulled first`,
          );
        }
      } else if (movement.stage !== "moving" || movement.transport?.collectedAt === undefined) {
        return reject(
          state,
          event,
          `cannot arrive a patient at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      if (!movement.acceptedUnitId) {
        return reject(state, event, `movement ${movement.id} has no accepted destination unit`);
      }
      // A `ward` caller with no `actingUnitId` is refused outright, as `BOOK_TRANSPORT` and
      // `CANCEL_TRANSPORT` do.
      if (event.role === "ward" && !event.actingUnitId) {
        return reject(
          state,
          event,
          `PATIENT_ARRIVED raised as ward must state its actingUnitId, and it has no default`,
        );
      }
      if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `ward ${event.actingUnitId} cannot confirm arrival for a patient accepted at ${movement.acceptedUnitId}`,
        );
      }
      const unit = findUnit(state, movement.acceptedUnitId);
      if (!unit) return reject(state, event, `no unit found for id ${movement.acceptedUnitId}`);

      /**
       * A4-16 (Josh): the receiving ward closes the transfer on arrival and handover. The officer's
       * Delivered ends the transport leg only: it records `transport.arrivedAt` and leaves the
       * movement open at `moving`. The ward (or coordinator) then confirms arrival with this same
       * event.
       */
      if (event.role === "officer") {
        // Master plan 5.2 random run: with no transport needed there is no leg to deliver, and
        // Delivered used to be accepted as a silent no-op. The officer screen already refuses it.
        if (noTransportNeeded) {
          return reject(state, event, "No transport leg to deliver; the receiving ward confirms arrival");
        }
        if (movement.transport?.arrivedAt !== undefined) {
          return reject(
            state,
            event,
            `transport for movement ${movement.id} was already delivered; the receiving ward confirms arrival`,
          );
        }
        return replaceMovement(state, movement.id, {
          ...movement,
          transport: movement.transport && { ...movement.transport, arrivedAt: event.now },
        });
      }

      const patientId =
        movement.patientId ??
        state.referrals.find((r) => r.id === movement.referralId)?.patientId ??
        (movement.admissionId ? findAdmission(state, movement.admissionId)?.patientId : undefined);
      const source = movementSourceAdmission(state, movement);
      if (
        (movement.sourceAdmissionId && !source) ||
        (source && (source.state !== "occupied" || source.patientId !== patientId || source.unitId === unit.id))
      ) {
        return reject(
          state,
          event,
          "Repatriation arrival needs the patient's occupied source stay at a different ward.",
        );
      }
      if (
        patientId &&
        state.admissions.some(
          (a) =>
            a.patientId === patientId &&
            (a.state === "pulled" || a.state === "occupied") &&
            a.id !== movement.admissionId &&
            a.id !== source?.id,
        )
      ) {
        return reject(state, event, "This patient already holds another bed or occupies another ward.");
      }
      const linkedAdmission =
        movement.admissionId === undefined ? undefined : findAdmission(state, movement.admissionId);
      if (
        movement.admissionId !== undefined &&
        (!linkedAdmission ||
          linkedAdmission.state !== "pulled" ||
          linkedAdmission.unitId !== unit.id ||
          (linkedAdmission.movementId !== movement.id &&
            !(linkedAdmission.movementId === null && !linkedAdmission.id.startsWith("AD-ARR-"))) ||
          (patientId !== undefined && linkedAdmission.patientId !== patientId))
      ) {
        return reject(state, event, "Arrival needs this movement's matching held admission at its accepted ward.");
      }
      const heldReferral =
        movement.referralId === undefined
          ? undefined
          : state.referrals
              .find((referral) => referral.id === movement.referralId)
              ?.destinations.find(
                (arm) =>
                  arm.state === "accepted" &&
                  arm.heldBedNumber !== undefined &&
                  arm.destination.kind === "psychiatric_ward" &&
                  arm.destination.unitId === unit.id,
              );
      // The patient lands in the bed held for them; if that bed has since been taken they still
      // arrive, with no bed recorded, rather than being refused at the door.
      const heldBed = movement.heldBedNumber ?? heldReferral?.heldBedNumber;
      const heldBedNumber =
        heldBed !== undefined && bedNumberRefusal(state, unit, heldBed, linkedAdmission?.id) === null
          ? heldBed
          : undefined;
      // A seeded pulled stay (`movementId` null) is already counted as a taken bed and in the sex
      // mix (`bedStates`), so its arrival takes no second bed. Before this, arriving one moved
      // Occupied up by two and Ready down by one (release gate, 15 Oct 2026).
      const bedAlreadyCounted = linkedAdmission?.movementId === null;
      const isBedTurnaround = !bedAlreadyCounted && unit.empty.value <= 0;

      // Owner ruling 2026-09-25: occupant counts follow gender (recorded sex for a non-binary person).
      const arriverSex = mixSexOf(movement.gender, movement.sex);
      const countedSex =
        linkedAdmission === undefined ? arriverSex : mixSexOf(linkedAdmission.gender, linkedAdmission.sex);
      const updatedSexMix =
        bedAlreadyCounted && countedSex !== arriverSex
          ? adjustSexMix(adjustSexMix(unit.sexMix, countedSex, -1), arriverSex, 1)
          : bedAlreadyCounted
            ? unit.sexMix
            : adjustSexMix(unit.sexMix, arriverSex, 1);

      /*
       * A no-transport arrival jumps from `pulled` or `handover_ready` straight here and skips
       * `HANDOVER_READY`, `TRANSPORT_ACCEPTED` and `PATIENT_COLLECTED`, which already call
       * `heldUnitGenderRefusal`. Re-ask only `gender_designation` on that shortcut, using the same
       * refusal those steps use. Do not call the full helper: its placement-record check would
       * refuse a non-binary arrival on an undesignated ward, which the 2026-09-25 sex-mix ruling
       * still counts under recorded sex.
       *
       * A patient already `moving` is not refused here. `heldUnitGenderRefusal` documents why:
       * blocking arrival strands someone already in transit, and `RECORD_MOVEMENT_GENDER` has
       * already notified the coordinator.
       */
      if (movement.stage !== "moving") {
        const genderGate = eligibility(movement, unit, event.now).gates.find(
          (gate) => gate.gate === "gender_designation",
        );
        if (genderGate && !genderGate.pass) {
          return reject(state, event, GENDER_NO_LONGER_SUITS_REFUSAL);
        }
      }

      const updatedUnit: Unit = {
        ...unit,
        empty: bedAlreadyCounted ? unit.empty : { ...unit.empty, value: Math.max(0, unit.empty.value - 1) },
        sexMix: updatedSexMix,
        ...(isBedTurnaround
          ? {
              arrivalCapacityConflicts: [
                ...(unit.arrivalCapacityConflicts ?? []),
                {
                  movementId: movement.id,
                  ...((movement.admissionId ?? linkedAdmission?.id) === undefined
                    ? {}
                    : { admissionId: movement.admissionId ?? linkedAdmission?.id }),
                  at: event.now,
                },
              ],
            }
          : {}),
      };
      const { heldBedNumber: _heldBedNumber, ...movementWithoutHeldBed } = movement;
      void _heldBedNumber;
      const updatedMovement: Movement = {
        ...movementWithoutHeldBed,
        stage: "arrived",
        // A cancelled job may still sit on `movement.transport`; this route never writes
        // `arrivedAt` onto it.
        transport:
          movement.transport === undefined || noTransportNeeded
            ? movement.transport
            : { ...movement.transport, arrivedAt: movement.transport.arrivedAt ?? event.now },
        ...(arrivalException ? { arrivalException } : {}),
        closure: {
          at: event.now,
          outcome: "arrived",
          reason: noTransportNeeded
            ? "Patient arrived at the accepting unit (no transport needed)"
            : "Patient arrived at the accepting unit",
        },
        // When empty beds are exhausted, arrival enters a holding state awaiting bed turnaround.
        blocker: isBedTurnaround ? "Arrived — Bed Turnaround" : STAGE_TRANSITION_BLOCKERS.arrived,
        // `closure.at` above agrees with this entry's `at` — see `StageChange`'s doc comment.
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: "arrived", by: event.role },
        ],
      };
      const withUnit = replaceUnit(state, unit.id, updatedUnit);
      /**
       * The only event that may write `arrivedAt` (owner ruling: "a patient is not marked as
       * arrived until the ward says they have arrived."). The person becomes `occupied` and the
       * stay clock starts.
       *
       * The admission is looked up by id, never by unit and state: two people pulled to one ward is
       * ordinary. A hand-authored seed movement has no `admissionId`; no occupant is fabricated for
       * it.
       */
      const pulledAdmission =
        movement.admissionId === undefined ? undefined : findAdmission(withUnit, movement.admissionId);
      let withPerson: WardFlowState;
      // Audit §3 items 2, 5, 6: an absent admission is left alone, never invented.
      if (pulledAdmission && pulledAdmission.state === "pulled") {
        withPerson = replaceAdmission(withUnit, pulledAdmission.id, {
          ...pulledAdmission,
          state: "occupied",
          gender: movement.gender,
          arrivedAt: event.now,
          ...(heldBedNumber === undefined ? {} : { bedNumber: heldBedNumber }),
          ...(isBedTurnaround ? { blockReason: "Awaiting clean" } : {}),
        });
      } else {
        withPerson = withUnit;
      }
      /*
       * A repatriation or recorded ward transfer carries the sending stay (via
       * `sourceAdmissionId` or a psychiatric-ward referral). Arrival at the receiving ward ends
       * that stay as a transfer, so one person never holds a bed at both hospitals. A stay that
       * has already left (or has gone) is left alone.
       */
      const sendingUnit = source ? findUnit(withPerson, source.unitId) : undefined;
      if (source && sendingUnit && source.state === "occupied") {
        withPerson = departAdmission(
          withPerson,
          source,
          sendingUnit,
          event.now,
          "transferred-to-another-psychiatric-ward",
          event.role,
        );
      }
      if (heldReferral && movement.referralId) {
        const referral = findReferral(withPerson, movement.referralId);
        if (referral) {
          withPerson = replaceReferral(withPerson, referral.id, {
            ...referral,
            destinations: referral.destinations.map((arm) => {
              if (
                arm.state !== "accepted" ||
                arm.heldBedNumber === undefined ||
                arm.destination.kind !== "psychiatric_ward" ||
                arm.destination.unitId !== unit.id
              )
                return arm;
              const { heldBedNumber: _heldBed, ...releasedArm } = arm;
              void _heldBed;
              return releasedArm;
            }),
          });
        }
      }
      return replaceMovement(withPerson, movement.id, updatedMovement);
    }

    /**
     * Away at an emergency department, and back again: neither case touches a unit. The ward holds
     * the bed because the person is coming back, so no availability figure moves and a coordinator
     * is never offered it. Pinned in `tests/ward-away-at-emergency-department.test.ts`.
     *
     * `RECORD_MOVEMENT_BLOCKER` writes `Movement.blocker` (the free-prose field, not
     * `BedRelease.blocker`): the facts a coordinator needs to read that nothing in the model can
     * compute. Not membership-checked, deliberately (owner ruling): a fixed list cannot hold an
     * absence with its reason, or activity by parties the model has no field for. A blank is
     * refused. No role is recorded with it; inventing an attribution is worse than omitting one.
     *
     * `FLAG_MOVEMENT_URGENT` / `CLEAR_MOVEMENT_URGENT`: both halves, so a flag can always be taken
     * down. Item 37: raising records a reason (checked against `URGENT_MARK_REASONS` at runtime),
     * role and instant on `Movement.urgentFlag`; clearing needs no reason. `urgentFlagHistory` is
     * append-only: raising pushes an entry; clearing fills `clearedAt`/`clearedBy` on the newest
     * open entry (`findLastIndex`), so one raise-then-clear cycle is one row.
     */
    case "FLAG_MOVEMENT_URGENT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // A closed movement is off `queueOrder`; refused rather than accepted as a silent no-op.
      if (movement.closure) {
        return reject(state, event, `cannot flag a closed movement as urgent (${movement.closure.reason})`);
      }
      if (movement.flaggedUrgent) {
        return reject(state, event, `movement ${movement.id} is already flagged urgent`);
      }
      if (!URGENT_MARK_REASONS.includes(event.reason)) {
        return reject(state, event, `FLAG_MOVEMENT_URGENT reason must be chosen from URGENT_MARK_REASONS`);
      }
      return replaceMovement(state, movement.id, {
        ...movement,
        flaggedUrgent: true,
        urgentFlag: { at: event.now, by: event.role, reason: event.reason },
        urgentFlagHistory: [
          ...(movement.urgentFlagHistory ?? []),
          { raisedAt: event.now, raisedBy: event.role, reason: event.reason },
        ],
      });
    }

    case "CLEAR_MOVEMENT_URGENT_FLAG": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      // No `closure` check, unlike flagging: removing a flag can never promote anybody, and a flag
      // that cannot be cleared is the permanent state this pair prevents.
      if (!movement.flaggedUrgent) {
        return reject(state, event, `movement ${movement.id} is not flagged urgent`);
      }
      // `undefined` stays `undefined` — a movement flagged before this history existed (WF-018)
      // has nothing to update, and clearing it must not invent an empty log where there was none.
      const history = movement.urgentFlagHistory;
      const openIndex = history?.findLastIndex((entry) => entry.clearedAt === undefined) ?? -1;
      const updatedHistory =
        history === undefined || openIndex === -1
          ? history
          : history.map((entry, index) =>
              index === openIndex ? { ...entry, clearedAt: event.now, clearedBy: event.role } : entry,
            );
      // Clears the provenance together with the boolean — the two fields can never disagree about
      // whether a flag is live (see `Movement.urgentFlag`'s own doc comment).
      return replaceMovement(state, movement.id, {
        ...movement,
        flaggedUrgent: false,
        urgentFlag: undefined,
        urgentFlagHistory: updatedHistory,
      });
    }

    /**
     * Nothing is holding this patient up any more. Clearing is represented, not interpreted: this
     * writes one sentinel from `BLOCKERS_MEANING_NOTHING_IS_BLOCKING`, so the recogniser only ever
     * knows a closed set.
     *
     * `"None — cleared"` is an absence with its reason: somebody looked and said it is gone, unlike
     * "No blocker", which means nobody recorded one.
     */
    case "CLEAR_MOVEMENT_BLOCKER": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot clear the blocker on a closed movement (${movement.closure.reason})`);
      }
      const examinationOutcome = movement.examination?.outcome;
      const examinationRevokedHoldingBed =
        (examinationOutcome === "community_order" || examinationOutcome === "revoked") &&
        movementHoldsBedByStage(movement);
      const awaitingRelease = movement.blocker === STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease;
      if (examinationRevokedHoldingBed || awaitingRelease) {
        return reject(
          state,
          event,
          `cannot clear statutory hold on movement ${movement.id}: examination was revoked while holding a bed — requires doctor reassessment or bed release`,
        );
      }
      // Refused rather than a no-op: a control must not report success for an act that changed
      // nothing.
      if (BLOCKERS_MEANING_NOTHING_IS_BLOCKING.some((inactive) => inactive === movement.blocker.trim())) {
        return reject(state, event, `movement ${movement.id} already records that nothing is holding it up`);
      }
      return replaceMovement(state, movement.id, {
        ...movement,
        blocker: "None — cleared",
        examRevoked: movement.examRevoked,
      });
    }

    case "CLEAR_STAY_DISCHARGE_BLOCKER": {
      const admission = findAdmission(state, event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `CLEAR_STAY_DISCHARGE_BLOCKER was raised acting as unit ${event.actingUnitId} but admission ${admission.id} belongs to unit ${admission.unitId}`,
        );
      }
      // Refused rather than absorbed: clearing a blocker that was never recorded is a screen defect.
      if (admission.blockReason === null) {
        return reject(state, event, `admission ${admission.id} carries no discharge blocker to clear`);
      }
      if (
        event.reason !== undefined &&
        (typeof event.reason !== "string" ||
          event.reason.trim().length === 0 ||
          !(DISCHARGE_DELAY_CLEAR_REASONS as readonly string[]).includes(event.reason))
      ) {
        return reject(
          state,
          event,
          `CLEAR_STAY_DISCHARGE_BLOCKER reason must be chosen from DISCHARGE_DELAY_CLEAR_REASONS`,
        );
      }
      const clearedReason: DischargeDelayClearReason = (event.reason ??
        "resolved_clinically") as DischargeDelayClearReason;
      const next = replaceAdmission(state, admission.id, { ...admission, blockReason: null });
      const linkedRelease = next.bedReleases.find(
        (candidate) =>
          candidate.admissionId === admission.id &&
          candidate.state !== "discharged" &&
          candidate.blocker !== null &&
          candidate.unitId === event.actingUnitId &&
          candidate.blocker === admission.blockReason,
      );
      if (!linkedRelease) return next;
      return replaceBedRelease(next, linkedRelease.id, {
        ...linkedRelease,
        blocker: null,
        blockedBy: null,
        lastClearedBlockReason: clearedReason,
        clearedBlockHistory: [
          ...(linkedRelease.clearedBlockHistory ?? []),
          { at: event.now, by: event.role, reason: clearedReason, blocker: admission.blockReason },
        ],
      });
    }

    case "CONFIRM_CAPACITY": {
      // The role check proves only that a ward raised this, not which. This compares the unit the
      // caller said it acts as against the unit written to. It does not prove the claim:
      // `actingUnitId` is whatever the call site supplied and this prototype has no authenticated
      // identity. A recorded assertion, not an authorisation decision; never describe or extend it
      // as one.
      if (event.actingUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `CONFIRM_CAPACITY was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
        );
      }
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      // The reducer is the trust boundary: a screen bound is bypassed by other call sites.
      //
      // The bound is `unit.beds`, never `empty.value`: a ward confirmation may disagree with a
      // stale feed (`tests/ward-flow-reducer.test.ts`'s "arrival capacity floor" relies on it).
      // Refuses rather than clamps, so no number the ward never said is recorded.
      if (!Number.isInteger(event.value) || event.value < 0) {
        return reject(
          state,
          event,
          `CONFIRM_CAPACITY on unit ${unit.id} was given ${event.value}, which is not a whole number of beds`,
        );
      }
      if (event.value > unit.beds) {
        return reject(
          state,
          event,
          `CONFIRM_CAPACITY says unit ${unit.id} can allocate ${event.value} beds, which is more than the ${unit.beds} beds it has`,
        );
      }
      // Optimistic-concurrency: a caller that read revision N and now writes must be told
      // when any resource change has since landed, rather than silently overwriting it.
      if (
        !Number.isSafeInteger(event.expectedRevision) ||
        (unit.allocatable.revision ?? 0) !== event.expectedRevision
      ) {
        return reject(
          state,
          event,
          `CONFIRM_CAPACITY on unit ${unit.id} is stale: expected revision ${event.expectedRevision}, current ${unit.allocatable.revision ?? 0}`,
        );
      }
      const updatedUnit: Unit = {
        ...unit,
        ...(unit.reservationReleaseCapacityConflicts === undefined
          ? {}
          : {
              reservationReleaseCapacityConflicts: unit.reservationReleaseCapacityConflicts.filter(
                (entry) => entry.at > event.now,
              ),
            }),
        allocatable: {
          ...unit.allocatable,
          value: event.value,
          source: "ward",
          confirmedAt: event.now,
          revision: (unit.allocatable.revision ?? 0) + 1,
        },
      };
      return replaceUnit(state, unit.id, updatedUnit);
    }

    case "FLAG_BED_RELEASE": {
      // Claim-not-proof, as CONFIRM_CAPACITY: compares the caller's stated unit against the
      // release's unit. `FLAG_BED_RELEASE` is `ward`-only, so the comparison always runs.
      if (event.actingUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `FLAG_BED_RELEASE was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
        );
      }
      const flaggedUnit = findUnit(state, event.unitId);
      if (!flaggedUnit) return reject(state, event, `no unit found for id ${event.unitId}`);
      // Owner decision: a bed release is a named patient's discharge. These checks make
      // `admissionId` real; see `BedRelease.admissionId`.
      const flaggedAdmission = findAdmission(state, event.admissionId);
      if (!flaggedAdmission) {
        return reject(state, event, `no admission found for id ${event.admissionId}`);
      }
      if (flaggedAdmission.unitId !== event.unitId) {
        return reject(
          state,
          event,
          `FLAG_BED_RELEASE names admission ${flaggedAdmission.id} on unit ${flaggedAdmission.unitId}, not unit ${event.unitId}`,
        );
      }
      if (flaggedAdmission.state === "departed") {
        return reject(
          state,
          event,
          `admission ${flaggedAdmission.id} has already left, and a bed release completes when they leave`,
        );
      }
      if (flaggedAdmission.state !== "occupied") {
        return reject(
          state,
          event,
          `admission ${flaggedAdmission.id} is ${flaggedAdmission.state}, and only somebody occupying a bed can have a bed release`,
        );
      }
      const flaggedLiveRelease = state.bedReleases.find(
        (r) => r.admissionId === flaggedAdmission.id && r.state !== "discharged",
      );
      if (flaggedLiveRelease) {
        return reject(
          state,
          event,
          `admission ${flaggedAdmission.id} already has a live bed release (${flaggedLiveRelease.id})`,
        );
      }
      // "Blockers are chosen, never typed" (binding spec) is a runtime rule: checked by membership
      // for an untyped caller.
      if (event.blocker !== undefined && !BED_RELEASE_BLOCKERS.includes(event.blocker)) {
        return reject(state, event, `FLAG_BED_RELEASE blocker must be chosen from BED_RELEASE_BLOCKERS`);
      }
      // A flag always creates an `"expected"` release; a blocker sets the blocked flag on it rather
      // than choosing a different state, so `capacityBreakdown` counts a held-up release.
      // `waitingOn` is kept on both paths.
      //
      // `expectedAt` is the ward's estimate of when the bed will be free (`event.expectedAt`), so
      // `releaseBand()` can classify it; `confirmedAt` is when the ward reported. Neither carries
      // anything about the departing patient's own timing (binding spec §4).
      const flaggingRole = recordedByLabel(event.role, flaggedUnit.name);
      const release: BedRelease = {
        // "WR-9NN": the "9" prefix marks a runtime id. Safe to derive from `bedReleases.length`:
        // nothing ever removes a release.
        id: `WR-9${String(state.bedReleases.length).padStart(2, "0")}`,
        unitId: flaggedUnit.id,
        admissionId: flaggedAdmission.id,
        state: "expected",
        expectedAt: event.expectedAt,
        waitingOn: event.waitingOn,
        // A blocker already recorded on the stay carries over when the flag supplies none.
        blocker: event.blocker ?? flaggedAdmission.blockReason ?? null,
        blockedBy: event.blocker !== undefined || flaggedAdmission.blockReason !== null ? flaggingRole : null,
        // A bed nobody has yet left is not being made ready. Preparation only ever begins after
        // `RELEASE_BED`, and only through `SET_BED_PREPARATION` — see that case.
        preparing: false,
        preparationNote: null,
        confirmedAt: event.now,
        confirmedBy: flaggingRole,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      // The stay's reason follows the release's blocker, so an explicit blocker on the flag is not left off the stay.
      return withStayBlocker(
        { ...state, bedReleases: [...state.bedReleases, release] },
        flaggedAdmission.id,
        release.blocker,
      );
    }

    case "CONFIRM_BED_RELEASE": {
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      // Claim-not-proof, as FLAG_BED_RELEASE. `CONFIRM_BED_RELEASE` carries the acting unit, so the
      // comparison always runs.
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `CONFIRM_BED_RELEASE was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // Legal transition: expected -> confirmed only. A blocked release is confirmed from whichever
      // stage it is in, keeping its flag.
      if (release.state !== "expected") {
        return reject(state, event, `cannot move release ${release.id} from ${release.state} to confirmed`);
      }
      // Spec D7: `confirmedAt` restates to `event.now` on every accepted transition, so freshness
      // reports when the current state was last reported. `confirmedBy` is not restated: the guard
      // above guarantees it is the same ward.
      //
      // `blocker`/`blockedBy` carry through untouched: a decided but stuck discharge is still
      // confirmed, and flagged. `CLEAR_BED_RELEASE_BLOCK` is the only way a flag comes off.
      const updated: BedRelease = {
        ...release,
        state: "confirmed",
        waitingOn: null,
        confirmedAt: event.now,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return withAdmissionDischargeDecision(
        replaceBedRelease(state, release.id, updated),
        release.admissionId,
        event.now,
        event.role,
      );
    }

    case "REVERT_BED_RELEASE": {
      // The reversal is recorded like every other change (`confirmedAt` restated, `confirmedBy`
      // left alone): a reversal that cannot be recorded honestly gets recorded dishonestly instead.
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `REVERT_BED_RELEASE was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // Legal transition: confirmed -> expected. `discharged` is terminal and `expected` is
      // already there, so both fall into the same refusal.
      if (release.state !== "confirmed") {
        return reject(state, event, `cannot move release ${release.id} from ${release.state} to expected`);
      }
      // Membership check, not truthiness — the same discipline BLOCK_BED_RELEASE's own blocker
      // check holds to, and for the same reason: a runtime rule, not merely a compile-time one.
      if (!BED_RELEASE_WAITING_ON.includes(event.waitingOn)) {
        return reject(state, event, `REVERT_BED_RELEASE waitingOn must be chosen from BED_RELEASE_WAITING_ON`);
      }
      // The blocked flag survives: reversing the discharge decision does not unstick the bed.
      const reverted: BedRelease = {
        ...release,
        state: "expected",
        waitingOn: event.waitingOn,
        confirmedAt: event.now,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return withAdmissionDischargeDecision(
        replaceBedRelease(state, release.id, reverted),
        release.admissionId,
        null,
        event.role,
      );
    }

    case "BLOCK_BED_RELEASE": {
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `BLOCK_BED_RELEASE was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // "Blocked with no blocker" is a contradiction (spec D3), and "Blockers are chosen, never
      // typed" (binding spec): a real membership test for an untyped caller.
      if (!event.blocker || !BED_RELEASE_BLOCKERS.includes(event.blocker)) {
        return reject(state, event, `BLOCK_BED_RELEASE requires a blocker chosen from BED_RELEASE_BLOCKERS`);
      }
      // Sets a flag and moves no stage: a blocked release keeps its stage and keeps counting as
      // such. Only `discharged` is refused, since the bed is already free.
      const blockedUnit = findUnit(state, release.unitId);
      if (!blockedUnit) return reject(state, event, `no unit found for id ${release.unitId}`);
      if (release.state === "discharged") {
        return reject(state, event, `cannot block release ${release.id} because it is already released`);
      }
      // Spec D7: same freshness restatement as CONFIRM_BED_RELEASE. `blockedBy` is separate from
      // `confirmedBy`: "who says this bed is stuck" and "who last reported its stage" differ once a
      // block outlives a stage change.
      const updated: BedRelease = {
        ...release,
        blocker: event.blocker,
        blockedBy: recordedByLabel(event.role, blockedUnit.name),
        confirmedAt: event.now,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return withStayBlocker(replaceBedRelease(state, release.id, updated), release.admissionId, event.blocker);
    }

    case "CLEAR_BED_RELEASE_BLOCK": {
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `CLEAR_BED_RELEASE_BLOCK was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // Refused rather than a silent no-op: unblocking an unflagged release is a screen defect to
      // surface.
      if (release.blocker === null) {
        return reject(state, event, `release ${release.id} carries no blocked flag to clear`);
      }
      if (
        event.reason !== undefined &&
        (typeof event.reason !== "string" ||
          event.reason.trim().length === 0 ||
          !(DISCHARGE_DELAY_CLEAR_REASONS as readonly string[]).includes(event.reason))
      ) {
        return reject(state, event, `CLEAR_BED_RELEASE_BLOCK reason must be chosen from DISCHARGE_DELAY_CLEAR_REASONS`);
      }
      const clearedReason: DischargeDelayClearReason = (event.reason ??
        "resolved_clinically") as DischargeDelayClearReason;
      const unblocked: BedRelease = {
        ...release,
        blocker: null,
        blockedBy: null,
        confirmedAt: event.now,
        lastClearedBlockReason: clearedReason,
        clearedBlockHistory: [
          ...(release.clearedBlockHistory ?? []),
          { at: event.now, by: event.role, reason: clearedReason, blocker: release.blocker },
        ],
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return withStayBlocker(replaceBedRelease(state, release.id, unblocked), release.admissionId, null);
    }

    case "SET_BED_PREPARATION": {
      // Q4: marks a bed as being made ready and nothing else. It touches no unit field or capacity
      // figure, so the bed stays offered and counted as the owner requires. Do not add a unit write
      // here to "hold" a bed while it is cleaned.
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `SET_BED_PREPARATION was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // "Notes are chosen, never typed" is a runtime rule: anything outside `BED_PREPARATION_NOTES`
      // is refused. The `string | undefined` binding and `readonly string[]` widening keep the
      // check compiling if the list is ever emptied.
      const requestedNote: string | undefined = event.note;
      if (requestedNote !== undefined && !(BED_PREPARATION_NOTES as readonly string[]).includes(requestedNote)) {
        return reject(state, event, `SET_BED_PREPARATION note must be chosen from BED_PREPARATION_NOTES`);
      }
      const prepared: BedRelease = {
        ...release,
        preparing: event.preparing,
        // Clearing the flag clears the note with it — "being made ready, waiting on nothing" is
        // a state, "not being made ready, waiting on a clean" is a contradiction.
        preparationNote: event.preparing ? (event.note ?? null) : null,
        confirmedAt: event.now,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceBedRelease(state, release.id, prepared);
    }

    case "RELEASE_BED": {
      const release = findBedRelease(state, event.releaseId);
      if (!release) return reject(state, event, `no bed release found for id ${event.releaseId}`);
      if (event.actingUnitId !== release.unitId) {
        return reject(
          state,
          event,
          `RELEASE_BED was raised acting as unit ${event.actingUnitId} but release ${release.id} belongs to unit ${release.unitId}`,
        );
      }
      // Legal transitions: confirmed -> discharged and expected -> discharged; `discharged` is
      // terminal (owner ruling: discharged, not released). Expected is accepted deliberately: "the
      // person has left" is a fact about an empty bed.
      if (release.state === "discharged") {
        return reject(state, event, `release ${release.id} is already discharged and cannot be discharged again`);
      }
      const unit = findUnit(state, release.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${release.unitId}`);
      // Owner decision: this completes a release only once its named admission has left. While they
      // are still in the bed, `RECORD_LEAVING` is what completes it. See `departAdmission`.
      const releasedAdmission = findAdmission(state, release.admissionId);
      if (!releasedAdmission) {
        return reject(
          state,
          event,
          `release ${release.id} names admission ${release.admissionId}, which does not exist`,
        );
      }
      if (releasedAdmission.state !== "departed") {
        return reject(
          state,
          event,
          `release ${release.id} completes when admission ${releasedAdmission.id} is recorded as having left (RECORD_LEAVING); they are still ${releasedAdmission.state}`,
        );
      }
      // Spec D7: same freshness restatement as CONFIRM_BED_RELEASE. The blocked flag comes off here
      // too: once the bed is free nothing is held up.
      const updatedRelease: BedRelease = {
        ...release,
        state: "discharged",
        waitingOn: null,
        blocker: null,
        blockedBy: null,
        confirmedAt: event.now,
      };
      // The person has already left (refused above otherwise) and `departAdmission` moved the
      // figures then; this event only records the stage and never moves a count. Any figure written
      // must stay clamped to `unit.beds`, which `unitCapacity`'s reconciliation identity
      // (`tests/ward-capacity-reconciliation.test.ts`) depends on.
      const departureAlreadyIncremented = true;

      // `sexMix` is not touched: a release does not say who left, so the count moves when the
      // admission departs (owner rulings), never by guessing here. Audit A1-11: recording the stage
      // never stamps the ward's figures as confirmed.
      const updatedUnit: Unit = departureAlreadyIncremented
        ? unit
        : {
            ...unit,
            allocatable: {
              ...unit.allocatable,
              value: Math.min(unit.beds, unit.allocatable.value + 1),
            },
            empty: { ...unit.empty, value: Math.min(unit.beds, unit.empty.value + 1) },
          };
      const withUnit = replaceUnit(state, unit.id, updatedUnit);
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceBedRelease(withUnit, release.id, updatedRelease);
    }

    case "END_LEAVE_BED": {
      const leaveBed = findLeaveBed(state, event.leaveBedId);
      if (!leaveBed) return reject(state, event, `no leave bed found for id ${event.leaveBedId}`);
      if (event.actingUnitId !== leaveBed.unitId) {
        return reject(
          state,
          event,
          `END_LEAVE_BED was raised acting as unit ${event.actingUnitId} but leave bed ${leaveBed.id} belongs to unit ${leaveBed.unitId}`,
        );
      }
      return { ...state, leaveBeds: state.leaveBeds.filter((candidate) => candidate.id !== leaveBed.id) };
    }

    case "END_COMMUNITY_TREATMENT_ORDER": {
      const patient = state.patients.find((candidate) => candidate.id === event.patientId);
      if (!patient) return reject(state, event, `no patient found for id ${event.patientId}`);
      if (!patient.communityTreatmentOrder || patient.communityTreatmentOrder.endedAt !== undefined) {
        return reject(state, event, `patient ${patient.id} has no community treatment order recorded`);
      }
      const ended = { ...patient.communityTreatmentOrder, endedAt: event.now };
      return {
        ...state,
        patients: state.patients.map((candidate) =>
          candidate.id === patient.id ? { ...candidate, communityTreatmentOrder: ended } : candidate,
        ),
      };
    }

    case "REQUEST_CAPACITY_REFRESH": {
      // Spec D12: changes no number; it only records who asked and when. Nothing leaves the sandbox
      // and no message is sent.
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      return {
        ...state,
        refreshRequests: [...state.refreshRequests, { unitId: unit.id, at: event.now, byRole: event.role }],
      };
    }

    case "RECEIVE_REFERRAL": {
      if (event.atsCategory !== undefined && ![1, 2, 3, 4, 5].includes(event.atsCategory))
        return reject(state, event, "RECEIVE_REFERRAL ATS category must be a recorded integer from 1 to 5.");
      // Spec failure behaviour: "a referral missing a required field, or carrying an unknown source
      // … → refused with a visible `Rejection`. Never silently queued, never defaulted." Every
      // check below is a membership check or a resolution against the real site list, and each
      // names what was wrong.
      if (!COHORTS.includes(event.ageBand)) {
        return reject(state, event, `RECEIVE_REFERRAL ageBand must be chosen from COHORTS`);
      }
      // `sex` is membership-checked on the ward arm (review finding M1): an off-list value would
      // otherwise match almost nothing with plausible-looking reasons.
      //
      // FD-21: one act, several destinations, up to the cap. Each refusal names a different way the
      // list can be wrong.
      if (event.destinations.length === 0) {
        return reject(state, event, `RECEIVE_REFERRAL needs at least one destination`);
      }
      if (event.destinations.length > state.configuration.parallelReferralCap) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL may address at most ${state.configuration.parallelReferralCap} destinations, not ${event.destinations.length}`,
        );
      }
      const kinds = event.destinations.map((destination) => destination.kind);
      const recipientKeys = event.destinations.map((destination) =>
        destination.kind === "psychiatric_ward" && destination.unitId
          ? `${destination.kind}:${destination.unitId}`
          : destination.kind,
      );
      const broadWard = event.destinations.some(
        (destination) => destination.kind === "psychiatric_ward" && !destination.unitId,
      );
      if (
        new Set(recipientKeys).size !== recipientKeys.length ||
        (broadWard && kinds.filter((kind) => kind === "psychiatric_ward").length > 1)
      ) {
        // Asking one kind twice is refused rather than de-duplicated, so the cap counts what the
        // referrer chose.
        return reject(state, event, `RECEIVE_REFERRAL cannot address the same destination kind twice`);
      }
      if (kinds.some((kind) => !REFERRAL_DESTINATION_KINDS.includes(kind))) {
        return reject(state, event, `RECEIVE_REFERRAL destination kind must be chosen from REFERRAL_DESTINATION_KINDS`);
      }
      /**
       * The ED arm's `edId` resolves against the real network, as `originSiteCode` does:
       * non-emptiness is not the check, since `"not-a-department"` survives every truthiness test
       * and would queue a real person at a hospital that does not exist. Every path goes through
       * here, so this is the last line, not a screen guard.
       */
      const edDestination = event.destinations.find((destination) => destination.kind === "emergency_department");
      if (edDestination?.kind === "emergency_department") {
        if (!allEmergencyDepartments().some((department) => department.id === edDestination.edId)) {
          return reject(state, event, `RECEIVE_REFERRAL edId must resolve to a real emergency department`);
        }
        if (!REFERRAL_PURPOSES.includes(edDestination.purpose)) {
          return reject(state, event, `RECEIVE_REFERRAL purpose must be chosen from REFERRAL_PURPOSES`);
        }
      }
      for (const wardDestination of event.destinations) {
        if (wardDestination.kind !== "psychiatric_ward") continue;
        if (wardDestination.unitId !== undefined && !findUnit(state, wardDestination.unitId)) {
          return reject(state, event, "RECEIVE_REFERRAL unitId must resolve to a real ward");
        }
        if (!RECORDED_SEXES.includes(wardDestination.sex))
          return reject(state, event, "RECEIVE_REFERRAL sex must be chosen from RECORDED_SEXES");
        if (wardDestination.gender !== undefined && !REFERRAL_GENDERS.includes(wardDestination.gender))
          return reject(state, event, "RECEIVE_REFERRAL gender must be chosen from REFERRAL_GENDERS");
        if (
          [
            wardDestination.secureBedNeeded,
            wardDestination.involuntaryBedNeeded,
            // Legacy broad referrals omitted acuity; named recipients must answer explicitly.
            wardDestination.highAcuityNursingNeeded ?? (wardDestination.unitId === undefined ? false : undefined),
          ].some((value) => typeof value !== "boolean")
        )
          return reject(state, event, "RECEIVE_REFERRAL bed criteria must be answered");
      }
      if (event.intake !== undefined) {
        const error = referralIntakeError(event.intake);
        if (error) return reject(state, event, `RECEIVE_REFERRAL: ${error}`);
      }
      if (!REFERRAL_SOURCES.includes(event.source)) {
        return reject(state, event, `RECEIVE_REFERRAL source must be chosen from REFERRAL_SOURCES`);
      }
      // R9 (owner item 23): "only `ed_medical` is raised as `ed`, and `ed` with any other source is
      // refused. Everything else, including GP, stays `community`." Role `community` with source
      // `ed_medical` stays open (`tests/ward-ed-to-community-referral.test.ts`). Checked before the
      // `originUnitId` check so the pairing is reported first.
      if (event.role === "ed" && event.source !== "ed_medical") {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL raised as role ed must carry source ed_medical, not ${event.source}`,
        );
      }
      // Role access plan (15 Oct 2026): a ward raises a referral in its own name only as the
      // sending ward. Any other source would file it under someone else.
      if (event.role === "ward" && event.source !== "psychiatric_ward") {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL raised as role ward must carry source psychiatric_ward, not ${event.source}`,
        );
      }
      if (event.source === "psychiatric_ward") {
        if (!event.originUnitId || !findUnit(state, event.originUnitId)) {
          return reject(
            state,
            event,
            `RECEIVE_REFERRAL source psychiatric_ward must name a real originUnitId (the sending ward)`,
          );
        }
      }
      // A ward names itself with `actingUnitId`, and may only send from that ward, as it answers
      // only its own movements (`wardActingUnitError`). Otherwise ward A could file a referral as B.
      if (event.role === "ward" && event.actingUnitId !== event.originUnitId) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL raised as role ward must send from its own ward: acting as ${event.actingUnitId ?? "no named ward"}, origin ${event.originUnitId}`,
        );
      }
      // `homeRegion` is a region from a fixed list, never an address or free text; see
      // `HOME_REGIONS`.
      if (!HOME_REGIONS.includes(event.homeRegion)) {
        return reject(state, event, `RECEIVE_REFERRAL homeRegion must be chosen from HOME_REGIONS`);
      }
      // The suburb is resolved against the real catchment table, never merely checked for
      // non-emptiness: a street address must not reach the one field whose defence is that it is
      // coarser (`PD-3`).
      if (!referralSuburbIsAnswered(event.suburb)) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL suburb must name a suburb the catchment source knows, or state that it is not known`,
        );
      }
      if (event.urgency !== 1 && event.urgency !== 2 && event.urgency !== 3) {
        return reject(state, event, `RECEIVE_REFERRAL urgency must be 1, 2 or 3`);
      }
      // A synthetic site code, never an address — resolved against the real network rather than
      // merely checked for non-emptiness, so "12 Wellington St, Perth" cannot pass as a code.
      const originSite = siteByCode(event.originSiteCode);
      if (!originSite) {
        return reject(state, event, `RECEIVE_REFERRAL originSiteCode must resolve to a real site`);
      }
      /**
       * A referral from ED medical staff must come from a hospital that has an ED. Each field was
       * valid alone; only their combination is impossible, and no screen could catch it. Reads the
       * site's own record in `wardSites`, never a hand-written list of codes
       * (`docs/ward-flow-changeable-data-rule.md`).
       */
      if (event.source === "ed_medical" && !originSite.emergencyDepartment) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL source ed_medical requires an origin site with an emergency department`,
        );
      }
      // A future triage instant is refused: `referralClocks` clamps at zero, so it would render as
      // a plausible "0m".
      if (event.triagedAt !== undefined && event.triagedAt > event.now) {
        return reject(state, event, `RECEIVE_REFERRAL triagedAt cannot be later than the referral itself`);
      }
      /**
       * Three states: absent (a referral raised with nobody on file, legitimate), present and real,
       * and present but naming nobody, which is refused. Same shape as `RAISE_REFERRAL`'s
       * `referralId` lookup. Do not drop the presence check, or every referral with no person on
       * file would be refused.
       */
      if (event.patientId !== undefined && !state.patients.some((patient) => patient.id === event.patientId)) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL patientId must name a patient this system already holds, and ${event.patientId} names none`,
        );
      }
      /**
       * The written history, the only field here that cannot be membership-checked. Only two things
       * are enforced: it is a string, and it does not exceed `REFERRAL_HISTORY_LIMITS`.
       *
       * A blank story is a complete answer (owner ruling: one story box, optional). An over-length
       * value is refused, never truncated: truncation silently drops the end of a risk note.
       * Nothing else is inspected; reading meaning out of this field would be clinical decision
       * support (see `Referral.history`).
       *
       * The shape check comes first: a thrown TypeError on an omitted field presents as a button
       * that did nothing, while a refusal is a `Rejection` a clinician can read.
       */
      for (const field of Object.keys(REFERRAL_HISTORY_LIMITS) as ReferralHistoryField[]) {
        if (typeof event[field] !== "string") {
          return reject(state, event, `RECEIVE_REFERRAL ${field} must be text, even when it is empty text`);
        }
      }
      for (const [field, limit] of Object.entries(REFERRAL_HISTORY_LIMITS) as [ReferralHistoryField, number][]) {
        if (event[field].length > limit) {
          return reject(
            state,
            event,
            `RECEIVE_REFERRAL ${field} is ${event[field].length} characters and the limit is ${limit} — it is refused rather than shortened`,
          );
        }
      }
      /**
       * The sending team's name. A blank-but-present value is refused rather than normalised to
       * `undefined`, and an over-length value is refused rather than shortened: a truncated name is
       * a different team's name.
       */
      if (event.sendingTeamName !== undefined) {
        if (event.sendingTeamName.trim() === "") {
          return reject(
            state,
            event,
            "RECEIVE_REFERRAL sendingTeamName is present but blank — omit the field to record no " +
              "sending team, rather than sending an empty one",
          );
        }
        if (event.sendingTeamName.length > SENDING_TEAM_NAME_LIMIT) {
          return reject(
            state,
            event,
            `RECEIVE_REFERRAL sendingTeamName is ${event.sendingTeamName.length} characters and the ` +
              `limit is ${SENDING_TEAM_NAME_LIMIT} — it is refused rather than shortened, because a ` +
              `truncated team name is a different team's name`,
          );
        }
      }
      // T15 (item 12): membership-checked when supplied; absent means nobody has recorded one.
      if (event.tentativeDiagnosis !== undefined && !isTentativeDiagnosisBlock(event.tentativeDiagnosis)) {
        return reject(
          state,
          event,
          `RECEIVE_REFERRAL tentativeDiagnosis must be chosen from TENTATIVE_DIAGNOSIS_BLOCKS`,
        );
      }
      const sequence = state.frontDoorReferralSequence + 1;
      const created: Referral = {
        id: nextFrontDoorReferralId(sequence),
        ...(event.intake === undefined ? {} : { intake: event.intake }),
        // Copied through, never defaulted: `undefined` means no person on file, and inventing an id
        // is how a referral points at the wrong human being.
        patientId: event.patientId,
        ageBand: event.ageBand,
        // Every destination starts queued: the referrer chose them, nobody has answered yet.
        // Each addressing records its own referral moment (the silence reminder reads it per ward).
        destinations: event.destinations.map((destination) => ({
          destination,
          state: "queued" as const,
          referredAt: event.now,
        })),
        homeRegion: event.homeRegion,
        suburb: event.suburb,
        source: event.source,
        originUnitId: event.source === "psychiatric_ward" ? event.originUnitId : undefined,
        // Copied through, never defaulted: `undefined` means no sending team was recorded, which
        // is a real answer for a crisis service or ambulance referral and not a gap to be filled.
        sendingTeamName: event.sendingTeamName,
        raisedAt: event.now,
        // Absent for a community expect, which is a real state and not a missing value.
        triagedAt: event.triagedAt,
        urgency: event.urgency,
        ...(event.atsCategory === undefined ? {} : { atsCategory: event.atsCategory }),
        originSiteCode: event.originSiteCode,
        transportNeeded: event.transportNeeded,
        // Byte for byte, untrimmed: the blank check trims only to decide; what the referrer wrote
        // is kept as written.
        history: event.history,
        // T15 (item 12): absent means nobody has recorded one — never defaulted, never derived
        // from anything else on the referral.
        tentativeDiagnosis: event.tentativeDiagnosis,
      };
      return { ...state, referrals: [...state.referrals, created], frontDoorReferralSequence: sequence };
    }

    case "ACCEPT_REFERRAL": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      /**
       * The role must match the destination it is answering (the narrowing half of `FD-3`). `ed`
       * may answer a referral addressed to it, so no ED decision is ever recorded under a false
       * `decidedBy`, but a role answers its own kind and nothing else. The coordinator is exempt
       * (`CO-D2`): it sees the whole picture.
       *
       * A total record over `WardFlowRole`, never `Partial`, so a new role without an entry is a
       * compile error rather than a silent bypass. `officer` and `demo` are `"any"` only because
       * `EVENT_ROLE` stops them reaching this line; widening `EVENT_ROLE` is a separate decision.
       */
      const answerableBy: Record<WardFlowRole, ReferralDestinationKind | "any"> = {
        ward: "psychiatric_ward",
        ed: "emergency_department",
        coordinator: "any",
        officer: "any",
        demo: "any",
        /**
         * `community_team`, not `"any"` (owner ruling): `EVENT_ROLE.DECLINE_REFERRAL` permits
         * `community`, and `"any"` would let a community team decline a ward's bed. Set in both the
         * accept and decline handlers so a future widening is already correct.
         */
        community: "community_team",
        bed_manager: "any",
        executive: "any",
      };
      const ownKind = answerableBy[event.role];
      if (ownKind !== "any" && ownKind !== event.destinationKind) {
        return reject(
          state,
          event,
          `${event.type} was raised by role ${event.role}, which may only answer ${ownKind.replace(/_/g, " ")} destinations, not ${event.destinationKind.replace(/_/g, " ")}`,
        );
      }
      if (
        event.role === "ward" &&
        event.destinationKind === "psychiatric_ward" &&
        event.unitId !== undefined &&
        wardTransferNeedsCoordinator(referral, event.unitId, state.units)
      ) {
        return reject(
          state,
          event,
          `D-30: a transfer from a ward at another hospital is accepted by the central bed coordinator, not the receiving ward`,
        );
      }
      const eligibleAddressings = referral.destinations.filter(
        (candidate) => candidate.destination.kind === event.destinationKind,
      );
      const addressing = eligibleAddressings.find(
        (candidate) =>
          candidate.destination.kind !== "psychiatric_ward" ||
          candidate.destination.unitId === undefined ||
          candidate.destination.unitId === event.unitId,
      );
      if (
        event.destinationKind === "psychiatric_ward" &&
        eligibleAddressings.length > 1 &&
        event.unitId === undefined
      ) {
        return reject(state, event, "Name the ward that is answering this referral.");
      }
      if (!addressing) {
        return reject(
          state,
          event,
          `referral ${referral.id} was not addressed to ${event.destinationKind.replace(/_/g, " ")}`,
        );
      }
      const actingRefusal = wardActingUnitRefusal(event, addressing);
      if (actingRefusal) return reject(state, event, actingRefusal);
      // FD-22: the first acceptance ends the placement; a second is refused rather than recorded,
      // so two places never believe they have taken the same person.
      //
      // RB5 (item 16): not for a community arm, which never competes for the placement and stays
      // answerable after a ward or ED says yes.
      const hasClinicalReassessment =
        event.reassessment === true ||
        event.clinicalUpdate === true ||
        event.clearanceUpdated === true ||
        (typeof event.reassessmentNote === "string" && event.reassessmentNote.trim().length > 0);
      const reassessmentEntry: ClinicalReassessmentEntry | undefined = hasClinicalReassessment
        ? {
            at: event.now,
            by: event.role,
            ...(typeof event.reassessmentNote === "string" && event.reassessmentNote.trim().length > 0
              ? { note: event.reassessmentNote.trim() }
              : {}),
            ...(event.clinicalUpdate !== undefined ? { clinicalUpdate: event.clinicalUpdate } : {}),
            ...(event.clearanceUpdated !== undefined ? { clearanceUpdated: event.clearanceUpdated } : {}),
          }
        : undefined;
      if (
        event.destinationKind !== "community_team" &&
        referralState(referral) === "accepted" &&
        !(hasClinicalReassessment && addressing.state === "accepted")
      ) {
        return reject(state, event, `referral ${referral.id} has already been accepted elsewhere`);
      }
      // Per-destination, not per-referral: another destination having declined leaves this one
      // free to answer (FD-24). Only THIS destination being already decided is a refusal, unless
      // a clinical reassessment or updated clearance is being recorded.
      if (
        addressing.state !== "queued" &&
        !(hasClinicalReassessment && (addressing.state === "declined" || addressing.state === "accepted"))
      ) {
        return reject(
          state,
          event,
          `${event.destinationKind.replace(/_/g, " ")} has already answered referral ${referral.id} (${addressing.state})`,
        );
      }
      /**
       * `RECORD_REFERRER_WITHDRAWAL` stamps `withdrawnAt`, never `state` (O-17.11), so the guard
       * above cannot see a withdrawal. A separate guard, because they are two different facts.
       */
      if (addressing.withdrawnAt !== undefined) {
        return reject(
          state,
          event,
          `referral ${referral.id} was withdrawn by its referrer, so ${event.destinationKind.replace(/_/g, " ")} cannot accept it`,
        );
      }

      const nextAddressingReassessmentHistory: ReadonlyArray<ClinicalReassessmentEntry> | undefined =
        reassessmentEntry === undefined
          ? addressing.reassessmentHistory
          : [
              ...(addressing.reassessmentHistory ??
                (addressing.reassessmentNote
                  ? [
                      {
                        at: addressing.decidedAt ?? referral.raisedAt,
                        by: event.role,
                        note: addressing.reassessmentNote,
                      },
                    ]
                  : [])),
              reassessmentEntry,
            ];

      if (hasClinicalReassessment && addressing.state === "accepted" && reassessmentEntry !== undefined) {
        const updatedAddressing: ReferralAddressing = {
          ...addressing,
          ...(nextAddressingReassessmentHistory === undefined
            ? {}
            : { reassessmentHistory: nextAddressingReassessmentHistory }),
          ...(reassessmentEntry.note !== undefined
            ? { reassessmentNote: reassessmentEntry.note }
            : addressing.reassessmentNote !== undefined
              ? { reassessmentNote: addressing.reassessmentNote }
              : {}),
        };
        const updatedDestinations = referral.destinations.map((candidate) =>
          candidate === addressing ? updatedAddressing : candidate,
        );
        const existingReferralHistory = referral.reassessmentHistory;
        const nextReferralHistory: ReadonlyArray<ClinicalReassessmentEntry> = [
          ...(existingReferralHistory ??
            (referral.reassessmentNote
              ? [
                  {
                    at: referral.raisedAt,
                    by: event.role,
                    note: referral.reassessmentNote,
                  },
                ]
              : [])),
          reassessmentEntry,
        ];
        let nextState = replaceReferral(state, referral.id, {
          ...referral,
          destinations: updatedDestinations,
          reassessmentHistory: nextReferralHistory,
          ...(reassessmentEntry.note !== undefined ? { reassessmentNote: reassessmentEntry.note } : {}),
        });
        const linkedMovement = nextState.movements.find((m) => m.referralId === referral.id && !m.closure);
        if (linkedMovement) {
          nextState = replaceMovement(nextState, linkedMovement.id, {
            ...linkedMovement,
            reassessmentHistory: [...(linkedMovement.reassessmentHistory ?? []), reassessmentEntry],
          });
        }
        decision.outcome = "accepted";
        decision.reasonCode = "none";
        return nextState;
      }

      let accepted: ReferralAddressing;
      // T12 (item 9): set only inside the ward branch below, when this acceptance is the FIRST
      // thing to clear a `Non-binary` referral for this specific unit.
      let genderPlacementAddition:
        | {
            at: Instant;
            by: WardFlowRole;
            unitIds: string[];
            reason: (typeof GENDER_PLACEMENT_REASONS)[number];
            wardChecked: true;
          }
        | undefined;
      if (addressing.destination.kind === "psychiatric_ward") {
        /**
         * P2-6 (Ward Lead audit): a ward must not accept this referral into a bed while a movement
         * raised from its ED arm is still under way for the same patient. `isOpen` is inlined to
         * avoid a circular import, as in `RAISE_REFERRAL`.
         */
        const openLinkedMovement = state.movements.find(
          (movement) => movement.referralId === referral.id && !movement.closure && movement.stage !== "arrived",
        );
        if (openLinkedMovement) {
          return reject(
            state,
            event,
            `referral ${referral.id} already has an open movement (${openLinkedMovement.id}); it cannot also be accepted into a ward while that movement is open`,
          );
        }
        // Only a ward acceptance names a unit, and only a ward acceptance runs the bed gates.
        if (!event.unitId) {
          return reject(state, event, `ACCEPT_REFERRAL into a psychiatric ward must name a unit`);
        }
        const unit = findUnit(state, event.unitId);
        if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
        if (event.bedNumber !== undefined) {
          const bedRefusal = bedNumberRefusal(state, unit, event.bedNumber, undefined);
          if (bedRefusal) return reject(state, event, bedRefusal);
        }
        /**
         * T12 (owner answer 9): the front door's half of the `REFER_TO_UNITS` rule (see
         * `GenderPlacement` in `ward-model.ts`). Checked before the eligibility gate and refuses
         * the whole acceptance.
         */
        if (
          genderReviewNeeded(addressing.destination.gender, addressing.destination.sex) &&
          !(referral.genderPlacements ?? []).some((record) => record.unitIds.includes(unit.id))
        ) {
          if (event.role !== "coordinator") {
            return reject(state, event, GENDER_PLACEMENT_REFUSAL);
          }
          if (event.genderPlacementReason === undefined || event.genderPlacementChecked !== true) {
            return reject(state, event, GENDER_PLACEMENT_REFUSAL);
          }
          if (!GENDER_PLACEMENT_REASONS.includes(event.genderPlacementReason)) {
            return reject(
              state,
              event,
              `ACCEPT_REFERRAL genderPlacementReason must be chosen from GENDER_PLACEMENT_REASONS`,
            );
          }
          genderPlacementAddition = {
            at: event.now,
            by: event.role,
            unitIds: [unit.id],
            reason: event.genderPlacementReason,
            // Same discipline as `REFER_TO_UNITS`'s own write above: the tick is validated `true`
            // two lines up, and `wardChecked` stores it on the record rather than the reason text.
            wardChecked: true,
          };
        }
        // The rejection names the failing gate, reusing `referralEligibility`'s per-gate detail so
        // it reads the same as the match view.
        //
        // Owner reversal, item 2: the `gender_designation` gate must see this event's pending
        // gender-placement write, so both can be cleared in one acceptance. Only this local
        // eligibility read is widened; `referral` is committed unchanged.
        const referralForEligibility: Referral =
          genderPlacementAddition === undefined
            ? referral
            : { ...referral, genderPlacements: [...(referral.genderPlacements ?? []), genderPlacementAddition] };
        if (event.bedNumber !== undefined) {
          const bedRefusal =
            bedNumberRefusal(state, unit, event.bedNumber, undefined) ??
            heldBedRefusal(state, unit, event.bedNumber, undefined, referral.id);
          if (bedRefusal) return reject(state, event, bedRefusal);
        }
        const acceptRefusal = referralAcceptanceRefusal(
          event,
          referralForEligibility,
          addressing.destination,
          unit,
          event.now,
        );
        if (acceptRefusal.refusal) return reject(state, event, acceptRefusal.refusal);
        decision.overrideFactRecorded = acceptRefusal.overrideApplied;
        accepted = {
          ...addressing,
          state: "accepted",
          acceptedUnitId: unit.id,
          decidedAt: event.now,
          decidedBy: WARD_FLOW_ROLE_LABELS[event.role],
          declineReason: undefined,
          // Written unconditionally, so `...addressing` cannot carry an old reason onto a clean
          // acceptance.
          acceptOverrideReason: acceptRefusal.overrideApplied ? event.overrideReason : undefined,
          ...(event.bedNumber === undefined ? {} : { heldBedNumber: event.bedNumber }),
          ...(nextAddressingReassessmentHistory === undefined
            ? {}
            : { reassessmentHistory: nextAddressingReassessmentHistory }),
          ...(reassessmentEntry?.note !== undefined
            ? { reassessmentNote: reassessmentEntry.note }
            : addressing.reassessmentNote !== undefined
              ? { reassessmentNote: addressing.reassessmentNote }
              : {}),
        };
      } else {
        // An ED, medical ward or community team has no bed and no unit, so a `unitId` here is a
        // caller's mistake.
        if (event.unitId) {
          return reject(
            state,
            event,
            `${event.destinationKind.replace(/_/g, " ")} is answered by a team, not a bed — it cannot name a unit`,
          );
        }
        if (event.bedNumber !== undefined) {
          return reject(state, event, "Only a psychiatric ward answer can place a referral in a bed");
        }
        accepted = {
          ...addressing,
          state: "accepted",
          decidedAt: event.now,
          decidedBy: WARD_FLOW_ROLE_LABELS[event.role],
          ...(nextAddressingReassessmentHistory === undefined
            ? {}
            : { reassessmentHistory: nextAddressingReassessmentHistory }),
          ...(reassessmentEntry?.note !== undefined
            ? { reassessmentNote: reassessmentEntry.note }
            : addressing.reassessmentNote !== undefined
              ? { reassessmentNote: addressing.reassessmentNote }
              : {}),
        };
      }

      // FD-22: the first acceptance automatically cancels every destination still waiting. A
      // declined destination keeps its refusal, time and reason (FD-24).
      //
      // Before changing what this cancels: making a leaving acceptance cancel nothing (owner
      // question 7) interacts with `coordinatorWorklistReferrals` and Branch 2's lone-accepted-arm
      // reading; together they can hide a patient still awaiting a psychiatric decision. It would
      // also turn red the `"cancelled"` positive control in
      // `tests/ward-referral-visibility.test.ts`'s `multiDestinationReferral()`. Do not weaken that
      // privacy sweep's markers; split the fixture in that test file instead. No test yet drives a
      // community acceptance; write it with that change.
      const destinations = referral.destinations.map((candidate) => {
        if (candidate === addressing) return accepted;
        if (candidate.state !== "queued") return candidate;
        /**
         * RB5 (item 16): a community acceptance cancels nothing. It decides nothing about the bed,
         * so FD-22 does not apply to it.
         */
        if (accepted.destination.kind === "community_team") return candidate;
        /**
         * A community team is never cancelled by somebody else's acceptance (owner ruling:
         * "Community referral means a patient is about to be discharged"). It does not compete with
         * a bed, so cancelling it would cancel discharge planning when admission is confirmed.
         */
        if (candidate.destination.kind === "community_team") return candidate;
        return { ...candidate, state: "cancelled" as const, decidedAt: event.now };
      });
      const existingReferralHistory = referral.reassessmentHistory;
      const nextReferralHistory: ReadonlyArray<ClinicalReassessmentEntry> | undefined =
        reassessmentEntry === undefined
          ? existingReferralHistory
          : [
              ...(existingReferralHistory ??
                (referral.reassessmentNote
                  ? [
                      {
                        at: referral.raisedAt,
                        by: event.role,
                        note: referral.reassessmentNote,
                      },
                    ]
                  : [])),
              reassessmentEntry,
            ];
      // Spec D14: acceptance creates no `Movement`. That seam is deliberate;
      // `tests/ward-referral-reducer.test.ts` asserts it.
      const next = replaceReferral(state, referral.id, {
        ...referral,
        destinations,
        // T12: appended only when this acceptance supplied a fresh clearance.
        genderPlacements:
          genderPlacementAddition === undefined
            ? referral.genderPlacements
            : [...(referral.genderPlacements ?? []), genderPlacementAddition],
        ...(nextReferralHistory === undefined ? {} : { reassessmentHistory: nextReferralHistory }),
        ...(reassessmentEntry?.note !== undefined ? { reassessmentNote: reassessmentEntry.note } : {}),
      });
      /**
       * Addendum §1.3: "ACCEPT_REFERRAL — the referrer and the receiving ward — both sides of a
       * commitment." Two optional notices, each with its own `NoticeKind`: the referrer only when
       * `referralReferrer` resolves one safely, and the receiving ward only for a psychiatric-ward
       * acceptance. The referrer's sentence names the actual unit whenever one is known.
       */
      const referralNotices: Notice[] = [];
      const referrer = referralReferrer(referral);
      if (referrer !== undefined) {
        const acceptedBy =
          addressing.destination.kind === "psychiatric_ward" && event.unitId !== undefined
            ? unitName(state, event.unitId)
            : event.destinationKind.replace(/_/g, " ");
        referralNotices.push(
          makeNotice(
            event.now,
            state.notices.length,
            "referral_accepted_referrer",
            referrer,
            { referralId: referral.id },
            `${acceptedBy} accepted referral ${referral.id}.`,
          ),
        );
      }
      if (addressing.destination.kind === "psychiatric_ward" && event.unitId !== undefined) {
        referralNotices.push(
          makeNotice(
            event.now,
            state.notices.length,
            "referral_accepted_ward",
            { role: "ward", placeId: event.unitId },
            { referralId: referral.id, unitId: event.unitId },
            `${unitName(state, event.unitId)} accepted referral ${referral.id}. No bed is pulled and no movement is created.`,
          ),
        );
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return appendNotices(next, referralNotices);
    }

    case "DECLINE_REFERRAL": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      /**
       * The role must match the destination it is answering; see the identical map on
       * `ACCEPT_REFERRAL` above.
       */
      const answerableBy: Record<WardFlowRole, ReferralDestinationKind | "any"> = {
        ward: "psychiatric_ward",
        ed: "emergency_department",
        coordinator: "any",
        officer: "any",
        demo: "any",
        /** `community_team`, not `"any"` (owner ruling): see `ACCEPT_REFERRAL` above. */
        community: "community_team",
        bed_manager: "any",
        executive: "any",
      };
      const ownKind = answerableBy[event.role];
      if (ownKind !== "any" && ownKind !== event.destinationKind) {
        return reject(
          state,
          event,
          `${event.type} was raised by role ${event.role}, which may only answer ${ownKind.replace(/_/g, " ")} destinations, not ${event.destinationKind.replace(/_/g, " ")}`,
        );
      }
      const eligibleAddressings = referral.destinations.filter(
        (candidate) => candidate.destination.kind === event.destinationKind,
      );
      const addressing = eligibleAddressings.find(
        (candidate) =>
          candidate.destination.kind !== "psychiatric_ward" ||
          candidate.destination.unitId === undefined ||
          candidate.destination.unitId === event.unitId,
      );
      if (
        event.destinationKind === "psychiatric_ward" &&
        eligibleAddressings.length > 1 &&
        event.unitId === undefined
      ) {
        return reject(state, event, "Name the ward that is answering this referral.");
      }
      if (!addressing) {
        return reject(
          state,
          event,
          `referral ${referral.id} was not addressed to ${event.destinationKind.replace(/_/g, " ")}`,
        );
      }
      const actingRefusal = wardActingUnitRefusal(event, addressing);
      if (actingRefusal) return reject(state, event, actingRefusal);
      // RB5 (item 16): the same community exemption as `ACCEPT_REFERRAL`'s own guard, above -- a
      // community team may still decline its own arm after a ward or ED has accepted.
      if (event.destinationKind !== "community_team" && referralState(referral) === "accepted") {
        return reject(state, event, `referral ${referral.id} has already been accepted elsewhere`);
      }
      if (addressing.state !== "queued") {
        return reject(
          state,
          event,
          `${event.destinationKind.replace(/_/g, " ")} has already answered referral ${referral.id} (${addressing.state})`,
        );
      }
      // Same gap as ACCEPT_REFERRAL's own withdrawal guard above, and the same reasoning: O-17.11's
      // `withdrawnAt` is a separate fact from `state` and the guard above cannot see it.
      if (addressing.withdrawnAt !== undefined) {
        return reject(
          state,
          event,
          `referral ${referral.id} was withdrawn by its referrer, so ${event.destinationKind.replace(/_/g, " ")} cannot decline it`,
        );
      }
      // Membership, not truthiness: "chosen from a fixed list, never typed" is a runtime rule.
      //
      // Scoped to the answering destination kind (O-16.6): a community decline and a ward decline
      // have no overlap in meaning, so each kind is checked only against its own list.
      // `psychiatric_ward` keeps `REFERRAL_DECLINE_REASONS`.
      const declineReasonsFor: Record<
        ReferralDestinationKind,
        readonly (ReferralDeclineReason | CommunityDeclineReason)[]
      > = {
        psychiatric_ward: REFERRAL_DECLINE_REASONS,
        emergency_department: ED_DECLINE_REASONS,
        community_team: COMMUNITY_DECLINE_REASONS,
      };
      const declineReasonListName: Record<ReferralDestinationKind, string> = {
        psychiatric_ward: "REFERRAL_DECLINE_REASONS",
        emergency_department: "ED_DECLINE_REASONS",
        community_team: "COMMUNITY_DECLINE_REASONS",
      };
      if (!declineReasonsFor[event.destinationKind].includes(event.reason)) {
        return reject(
          state,
          event,
          `DECLINE_REFERRAL reason must be chosen from ${declineReasonListName[event.destinationKind]}, the vocabulary for ${event.destinationKind.replace(/_/g, " ")} destinations`,
        );
      }
      // One field, two vocabularies: `ReferralAddressing` is not discriminated on
      // `destination.kind`, so the check above is what holds the vocabularies apart at runtime.
      if (event.waitlist === true) {
        if (
          addressing.destination.kind !== "psychiatric_ward" ||
          !addressing.destination.unitId ||
          event.reason !== "no_suitable_bed"
        )
          return reject(state, event, "Only a named ward can waitlist a referral for no suitable bed.");
        return replaceReferral(state, referral.id, {
          ...referral,
          destinations: referral.destinations.map((candidate) =>
            candidate === addressing ? { ...candidate, waitlistedAt: event.now } : candidate,
          ),
        });
      }
      // FD-24: this destination declines and nothing else changes. The others stay queued, and the
      // refusal stays on record with its time and reason.
      const destinations = referral.destinations.map((candidate) =>
        candidate === addressing
          ? {
              ...candidate,
              state: "declined" as const,
              declineReason: event.reason,
              decidedAt: event.now,
              decidedBy: WARD_FLOW_ROLE_LABELS[event.role],
            }
          : candidate,
      );
      const next = replaceReferral(state, referral.id, { ...referral, destinations });
      // Addendum §1.3 and FD-23: the decline reason reaches that referral's referrer and no other
      // team; no notice is safer than a wrongly-addressed one. Shares `NoticeKind`
      // "referral_declined" with `DECLINE`.
      const referrer = referralReferrer(referral);
      if (referrer === undefined) return next;
      // The reason reads through the curated label maps (`DECLINE_REASON_LABELS`, and the community
      // one per O-16.6), never a de-underscored code: "Another reason — needs follow-up" carries
      // meaning the referrer must act on. The `Record<string, string>` widening matches
      // `referral-board.tsx` and `ward-referrals.ts`.
      const declineLabel =
        (DECLINE_REASON_LABELS as Record<string, string>)[event.reason] ??
        (COMMUNITY_DECLINE_REASON_LABELS as Record<string, string>)[event.reason] ??
        event.reason;
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "referral_declined",
          referrer,
          { referralId: referral.id },
          `${event.destinationKind.replace(/_/g, " ")} declined referral ${referral.id} (${declineLabel}).`,
        ),
      ]);
    }

    /**
     * RB7 (item 27): appends an attributed, timestamped note to `referral.corrections` and never
     * assigns `history:` (`tests/ward-referral-history-immutable.test.ts` checks this). No
     * referral-state precondition: a correction is a note on top of whatever has happened.
     */
    case "ADD_REFERRAL_CORRECTION": {
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
      if (event.role === "ed" && event.actingPlaceId !== undefined) {
        const originEdId = referralReferrer(referral)?.placeId;
        if (originEdId === undefined || event.actingPlaceId !== originEdId) {
          return reject(
            state,
            event,
            `caller ED ${event.actingPlaceId} is not the referral origin ED (${originEdId ?? referral.originSiteCode ?? "unknown"}); only origin ED or coordinator may add corrections`,
          );
        }
      }
      if (event.role === "community" && event.actingPlaceId !== undefined) {
        if (
          referral.sendingTeamName !== undefined &&
          event.actingPlaceId !== referral.sendingTeamName &&
          event.actingPlaceId !== communityTeamSlug(referral.sendingTeamName)
        ) {
          return reject(
            state,
            event,
            `caller community team ${event.actingPlaceId} is not the referral origin team (${referral.sendingTeamName}); only origin team or coordinator may add corrections`,
          );
        }
      }
      // Trimmed for the blank check, the same discipline `RECORD_MOVEMENT_BLOCKER` already holds a
      // typed, must-say-something field to — a whitespace-only note is not a correction.
      const note = event.note.trim();
      if (note.length === 0) {
        return reject(state, event, `ADD_REFERRAL_CORRECTION note must say something — a blank is not a correction`);
      }
      // ⚠️ Refused, never shortened — the same rule `history` and `sendingTeamName` are held to on
      // `RECEIVE_REFERRAL` above: a truncated correction silently drops whatever was typed last.
      if (note.length > REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS) {
        return reject(
          state,
          event,
          `ADD_REFERRAL_CORRECTION note is ${note.length} characters and the limit is ${REFERRAL_CORRECTION_NOTE_MAX_CHARACTERS} — it is refused rather than shortened`,
        );
      }
      const correction: ReferralCorrection = { at: event.now, by: event.role, note };
      const corrected: Referral = {
        ...referral,
        corrections: [...(referral.corrections ?? []), correction],
      };
      return replaceReferral(state, referral.id, corrected);
    }

    case "CHANGE_URGENCY": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot change urgency for a closed movement (${movement.closure.reason})`);
      }
      if (!URGENCY_LEVELS.includes(event.urgency as (typeof URGENCY_LEVELS)[number])) {
        return reject(state, event, `CHANGE_URGENCY urgency must be chosen from URGENCY_LEVELS`);
      }
      if (!URGENCY_CHANGE_REASONS.includes(event.reason)) {
        /**
         * Runtime membership, not merely the type: a type-only guarantee passes `vitest run` with
         * no `tsc` involved. `changeReasonLabels` has no fallback, so an off-list value would
         * render "undefined".
         */
        return reject(state, event, `CHANGE_URGENCY reason must be chosen from URGENCY_CHANGE_REASONS`);
      }
      // Nothing auto-allocates: this records who changed the tier, when and why, and never
      // re-sorts, re-suggests or re-refers (Global Constraint 3, spec D2).
      const updated: Movement = {
        ...movement,
        urgency: event.urgency,
        urgencyChanges: [
          ...movement.urgencyChanges,
          { at: event.now, from: movement.urgency, to: event.urgency, by: event.role, reason: event.reason },
        ],
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "CHANGE_LEGAL_STATUS": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot change legal status for a closed movement (${movement.closure.reason})`);
      }
      if (!LEGAL_STATUS_CHANGE_REASONS.includes(event.reason)) {
        /**
         * Runtime membership, not merely the type: a type-only guarantee passes `vitest run` with
         * no `tsc` involved. This records why a Mental Health Act status changed, so an off-list
         * reason must never reach the legal-and-forms panel.
         */
        return reject(state, event, `CHANGE_LEGAL_STATUS reason must be chosen from LEGAL_STATUS_CHANGE_REASONS`);
      }
      // A legal status change can make an accepted destination unlawful;
      // `destinationNoLongerLawful` surfaces that for a human. This handler only records the
      // change.
      const updated: Movement = {
        ...movement,
        legalStatus: event.legalStatus,
        statusChanges: [
          ...movement.statusChanges,
          { at: event.now, from: movement.legalStatus, to: event.legalStatus, by: event.role, reason: event.reason },
        ],
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceMovement(state, movement.id, updated);
    }

    case "RELEASE_PULL": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot release a pull for a closed movement (${movement.closure.reason})`);
      }
      // WFA-004: physical collection is not erased by a stage correction. Releasing the bed after
      // collection is `STOP_TRANSPORT`, never `RELEASE_PULL`.
      if (movement.transport?.collectedAt !== undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id}'s patient has already been collected; use STOP_TRANSPORT to stop the journey instead of releasing the pull`,
        );
      }
      // A booked (uncollected) transport job must not be silently deleted by releasing the pull —
      // cancel it explicitly first so the officer and receiving ward are told, never left believing.
      if (movement.transport !== undefined && movement.transport.cancelledAt === undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id} has a transport job booked; cancel it (CANCEL_TRANSPORT) before releasing the pull`,
        );
      }
      if (movement.stage !== "pulled") {
        return reject(
          state,
          event,
          `cannot release a pull at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      // Claim-not-proof, as CONFIRM_CAPACITY: the caller's stated unit against the unit holding the
      // bed. A coordinator may act for any unit.
      if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `RELEASE_PULL was raised acting as unit ${event.actingUnitId} but movement ${movement.id}'s bed is pulled at ${movement.acceptedUnitId}`,
        );
      }
      if (!RELEASE_PULL_REASONS.includes(event.reason)) {
        /**
         * Runtime membership, not merely the type: a type-only guarantee passes `vitest run` with
         * no `tsc` involved. An off-list reason would reach `stageChanges` and `unwinds` and render
         * as no reason at all. Checked before the unit lookups below.
         */
        return reject(state, event, `RELEASE_PULL reason must be chosen from RELEASE_PULL_REASONS`);
      }
      if (!movement.acceptedUnitId) {
        return reject(state, event, `movement ${movement.id} has no accepted unit holding a bed`);
      }
      const unit = findUnit(state, movement.acceptedUnitId);
      if (!unit) return reject(state, event, `no unit found for id ${movement.acceptedUnitId}`);

      // The exact inverse of PULL_PATIENT's writes (ruling P4-1): `allocatable` is given back, and
      // the admission the pull created is deleted, so no phantom occupant remains. `Unit.held` is
      // seed-only; the live held count is derived.
      //
      // Deleted, not ended, unlike `RECORD_LEAVING`: a released pull is a retracted assertion, so
      // no discharge is recorded. `admissionSequence` is not rewound, so no id is reused. Both
      // halves live in `releasePulledBedAndAdmission`, shared with `WITHDRAW_REFERRAL` and
      // `STOP_TRANSPORT` (WLQ-38).
      const withoutPhantom = releasePulledBedAndAdmission(state, movement, event.now);
      // Never closes the movement, never clears `legalForm`, never touches `referredUnitIds` —
      // the patient survives and keeps their acceptance; only the pull itself unwinds.
      const updatedMovement: Movement = {
        ...movement,
        stage: "accepted_awaiting_bed",
        // Restate the blocker as at first acceptance: once the bed is given back, a
        // transport-provider sentence is false. A standing job is flagged by `orphanedTransport`,
        // not here.
        blocker: STAGE_TRANSITION_BLOCKERS.accepted,
        pullExpiresAt: undefined,
        allocatedBed: undefined,
        // The admission the pull created was deleted by the shared helper, so the join goes too.
        admissionId: undefined,
        transport: undefined,
        unwinds: [...movement.unwinds, { at: event.now, kind: "pull_released", by: event.role, reason: event.reason }],
        // Appends a second `to: accepted_awaiting_bed` entry and must never touch `acceptedAt`: a
        // release is not a re-acceptance. See `StageChange`.
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: "accepted_awaiting_bed", by: event.role, reason: event.reason },
        ],
      };
      const next = replaceMovement(withoutPhantom, movement.id, updatedMovement);
      // Addendum §1.3: "a referrer not told goes on believing a bed is coming."
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "bed_pull_released",
          { role: "ed", placeId: movement.originEdId },
          { movementId: movement.id, unitId: unit.id },
          `${unit.name} released the bed it had pulled for ${movement.id} (${event.reason.replace(/_/g, " ")}).`,
        ),
      ]);
    }

    case "BOOK_TRANSPORT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot book transport for a closed movement (${movement.closure.reason})`);
      }
      // Owner answer 30: "no automatic rebooking; a person books again", including from
      // `handover_ready`, since `CANCEL_TRANSPORT` now removes the job in every case.
      if (movement.stage !== "pulled" && movement.stage !== "handover_ready") {
        return reject(
          state,
          event,
          `cannot book transport at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      // A second booking would replace a job a provider may already have accepted, and the
      // acceptance timestamps would vanish with it. Cancel first (`CANCEL_TRANSPORT`), then rebook.
      if (movement.transport && movement.transport.cancelledAt === undefined) {
        return reject(state, event, `transport for movement ${movement.id} is already booked`);
      }
      if (!TRANSPORT_PROVIDERS.includes(event.provider)) {
        return reject(state, event, `BOOK_TRANSPORT provider must be chosen from TRANSPORT_PROVIDERS`);
      }
      // A missing escort answer is refused, never defaulted: `false` would claim "no escort
      // required" as though a clinician said so (TR-D1). `typeof`, because the payload may arrive
      // from JavaScript.
      if (typeof event.escortRequired !== "boolean") {
        return reject(state, event, `BOOK_TRANSPORT escortRequired must be answered, and it has no default`);
      }
      // Owner's third ruling: this logs a booking already made by phone, and the three facts from
      // that call are required, never defaulted.
      if (typeof event.cadNumber !== "string" || event.cadNumber.trim().length === 0) {
        return reject(state, event, `BOOK_TRANSPORT cadNumber must be answered, and it has no default`);
      }
      if (!TRANSPORT_LEGAL_STATUSES.includes(event.transportLegalStatus)) {
        return reject(state, event, `BOOK_TRANSPORT transportLegalStatus must be chosen from TRANSPORT_LEGAL_STATUSES`);
      }
      if (typeof event.estimatedAt !== "number" || !Number.isFinite(event.estimatedAt)) {
        return reject(state, event, `BOOK_TRANSPORT estimatedAt must be answered, and it has no default`);
      }
      // WLQ-11 (owner): a `ward` booker must state its unit now, so `CANCEL_TRANSPORT` can later
      // tell the booking ward from any other.
      if (event.role === "ward" && !event.actingUnitId) {
        return reject(state, event, `BOOK_TRANSPORT raised as ward must state its actingUnitId, and it has no default`);
      }
      // The claimed unit must be real, or `bookedBy.unitId` could never match a later cancellation
      // claim.
      if (event.role === "ward" && event.actingUnitId !== undefined && !findUnit(state, event.actingUnitId)) {
        return reject(state, event, `BOOK_TRANSPORT actingUnitId ${event.actingUnitId} does not name a real unit`);
      }
      if (event.role === "ward" && event.actingUnitId !== undefined) {
        const referral = movement.referralId ? findReferral(state, movement.referralId) : undefined;
        const sendingWard =
          referral?.originUnitId ??
          movementSourceAdmission(state, movement)?.unitId ??
          (movement as { originUnitId?: string }).originUnitId;
        if (sendingWard) {
          if (event.actingUnitId !== sendingWard) {
            return reject(
              state,
              event,
              `BOOK_TRANSPORT was raised acting as unit ${event.actingUnitId} but movement origin is ward ${sendingWard}; only the sending ward can book transport`,
            );
          }
        } else if (movement.acceptedUnitId && event.actingUnitId === movement.acceptedUnitId) {
          return reject(
            state,
            event,
            `BOOK_TRANSPORT was raised acting as destination ward ${event.actingUnitId}; receiving ward cannot book transport`,
          );
        }
      }
      // Owner's third ruling (answer 9): "only the community team that booked transport may cancel
      // it", so a `community` booker states its place now.
      if (event.role === "community" && !event.actingPlaceId) {
        return reject(
          state,
          event,
          `BOOK_TRANSPORT raised as community must state its actingPlaceId, and it has no default`,
        );
      }
      if (event.role === "community" && event.actingPlaceId !== undefined && !communityTeamById(event.actingPlaceId)) {
        return reject(
          state,
          event,
          `BOOK_TRANSPORT actingPlaceId ${event.actingPlaceId} does not name a real community team`,
        );
      }
      if (!movement.acceptedUnitId && !movement.admissionId) {
        return reject(
          state,
          event,
          `cannot book transport for movement ${movement.id} without an accepted destination ward or admission`,
        );
      }
      if (
        event.role === "ed" &&
        event.actingPlaceId &&
        movement.originEdId &&
        event.actingPlaceId !== movement.originEdId
      ) {
        return reject(
          state,
          event,
          `BOOK_TRANSPORT raised as ED acting as ${event.actingPlaceId} may only book transport for movements originating from its own ED (${movement.originEdId})`,
        );
      }
      // The job id counts prior cancellations from `unwinds` (append-only), so a re-booking after a
      // no-bed-held cancellation never reuses an earlier job's id. Deterministic; with no prior
      // cancellation the id stays `${movement.id}-transport`.
      const priorTransportCancellations = movement.unwinds.filter(
        (entry) => entry.kind === "transport_cancelled",
      ).length;
      // Audit fix (13 Oct 2026): a booking whose status differs from Legal now records why.
      const bookingException =
        event.exception === undefined
          ? undefined
          : transportExceptionRecord(event.exception, event.now, event.role, "booked");
      if (typeof bookingException === "string") return reject(state, event, `BOOK_TRANSPORT ${bookingException}`);
      const booked: Movement = {
        ...movement,
        transport: {
          id:
            priorTransportCancellations === 0
              ? `${movement.id}-transport`
              : `${movement.id}-transport-${priorTransportCancellations + 1}`,
          provider: event.provider,
          escortRequired: event.escortRequired,
          // Owner's third ruling, 2026-09-17: the phone-logged facts, required and stored exactly
          // as answered — see each field's own doc comment on `TransportJob` (`ward-model.ts`).
          cadNumber: event.cadNumber,
          transportLegalStatus: event.transportLegalStatus,
          estimatedAt: event.estimatedAt,
          ...(bookingException ? { exceptions: [bookingException] } : {}),
          // Carried forward from RECORD_TRANSPORT_NEED so the "no transport needed" branches read a
          // runtime-booked job as they read a seeded one.
          needed: movement.transportNeed?.needed,
          // WLQ-11 / third ruling: who booked this job. See `TransportJob.bookedBy`.
          bookedBy: {
            role: event.role,
            ...(event.role === "ward" ? { unitId: event.actingUnitId } : {}),
            ...(event.role === "community" ? { placeId: event.actingPlaceId } : {}),
            ...(event.role === "ed" && event.actingPlaceId ? { placeId: event.actingPlaceId } : {}),
          },
        },
        // A job exists and the provider has not answered. Provider and escort are on the job
        // itself, so they are not restated here.
        blocker: STAGE_TRANSITION_BLOCKERS.transportBooked,
      };
      return replaceMovement(state, movement.id, booked);
    }

    case "CANCEL_TRANSPORT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot cancel transport for a closed movement (${movement.closure.reason})`);
      }
      if (!movement.transport) {
        return reject(state, event, `movement ${movement.id} has no transport job to cancel`);
      }
      if (movement.transport.cancelledAt !== undefined) {
        return reject(state, event, `transport for movement ${movement.id} was already cancelled`);
      }
      if (movement.transport.arrivedAt !== undefined) {
        return reject(state, event, `cannot cancel transport for movement ${movement.id} — the patient has arrived`);
      }
      if (movement.transport.collectedAt !== undefined) {
        return reject(state, event, `cannot cancel transport for movement ${movement.id} — the patient has departed`);
      }
      /**
       * TR-D6 (owner): a transport may be cancelled by the team that booked it and by the
       * coordinator, never by the receiving ward. WLQ-11 (owner): "whoever booked transport may
       * cancel it; the receiving ward still may not." A `ward` caller's claim is compared against
       * `transport.bookedBy` (claim-not-proof); an absent `bookedBy` refuses. Coordinator and `ed`
       * rights are unconditional. `community` gets the same check against `bookedBy.placeId` just
       * below.
       */
      if (event.role === "ward") {
        if (
          movement.transport.bookedBy?.role !== "ward" ||
          !event.actingUnitId ||
          movement.transport.bookedBy.unitId !== event.actingUnitId
        ) {
          return reject(
            state,
            event,
            `CANCEL_TRANSPORT raised as ward acting as ${event.actingUnitId} may only cancel transport it booked for movement ${movement.id}`,
          );
        }
      }
      // Owner's third ruling (answer 9): "only the community team that booked transport may cancel
      // it." Refused when the claim does not match, including when `bookedBy` has no `placeId`.
      if (event.role === "community") {
        if (
          movement.transport.bookedBy?.role !== "community" ||
          !event.actingPlaceId ||
          movement.transport.bookedBy.placeId !== event.actingPlaceId
        ) {
          return reject(
            state,
            event,
            `CANCEL_TRANSPORT raised as community acting as ${event.actingPlaceId} may only cancel transport it booked for movement ${movement.id}`,
          );
        }
      }
      if (event.role === "ed" && event.actingPlaceId) {
        if (movement.transport.bookedBy?.placeId && movement.transport.bookedBy.placeId !== event.actingPlaceId) {
          return reject(
            state,
            event,
            `CANCEL_TRANSPORT raised as ED acting as ${event.actingPlaceId} may only cancel transport it booked for movement ${movement.id}`,
          );
        }
      }
      if (!CANCEL_TRANSPORT_REASONS.includes(event.reason)) {
        /**
         * Runtime membership, not merely the type: a type-only guarantee passes `vitest run` with
         * no `tsc` involved. TR-D6 says the reason must not become optional.
         */
        return reject(state, event, `CANCEL_TRANSPORT reason must be chosen from CANCEL_TRANSPORT_REASONS`);
      }
      // Never closes the movement: only the transport job unwinds, and the bed is untouched. The
      // cancelled job stays named in the audit trail.
      //
      // The stage is left exactly as found in every reachable case: unwinding a job never changes
      // where the patient sits in the pathway (`STEP_BACK_STAGE` and `RELEASE_PULL` can leave a
      // booked job at `accepted_awaiting_bed`; see `tests/ward-cancel-transport-stage.test.ts`).
      //
      // Owner answer 30: "Cancelling transport while a bed is held: no automatic rebooking; a
      // person books again." Both branches remove the job
      // (`tests/ward-transport-cancel-no-rebook.test.ts`,
      // `tests/ward-cancel-transport-no-bed-held.test.ts`); `BOOK_TRANSPORT` accepts a new booking
      // from `pulled` or `handover_ready`.
      const cancelledTransport = movement.transport;
      // WFA-001: same OR as `releasePulledBedAndAdmission`: a stepped-back movement can hold its
      // admission and bed before `pulled`.
      const bedIsHeld =
        movement.admissionId !== undefined ||
        MOVEMENT_STAGES.indexOf(movement.stage) >= MOVEMENT_STAGES.indexOf("pulled");
      const updatedMovement: Movement = {
        ...movement,
        // `stage` is deliberately not written: cancelling never moves the stage. No branch replaces
        // the job: an absent job is "nothing to flag" for `orphanedTransport` and lets
        // `BOOK_TRANSPORT` succeed again.
        transport: undefined,
        // The job is gone, so a provider-progress sentence is now false. Bed held:
        // `transportCancelled` (still held, not booked again). No bed: as at first acceptance.
        blocker: bedIsHeld ? STAGE_TRANSITION_BLOCKERS.transportCancelled : STAGE_TRANSITION_BLOCKERS.accepted,
        unwinds: [
          ...movement.unwinds,
          {
            at: event.now,
            kind: "transport_cancelled",
            by: event.role,
            reason: event.reason,
            transportId: cancelledTransport.id,
            cadNumber: cancelledTransport.cadNumber,
          },
        ],
        // No entry appended: `stage` never moves here, so a transition would misstate this
        // cancellation.
        stageChanges: movement.stageChanges,
      };
      const next = replaceMovement(state, movement.id, updatedMovement);
      /**
       * Addendum §1.3: "CANCEL_TRANSPORT — the officer and the receiving ward — somebody is
       * expecting a person who is no longer coming." Two notices, each its own `NoticeKind`. The
       * officer is always told; the receiving ward is `movement.acceptedUnitId`, guarded rather
       * than asserted.
       *
       * Owner answer 30: nothing arranges a replacement on either branch, so each sentence states
       * only that the job was cancelled and nothing has been rebooked. Wording from
       * `docs/ward-flow/plans/2026-09-17-build-plan-referrals-transport.md` §4, T1.
       */
      const cancelledNote = bedIsHeld
        ? "the bed is still held and nothing has been rebooked."
        : "no bed is held and nothing has been rebooked.";
      const transportNotices: Notice[] = [
        makeNotice(
          event.now,
          state.notices.length,
          "transport_cancelled_officer",
          { role: "officer" },
          { movementId: movement.id },
          `Transport for ${movement.id} was cancelled (${event.reason.replace(/_/g, " ")}); ${cancelledNote}`,
        ),
      ];
      if (movement.acceptedUnitId !== undefined) {
        const receivingUnitId = movement.acceptedUnitId;
        transportNotices.push(
          makeNotice(
            event.now,
            state.notices.length,
            "transport_cancelled_ward",
            { role: "ward", placeId: receivingUnitId },
            { movementId: movement.id, unitId: receivingUnitId },
            `The transport bringing your patient for ${movement.id} was cancelled (${event.reason.replace(/_/g, " ")}); ${cancelledNote}`,
          ),
        );
      }
      return appendNotices(next, transportNotices);
    }

    /**
     * The referrer or coordinator stops a collected journey (WLQ-38; see `ward-flow-events.ts`).
     * `EVENT_ROLE.STOP_TRANSPORT` already restricts the caller, so the role is not re-checked.
     */
    case "STOP_TRANSPORT": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot stop transport for a closed movement (${movement.closure.reason})`);
      }
      if (!movement.transport) {
        return reject(state, event, `movement ${movement.id} has no transport job to stop`);
      }
      if (movement.transport.collectedAt === undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id}'s transport has not been collected yet; use CANCEL_TRANSPORT instead`,
        );
      }
      // Belt and braces: `PATIENT_ARRIVED` sets `arrivedAt` and `closure` together, so this fires
      // only if that invariant breaks.
      if (movement.transport.arrivedAt !== undefined) {
        return reject(state, event, `movement ${movement.id}'s patient has already arrived`);
      }
      if (movement.transport.diversion) {
        return reject(
          state,
          event,
          `movement ${movement.id} was diverted; use RELEASE_DIVERTED_BED rather than STOP_TRANSPORT`,
        );
      }
      if (movement.transport.cancelledAt !== undefined) {
        return reject(state, event, `transport for movement ${movement.id} was already stopped or cancelled`);
      }
      if (!STOP_TRANSPORT_REASONS.includes(event.reason)) {
        // Runtime membership, not merely the type — the same discipline every other reason-carrying
        // event in this file holds to, because `vitest run` alone involves no `tsc`.
        return reject(state, event, `STOP_TRANSPORT reason must be chosen from STOP_TRANSPORT_REASONS`);
      }
      if (!TRANSPORT_WHEREABOUTS.includes(event.whereabouts)) {
        // Item 31 (T3): runtime membership, since `vitest run` alone involves no `tsc`.
        return reject(state, event, `STOP_TRANSPORT whereabouts must be chosen from TRANSPORT_WHEREABOUTS`);
      }

      // Owner answer 8: the bed no longer comes back automatically. `acceptedUnitId` and
      // `admissionId` stay as they are until `RELEASE_HELD_BED`.
      const stoppedTransport = movement.transport;
      const stopped: Movement = {
        ...movement,
        transport: {
          ...stoppedTransport,
          // `cancelledAt` is the general "this job is over" signal other readers understand; the
          // `stopped*` fields record who stopped it, why and where the patient is. See
          // `TransportJob`.
          cancelledAt: event.now,
          stoppedAt: event.now,
          stoppedBy: event.role,
          stopReason: event.reason,
          stoppedWhereabouts: event.whereabouts,
        },
        closure: {
          at: event.now,
          outcome: "did_not_proceed",
          // `STOP_TRANSPORT_REASONS` members are already full sentences, so the reason is the
          // closure reason.
          reason: event.reason,
        },
        // Active: the journey is over but the bed is held pending a release decision. Supersedes
        // WLQ-4's `examinationRevokedAwaitingRelease` for the same bed.
        blocker: STAGE_TRANSITION_BLOCKERS.transportStoppedAwaitingRelease,
      };
      const next = replaceMovement(state, movement.id, stopped);
      // Addendum §1.3, extended by WLQ-38 and item 31: the officer is always told where the patient
      // now is, and the receiving ward, if any, that the patient is not coming.
      const stopNotices: Notice[] = [
        makeNotice(
          event.now,
          state.notices.length,
          "transport_stopped_officer",
          { role: "officer" },
          { movementId: movement.id },
          `Transport for ${movement.id} was stopped (${event.reason}). Where the patient is now: ${event.whereabouts}.`,
        ),
      ];
      if (movement.acceptedUnitId !== undefined) {
        const receivingUnitId = movement.acceptedUnitId;
        stopNotices.push(
          makeNotice(
            event.now,
            state.notices.length,
            "transport_stopped_ward",
            { role: "ward", placeId: receivingUnitId },
            { movementId: movement.id, unitId: receivingUnitId },
            `The transport bringing your patient for ${movement.id} was stopped (${event.reason}); the patient is not coming.`,
          ),
        );
      }
      return appendNotices(next, stopNotices);
    }

    /**
     * Releases a bed `STOP_TRANSPORT` left held (owner answer 8). See `ward-flow-events.ts` for why
     * this is a new case rather than a loosened `RELEASE_PULL`.
     */
    case "RELEASE_HELD_BED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      const isStoppedTransport = movement.transport?.stoppedAt !== undefined;
      const examinationOutcome = movement.examination?.outcome;
      const isRevokedExamHold =
        (examinationOutcome === "community_order" || examinationOutcome === "revoked") &&
        (movement.admissionId !== undefined || (movement.closure === undefined && movementHoldsBedByStage(movement)));
      const awaitingRelease = movement.blocker === STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease;

      if (!isStoppedTransport && !isRevokedExamHold && !awaitingRelease) {
        return reject(
          state,
          event,
          `movement ${movement.id} was not stopped by STOP_TRANSPORT and has no examination-revoked hold, so there is no held bed to release this way`,
        );
      }
      // A stopped journey or revoked-exam hold holds a bed until explicitly released.
      const heldBedOutstanding =
        movement.admissionId !== undefined ||
        (movement.closure === undefined && movementHoldsBedByStage(movement)) ||
        movement.blocker === STAGE_TRANSITION_BLOCKERS.transportStoppedAwaitingRelease ||
        movement.blocker === STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease;
      if (!heldBedOutstanding) {
        return reject(state, event, `movement ${movement.id} holds no bed — it may already have been released`);
      }
      // Claim-not-proof, as RELEASE_PULL and CANCEL_TRANSPORT. A coordinator or ed caller may act
      // regardless.
      if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `RELEASE_HELD_BED was raised acting as unit ${event.actingUnitId} but movement ${movement.id}'s bed is held at ${movement.acceptedUnitId}`,
        );
      }
      const withoutHeldBed = releasePulledBedAndAdmission(state, movement, event.now);
      const released: Movement = {
        ...movement,
        admissionId: undefined,
        ...(isRevokedExamHold || awaitingRelease
          ? {
              acceptedUnitId: undefined,
              referredUnitIds: [],
              ...(movement.transport && movement.transport.cancelledAt === undefined
                ? {
                    transport: {
                      ...movement.transport,
                      cancelledAt: event.now,
                    },
                  }
                : {}),
            }
          : {}),
        // Nothing is blocking any more — the release this sentence describes is the one thing that
        // was outstanding.
        blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
        examRevoked: undefined,
        closure: movement.closure ?? {
          at: event.now,
          outcome: "did_not_proceed",
          reason: isRevokedExamHold || awaitingRelease ? "examination_revoked" : "bed_released",
        },
      };
      return replaceMovement(withoutHeldBed, movement.id, released);
    }

    /** Item 29 (T4a) / OA-29: release a bed left held by a diversion. */
    case "RELEASE_DIVERTED_BED": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.transport?.diversion === undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id} was not diverted, so there is no diverted bed to release this way`,
        );
      }
      // A diverted journey stays open until this release closes it, so the closure is the
      // released marker; a seeded journey with no `admissionId` still holds its bed by stage.
      if (movement.closure !== undefined || !movementHoldsBedByStage(movement)) {
        return reject(state, event, `movement ${movement.id} holds no bed — it may already have been released`);
      }
      if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `RELEASE_DIVERTED_BED was raised acting as unit ${event.actingUnitId} but movement ${movement.id}'s bed is held at ${movement.acceptedUnitId}`,
        );
      }
      const withoutHeldBed = releasePulledBedAndAdmission(state, movement, event.now);
      const diversionReason = movement.transport.diversion.reason;
      const released: Movement = {
        ...movement,
        admissionId: undefined,
        transport: {
          ...movement.transport,
          cancelledAt: event.now,
        },
        closure: {
          at: event.now,
          outcome: "did_not_proceed",
          reason: diversionReason,
        },
        blocker: STAGE_TRANSITION_BLOCKERS.didNotProceed,
      };
      const next = replaceMovement(withoutHeldBed, movement.id, released);
      if (event.role === "ward" || movement.acceptedUnitId === undefined) {
        return next;
      }
      const receivingUnitId = movement.acceptedUnitId;
      return appendNotices(next, [
        makeNotice(
          event.now,
          next.notices.length,
          "diversion_bed_released_ward",
          { role: "ward", placeId: receivingUnitId },
          { movementId: movement.id, unitId: receivingUnitId },
          `The bed held for diverted patient ${movement.id} was released.`,
        ),
      ]);
    }

    /**
     * The coordinator's own record correction (owner rulings E and F). See `STEP_BACK_STAGE` in
     * `ward-flow-events.ts`.
     */
    case "STEP_BACK_STAGE": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.stage === "arrived" || movement.transport?.arrivedAt !== undefined) {
        return reject(
          state,
          event,
          `cannot step back an arrived movement (invariant I-05: physical arrival is irreversible)`,
        );
      }
      if (movement.closure) {
        return reject(state, event, `cannot step back a closed movement (${movement.closure.reason})`);
      }
      if (!MOVEMENT_STAGES.includes(event.to)) {
        return reject(state, event, `STEP_BACK_STAGE target must be chosen from MOVEMENT_STAGES`);
      }
      const fromIndex = MOVEMENT_STAGES.indexOf(movement.stage);
      const toIndex = MOVEMENT_STAGES.indexOf(event.to);
      if (toIndex >= fromIndex) {
        return reject(
          state,
          event,
          `STEP_BACK_STAGE target must be strictly before the movement's current stage (movement ${movement.id} is at ${stageCopy[movement.stage].label}, target was ${stageCopy[event.to].label})`,
        );
      }
      if (!STEP_BACK_REASONS.includes(event.reason)) {
        /**
         * Runtime membership, not merely the type: a type-only requirement passes `vitest run` with
         * no `tsc` involved.
         */
        return reject(state, event, `STEP_BACK_STAGE reason must be chosen from STEP_BACK_REASONS`);
      }
      // Touch nothing else (F3, ruling E: "does not release the bed / does not cancel the
      // transport"). Never write `acceptedUnitId`, `acceptedAt`, `pullExpiresAt`, `admissionId`,
      // `transport` or any `Unit.allocatable` field. The only side effects are the two appends
      // below and `stage`.
      const updatedMovement: Movement = {
        ...movement,
        stage: event.to,
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: event.to, by: event.role, reason: event.reason },
        ],
        unwinds: [
          ...movement.unwinds,
          { at: event.now, kind: "stage_corrected", by: event.role, reason: event.reason },
        ],
      };
      return replaceMovement(state, movement.id, updatedMovement);
    }

    /**
     * The coordinator undoes a ward's "yes" (rulings E and F). See `WITHDRAW_ACCEPTANCE` in
     * `ward-flow-events.ts`.
     */
    case "WITHDRAW_ACCEPTANCE": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot withdraw an acceptance for a closed movement (${movement.closure.reason})`);
      }
      /**
       * The message states the condition the guard tests, never a cause: five stages can reach it,
       * and at the two earliest no bed exists. `arrived` cannot reach here, since arrival sets
       * `closure`. Do not restore the removed wording, even quoted.
       *
       * `stageCopy`'s label is not used: importing `ward-derivations.ts` would be circular (and
       * pull in `lucide-react`). `.replace(/_/g, " ")` is this file's idiom.
       */
      if (movement.stage !== "accepted_awaiting_bed") {
        return reject(
          state,
          event,
          `cannot withdraw an acceptance unless the movement is still awaiting a bed ` +
            `(movement ${movement.id} is at ${stageCopy[movement.stage].label})`,
        );
      }
      if (!STEP_BACK_REASONS.includes(event.reason)) {
        return reject(state, event, `WITHDRAW_ACCEPTANCE reason must be chosen from STEP_BACK_REASONS`);
      }
      /**
       * A movement stepped back from `pulled` is at this stage and still holds a bed. Refused,
       * naming the existing route (restore the pull, release it, then withdraw); a bed-holding
       * withdrawal is an open owner question (ruling 2).
       */
      if (movement.admissionId !== undefined) {
        return reject(
          state,
          event,
          `cannot withdraw an acceptance while movement ${movement.id} still holds a bed (admission ${movement.admissionId}); pull it again to restore it, release the pull, then withdraw`,
        );
      }
      // Read before clearing: `UnwindRecord.unitId` names which ward's acceptance this was.
      const withdrawnUnitId = movement.acceptedUnitId;
      const updatedMovement: Movement = {
        ...movement,
        acceptedUnitId: undefined,
        acceptedAt: undefined,
        stage: "destination_review",
        // Not pushed back into `referredUnitIds` (owner ruling 3): withdrawing an acceptance is not
        // re-referring.
        stageChanges: [
          ...movement.stageChanges,
          {
            at: event.now,
            from: "accepted_awaiting_bed",
            to: "destination_review",
            by: event.role,
            reason: event.reason,
          },
        ],
        unwinds: [
          ...movement.unwinds,
          {
            at: event.now,
            kind: "acceptance_withdrawn",
            by: event.role,
            reason: event.reason,
            unitId: withdrawnUnitId,
          },
        ],
      };
      const next = replaceMovement(state, movement.id, updatedMovement);
      // Item 48, Q3 (owner): the ward whose acceptance was undone is told. `withdrawnUnitId` was
      // read before this handler cleared it.
      return appendNotices(next, [
        makeNotice(
          event.now,
          state.notices.length,
          "acceptance_withdrawn_ward",
          { role: "ward", placeId: withdrawnUnitId },
          { movementId: movement.id, unitId: withdrawnUnitId },
          `The coordinator withdrew this ward's acceptance of ${movement.id}. The patient is not coming unless this ward is asked again.`,
        ),
      ]);
    }

    /**
     * Item 48, Q2 (owner answer 48): a notice counts as read only when it is marked as read. The
     * only writer of `Notice.readAt`; see `MARK_NOTICE_READ` in `ward-flow-events.ts`.
     *
     * The addressee itself, never "whoever can see it": `event.role`/`event.actingPlaceId` must
     * equal `notice.to.role`/`notice.to.placeId` exactly, including `undefined` for `officer`
     * (claim-not-proof). Not idempotent: a second mark is refused, so an earlier `readAt`/`readBy`
     * is never overwritten.
     */
    case "MARK_NOTICE_READ":
    case "ACKNOWLEDGE_INBOX_ITEM":
    case "COMPLETE_INBOX_ITEM":
    case "REOPEN_INBOX_ITEM":
    case "TAKE_INBOX_ITEM_OWNERSHIP":
    case "SNOOZE_INBOX_ITEM":
    case "UNSNOOZE_INBOX_ITEM": {
      const next = reduceInboxEvent(state, event, decision, reject);
      if (next) return next;
      return state;
    }

    case "SET_ARRIVAL_DETAILS": {
      const movement = state.movements.find((m) => m.id === event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, "cannot update arrival details on closed movement");
      }
      if (
        event.role === "ward" &&
        event.actingUnitId !== undefined &&
        movement.acceptedUnitId !== undefined &&
        event.actingUnitId !== movement.acceptedUnitId
      ) {
        return reject(
          state,
          event,
          `SET_ARRIVAL_DETAILS was raised acting as unit ${event.actingUnitId} but destination is unit ${movement.acceptedUnitId}; only destination ward or coordinator can set arrival details`,
        );
      }

      const arrivalDetails = {
        mode: event.arrivalMode,
        trackingNumber: event.trackingNumber?.trim() || undefined,
        estimatedArrivalAt: event.estimatedArrivalAt,
        recordedAt: event.now,
        recordedBy: event.role,
      };

      let updatedMovement: Movement = {
        ...movement,
        arrivalDetails,
        pullExpiresAt: undefined, // Default 4h countdown timer is removed as arrival is sorted
      };

      let next = {
        ...state,
        movements: state.movements.map((m) => (m.id === movement.id ? updatedMovement : m)),
      };

      if (
        isArrivalLate(event.estimatedArrivalAt, updatedMovement.stage, event.now) &&
        updatedMovement.arrivalLateNotifiedAt === undefined
      ) {
        updatedMovement = { ...updatedMovement, arrivalLateNotifiedAt: event.now };
        next = {
          ...next,
          movements: next.movements.map((m) => (m.id === movement.id ? updatedMovement : m)),
        };
        const notices = [
          makeNotice(
            event.now,
            next.notices.length,
            "arrival_late_referrer",
            { role: "ed", placeId: movement.originEdId },
            { movementId: movement.id },
            `Arrival for ${movement.id} is more than ${ARRIVAL_LATE_AFTER_MINUTES} minutes past the planned time and they have not arrived.`,
          ),
        ];
        if (movement.acceptedUnitId) {
          notices.push(
            makeNotice(
              event.now,
              next.notices.length + 1,
              "arrival_late_ward",
              { role: "ward", placeId: movement.acceptedUnitId },
              { movementId: movement.id, unitId: movement.acceptedUnitId },
              `Arrival for ${movement.id} is more than ${ARRIVAL_LATE_AFTER_MINUTES} minutes past the planned time and they have not arrived.`,
            ),
          );
        }
        return appendNotices(next, notices);
      }

      return next;
    }

    case "SET_STEP_DOWN_CANDIDATE": {
      const admission = state.admissions.find((a) => a.id === event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      // Same claim-not-proof discipline as RECORD_LEAVING: a ward may only touch its own admission.
      if (event.role === "ward" && event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `SET_STEP_DOWN_CANDIDATE was raised acting as unit ${event.actingUnitId} but admission ${admission.id} is at ${admission.unitId}`,
        );
      }

      const updatedAdmission: Admission = {
        ...admission,
        stepDownCandidate: event.stepDownCandidate,
      };

      return {
        ...state,
        admissions: state.admissions.map((a) => (a.id === admission.id ? updatedAdmission : a)),
      };
    }

    case "SET_DISCHARGE_BARRIER": {
      const admission = state.admissions.find((a) => a.id === event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.role === "ward" && event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `SET_DISCHARGE_BARRIER was raised acting as unit ${event.actingUnitId} but admission ${admission.id} is at ${admission.unitId}`,
        );
      }

      // Chosen from DISCHARGE_BARRIERS, never typed: this event is on the persistence safe list, so
      // anything off the list would reach browser storage as free text (review findings S2-12/A2-2).
      if (event.barrier !== null && event.barrier !== "None" && !isDischargeBarrier(event.barrier)) {
        return reject(state, event, "SET_DISCHARGE_BARRIER barrier must be chosen from DISCHARGE_BARRIERS");
      }

      const stay = daysInBed(admission, event.now) ?? 0;
      if (stay < 7 && event.barrier !== null && event.barrier !== "None") {
        return reject(
          state,
          event,
          `Cannot set discharge barrier: patient length of stay (${stay} days) is less than 7 days`,
        );
      }

      const updatedAdmission: Admission = {
        ...admission,
        dischargeBarrier: event.barrier === "None" ? null : event.barrier,
      };

      return {
        ...state,
        admissions: state.admissions.map((a) => (a.id === admission.id ? updatedAdmission : a)),
      };
    }

    case "UPLOAD_PATIENT_FORM": {
      const movement = state.movements.find((m) => m.id === event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);

      // This prototype records document details only; empty details are not a document.
      if (
        typeof event.formName !== "string" ||
        event.formName.trim().length === 0 ||
        typeof event.fileName !== "string" ||
        event.fileName.trim().length === 0
      ) {
        return reject(state, event, "Enter the document name and file name.");
      }
      const sizeBytes = event.sizeBytes;
      if (typeof sizeBytes !== "number" || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
        return reject(state, event, "Document details need a non-empty file with a valid byte size.");
      }

      const newForm = {
        id: `FORM-${event.now}-${(movement.uploadedForms?.length ?? 0) + 1}`,
        formName: event.formName,
        fileName: event.fileName,
        sizeBytes,
        uploadedAt: event.now,
        uploadedBy: event.role,
      };

      const updatedMovement: Movement = {
        ...movement,
        uploadedForms: [...(movement.uploadedForms ?? []), newForm],
      };

      return {
        ...state,
        movements: state.movements.map((m) => (m.id === movement.id ? updatedMovement : m)),
      };
    }

    case "EVALUATE_ARRIVAL_LATENESS": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) return reject(state, event, "This movement is closed.");
      if (movement.arrivalLateNotifiedAt !== undefined) return state;
      if (!isArrivalLate(movement.arrivalDetails?.estimatedArrivalAt, movement.stage, event.now)) {
        return state;
      }
      const updated: Movement = { ...movement, arrivalLateNotifiedAt: event.now };
      const next = replaceMovement(state, movement.id, updated);
      const notices = [
        makeNotice(
          event.now,
          next.notices.length,
          "arrival_late_referrer",
          { role: "ed", placeId: movement.originEdId },
          { movementId: movement.id },
          `Arrival for ${movement.id} is more than ${ARRIVAL_LATE_AFTER_MINUTES} minutes past the planned time and they have not arrived.`,
        ),
      ];
      if (movement.acceptedUnitId) {
        notices.push(
          makeNotice(
            event.now,
            next.notices.length + 1,
            "arrival_late_ward",
            { role: "ward", placeId: movement.acceptedUnitId },
            { movementId: movement.id, unitId: movement.acceptedUnitId },
            `Arrival for ${movement.id} is more than ${ARRIVAL_LATE_AFTER_MINUTES} minutes past the planned time and they have not arrived.`,
          ),
        );
      }
      return appendNotices(next, notices);
    }

    case "RELEASE_AND_REOPEN_SEARCH": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) {
        return reject(state, event, `cannot release and reopen a closed movement (${movement.closure.reason})`);
      }
      if (movement.stage !== "pulled" && movement.stage !== "accepted_awaiting_bed") {
        return reject(
          state,
          event,
          `cannot release and reopen at the movement's current stage (${stageCopy[movement.stage].label})`,
        );
      }
      if (movement.transport !== undefined && movement.transport.cancelledAt === undefined) {
        return reject(
          state,
          event,
          `movement ${movement.id} has a transport job booked; cancel it (CANCEL_TRANSPORT) before releasing and reopening the search`,
        );
      }
      if (!RELEASE_PULL_REASONS.includes(event.reason)) {
        return reject(state, event, `RELEASE_AND_REOPEN_SEARCH reason must be chosen from RELEASE_PULL_REASONS`);
      }
      if (event.role === "ward" && event.actingUnitId !== movement.acceptedUnitId) {
        return reject(
          state,
          event,
          `RELEASE_AND_REOPEN_SEARCH was raised acting as unit ${event.actingUnitId} but movement ${movement.id}'s bed is at ${movement.acceptedUnitId}`,
        );
      }
      const withoutPhantom = releasePulledBedAndAdmission(state, movement, event.now);
      // A stepped-back movement keeps its bed and admission at `accepted_awaiting_bed` (same rule
      // as `releasePulledBedAndAdmission`).
      const heldBed = movement.stage === "pulled" || movement.admissionId !== undefined;
      const releasedUnitId = movement.acceptedUnitId;
      const updatedMovement: Movement = {
        ...movement,
        stage: "placement_requested",
        acceptedUnitId: undefined,
        acceptedAt: undefined,
        admissionId: undefined,
        allocatedBed: undefined,
        pullExpiresAt: undefined,
        waitlistedUnitIds: undefined,
        referredUnitIds: [],
        transport: undefined,
        blocker: STAGE_TRANSITION_BLOCKERS.wardRequestWithdrawn,
        unwinds: [
          ...movement.unwinds,
          // From accepted_awaiting_bed no bed was ever held: this undoes the ward's acceptance, not a pull.
          {
            at: event.now,
            kind: heldBed ? "pull_released" : "acceptance_withdrawn",
            by: event.role,
            reason: event.reason,
            // Name the former accepting ward: `acceptedUnitId` is cleared in this same update.
            ...(releasedUnitId !== undefined ? { unitId: releasedUnitId } : {}),
          },
        ],
        stageChanges: [
          ...movement.stageChanges,
          { at: event.now, from: movement.stage, to: "placement_requested", by: event.role, reason: event.reason },
        ],
      };
      const next = replaceMovement(withoutPhantom, movement.id, updatedMovement);
      const reasonText = event.reason.replace(/_/g, " ");
      // Clinical owner ruling, 14 Oct 2026: the ED is ALWAYS notified, whether a bed was released
      // or only an acceptance was withdrawn.
      const notices = [
        makeNotice(
          event.now,
          state.notices.length,
          heldBed ? "bed_pull_released" : "acceptance_withdrawn_referrer",
          { role: "ed", placeId: movement.originEdId },
          { movementId: movement.id, unitId: releasedUnitId },
          heldBed
            ? `Bed released and search reopened for ${movement.id} (${reasonText}).`
            : `Acceptance withdrawn and search reopened for ${movement.id} (${reasonText}).`,
        ),
      ];
      // No bed was held: the accepting ward is told its acceptance was released when someone else
      // (the coordinator) made that call (main's ruling, 2026-10-13 22:13 AWST).
      if (!heldBed && releasedUnitId !== undefined && event.role !== "ward") {
        notices.push(
          makeNotice(
            event.now,
            state.notices.length + 1,
            "acceptance_withdrawn_ward",
            { role: "ward", placeId: releasedUnitId },
            { movementId: movement.id, unitId: releasedUnitId },
            `The acceptance for ${movement.id} was released and the search reopened (${reasonText}).`,
          ),
        );
      }
      return appendNotices(next, notices);
    }

    case "CLEAR_EXPECT_FLAG": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) return reject(state, event, "This movement is closed.");
      if (!movement.expectFlag || movement.expectFlag.clearedAt !== undefined) {
        return reject(state, event, `movement ${movement.id} has no open expect flag to clear`);
      }
      const updated: Movement = {
        ...movement,
        expectFlag: { ...movement.expectFlag, clearedAt: event.now, clearedBy: event.role },
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "RAISE_EXPECT_FLAG": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) return reject(state, event, "This movement is closed.");
      if (movement.expectFlag && movement.expectFlag.clearedAt === undefined) {
        return reject(state, event, `movement ${movement.id} already has an open expect flag`);
      }
      // A type-only union passes `vitest run` with no tsc, so membership is enforced at runtime too.
      if (event.kind !== "voluntary_48h" && event.kind !== "involuntary_7d") {
        return reject(state, event, `RAISE_EXPECT_FLAG kind must be "voluntary_48h" or "involuntary_7d"`);
      }
      const updated: Movement = {
        ...movement,
        expectFlag: { raisedAt: event.now, kind: event.kind },
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "FLAG_LEGAL_MISMATCH": {
      const movement = findMovement(state, event.movementId);
      if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
      if (movement.closure) return reject(state, event, "This movement is closed.");
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      const involuntary = movement.legalStatus !== "Voluntary";
      const derived =
        involuntary && !unit.authorised
          ? ("involuntary_on_voluntary_ward" as const)
          : movement.legalStatus === "Voluntary" && unit.lockedBeds > 0 && unit.beds - unit.lockedBeds <= 0
            ? ("voluntary_on_locked_ward" as const)
            : null;
      if (!derived || event.kind !== derived)
        return reject(state, event, "The selected legal mismatch must match the current ward and patient status.");
      const kind = derived;
      const updated: Movement = {
        ...movement,
        legalMismatch: { at: event.now, unitId: event.unitId, kind },
      };
      return replaceMovement(state, movement.id, updated);
    }

    case "EVALUATE_LEAVE_BED_WARNINGS": {
      let noticeCount = state.notices.length;
      const notices: Notice[] = [];
      const leaveBeds = state.leaveBeds.map((leaveBed) => {
        if (leaveBed.openWarningAt !== undefined) return leaveBed;
        if (!leaveBedNeedsOpenWarning(leaveBed.confirmedAt, leaveBed.openWarningAt, event.now)) {
          return leaveBed;
        }
        notices.push(
          makeNotice(
            event.now,
            noticeCount++,
            "leave_bed_open_warning",
            { role: "ward", placeId: leaveBed.unitId },
            { unitId: leaveBed.unitId },
            `Leave bed ${leaveBed.id} has been away for more than 24 hours — consider opening it.`,
          ),
        );
        return { ...leaveBed, openWarningAt: event.now };
      });
      const next = { ...state, leaveBeds };
      return notices.length === 0 ? next : appendNotices(next, notices);
    }

    case "CONFIRM_MORNING_ROLLUP": {
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      // Same claim-not-proof discipline as CONFIRM_CAPACITY: a caller stating a different unit than
      // the one being written to is refused, so one ward cannot confirm another ward's morning count.
      if (
        (event.role === "ward" && event.actingUnitId === undefined) ||
        (event.actingUnitId !== undefined && event.actingUnitId !== event.unitId)
      ) {
        return reject(
          state,
          event,
          `CONFIRM_MORNING_ROLLUP was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
        );
      }
      if (!Number.isSafeInteger(event.expectedDischarges) || event.expectedDischarges < 0) {
        return reject(state, event, "expectedDischarges must be a finite, non-negative whole number");
      }
      return {
        ...state,
        morningRollupConfirmations: {
          ...state.morningRollupConfirmations,
          [event.unitId]: {
            confirmedAt: event.now,
            confirmedByRole: event.role,
            expectedDischarges: event.expectedDischarges,
          },
        },
      };
    }

    case "SEND_WARD_BUZZ": {
      if (
        !WARD_BUZZ_MESSAGES.includes(event.message) ||
        (event.urgent !== undefined && typeof event.urgent !== "boolean")
      )
        return reject(state, event, "Choose a valid ward refresh message.");
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      return {
        ...state,
        refreshRequests: [
          ...state.refreshRequests,
          {
            unitId: unit.id,
            at: event.now,
            byRole: event.role,
            message: event.message,
            urgent: event.urgent,
          },
        ],
      };
    }

    case "DISPATCH_BROADCAST_ALERT":
    case "ACKNOWLEDGE_BROADCAST_ALERT":
    case "STAND_DOWN_BROADCAST_ALERT":
    case "EXTEND_BROADCAST_ALERT":
    case "RAISE_PULL_NOW":
    case "REPLY_BROADCAST_ALERT": {
      const next = reduceBroadcastAlertEvent(state, event, decision, reject);
      if (next) return next;
      return state;
    }

    case "BOOK_PLANNED_ADMISSION": {
      if (!PLANNED_ADMISSION_REASONS.includes(event.reason))
        return reject(state, event, `${event.type} reason must be chosen from the listed reasons`);
      return reducePlannedAdmission(state, event, decision);
    }
    case "CHANGE_PLANNED_ADMISSION": {
      if (!PLANNED_ADMISSION_REASONS.includes(event.reason))
        return reject(state, event, `${event.type} reason must be chosen from the listed reasons`);
      return reducePlannedAdmission(state, event, decision);
    }
    case "CANCEL_PLANNED_ADMISSION": {
      if (!PLANNED_ADMISSION_CANCEL_REASONS.includes(event.reason))
        return reject(state, event, `${event.type} reason must be chosen from the listed reasons`);
      return reducePlannedAdmission(state, event, decision);
    }
    case "CONVERT_PLANNED_ADMISSION": {
      return reducePlannedAdmission(state, event, decision);
    }
  }
  return state;
}

// Passed to the RECORD_* and UNDO_* slices, which may not import this file at run time.

const RECORDED_FACT_EVENT_HELPERS: RecordedFactEventHelpers = {
  STAGE_TRANSITION_BLOCKERS,
  appendNotices,
  departAdmission,
  dischargeBlockingTransit,
  dischargeMovement,
  findAdmission,
  findMovement,
  findReferral,
  findUnit,
  makeNotice,
  movementHoldsBedByStage,
  movementSourceAdmission,
  nextLeaveBedId,
  nextReferralId,
  patientRecordIsInvoluntary,
  recordedByLabel,
  reduceClinicalEvent,
  referralReferrer,
  reject,
  releasePulledBedAndAdmission,
  replaceAdmission,
  replaceMovement,
  replaceReferral,
  replaceUnit,
  withdrawAllLiveRequestsForReferrer,
};

const UNDO_EVENT_HELPERS: UndoEventHelpers = {
  UNDO_STEP_NOTHING,
  bedNumberRefusal,
  findAdmission,
  findReferral,
  findUnit,
  heldBedRefusal,
  reject,
  replaceAdmission,
  replaceReferral,
};
