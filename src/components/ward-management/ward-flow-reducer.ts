import { reducePatientRegistration } from "./ward-patient-registration-reducer";
import { reduceWardDiagnosis } from "./ward-flow-diagnosis-events";
// Closing-the-loop (package E): return requested vs home service agreed.
import { reduceHomeServiceReturn, type HomeServiceReturnRecord } from "./out-of-area/home-service-return";
import { withDischargeMoveDemo } from "./coordinator/since-last-look-seed";
import { reduceDirectoryCheck, type DirectoryCheckRecord } from "./on-call/on-call-checks";
import { classifyLegalStatus, legalStatusIsDetained } from "@/components/ward-management/ward-legal-status";
import { appendRefreshRequest } from "./ward/ward-buzz-keys";
import { referralState } from "./ward-referrals";
import {
  movementHasOpenTurnaroundRequest,
  turnaroundEligibilityAllows,
  unitTurnaroundSource,
} from "./ward-turnaround-priority";
import { recordedMovementMedicalClearance } from "./ward-medical-clearance";
import { withoutRecordNumbers, withUmrnInPlaceOfMovementIds } from "./ward-patient-resolver";
import { appendAudit, classifyAuditEvent, finiteInstant, type AuditDecision, type WardAuditState } from "./ward-audit";
import {
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
  admissionCriteriaEligibility,
  plannedAdmissionLegalStatus,
  dischargeMovement,
  safeCounter,
  uniqueRecord,
  type LegalStatusRecords,
} from "./ward-discharge-records";
// D-64: these two live beside the discharge records so the Discharges list can use them too.
export { admissionCriteriaEligibility, dischargeMovement };
import {
  PLANNED_ADMISSION_CANCEL_REASONS,
  PLANNED_ADMISSION_REASONS,
  type LeavingDestination,
} from "./ward-admissions";
import { lockedBedsFree } from "@/components/ward-management/ward-bed-designation";
import type { Instant } from "@/components/ward-management/ward-clock";
import { type BroadcastAlert } from "./alerts/ward-broadcast-model";
import { reduceBroadcastAlertEvent } from "./alerts/ward-broadcast-reducer";
import { reducePlannedAdmissionEvent } from "./capacity/planned-admissions-reducer";
import { reduceInboxEvent } from "./ward-inbox-reducer";
import { type RecordedFactEventHelpers, reduceRecordedFactEvent } from "./ward-flow-record-events";
import { reduceObservationLevelEvent } from "./ward-flow-observation-events";
import { type UndoEventHelpers, reduceUndoEvent } from "./ward-flow-undo-events";
import type { InboxOwnershipEntry, InboxSnoozeEntry } from "./ward-inbox-snooze";
import {
  type BedReleaseBlocker,
  URGENT_MARK_REASONS,
  GENDER_NO_LONGER_SUITS_REFUSAL,
  GENDER_NO_LONGER_SUITS_NON_BINARY_REFUSAL,
  OVERRIDE_REASONS,
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
  authorisationReasonRecordedSinceLegalChange,
  heldUnitAuthorisationGap,
} from "@/components/ward-management/ward-held-legal-check";

import {
  EVENT_ROLE,
  WARD_BUZZ_MESSAGES,
  WARD_FLOW_ROLE_LABELS,
  type RepatriationMode,
  type WardFlowEvent,
  type OverridableWardFlowEvent,
  type WardFlowRole,
} from "@/components/ward-management/ward-flow-events";

import {
  BLOCKERS_MEANING_NOTHING_IS_BLOCKING,
  genderReviewNeeded,
  type ReferralAddressing,
  OVERRIDE_SIGN_OFF_NAME_MAX,
  type OverrideSignOff,
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
  Rejection,
  TransportLegalStatus,
  TransportProvider,
  Unit,
} from "@/components/ward-management/ward-model";
import {
  defaultWardConfiguration,
  describeInvalidConfiguration,
  validateConfiguration,
  mergeConfiguration,
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

import { siteByCode } from "@/components/ward-management/ward-sites";
import {
  WARD_SCENARIOS,
  scenarioNetwork,
  scenarioUnits,
  type WardScenario,
} from "@/components/ward-management/ward-scenarios";
import { shiftInstants } from "@/components/ward-management/ward-reanchor";
import {
  lacksObservationStaff,
  remainingHighAcuityCapacity,
  bedIsOccupied,
  type Admission,
  type PlannedAdmission,
} from "@/components/ward-management/ward-admissions";
import { activeCommunityTreatmentOrder } from "@/components/ward-management/ward-patients";
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

import { type SupportNotificationRecord } from "@/components/ward-management/ward-support-notifications";
import { reduceReferralSendEvent } from "./ward-flow-referral-send-events";
import { reduceReferralFollowUpEvent } from "./ward-flow-referral-followup-events";
import { reduceReferralAskEvent } from "./ward-flow-referral-ask-events";
import { reduceReferralOwnerEvent } from "./ward-flow-referral-owner-events";
import { reduceReferralCommitmentEvent } from "./ward-flow-referral-commitment-events";
import { reduceWardClosureEvent } from "./ward-flow-ward-closure-events";
import { reduceArrivalCheckEvent, reduceReleaseNoticeEvent } from "./ward-flow-release-notice-events";
import { reduceDischargeDependencyEvent } from "./discharges/discharge-dependency-events";
import { reduceBedMeetingEvent } from "./ward-flow-bed-meeting-events";
// Closing the loop, package D (24 Oct 2026).
import { reduceLoopCheckEvent } from "./ward-flow-loop-check-events";
import { applyLoopChecksDemoOverlay } from "./ward-loop-checks-demo";
import { reduceRestrictivePracticeEvent } from "./ward-flow-restrictive-practice-events";
import { subjectId } from "./ward-flow-subject-id";
import { reduceReferralAnswerEvent } from "./ward-flow-referral-answer-events";
import { reducePlacementEvent } from "./ward-flow-placement-events";
import { reduceTransportEvent } from "./ward-flow-transport-events";
import { reduceBedEvent } from "./ward-flow-bed-events";
import { reduceProtectedRecordEvent } from "./ward-flow-protected-record-events";
export { UNLINKED_CARE_REFUSAL } from "./ward-flow-protected-record-events";

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
  /**
   * Closing-the-loop (package E): return requested and the home service's answer, one per stay
   * (`RECORD_HOME_SERVICE_RETURN`). Optional: absent in older saves, read as none.
   */
  homeServiceReturns?: HomeServiceReturnRecord[];
  /**
   * Closing-the-loop (package E): the latest recorded check of each on-call directory entry
   * (`RECORD_DIRECTORY_CHECK`). Entry id, time and desk only. Optional: absent in older saves.
   */
  directoryChecks?: DirectoryCheckRecord[];
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
 * night. `RESET_SCENARIO` reloads the scenario that is loaded (overall review, 20 Oct 2026: Josh
 * accepted "reset to the scenario that is loaded"), so Reset demo does what its confirm says.
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
    // Closing-the-loop (package E): one discharge date moved this shift, standard night only.
    admissions: network ? structuredClone(network.admissions) : withDischargeMoveDemo(structuredClone(wardAdmissions)),
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
  // Closing the loop, package D (24 Oct 2026): a few synthetic marks so each record shows in the demo.
  return network ? seed : applyLoopChecksDemoOverlay(applyRulingsDemoOverlay(seed, NOW_ANCHOR), NOW_ANCHOR);
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
  bedKindTaken?: "open" | "locked",
): Movement["overrides"] {
  if (event.overrideReason === undefined || !OVERRIDE_REASONS.includes(event.overrideReason)) return movement.overrides;
  const gates: NonNullable<Movement["overrides"][number]["gate"]>[] = [];
  if (lacksObservationStaff(movement.observation, unit, admissions)) gates.push("specialling_staffing");
  if (movement.highAcuity && remainingHighAcuityCapacity(unit, admissions) <= 0) gates.push("high_acuity_staffing");
  if (!checkEligibility) {
    // The restore pull (Audit 2 E-03): the one suitability question it re-asks is authorisation
    // after a legal status change, and only when no reason has been recorded since that change.
    if (heldUnitAuthorisationGap(movement, [unit]) && !authorisationReasonRecordedSinceLegalChange(movement, unit.id))
      gates.push("authorisation");
  }
  if (checkEligibility) {
    if (
      movement.security === "Secure" &&
      (bedKindTaken === "open" || (bedKindTaken === undefined && lockedBedsFree(unit) <= 0))
    )
      gates.push("locked_bed_capacity");
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
    reducePlannedAdmissionEvent(
      state,
      event,
      decision,
      reject,
      (movement, unit, now, waived) =>
        eligibilityRefusal({ type: "CONVERT_PLANNED_ADMISSION" }, movement, unit, now, waived),
      OVERRIDE_REASON_REQUIRED,
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
  /**
   * Audit 24-1 CS2-19: gates already answered by a reason recorded elsewhere — only a planned
   * booking's recorded authorisation reason, for its own ward. Never the gender gate (checked
   * first, above any waiver) and never a capacity refusal (refused before this is called).
   */
  waived: readonly EligibilityGate[] = [],
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
  const failed = verdict.gates.find(
    (gate) => !gate.pass && SUITABILITY_GATES.includes(gate.gate) && !waived.includes(gate.gate),
  );
  if (!failed) return null;
  return (
    `${unit.name} is not eligible for movement ${movement.id} — failed gate ${failed?.gate}: ` +
    `${waived.length > 0 ? failed.detail : candidateReason(verdict)}. This placement ${OVERRIDE_REASON_REQUIRED}.`
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
  // Audit 24-1 B-02: a seeded pulled stay (`movementId: null`) sits outside the empty count
  // (`bedStates`), so its bed becomes physically empty again here. Without this the released bed
  // stayed in Occupied with nobody in it, and a Closed bed read as an unnamed Occupied one.
  const seededPullReleased = heldAdmission?.movementId === null;
  const releasedUnit: Unit = {
    ...unit,
    allocatable: {
      ...unit.allocatable,
      value: Math.min(unit.beds, unit.allocatable.value + 1),
    },
    ...(seededPullReleased ? { empty: { ...unit.empty, value: Math.min(unit.beds, unit.empty.value + 1) } } : {}),
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
  // Audit 24-1 CS2-03: the deleted stay's span stays in the bed replay, so a later pull keeps its bed.
  const pulledAt = heldAdmission?.pulledAt;
  const releasedSpan =
    heldAdmission === undefined || pulledAt == null
      ? undefined
      : {
          admissionId: heldAdmission.id,
          pulledAt,
          leftAt: Math.max(now, pulledAt),
          ...(heldAdmission.bedKind === undefined ? {} : { bedKind: heldAdmission.bedKind }),
          ...(heldAdmission.bedNumber === undefined ? {} : { bedNumber: heldAdmission.bedNumber }),
        };
  const withUnit = replaceUnit(
    state,
    unit.id,
    releasedSpan === undefined
      ? releasedUnit
      : { ...releasedUnit, releasedPullSpans: [...(unit.releasedPullSpans ?? []), releasedSpan] },
  );
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
  const departed: Admission = {
    ...admission,
    state: "departed",
    leftAt: now,
    leavingDestination,
    blockReason: null,
    dischargeCriteria: null,
  };
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

/**
 * Whether a patient record's free-text legal status is involuntary, for the two discharge guards
 * below. Deliberately wide: anything starting "Involuntary", plus "Detained awaiting examination".
 * Refusing a discharge that needs a revocation first is the conservative failure.
 */
export function patientRecordIsInvoluntary(legalStatus: string | undefined): boolean {
  return legalStatusIsDetained(legalStatus);
}

/** The ward's legal status uses the same patient, current movement and booking sources as criteria eligibility. */
export function admissionLegalStatus(state: LegalStatusRecords, admission: Admission): string | undefined {
  const patient = uniqueRecord(state.patients, admission.patientId);
  const patientStatus = patient?.legalStatus;
  // A Form 5A in force excludes criteria led discharge even when the typed status was not changed.
  if (activeCommunityTreatmentOrder(patient) !== undefined) {
    return patientStatus !== undefined && /community treatment order/i.test(patientStatus)
      ? patientStatus
      : "Community treatment order, Form 5A";
  }
  // A patient record that excludes criteria led discharge outranks the movement, as it does there
  // (`criteriaEligibility`): a community treatment order, detained, or on a referral for examination.
  const recordClass = classifyLegalStatus(patientStatus);
  if (recordClass === "cto" || recordClass === "detained" || recordClass === "referred") {
    return patientStatus;
  }
  return (
    dischargeMovement(state, admission)?.legalStatus ?? plannedAdmissionLegalStatus(state, admission) ?? patientStatus
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
 * A released bed is free again only once the accepted referral arm that held it lets go too:
 * `heldBedRefusal` reads both the movement's and the arm's `heldBedNumber` (review on PR #365).
 */
export function withoutReferralBedHold(state: WardFlowState, movement: Movement): WardFlowState {
  const unitId = movement.acceptedUnitId;
  if (movement.referralId === undefined || unitId === undefined) return state;
  let changed = false;
  const referrals = state.referrals.map((referral) => {
    if (referral.id !== movement.referralId) return referral;
    const destinations = referral.destinations.map((arm) => {
      if (
        arm.state !== "accepted" ||
        arm.heldBedNumber === undefined ||
        arm.destination.kind !== "psychiatric_ward" ||
        (arm.acceptedUnitId ?? arm.destination.unitId) !== unitId
      )
        return arm;
      changed = true;
      const { heldBedNumber: _heldBed, ...released } = arm;
      void _heldBed;
      return released;
    });
    return changed ? { ...referral, destinations } : referral;
  });
  return changed ? { ...state, referrals } : state;
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
  // A reassessment on an arm already accepted decides nothing, so it must not replace the
  // acceptance's undo record (Undo would then take back only the note). The acceptance then reads
  // as changed since the decision, so its Undo is refused rather than erasing the reassessment.
  const decisionUnchanged = before.destinations.every((arm, index) => arm.state === after.destinations[index]?.state);
  if (event.type === "ACCEPT_REFERRAL" && decisionUnchanged) return next;
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
    const recorded = advanceResourceRevisions(
      state,
      reduceProtectedRecordEvent(state, event, PROTECTED_RECORD_EVENT_HELPERS),
    );
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
    case "PLACE_IN_BED":
    case "UPDATE_EXPECTED_DISCHARGE":
    case "CLEAR_STAY_DISCHARGE_BLOCKER":
    case "CONFIRM_CAPACITY":
    case "FLAG_BED_RELEASE":
    case "CONFIRM_BED_RELEASE":
    case "REVERT_BED_RELEASE":
    case "BLOCK_BED_RELEASE":
    case "CLEAR_BED_RELEASE_BLOCK":
    case "SET_BED_PREPARATION":
    case "END_LEAVE_BED":
    case "END_COMMUNITY_TREATMENT_ORDER":
    case "REQUEST_CAPACITY_REFRESH":
    case "SET_STEP_DOWN_CANDIDATE":
    case "SET_DISCHARGE_BARRIER":
    case "SET_DISCHARGE_CRITERIA":
    case "UPLOAD_PATIENT_FORM":
    case "EVALUATE_LEAVE_BED_WARNINGS":
      return reduceBedEvent(state, event, decision, BED_EVENT_HELPERS);

    // A reset re-anchors onto the demo's current now rather than handing back a fixture authored at
    // NOW_ANCHOR, so predictions are not already lapsed. `event.now` includes `clockOffsetMinutes`,
    // which a reset clears; subtracting it keeps the visible clock from jumping.
    case "ADD_PATIENT":
      return reducePatientRegistration(state, event, reject);

    case "RESET_SCENARIO":
      // Puts the loaded scenario back to its start. A scenario outside `WARD_SCENARIOS` (a damaged
      // restore) falls back to the standard night rather than seeding something unknown.
      return seedWardFlowStateAt(
        event.now - state.clockOffsetMinutes - NOW_ANCHOR,
        WARD_SCENARIOS.includes(state.scenario) ? state.scenario : "standard",
      );

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
      const merge =
        event.baseConfiguration === undefined
          ? { status: "merged" as const, configuration: requested }
          : mergeConfiguration(state.configuration, requested, event.baseConfiguration, event.replaceAll === true);
      if (merge.status !== "merged") {
        decision.reasonCode = merge.status === "conflict" ? "revision" : "invalid-payload";
        return reject(
          state,
          event,
          merge.status === "conflict"
            ? `Configuration changed while this draft was open: ${merge.fields.join(", ")}. Review the latest settings.`
            : "Configuration draft or its baseline is invalid; review the latest settings.",
        );
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return { ...state, configuration: merge.configuration };
    }
    case "RAISE_REFERRAL":
    case "CORRECT_LEGAL_FORM_RECEIPT":
    case "REFER_TO_COMMUNITY_TEAM":
    case "REFER_TO_UNITS":
    case "WITHDRAW_REFERRAL":
    case "WITHDRAW_WARD_REQUEST":
    case "ADD_REFERRAL_CORRECTION":
    case "CHANGE_URGENCY":
    case "CHANGE_LEGAL_STATUS":
      return reduceReferralSendEvent(state, event, decision, REFERRAL_SEND_EVENT_HELPERS);

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
    case "RECORD_OBSERVATION_LEVEL":
      return reduceObservationLevelEvent(state, event, RECORDED_FACT_EVENT_HELPERS);
    case "ACCEPT_IN_PRINCIPLE":
    case "DECLINE":
    case "RECEIVE_REFERRAL":
    case "ACCEPT_REFERRAL":
    case "HOLD_REFERRAL_BED":
    case "DECLINE_REFERRAL":
    case "WITHDRAW_ACCEPTANCE":
      return reduceReferralAnswerEvent(state, event, decision, REFERRAL_ANSWER_EVENT_HELPERS);
    case "MARK_REFERRAL_OPENED":
    case "REQUEST_REFERRAL_INFORMATION":
    case "MARK_REFERRAL_INFORMATION_MET":
      return reduceReferralFollowUpEvent(state, event, decision, { findReferral, reject, replaceReferral });
    case "ASSIGN_REFERRAL":
    case "LOG_REFERRAL_CONTACT":
      return reduceReferralOwnerEvent(state, event, decision, { findReferral, reject, replaceReferral });
    // Closing-the-loop package A (24 Oct 2026): response commitments.
    case "RECORD_REFERRAL_COMMITMENT":
      return reduceReferralCommitmentEvent(state, event, decision, { findReferral, reject, replaceReferral });
    case "ASK_MORE_WARDS":
      return reduceReferralAskEvent(state, event, decision, { findReferral, findUnit, reject, replaceReferral });
    case "CLOSE_WARD_TO_ADMISSIONS":
    case "REOPEN_WARD_TO_ADMISSIONS":
      return reduceWardClosureEvent(state, event, decision, { findUnit, reject, replaceUnit });
    case "RECORD_RESTRICTIVE_PRACTICE_START":
    case "RECORD_RESTRICTIVE_PRACTICE_END":
    case "RECORD_WARD_INCIDENT":
    case "SET_SECLUSION_ROOM_STATUS":
      return reduceRestrictivePracticeEvent(state, event, decision, { findUnit, reject, replaceUnit });
    case "SEND_RELEASE_SUPPORT_NOTICE":
      return reduceReleaseNoticeEvent(state, event, decision, BED_EVENT_HELPERS);
    // Closing-the-loop package B (24 Oct 2026): discharge dependencies and plan changes.
    case "RECORD_DISCHARGE_DEPENDENCY":
    case "RECORD_DISCHARGE_PLAN_CHANGE":
      return reduceDischargeDependencyEvent(state, event, decision, BED_EVENT_HELPERS);
    case "RECORD_ARRIVAL_CHECK":
      return reduceArrivalCheckEvent(state, event, decision, { findMovement, reject, replaceMovement });
    // Closing the loop, package D (24 Oct 2026).
    case "MARK_CANCELLED_MOVE_CHECK":
    case "RECORD_ACCEPTANCE_CONDITION":
    case "MARK_ACCEPTANCE_CONDITION_MET":
    case "RECORD_RESTRICTION_REVIEW":
    case "MARK_CLOSURE_TRANSITION_ITEM":
      return reduceLoopCheckEvent(state, event, decision, {
        findMovement,
        findUnit,
        reject,
        replaceMovement,
        replaceUnit,
      });
    case "RECORD_BED_MEETING_ACTION":
    case "COMPLETE_BED_MEETING_ACTION":
      return reduceBedMeetingEvent(state, event, decision, {
        findAdmission,
        findMovement,
        findUnit,
        reject,
        replaceAdmission,
        replaceMovement,
      });

    case "PULL_PATIENT":
    case "RELEASE_PULL":
    case "RELEASE_HELD_BED":
    case "RELEASE_DIVERTED_BED":
    case "STEP_BACK_STAGE":
    case "RELEASE_AND_REOPEN_SEARCH":
      return reducePlacementEvent(state, event, decision, PLACEMENT_EVENT_HELPERS);

    case "HANDOVER_READY":
    case "TRANSPORT_ACCEPTED":
    case "TRANSPORT_EN_ROUTE":
    case "PATIENT_COLLECTED":
    case "PATIENT_ARRIVED":
    case "BOOK_TRANSPORT":
    case "CANCEL_TRANSPORT":
    case "STOP_TRANSPORT":
    case "SET_ARRIVAL_DETAILS":
    case "EVALUATE_ARRIVAL_LATENESS":
      return reduceTransportEvent(state, event, decision, TRANSPORT_EVENT_HELPERS);

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
    case "FLAG_MOVEMENT_TURNAROUND_PRIORITY":
    case "FLAG_REFERRAL_TURNAROUND_PRIORITY": {
      if (!Number.isFinite(event.now))
        return reject(state, event, "Turnaround preference requires a finite current time.");
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, "Turnaround preference names no known unit.");
      const source =
        event.source === "departure"
          ? unitTurnaroundSource(state, event.unitId, event.now, false)
          : event.source === "cld"
            ? unitTurnaroundSource(state, event.unitId, event.now, true)
            : unitTurnaroundSource(state, event.unitId, event.now);
      if (!source || (event.source !== undefined && event.source !== source))
        return reject(state, event, "No current CLD-ready admission or unblocked confirmed departure on this unit.");
      const preference = { unitId: event.unitId, flaggedAt: event.now, source };
      if (event.type === "FLAG_MOVEMENT_TURNAROUND_PRIORITY") {
        const movement = findMovement(state, event.movementId);
        if (!movement) return reject(state, event, "Turnaround preference names no known movement.");
        if (movement.closure || movement.stage === "arrived" || movement.acceptedUnitId)
          return reject(state, event, "Turnaround preference requires a waiting, unplaced movement.");
        if (!turnaroundEligibilityAllows(eligibility(movement, unit, event.now), unit))
          return reject(state, event, "The receiving unit's clinical and legal gates must allow this movement.");
        if (!movementHasOpenTurnaroundRequest(state, movement, unit.id))
          return reject(state, event, "Turnaround preference requires an open request for this receiving unit.");
        if (movement.turnaroundPriority?.unitId === event.unitId && movement.turnaroundPriority.source === source)
          return reject(state, event, "Turnaround preference already recorded for this unit.");
        return replaceMovement(state, movement.id, { ...movement, turnaroundPriority: preference });
      }
      const referral = findReferral(state, event.referralId);
      if (!referral) return reject(state, event, "Turnaround preference names no known referral.");
      if (
        referralState(referral) !== "queued" ||
        !referral.destinations.some((arm) => arm.state === "queued" && arm.withdrawnAt === undefined)
      )
        return reject(state, event, "Turnaround preference requires an open waiting referral.");
      if (state.movements.some((movement) => movement.referralId === referral.id))
        return reject(state, event, "Record turnaround preference on the referral's linked movement.");
      if (
        !referral.destinations.some(
          (arm) =>
            arm.state === "queued" &&
            arm.withdrawnAt === undefined &&
            arm.destination.kind === "psychiatric_ward" &&
            (arm.destination.unitId === undefined || arm.destination.unitId === unit.id) &&
            turnaroundEligibilityAllows(referralEligibility(referral, arm.destination, unit, event.now), unit),
        )
      )
        return reject(state, event, "An open ward request must match the receiving unit's clinical and legal gates.");
      if (referral.turnaroundPriority?.unitId === event.unitId && referral.turnaroundPriority.source === source)
        return reject(state, event, "Turnaround preference already recorded for this unit.");
      return replaceReferral(state, referral.id, { ...referral, turnaroundPriority: preference });
    }

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
      const divertedHoldingBed =
        movement.transport?.diversion !== undefined ||
        movement.blocker === STAGE_TRANSITION_BLOCKERS.divertedAwaitingRelease;
      if (divertedHoldingBed) {
        return reject(
          state,
          event,
          `cannot clear diversion hold on movement ${movement.id}: patient was diverted while holding a bed — requires bed release (RELEASE_DIVERTED_BED)`,
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
      // Audit 1 TS-9: a cleared earlier flag is kept, not overwritten.
      const updated: Movement = {
        ...movement,
        expectFlag: { raisedAt: event.now, kind: event.kind },
        ...(movement.expectFlag
          ? { expectFlagHistory: [...(movement.expectFlagHistory ?? []), movement.expectFlag] }
          : {}),
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
        refreshRequests: appendRefreshRequest(
          state.refreshRequests,
          {
            unitId: unit.id,
            at: event.now,
            byRole: event.role,
            message: event.message,
            urgent: event.urgent,
            confirmations: unit.allocatable.confirmations ?? 0,
          },
          state.worldGeneration,
        ),
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
    case "RECORD_WARD_DIAGNOSIS":
      return reduceWardDiagnosis(state, event, reject);
    // Closing-the-loop (package E).
    case "RECORD_HOME_SERVICE_RETURN":
      return reduceHomeServiceReturn(state, event, reject);
    case "RECORD_DIRECTORY_CHECK":
      return reduceDirectoryCheck(state, event, reject);
    default: {
      const _exhaustive: never = event;
      void _exhaustive;
      return state;
    }
  }
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
  withoutReferralBedHold,
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
  movementSourceAdmission,
  reject,
  replaceAdmission,
  replaceReferral,
};

const REFERRAL_SEND_EVENT_HELPERS = {
  REFERRABLE_MOVEMENT_STAGES,
  STAGE_TRANSITION_BLOCKERS,
  appendNotices,
  eligibilityRefusal,
  findMovement,
  findReferral,
  findUnit,
  makeNotice,
  movementSourceAdmission,
  nextFrontDoorReferralId,
  nextReferralId,
  overrideSignOffField,
  referralReferrer,
  reject,
  releasePulledBedAndAdmission,
  withoutReferralBedHold,
  replaceMovement,
  replaceReferral,
  withdrawAllLiveRequestsForReferrer,
};
export type ReferralSendEventHelpers = typeof REFERRAL_SEND_EVENT_HELPERS;

const REFERRAL_ANSWER_EVENT_HELPERS = {
  STAGE_TRANSITION_BLOCKERS,
  appendNotices,
  bedNumberRefusal,
  eligibilityRefusal,
  findMovement,
  findReferral,
  findUnit,
  heldBedRefusal,
  makeNotice,
  nextFrontDoorReferralId,
  overrideSignOffField,
  referralAcceptanceRefusal,
  referralReferrer,
  reject,
  releasePulledBedAndAdmission,
  replaceMovement,
  replaceReferral,
  unitName,
  wardActingMovementRefusal,
  wardActingUnitRefusal,
  withoutReferralBedHold,
};
export type ReferralAnswerEventHelpers = typeof REFERRAL_ANSWER_EVENT_HELPERS;

const PLACEMENT_EVENT_HELPERS = {
  HIGH_ACUITY_STAFFING_REFUSAL,
  OVERRIDE_REASON_REQUIRED,
  STAGE_TRANSITION_BLOCKERS,
  appendNotices,
  bedNumberRefusal,
  heldBedRefusal,
  eligibilityRefusal,
  findMovement,
  findUnit,
  heldUnitGenderRefusal,
  makeNotice,
  movementHoldsBedByStage,
  movementSourceAdmission,
  pullOverrides,
  reject,
  releasePulledBedAndAdmission,
  withoutReferralBedHold,
  replaceMovement,
  replaceUnit,
  wardActingMovementRefusal,
};
export type PlacementEventHelpers = typeof PLACEMENT_EVENT_HELPERS;

const TRANSPORT_EVENT_HELPERS = {
  STAGE_TRANSITION_BLOCKERS,
  appendNotices,
  bedNumberRefusal,
  heldBedRefusal,
  departAdmission,
  findAdmission,
  findMovement,
  findReferral,
  findUnit,
  heldUnitGenderRefusal,
  makeNotice,
  movementHoldsBedByStage,
  movementSourceAdmission,
  reject,
  replaceAdmission,
  replaceMovement,
  replaceReferral,
  replaceUnit,
};
export type TransportEventHelpers = typeof TRANSPORT_EVENT_HELPERS;

const BED_EVENT_HELPERS = {
  admissionCriteriaEligibility,
  appendNotices,
  bedNumberRefusal,
  findAdmission,
  findBedRelease,
  findLeaveBed,
  findUnit,
  heldBedRefusal,
  makeNotice,
  recordedByLabel,
  reject,
  replaceAdmission,
  replaceBedRelease,
  replaceUnit,
  withAdmissionDischargeDecision,
  withStayBlocker,
};
export type BedEventHelpers = typeof BED_EVENT_HELPERS;

const PROTECTED_RECORD_EVENT_HELPERS = {
  admissionLegalStatus,
  departAdmission,
  dischargeBlockingTransit,
  patientRecordIsInvoluntary,
  replaceAdmission,
  replaceUnit,
};
export type ProtectedRecordEventHelpers = typeof PROTECTED_RECORD_EVENT_HELPERS;
