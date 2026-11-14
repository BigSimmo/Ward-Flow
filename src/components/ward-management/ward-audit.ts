import { isObservation, type Observation } from "./ward-observation";
import { communityTeamById } from "./community/community-derivations";
import { stepUndoSubjectId } from "./ward-flow-subject-id";
import { validCareChange, type CareChange } from "./ward-care-journey";
import {
  ADMISSION_STATES,
  FOLLOW_UP_STATES,
  LEAVING_DESTINATIONS,
  type FollowUpState,
  type Admission,
  type LeavingDestination,
} from "./ward-admissions";
import {
  BED_PREPARATION_NOTES,
  BED_RELEASE_BLOCKERS,
  LEGAL_FORM_RECEIPT_CORRECTION_REASONS,
  LEGAL_STATUS_CHANGE_REASONS,
  OVERRIDE_REASONS,
  REFERRAL_CAP_REASONS,
  RELEASE_PULL_REASONS,
  type ReferralCapReason,
  type BedPreparationNote,
  type BedReleaseBlocker,
  type LegalFormReceiptCorrectionReason,
  type LegalStatusChangeReason,
  type OverrideReason,
} from "./ward-change-reasons";
import type { Instant } from "./ward-clock";
import {
  BED_RELEASE_STATES,
  BED_RELEASE_WAITING_ON,
  COMMUNITY_DECLINE_REASONS,
  DECLINE_REASONS,
  ED_DECLINE_REASONS,
  REFERRAL_DECLINE_REASONS,
  type BedRelease,
  type BedReleaseWaitingOn,
  type LegalStatus,
  SUPPORT_SERVICE_TYPES,
  type SupportServiceType,
} from "./ward-model";
import { validateConfiguration, type WardConfiguration } from "./ward-configuration";
import { SELECTABLE_LEGAL_FORMS, CONTINUATION_LEGAL_FORMS } from "./ward-legal-forms";
import { LEGAL_CLOCK_FORM_CODES } from "./ward-legal-clock";
import { LEGACY_DECLINE_REASONS } from "./ward-decline-legacy";
import { PAPER_EXPIRY_CORRECTION_REASONS, type LegalFormExpiryCorrectionReason } from "./ward-model-vocabulary";

import { WARD_FLOW_ROLE_LABELS, type WardFlowRole } from "./ward-flow-roles";
import type { WardFlowEvent } from "./ward-flow-events";
import { COVER_REVIEW_PREFIX, isBreakGlassReviewId } from "./ward-break-glass-review-id";
import { isOnBehalfReason, type OnBehalfReasonId } from "./ward-on-behalf-reason";
import type { BreakGlassReasonId, CoverReasonId, WardAccessRole, WardAccessScope } from "./ward-role-access";
import {
  historyCategoryForType,
  historyWritesOutcome,
  type HistoryCategory,
  type NewHistoryCategory,
} from "./ward-audit-categories";
import { eventDesk } from "./ward-desk-stamp-shape";
import type { HistoryLineDetails } from "./ward-history-lines";
import { BROADCAST_ANSWER_LABELS, type BroadcastAnswer } from "./alerts/ward-broadcast-model";
import { TRIBUNAL_OUTCOMES } from "./ward-patient-care-plans";
import type { WardFlowState } from "./ward-flow-reducer";
import { inboxRowMovementId } from "./ward-inbox-reducer";
import { seededGovernanceAuditEntry, syntheticGovernanceAuditEvents } from "./ward-governance-seed";
import {
  bedPlacementUndoFor,
  referralDecisionUndoFor,
  stepUndoFor,
  UNDO_STEP_TYPES,
  type UndoableStepAction,
  type UndoStepType,
} from "./ward-undo";
import { isSnoozeReason, type InboxSnoozeReason } from "./ward-inbox-snooze";
import type { PatientId } from "./ward-patients";
import { isPatientArchiveReason, type PatientArchiveReason } from "./ward-patient-archive";
import {
  uniqueRecord,
  validRecordActor,
  safeCounter,
  validDischargeRequestNamespace,
  type RecordRead,
  type WardRecordActor,
} from "./ward-discharge-records";

/**
 * Every form code the reducer accepts on a legal-form record (A1-4): intake forms, the continuation
 * list and the legal-clock codes (5B, 3C, 6B, 6C among them), so a continuation keeps its code.
 */
export const AUDITABLE_FORM_CODES: readonly string[] = [
  ...new Set([
    ...SELECTABLE_LEGAL_FORMS.map((form) => form.code),
    ...CONTINUATION_LEGAL_FORMS.map((form) => form.code),
    ...LEGAL_CLOCK_FORM_CODES,
  ]),
];

type AuditReason =
  | "none"
  | "role"
  | "scope"
  | "missing-or-inaccessible"
  | "invalid-payload"
  | "identity-link"
  | "generation"
  | "revision"
  | "transition";
/**
 * Who made a change. `declared-prototype-role`: the role the screen typed (every row stored before
 * D-222). `desk-session`: stamped from the session desk (`ward-desk-stamp.ts`), so the desk's place
 * can be named. `system`: raised automatically, with no desk.
 */
export type AuditActor = {
  role: WardFlowRole | null;
  /** The ward desk's own ward, or the ward a coordinator acted for. */
  actingUnitId: string | null;
  actingTeamId?: string;
  attribution: "declared-prototype-role" | "desk-session" | "system";
  /** desk-session: the desk's place. */
  scope?: WardAccessScope;
  /** desk-session: the role the step was recorded as, when it is not the desk's (a kept step role). */
  asRole?: WardFlowRole;
  /** desk-session: the access admin, which records under the executive role. */
  accessAdmin?: true;
  /** desk-session, signed in: the account's short display name (D-222 choice 2). */
  account?: string;
};
export type AuditSubject =
  | { kind: "admission"; admissionId: string; unitId: string; patientId: PatientId | null }
  | { kind: "movement"; movementId: string; patientId: PatientId | null }
  | { kind: "referral"; referralId: string; patientId: PatientId | null }
  | { kind: "bed-release"; releaseId: string; unitId: string }
  | { kind: "audit-event"; eventId: string }
  | { kind: "configuration" }
  /** D-222: a change about a person and no single record (care plan, tribunal, order). */
  | { kind: "patient"; patientId: PatientId }
  /** D-222: a change about a ward itself (bed numbers, intake hours, closures). */
  | { kind: "unit"; unitId: string }
  /** D-222: a bed call or broadcast. Coordinator only. */
  | { kind: "alert"; alertId: string }
  | { kind: "unresolved" };
type AuditBase = {
  id: string;
  sequence: number;
  generation: number;
  at: Instant | null;
  actor: AuditActor;
  subject: AuditSubject;
  outcome: "accepted" | "partial" | "denied" | "stale";
  reasonCode: AuditReason;
  /**
   * `synthetic-seed` (v10 pass 2, Josh 10 Oct 2026) marks the clearly synthetic governance entries a
   * fresh demonstration opens with (`ward-governance-seed.ts`). They are never in `auditEvents`.
   */
  origin: "captured-this-session" | "synthetic-seed" | "break-glass-opening";
};
/**
 * D-80 item 14: a break glass opening on the coordinator's review list. Never in `auditEvents`: the
 * shared server keeps openings in its own table and the local demo derives synthetic ones
 * (`governance-access-review.ts`). The desk is its role and place in words; `deskCount` is how many
 * openings that desk made in the 12 hours up to this one, so more than 3 reads as a pattern.
 */
type BreakGlassAuditDetails = {
  record: string | null;
  reason: BreakGlassReasonId | null;
  until: Instant | null;
  desk: WardAccessRole | null;
  place: string;
  deskCount: number;
  /** Only for "Other" in the local demo, held in memory. */
  otherText?: string;
};
/**
 * Master audit M58 (D-129, 10 Nov 2026): a cover given, on the coordinator's review list beside the
 * break glass openings, kept outside `auditEvents` the same way (origin `break-glass-opening`: held
 * outside the workspace). The desk is the giver's role and place; `cover` is the ward or ED covered.
 */
type CoverAuditDetails = {
  reason: CoverReasonId | null;
  until: Instant | null;
  desk: WardAccessRole | null;
  place: string;
  cover: string;
};
export type AuditReview = {
  id: string;
  eventId: string;
  generation: number;
  at: Instant;
  byRole: "coordinator";
  decision: "reviewed" | "follow-up-required";
};
export type WardAuditState = {
  worldGeneration: number;
  auditEvents: readonly AuditEvent[];
  auditReviews: readonly AuditReview[];
  auditSequence: number;
  auditReviewSequence: number;
  auditCaptureStartedAt: Instant;
};
type OverrideDetails = {
  reason: OverrideReason | null;
  overrideFactRecorded: boolean;
  targets: readonly { unitId: string | null; outcome: "accepted" | "denied"; reasonCode: AuditReason }[];
  /** v10 pass 3: the second sign-off kept with an accepted override; absent when none was given. */
  secondSignOff?: { role: WardFlowRole | null; name: string };
  /** Top 25 item 2: the reason for asking more wards than the referral cap; absent when within it. */
  overCapReason?: ReferralCapReason;
};
export type BedReleaseAuditFacts = {
  state: BedRelease["state"] | null;
  expectedAt: Instant | null;
  waitingOn: BedReleaseWaitingOn | null;
  blocker: BedReleaseBlocker | null;
  preparing: boolean | null;
  preparationNote: BedPreparationNote | null;
};
export type BedReleaseAuditRequest =
  | {
      action: "FLAG_BED_RELEASE";
      expectedAt: Instant | null;
      waitingOn: BedReleaseWaitingOn | null;
      blocker: BedReleaseBlocker | null;
    }
  | { action: "REVERT_BED_RELEASE"; waitingOn: BedReleaseWaitingOn | null }
  | { action: "BLOCK_BED_RELEASE"; blocker: BedReleaseBlocker | null }
  | { action: "SET_BED_PREPARATION"; preparing: boolean | null; note: BedPreparationNote | null }
  | { action: "CONFIRM_BED_RELEASE" | "CLEAR_BED_RELEASE_BLOCK" | "RELEASE_BED" }
  /** #398: the service a discharge support notice went to. */
  | { action: "SEND_RELEASE_SUPPORT_NOTICE"; service: SupportServiceType | null };
type DischargeDetails =
  | { kind: "care"; operation: CareChange["kind"] | null; recorded: CareChange | null }
  | { kind: "follow-up"; before: FollowUpState | null; requested: FollowUpState | null; after: FollowUpState | null }
  | {
      kind: "departure";
      before: Admission["state"] | null;
      after: Admission["state"] | null;
      requestedDestination: LeavingDestination | null;
      recordedDestination: LeavingDestination | null;
    }
  | {
      kind: "bed-release";
      before: BedReleaseAuditFacts | null;
      requested: BedReleaseAuditRequest;
      after: BedReleaseAuditFacts | null;
    };
type TypedAuditEvent = AuditBase &
  (
    | { category: "referral"; action: "REFER_TO_UNITS"; details: OverrideDetails }
    | {
        category: "override";
        action: "REFER_TO_UNITS" | "PULL_PATIENT" | "ACCEPT_IN_PRINCIPLE" | "ACCEPT_REFERRAL";
        details: OverrideDetails;
      }
    | {
        category: "legal-status";
        action: "CHANGE_LEGAL_STATUS";
        details: {
          before: LegalStatus | null;
          requested: LegalStatus | null;
          after: LegalStatus | null;
          /** The chosen reason. Absent on entries recorded before 27 Oct 2026, which did not keep it. */
          reason?: LegalStatusChangeReason | null;
        };
      }
    | {
        category: "legal-form";
        action: "RAISE_REFERRAL";
        details: { operation: "initial-capture"; formCode: string | null };
      }
    | {
        // T2 (2026-09-17 build plan). A typed expiry or extension against an already-raised
        // movement's legal form — see `RECORD_LEGAL_FORM_EXPIRY`'s own doc comment in
        // `ward-flow-events.ts` for why the two share one event and one audit shape.
        category: "legal-form";
        action: "RECORD_LEGAL_FORM_EXPIRY" | "RECORD_COUNTRY_EXTENSION" | "RECORD_LEGAL_FORM_CONTINUATION";
        details: {
          operation: "expiry-recorded" | "extension-recorded" | "continuation-recorded" | "expiry-corrected";
          dueAt: Instant | null;
          formCode?: string | null;
          startedAt?: Instant | null;
          previousDueAt?: Instant | null;
          reason?: LegalFormExpiryCorrectionReason | null;
        };
      }
    | {
        // T4 (2026-09-17 build plan). A Form 1A receipt correction — the fixed reason given and
        // the ORIGINAL instant being corrected away, so the audit trail keeps both without
        // resolving a stale subject.
        category: "legal-form";
        action: "CORRECT_LEGAL_FORM_RECEIPT";
        details: { reason: LegalFormReceiptCorrectionReason | null; correctedReceivedAt: Instant | null };
      }
    | {
        category: "discharge";
        action:
          | BedReleaseAuditRequest["action"]
          | "RECORD_LEAVING"
          | "RECORD_PATIENT_DISCHARGE"
          | "RECORD_ADMISSION_FOLLOW_UP"
          | "RECORD_ADMISSION_CARE";
        details: DischargeDetails;
      }
    | {
        category: "record-access";
        action: "OPEN_DISCHARGE_RECORD";
        /** `onBehalfReason`: D-80 item 17, the coordinator's closed-list reason for opening a ward's record. */
        details: { requestId: number | null; requestNamespace?: string; onBehalfReason?: OnBehalfReasonId };
      }
    | { category: "record-access"; action: "BREAK_GLASS"; details: BreakGlassAuditDetails }
    | { category: "record-access"; action: "ACCESS_COVER"; details: CoverAuditDetails }
    | { category: "review"; action: "REVIEW_AUDIT_EVENT"; details: { decision: AuditReview["decision"] | null } }
    | {
        // v10 pass 2: a review taken back. `decision` is always null so no screen reads it as a review.
        category: "review";
        action: "UNDO_AUDIT_REVIEW";
        details: { decision: null; undoneReviewId: string | null; undoneDecision: AuditReview["decision"] | null };
      }
    | {
        // v10 pass 2: a referral decision taken back with Undo.
        category: "undo";
        action: "UNDO_REFERRAL_DECISION";
        details: { undoneAction: "ACCEPT_REFERRAL" | "DECLINE_REFERRAL" | null; decidedAt: Instant | null };
      }
    | {
        // v10 pass 3: an undoable step taken back (`UNDO_STEP_ACTIONS`). The action and its time only.
        category: "undo";
        action: UndoStepType;
        details: { undoneAction: UndoableStepAction | null; decidedAt: Instant | null };
      }
    | {
        // v10 pass 2: the ward Bed board's pick up and place, and its Undo. Bed numbers only.
        category: "bed-placement";
        action: "PLACE_IN_BED" | "UNDO_PLACE_IN_BED" | "HOLD_REFERRAL_BED" | "RELEASE_REFERRAL_BED";
        details: { fromBed: number | null; toBed: number | null; openBedReason?: OverrideReason };
      }
    | {
        // Stream A, 9 Oct 2026: who took, snoozed or returned an action item. The reason is a closed list.
        // M37 (D-129, 10 Nov 2026): an acknowledgement too, so "Acknowledge visible" leaves one row per alert.
        category: "inbox";
        action:
          | "ACKNOWLEDGE_INBOX_ITEM"
          | "TAKE_INBOX_ITEM_OWNERSHIP"
          | "RELEASE_INBOX_ITEM_OWNERSHIP"
          | "SNOOZE_INBOX_ITEM"
          | "UNSNOOZE_INBOX_ITEM";
        details: { inboxItemId: string; reason: InboxSnoozeReason | null; until: Instant | null };
      }
    | {
        // #816: a patient record archived as added in error. The record number and the listed
        // reason only, read from the record before it left the lists.
        category: "patient-record";
        action: "ARCHIVE_PATIENT";
        details: { patientId: PatientId | null; umrn: string | null; reason: PatientArchiveReason | null };
      }
    | {
        category: "patient-record";
        action: "RECORD_OBSERVATION_LEVEL";
        details: { before: Observation | null; requested: Observation | null; after: Observation | null };
      }
    | {
        // M35 (Josh, 10 Nov 2026): a ward's or destination's answer to a referral, so the report's
        // decline count can be checked against the trail. Fixed-list reason and ward only.
        category: "referral-answer";
        action: "DECLINE" | "DECLINE_REFERRAL";
        details: { answer: "declined" | "waitlisted" | null; unitId: string | null; reason: string | null };
      }
    | {
        // M35 (Josh, 10 Nov 2026): a patient reaching the ward (or the officer's Delivered step).
        category: "arrival";
        action: "PATIENT_ARRIVED";
        details: { step: "delivered" | "arrived"; unitId: string | null };
      }
    | {
        category: "configuration";
        action: "SET_CONFIGURATION";
        details: {
          before: WardConfiguration | null;
          requested: WardConfiguration | null;
          after: WardConfiguration | null;
        };
      }
  );
/** The categories with their own typed details: every category History wrote before D-222. */
export type AuditCategory = TypedAuditEvent["category"];
/** The actions only a typed line carries, plus the four refined ones that are typed only sometimes. */
type GenericAuditAction =
  | Exclude<WardFlowEvent["type"], TypedAuditEvent["action"]>
  | "PULL_PATIENT"
  | "ACCEPT_IN_PRINCIPLE"
  | "ACCEPT_REFERRAL"
  | "RAISE_REFERRAL";
/**
 * D-222 (item 10): every other save's line. No payload is kept: ids through `subject`, and for three
 * categories a few closed-list facts (`line`, `ward-history-lines.ts`). Never typed text.
 */
export type HistoryLineAuditEvent = AuditBase & {
  /** The table's categories for types with no typed capture (`AUDIT_CATEGORY`). */
  category:
    | NewHistoryCategory
    | "referral"
    | "referral-answer"
    | "legal-form"
    | "discharge"
    | "inbox"
    | "patient-record"
    | "configuration";
  action: GenericAuditAction;
  details: { kind: "history-line"; line: HistoryLineDetails | null };
};
export type AuditEvent = TypedAuditEvent | HistoryLineAuditEvent;
/**
 * D-222 (choice 1): a line as a desk other than the coordinator sees it, or `null` when it may not.
 * Accepted lines only; refusals stay with the coordinator, and so do record-access receipts (their
 * own rule) and reviews. A typed line's before and after facts are withheld: what changed, the desk
 * and the time remain. The one shape the stored-state check pins (`RECORD_ADMISSION_CARE`) keeps it.
 */
export function sharedHistoryLine(event: AuditEvent): AuditEvent | null {
  if (event.outcome !== "accepted" || event.category === "record-access" || event.category === "review") return null;
  if (isHistoryLine(event) && event.details.line === null) return event;
  const details =
    event.action === "RECORD_ADMISSION_CARE"
      ? { kind: "care", operation: null, recorded: null }
      : { kind: "history-line", line: isHistoryLine(event) ? event.details.line : null };
  return { ...event, details } as AuditEvent;
}
/** A line written by the D-222 table rather than a typed capture. Never on the Review list. */
export function isHistoryLine(event: AuditEvent): event is HistoryLineAuditEvent {
  return (event.details as { kind?: unknown } | undefined)?.kind === "history-line";
}
/** Mutable only inside one reducer call, filled at the original clinical decision branch. */
export type AuditDecision = Pick<AuditBase, "outcome" | "reasonCode"> & {
  targets?: OverrideDetails["targets"];
  overrideFactRecorded?: boolean;
  /** Top 25 item 2: an accepted `REFER_TO_UNITS` that went past the referral cap with a reason. */
  overCapRecorded?: boolean;
};
export const finiteInstant = (value: unknown): Instant | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
export function enumValue<T extends string>(values: readonly T[], value: unknown): T | null {
  return typeof value === "string" && (values as readonly string[]).includes(value) ? (value as T) : null;
}
const legalStatuses: readonly LegalStatus[] = [
  "Voluntary",
  "Referred for psychiatric examination",
  "Detained awaiting examination",
  "Involuntary inpatient",
];
const destinations = LEAVING_DESTINATIONS.map((destination) => destination.id);
/** Every fixed decline reason either decline event may carry, so a row never keeps typed text. */
const declineAnswerReasons: readonly string[] = [
  ...new Set<string>([
    ...DECLINE_REASONS,
    ...REFERRAL_DECLINE_REASONS,
    ...ED_DECLINE_REASONS,
    ...COMMUNITY_DECLINE_REASONS,
  ]),
];
function declineAnswerReason(value: unknown): string | null {
  const current =
    typeof value === "string" && Object.hasOwn(LEGACY_DECLINE_REASONS, value) ? LEGACY_DECLINE_REASONS[value] : value;
  return enumValue(declineAnswerReasons, current);
}
export const reviewDecision = (value: unknown) => enumValue(["reviewed", "follow-up-required"] as const, value);

/**
 * D-222 (item 10): every save writes one History line unless excluded. The typed captures keep their
 * own category and refinements (an override, a legal form on a raise); every other type takes its
 * row in `AUDIT_CATEGORY` (`ward-audit-categories.ts`).
 */
export function classifyAuditEvent(event: WardFlowEvent): HistoryCategory | null {
  return typedAuditCategory(event) ?? historyCategoryForType(event.type);
}

/** The category of a save with its own typed capture, or null. History before D-222 wrote only these. */
function typedAuditCategory(event: WardFlowEvent): AuditCategory | null {
  switch (event.type) {
    case "REFER_TO_UNITS":
      return event.overrideReason === undefined ? "referral" : "override";
    case "PULL_PATIENT":
    case "ACCEPT_IN_PRINCIPLE":
    case "ACCEPT_REFERRAL":
      return event.overrideReason !== undefined ? "override" : null;
    case "CHANGE_LEGAL_STATUS":
      return "legal-status";
    case "RAISE_REFERRAL":
      return event.draft?.legalFormCode !== undefined ? "legal-form" : null;
    case "RECORD_LEGAL_FORM_EXPIRY":
    case "RECORD_COUNTRY_EXTENSION":
    case "RECORD_LEGAL_FORM_CONTINUATION":
    case "CORRECT_LEGAL_FORM_RECEIPT":
      return "legal-form";
    case "FLAG_BED_RELEASE":
    case "CONFIRM_BED_RELEASE":
    case "REVERT_BED_RELEASE":
    case "BLOCK_BED_RELEASE":
    case "CLEAR_BED_RELEASE_BLOCK":
    case "SET_BED_PREPARATION":
    case "SEND_RELEASE_SUPPORT_NOTICE":
    case "RECORD_LEAVING":
    case "RECORD_ADMISSION_CARE":
    case "RECORD_ADMISSION_FOLLOW_UP":
    case "RECORD_PATIENT_DISCHARGE":
      return "discharge";
    case "OPEN_DISCHARGE_RECORD":
      return "record-access";
    case "REVIEW_AUDIT_EVENT":
    case "UNDO_AUDIT_REVIEW":
      return "review";
    case "UNDO_REFERRAL_DECISION":
    case "UNDO_REFER_TO_UNITS":
    case "UNDO_ACCEPT_IN_PRINCIPLE":
    case "UNDO_LEGAL_FORM_RECORD":
    case "UNDO_SUPPORT_NOTIFICATION":
    case "UNDO_REPATRIATION":
    case "UNDO_FLAG_RETURN_EARLY":
    case "UNDO_HANDOVER_SIGN_OFF":
    case "UNDO_SITE_HANDOVER_SIGN_OFF":
    case "UNDO_ED_STEP":
    case "UNDO_TRANSPORT_STEP":
    case "UNDO_DEPARTURE":
    case "UNDO_ABSENT_WITHOUT_LEAVE":
    case "UNDO_BED_MEETING_ACTION":
    case "UNDO_BED_STEP":
    case "UNDO_RELEASE_STEP":
    case "UNDO_PATIENT_RECORD":
      return "undo";
    case "PLACE_IN_BED":
    case "UNDO_PLACE_IN_BED":
    case "HOLD_REFERRAL_BED":
    case "RELEASE_REFERRAL_BED":
      return "bed-placement";
    case "SET_CONFIGURATION":
      return "configuration";
    case "DECLINE":
    case "DECLINE_REFERRAL":
      return "referral-answer";
    case "PATIENT_ARRIVED":
      return "arrival";
    case "ARCHIVE_PATIENT":
    case "RECORD_OBSERVATION_LEVEL":
      return "patient-record";
    case "ACKNOWLEDGE_INBOX_ITEM":
    case "TAKE_INBOX_ITEM_OWNERSHIP":
    case "RELEASE_INBOX_ITEM_OWNERSHIP":
    case "SNOOZE_INBOX_ITEM":
    case "UNSNOOZE_INBOX_ITEM":
      return "inbox";
    default:
      return null;
  }
}

const FLOW_ROLES = Object.keys(WARD_FLOW_ROLE_LABELS) as WardFlowRole[];

function auditActor(state: WardFlowState, event: WardFlowEvent): AuditActor {
  const desk = eventDesk(event);
  if (desk) return deskActor(state, event, desk);
  const role = enumValue(FLOW_ROLES, event.role);
  return {
    role,
    actingUnitId: role === "ward" ? actingUnit(state, event) : null,
    ...("actingTeamId" in event &&
    role === "community" &&
    typeof event.actingTeamId === "string" &&
    communityTeamById(event.actingTeamId)
      ? { actingTeamId: event.actingTeamId }
      : {}),
    attribution: "declared-prototype-role",
  };
}

/** The ward the change names as acting for, when it is a ward the state knows. */
function actingUnit(state: WardFlowState, event: WardFlowEvent): string | null {
  const claimed =
    event.type === "RECORD_OBSERVATION_LEVEL"
      ? event.target?.actingUnitId
      : "actingUnitId" in event
        ? event.actingUnitId
        : undefined;
  return uniqueRecord(state.units, claimed)?.id ?? null;
}

/**
 * D-222: the actor from the session desk stamp. A ward desk names its own ward (the one it acted
 * for when it holds several); a coordinator names the ward it acted for, so the line reads "Bed
 * coordinator, for <ward>". A kept step role (`COORDINATOR_STEP_ROLES`) is kept as `asRole`.
 */
function deskActor(state: WardFlowState, event: WardFlowEvent, desk: NonNullable<ReturnType<typeof eventDesk>>) {
  const role: WardFlowRole = desk.role;
  const scope = desk.scope;
  const acting = actingUnit(state, event);
  const ownWard = scope.kind === "ward" && scope.unitIds.length === 1 ? scope.unitIds[0]! : null;
  const actingUnitId =
    role === "ward"
      ? acting !== null && scope.kind === "ward" && scope.unitIds.includes(acting)
        ? acting
        : ownWard
      : role === "coordinator"
        ? acting
        : null;
  const typed = enumValue(FLOW_ROLES, event.role);
  const actor: AuditActor = { role, actingUnitId, attribution: "desk-session", scope };
  if (typed !== null && typed !== role && typed !== "demo" && role === "coordinator") actor.asRole = typed;
  if (desk.accessAdmin) actor.accessAdmin = true;
  if (desk.account !== undefined) actor.account = desk.account;
  return actor;
}
function patientReference(state: WardFlowState, id: unknown): PatientId | null {
  return uniqueRecord(state.patients, id)?.id ?? null;
}
export function auditSubject(state: WardFlowState, event: WardFlowEvent): AuditSubject {
  if (event.type === "RECORD_OBSERVATION_LEVEL") {
    if (event.target?.kind === "movement") {
      const movement = uniqueRecord(state.movements, event.target.movementId);
      if (movement)
        return {
          kind: "movement",
          movementId: movement.id,
          patientId: patientReference(
            state,
            uniqueRecord(state.referrals, movement.referralId)?.patientId ?? movement.patientId,
          ),
        };
    } else if (event.target?.kind === "admission") {
      const admission = uniqueRecord(state.admissions, event.target.admissionId);
      if (admission && uniqueRecord(state.units, admission.unitId))
        return {
          kind: "admission",
          admissionId: admission.id,
          unitId: admission.unitId,
          patientId: patientReference(state, admission.patientId),
        };
    }
    return { kind: "unresolved" };
  }
  if ("admissionId" in event) {
    const admission = uniqueRecord(state.admissions, event.admissionId);
    if (admission && uniqueRecord(state.units, admission.unitId))
      return {
        kind: "admission",
        admissionId: admission.id,
        unitId: admission.unitId,
        patientId: patientReference(state, admission.patientId),
      };
  } else if ("movementId" in event) {
    const movement = uniqueRecord(state.movements, event.movementId);
    if (movement)
      return {
        kind: "movement",
        movementId: movement.id,
        patientId: patientReference(
          state,
          uniqueRecord(state.referrals, movement.referralId)?.patientId ?? movement.patientId,
        ),
      };
  } else if ("referralId" in event) {
    const referral = uniqueRecord(state.referrals, event.referralId);
    if (referral)
      return { kind: "referral", referralId: referral.id, patientId: patientReference(state, referral.patientId) };
  } else if ("releaseId" in event) {
    const release = uniqueRecord(state.bedReleases, event.releaseId);
    if (release && uniqueRecord(state.units, release.unitId))
      return { kind: "bed-release", releaseId: release.id, unitId: release.unitId };
  } else if (event.type === "REVIEW_AUDIT_EVENT") {
    const entry = governanceAuditEntry(state, event.eventId);
    if (entry) return { kind: "audit-event", eventId: entry.id };
  } else if (event.type === "UNDO_AUDIT_REVIEW") {
    const review = uniqueRecord(state.auditReviews, event.reviewId);
    const entry = review ? governanceAuditEntry(state, review.eventId) : undefined;
    if (entry) return { kind: "audit-event", eventId: entry.id };
  } else if (event.type === "UNDO_BED_MEETING_ACTION" && typeof event.subject === "object" && event.subject !== null) {
    // H-0150: the Undo names its stay or bed request through `subject`, not a top-level id.
    if (event.subject.kind === "movement") {
      const movement = uniqueRecord(state.movements, event.subject.id);
      if (movement)
        return {
          kind: "movement",
          movementId: movement.id,
          patientId: patientReference(
            state,
            uniqueRecord(state.referrals, movement.referralId)?.patientId ?? movement.patientId,
          ),
        };
    } else if (event.subject.kind === "admission") {
      const admission = uniqueRecord(state.admissions, event.subject.id);
      if (admission && uniqueRecord(state.units, admission.unitId))
        return {
          kind: "admission",
          admissionId: admission.id,
          unitId: admission.unitId,
          patientId: patientReference(state, admission.patientId),
        };
    }
  } else if (event.type === "SET_CONFIGURATION") {
    return { kind: "configuration" };
  } else if (
    event.type === "ACKNOWLEDGE_INBOX_ITEM" ||
    event.type === "TAKE_INBOX_ITEM_OWNERSHIP" ||
    event.type === "RELEASE_INBOX_ITEM_OWNERSHIP" ||
    event.type === "SNOOZE_INBOX_ITEM" ||
    event.type === "UNSNOOZE_INBOX_ITEM"
  ) {
    const movement = uniqueRecord(
      state.movements,
      inboxRowMovementId(
        state.movements,
        // A malformed event with no text id is refused by the reducer; never throw here (WF-50).
        typeof event.inboxItemId === "string" ? event.inboxItemId.trim() : "",
      ),
    );
    if (movement)
      return {
        kind: "movement",
        movementId: movement.id,
        patientId: patientReference(
          state,
          uniqueRecord(state.referrals, movement.referralId)?.patientId ?? movement.patientId,
        ),
      };
  }
  return { kind: "unresolved" };
}

/**
 * D-222: the subject of a line no record above names: a bed call, a person, or a ward. Only ids the
 * state knows; anything else stays unresolved, which no narrower desk ever sees.
 */
function otherSubject(state: WardFlowState, event: WardFlowEvent): AuditSubject {
  const fields = event as { alertId?: unknown; patientId?: unknown; unitId?: unknown };
  const alert = uniqueRecord(state.broadcastAlerts ?? [], fields.alertId);
  if (alert) return { kind: "alert", alertId: alert.id };
  const patientId = patientReference(state, fields.patientId);
  if (patientId !== null) return { kind: "patient", patientId };
  const unit = uniqueRecord(state.units, fields.unitId);
  if (unit) return { kind: "unit", unitId: unit.id };
  return { kind: "unresolved" };
}
function bedFacts(release: BedRelease | undefined): BedReleaseAuditFacts | null {
  if (!release) return null;
  return {
    state: enumValue(BED_RELEASE_STATES, release.state),
    expectedAt: finiteInstant(release.expectedAt),
    waitingOn: enumValue(BED_RELEASE_WAITING_ON, release.waitingOn),
    blocker: enumValue(BED_RELEASE_BLOCKERS, release.blocker),
    preparing: typeof release.preparing === "boolean" ? release.preparing : null,
    preparationNote: enumValue(BED_PREPARATION_NOTES, release.preparationNote),
  };
}
function bedRequest(event: WardFlowEvent): BedReleaseAuditRequest | null {
  switch (event.type) {
    case "FLAG_BED_RELEASE":
      return {
        action: event.type,
        expectedAt: finiteInstant(event.expectedAt),
        waitingOn: enumValue(BED_RELEASE_WAITING_ON, event.waitingOn),
        blocker: enumValue(BED_RELEASE_BLOCKERS, event.blocker),
      };
    case "REVERT_BED_RELEASE":
      return { action: event.type, waitingOn: enumValue(BED_RELEASE_WAITING_ON, event.waitingOn) };
    case "BLOCK_BED_RELEASE":
      return { action: event.type, blocker: enumValue(BED_RELEASE_BLOCKERS, event.blocker) };
    case "SET_BED_PREPARATION":
      return {
        action: event.type,
        preparing: typeof event.preparing === "boolean" ? event.preparing : null,
        note: enumValue(BED_PREPARATION_NOTES, event.note),
      };
    case "CONFIRM_BED_RELEASE":
    case "CLEAR_BED_RELEASE_BLOCK":
      return { action: event.type };
    case "SEND_RELEASE_SUPPORT_NOTICE":
      return { action: event.type, service: enumValue(SUPPORT_SERVICE_TYPES, event.service) };
    default:
      return null;
  }
}
export function captureAuditEvent(
  before: WardFlowState,
  after: WardFlowState,
  event: WardFlowEvent,
  decisionInput: AuditDecision | boolean = true,
): AuditEvent | null {
  if (!classifyAuditEvent(event)) return null;
  const decision: AuditDecision =
    typeof decisionInput === "boolean"
      ? { outcome: decisionInput ? "accepted" : "denied", reasonCode: "none" }
      : decisionInput;
  const sequence = (after.auditSequence ?? 0) + 1;
  // Role/time refusal precedence is independent of whether this command can name the current world.
  // An earlier winning refusal must never make a stale command resolve a replacement subject.
  const mayResolveSubject =
    event.type === "OPEN_DISCHARGE_RECORD" ||
    event.type === "REVIEW_AUDIT_EVENT" ||
    event.type === "UNDO_AUDIT_REVIEW" ||
    event.type === "RECORD_PATIENT_DISCHARGE" ||
    event.type === "RECORD_ADMISSION_FOLLOW_UP" ||
    event.type === "RECORD_ADMISSION_CARE"
      ? safeCounter(event.expectedGeneration) && event.expectedGeneration === before.worldGeneration
      : true;
  let subject = mayResolveSubject ? auditSubject(before, event) : ({ kind: "unresolved" } as const);
  if (event.type === "FLAG_BED_RELEASE" && decision.outcome === "accepted") {
    const created = after.bedReleases[before.bedReleases.length];
    if (created && uniqueRecord(after.bedReleases, created.id) && uniqueRecord(after.units, created.unitId))
      subject = { kind: "bed-release", releaseId: created.id, unitId: created.unitId };
  }
  if (event.type === "RAISE_REFERRAL" && decision.outcome === "accepted") {
    const created = after.movements[after.movements.length - 1];
    if (created && uniqueRecord(after.movements, created.id))
      subject = {
        kind: "movement",
        movementId: created.id,
        patientId: patientReference(
          after,
          uniqueRecord(after.referrals, created.referralId)?.patientId ?? created.patientId,
        ),
      };
  }
  const base: AuditBase = {
    id: `audit-${sequence}`,
    sequence,
    generation: after.worldGeneration,
    at: finiteInstant(event.now),
    actor: auditActor(before, event),
    subject,
    outcome: decision.outcome,
    reasonCode: decision.reasonCode,
    origin: "captured-this-session",
  };
  if (typedAuditCategory(event) === null) return historyLine(before, after, event, base);
  let captured: AuditEvent;
  switch (event.type) {
    case "OPEN_DISCHARGE_RECORD":
      captured = {
        ...base,
        category: "record-access",
        action: event.type,
        details: {
          requestId:
            safeCounter(event.requestId) && event.expectedGeneration === before.worldGeneration
              ? event.requestId
              : null,
          ...(validDischargeRequestNamespace(event.requestNamespace)
            ? { requestNamespace: event.requestNamespace }
            : {}),
          ...(isOnBehalfReason(event.onBehalfReason) ? { onBehalfReason: event.onBehalfReason } : {}),
        },
      };
      break;
    case "REVIEW_AUDIT_EVENT":
      captured = {
        ...base,
        category: "review",
        action: event.type,
        details: { decision: reviewDecision(event.decision) },
      };
      break;
    case "UNDO_AUDIT_REVIEW": {
      const review = mayResolveSubject ? uniqueRecord(before.auditReviews, event.reviewId) : undefined;
      captured = {
        ...base,
        category: "review",
        action: event.type,
        details: {
          decision: null,
          undoneReviewId: review?.id ?? null,
          undoneDecision: reviewDecision(review?.decision),
        },
      };
      break;
    }
    case "UNDO_REFERRAL_DECISION": {
      const record = referralDecisionUndoFor(before.undoRecords, event.referralId);
      captured = {
        ...base,
        category: "undo",
        action: event.type,
        details: { undoneAction: record?.action ?? null, decidedAt: finiteInstant(record?.at) },
      };
      break;
    }
    case "UNDO_REFER_TO_UNITS":
    case "UNDO_ACCEPT_IN_PRINCIPLE":
    case "UNDO_LEGAL_FORM_RECORD":
    case "UNDO_SUPPORT_NOTIFICATION":
    case "UNDO_REPATRIATION":
    case "UNDO_FLAG_RETURN_EARLY":
    case "UNDO_HANDOVER_SIGN_OFF":
    case "UNDO_SITE_HANDOVER_SIGN_OFF":
    case "UNDO_ED_STEP":
    case "UNDO_TRANSPORT_STEP":
    case "UNDO_DEPARTURE":
    case "UNDO_ABSENT_WITHOUT_LEAVE":
    case "UNDO_BED_MEETING_ACTION":
    case "UNDO_BED_STEP":
    case "UNDO_RELEASE_STEP":
    case "UNDO_PATIENT_RECORD": {
      const record = UNDO_STEP_TYPES.includes(event.type)
        ? stepUndoFor(before.undoRecords, event.type, stepUndoSubjectId(event))
        : undefined;
      captured = {
        ...base,
        category: "undo",
        action: event.type,
        details: { undoneAction: record?.action ?? null, decidedAt: finiteInstant(record?.at) },
      };
      break;
    }
    case "HOLD_REFERRAL_BED":
    case "RELEASE_REFERRAL_BED": {
      const held = (state: WardFlowState) =>
        uniqueRecord(state.referrals, event.referralId)?.destinations.find(
          (arm) =>
            arm.destination.kind === "psychiatric_ward" &&
            arm.state === "accepted" &&
            (arm.acceptedUnitId ?? arm.destination.unitId) === event.unitId,
        )?.heldBedNumber ?? null;
      captured = {
        ...base,
        category: "bed-placement",
        action: event.type,
        details: {
          fromBed: held(before),
          toBed:
            decision.outcome === "accepted"
              ? held(after)
              : event.type === "HOLD_REFERRAL_BED"
                ? finiteInstant(event.bedNumber)
                : null,
        },
      };
      break;
    }
    case "PLACE_IN_BED":
    case "UNDO_PLACE_IN_BED": {
      const bed = (state: WardFlowState) => {
        const value = uniqueRecord(state.admissions, event.admissionId)?.bedNumber;
        return typeof value === "number" && Number.isInteger(value) ? value : null;
      };
      const record =
        event.type === "UNDO_PLACE_IN_BED" ? bedPlacementUndoFor(before.undoRecords, event.admissionId) : undefined;
      captured = {
        ...base,
        category: "bed-placement",
        action: event.type,
        details: {
          fromBed: bed(before),
          toBed:
            decision.outcome === "accepted"
              ? bed(after)
              : event.type === "PLACE_IN_BED"
                ? finiteInstant(event.bedNumber)
                : (record?.beforeBed ?? null),
        },
      };
      // Audit CS3-12: the reason a stay needing a locked bed was moved to an open one.
      const openBedReason = event.type === "PLACE_IN_BED" ? enumValue(OVERRIDE_REASONS, event.overrideReason) : null;
      if (openBedReason !== null && decision.overrideFactRecorded === true)
        captured.details = { ...captured.details, openBedReason };
      break;
    }
    case "ACKNOWLEDGE_INBOX_ITEM":
    case "TAKE_INBOX_ITEM_OWNERSHIP":
    case "RELEASE_INBOX_ITEM_OWNERSHIP":
    case "SNOOZE_INBOX_ITEM":
    case "UNSNOOZE_INBOX_ITEM":
      captured = {
        ...base,
        category: "inbox",
        action: event.type,
        details: {
          inboxItemId: typeof event.inboxItemId === "string" ? event.inboxItemId.trim() : "",
          reason: event.type === "SNOOZE_INBOX_ITEM" && isSnoozeReason(event.reason) ? event.reason : null,
          until: event.type === "SNOOZE_INBOX_ITEM" && Number.isFinite(event.until) ? event.until : null,
        },
      };
      break;
    case "RECORD_OBSERVATION_LEVEL": {
      const observation = (state: WardFlowState): Observation | null => {
        const row =
          event.target?.kind === "movement"
            ? uniqueRecord(state.movements, event.target.movementId)
            : event.target?.kind === "admission"
              ? uniqueRecord(state.admissions, event.target.admissionId)
              : undefined;
        return isObservation(row?.observation) ? structuredClone(row.observation) : null;
      };
      captured = {
        ...base,
        category: "patient-record",
        action: event.type,
        details: {
          before: observation(before),
          requested: isObservation(event.observation) ? structuredClone(event.observation) : null,
          after: observation(after),
        },
      };
      break;
    }
    case "ARCHIVE_PATIENT": {
      const record = uniqueRecord(before.patients, event.patientId);
      captured = {
        ...base,
        category: "patient-record",
        action: event.type,
        details: {
          patientId: record?.id ?? null,
          umrn: record?.umrn ?? null,
          reason: isPatientArchiveReason(event.reason) ? event.reason : null,
        },
      };
      break;
    }
    case "SET_CONFIGURATION":
      captured = {
        ...base,
        category: "configuration",
        action: event.type,
        details: {
          before: before.configuration,
          requested: validateConfiguration(event.payload),
          after: after.configuration,
        },
      };
      break;
    case "REFER_TO_UNITS":
    case "PULL_PATIENT":
    case "ACCEPT_IN_PRINCIPLE":
    case "ACCEPT_REFERRAL": {
      const ids =
        event.type === "REFER_TO_UNITS" ? (Array.isArray(event.unitIds) ? event.unitIds : []) : [event.unitId];
      const details: OverrideDetails = {
        reason: enumValue(OVERRIDE_REASONS, event.overrideReason),
        overrideFactRecorded: decision.overrideFactRecorded === true,
        targets:
          decision.targets ??
          ids.map((id) => ({
            unitId: uniqueRecord(before.units, id)?.id ?? null,
            outcome: decision.outcome === "accepted" ? "accepted" : "denied",
            reasonCode: decision.reasonCode,
          })),
      };
      // Top 25 item 2: kept only when this accepted referral actually went past the cap.
      const overCapReason =
        event.type === "REFER_TO_UNITS" ? enumValue(REFERRAL_CAP_REASONS, event.overCapReason) : null;
      if (overCapReason !== null && decision.overCapRecorded === true) details.overCapReason = overCapReason;
      // v10 pass 3: the second sign-off, kept only with an override this event actually recorded.
      const signOff = "overrideSignOff" in event ? event.overrideSignOff : undefined;
      if (signOff !== undefined && decision.overrideFactRecorded === true && typeof signOff.name === "string")
        details.secondSignOff = {
          role: enumValue(Object.keys(WARD_FLOW_ROLE_LABELS) as WardFlowRole[], signOff.role),
          name: signOff.name.trim(),
        };
      captured =
        event.type === "REFER_TO_UNITS" && event.overrideReason === undefined
          ? { ...base, category: "referral", action: event.type, details }
          : { ...base, category: "override", action: event.type, details };
      break;
    }
    case "CHANGE_LEGAL_STATUS":
      captured = {
        ...base,
        category: "legal-status",
        action: event.type,
        details: {
          before: enumValue(legalStatuses, uniqueRecord(before.movements, event.movementId)?.legalStatus),
          requested: enumValue(legalStatuses, event.legalStatus),
          after: enumValue(legalStatuses, uniqueRecord(after.movements, event.movementId)?.legalStatus),
          reason: enumValue(LEGAL_STATUS_CHANGE_REASONS, event.reason),
        },
      };
      break;
    case "RAISE_REFERRAL":
      captured = {
        ...base,
        category: "legal-form",
        action: event.type,
        details: {
          operation: "initial-capture",
          formCode: enumValue(
            SELECTABLE_LEGAL_FORMS.map((form) => form.code),
            event.draft.legalFormCode,
          ),
        },
      };
      break;
    case "RECORD_COUNTRY_EXTENSION":
    case "RECORD_LEGAL_FORM_CONTINUATION": {
      captured = {
        ...base,
        category: "legal-form",
        action: event.type,
        details: {
          operation: event.type === "RECORD_COUNTRY_EXTENSION" ? "extension-recorded" : "continuation-recorded",
          dueAt: finiteInstant(event.paperExpiresAt),
          ...(event.type === "RECORD_LEGAL_FORM_CONTINUATION"
            ? {
                formCode: enumValue(AUDITABLE_FORM_CODES, event.formCode),
                startedAt: finiteInstant(event.startedAt),
              }
            : {}),
        },
      };
      break;
    }
    case "RECORD_LEGAL_FORM_EXPIRY": {
      // Read from `before`, the same discipline `RECORD_LEGAL_FORM_RECEIVED`'s own "already
      // recorded" check uses in the reducer: whether this was the first typed expiry or an
      // extension is a fact about the record BEFORE this event, never guessed from the outcome.
      const priorDueAt = mayResolveSubject
        ? uniqueRecord(before.movements, event.movementId)?.legalForm?.dueAt
        : undefined;
      captured = {
        ...base,
        category: "legal-form",
        action: event.type,
        details: {
          operation:
            event.correction !== undefined
              ? "expiry-corrected"
              : priorDueAt !== undefined
                ? "extension-recorded"
                : "expiry-recorded",
          dueAt: finiteInstant(event.dueAt),
          ...(event.correction === undefined
            ? {}
            : {
                previousDueAt: finiteInstant(priorDueAt),
                reason: enumValue(PAPER_EXPIRY_CORRECTION_REASONS, event.correction?.reason),
              }),
        },
      };
      break;
    }
    case "CORRECT_LEGAL_FORM_RECEIPT": {
      // The instant being CORRECTED is read from `before`, the same discipline
      // `RECORD_LEGAL_FORM_EXPIRY` immediately above uses — a fact about the record before this
      // event, never guessed from the outcome (which clears it).
      const correctedReceivedAt = mayResolveSubject
        ? (uniqueRecord(before.movements, event.movementId)?.legalFormReceivedAt ?? null)
        : null;
      captured = {
        ...base,
        category: "legal-form",
        action: event.type,
        details: {
          reason: enumValue(LEGAL_FORM_RECEIPT_CORRECTION_REASONS, event.reason),
          correctedReceivedAt: finiteInstant(correctedReceivedAt),
        },
      };
      break;
    }
    case "RECORD_ADMISSION_CARE": {
      captured = {
        ...base,
        category: "discharge",
        action: event.type,
        details: {
          kind: "care",
          operation: validCareChange(event.change) ? event.change.kind : null,
          recorded:
            decision.outcome === "accepted" && validCareChange(event.change) ? structuredClone(event.change) : null,
        },
      };
      break;
    }
    case "RECORD_ADMISSION_FOLLOW_UP": {
      const prior = mayResolveSubject ? uniqueRecord(before.admissions, event.admissionId) : undefined;
      const next = prior ? uniqueRecord(after.admissions, prior.id) : undefined;
      captured = {
        ...base,
        category: "discharge",
        action: event.type,
        details: {
          kind: "follow-up",
          before: enumValue(FOLLOW_UP_STATES, prior?.followUp?.state),
          requested: enumValue(FOLLOW_UP_STATES, event.followUpState),
          after: enumValue(FOLLOW_UP_STATES, next?.followUp?.state),
        },
      };
      break;
    }
    case "DECLINE":
    case "DECLINE_REFERRAL": {
      const accepted = decision.outcome === "accepted";
      // A ward that waitlists keeps its request open; a decline takes the ward off the request.
      const waitlisted =
        event.type === "DECLINE_REFERRAL"
          ? event.waitlist === true
          : (uniqueRecord(after.movements, event.movementId)?.referredUnitIds ?? []).includes(event.unitId);
      captured = {
        ...base,
        category: "referral-answer",
        action: event.type,
        details: {
          answer: accepted ? (waitlisted ? "waitlisted" : "declined") : null,
          // A ward answer that names no ward is kept to the ward that sent it, so a refused row
          // never falls out of ward scope.
          unitId: uniqueRecord(before.units, event.unitId ?? event.actingUnitId)?.id ?? null,
          reason: declineAnswerReason(event.reason),
        },
      };
      break;
    }
    case "PATIENT_ARRIVED": {
      const movement = mayResolveSubject ? uniqueRecord(before.movements, event.movementId) : undefined;
      captured = {
        ...base,
        category: "arrival",
        action: event.type,
        details: {
          step: event.role === "officer" ? "delivered" : "arrived",
          unitId: uniqueRecord(before.units, movement?.acceptedUnitId)?.id ?? null,
        },
      };
      break;
    }
    case "RECORD_LEAVING":
    case "RECORD_PATIENT_DISCHARGE": {
      // A stale generation cannot attach any detail from a reseeded admission to the old command.
      const prior = mayResolveSubject ? uniqueRecord(before.admissions, event.admissionId) : undefined;
      const next = prior ? uniqueRecord(after.admissions, prior.id) : undefined;
      captured = {
        ...base,
        category: "discharge",
        action: event.type,
        details: {
          kind: "departure",
          before: enumValue(ADMISSION_STATES, prior?.state),
          after: enumValue(ADMISSION_STATES, next?.state),
          requestedDestination: enumValue(destinations, event.leavingDestination),
          recordedDestination: enumValue(destinations, next?.leavingDestination),
        },
      };
      break;
    }
    case "FLAG_BED_RELEASE":
    case "CONFIRM_BED_RELEASE":
    case "REVERT_BED_RELEASE":
    case "BLOCK_BED_RELEASE":
    case "CLEAR_BED_RELEASE_BLOCK":
    case "SET_BED_PREPARATION":
    case "SEND_RELEASE_SUPPORT_NOTICE": {
      const requested = bedRequest(event);
      if (!requested) return null;
      const id = subject.kind === "bed-release" ? subject.releaseId : null;
      captured = {
        ...base,
        category: "discharge",
        action: event.type,
        details: {
          kind: "bed-release",
          before: bedFacts(uniqueRecord(before.bedReleases, id)),
          requested,
          after: bedFacts(uniqueRecord(after.bedReleases, id)),
        },
      };
      break;
    }
    default:
      return null;
  }
  return structuredClone(captured);
}

/**
 * D-222: a History line for a save with no typed capture. The outcome is the branch's own verdict
 * when it gave one; otherwise a new refusal means refused, and a changed state means accepted. A
 * save that changed nothing and was not refused is no save, so it writes no line.
 */
function historyLine(
  before: WardFlowState,
  after: WardFlowState,
  event: WardFlowEvent,
  base: AuditBase,
): HistoryLineAuditEvent | null {
  const category = classifyAuditEvent(event);
  if (category === null) return null;
  let outcome = base.outcome;
  let reasonCode = base.reasonCode;
  if (outcome !== "accepted") {
    if (after.rejections.length > before.rejections.length) {
      outcome = "denied";
    } else if (after === before) {
      return null;
    } else {
      outcome = "accepted";
      reasonCode = "none";
    }
  }
  if (!historyWritesOutcome(category, outcome)) return null;
  let subject = base.subject.kind === "unresolved" ? otherSubject(before, event) : base.subject;
  if (subject.kind === "unresolved" && outcome === "accepted") subject = createdSubject(before, after);
  return structuredClone({
    ...base,
    subject,
    outcome,
    reasonCode,
    category: category as HistoryLineAuditEvent["category"],
    action: event.type as GenericAuditAction,
    details: { kind: "history-line" as const, line: lineFacts(before, after, event) },
  });
}

/** The record an accepted save created, when it named none before (a new referral, journey, call or person). */
function createdSubject(before: WardFlowState, after: WardFlowState): AuditSubject {
  const added = <T extends { id: string }>(was: readonly T[] | undefined, now: readonly T[] | undefined) =>
    was && now && now.length > was.length ? now.at(-1) : undefined;
  const referral = added(before.referrals, after.referrals);
  if (referral)
    return { kind: "referral", referralId: referral.id, patientId: patientReference(after, referral.patientId) };
  const movement = added(before.movements, after.movements);
  if (movement)
    return {
      kind: "movement",
      movementId: movement.id,
      patientId: patientReference(after, movement.patientId),
    };
  const alert = added(before.broadcastAlerts, after.broadcastAlerts);
  if (alert) return { kind: "alert", alertId: alert.id };
  const patient = added(before.patients, after.patients);
  if (patient) return { kind: "patient", patientId: patient.id };
  return { kind: "unresolved" };
}

const wholeCount = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;

/**
 * The closed-list facts a bed call, pulled bed or tribunal line keeps (`ward-history-lines.ts`).
 * Kinds, counts, minutes, a fixed answer and ward ids only; never a title, message or name.
 */
function lineFacts(before: WardFlowState, after: WardFlowState, event: WardFlowEvent): HistoryLineDetails | null {
  const fields = event as { alertId?: unknown; unitId?: unknown; movementId?: unknown };
  const alertOf = (state: WardFlowState) =>
    uniqueRecord(state.broadcastAlerts ?? [], fields.alertId) ??
    (event.type === "DISPATCH_BROADCAST_ALERT" || event.type === "RAISE_PULL_NOW"
      ? after.broadcastAlerts?.length > (before.broadcastAlerts?.length ?? 0)
        ? after.broadcastAlerts.at(-1)
        : undefined
      : undefined);
  const unitId = uniqueRecord(after.units, fields.unitId)?.id ?? null;
  switch (event.type) {
    case "DISPATCH_BROADCAST_ALERT":
    case "EXTEND_BROADCAST_ALERT":
    case "STAND_DOWN_BROADCAST_ALERT":
    case "ADD_BROADCAST_ALERT_UNITS":
    case "ACKNOWLEDGE_BROADCAST_ALERT":
    case "REPLY_BROADCAST_ALERT":
    case "RAISE_PULL_NOW":
    case "SEND_WARD_BUZZ":
    case "REQUEST_CAPACITY_REFRESH": {
      const alert = alertOf(after);
      const previous = alertOf(before);
      const kind = alert?.kind ?? (alert ? "directive" : null);
      return {
        alertKind: kind === "bed_call" || kind === "directive" || kind === "pull_now" ? kind : null,
        ...(event.type === "DISPATCH_BROADCAST_ALERT"
          ? {
              desksAsked: Array.isArray(alert?.targetUnitIds) ? alert.targetUnitIds.length : null,
              durationMinutes: wholeCount(alert?.durationMinutes),
            }
          : {}),
        ...(event.type === "ADD_BROADCAST_ALERT_UNITS"
          ? { desksAsked: Array.isArray(event.unitIds) ? event.unitIds.length : null }
          : {}),
        ...(event.type === "EXTEND_BROADCAST_ALERT" && alert && previous
          ? { minutesAdded: wholeCount(alert.expiresAt - previous.expiresAt) }
          : {}),
        ...(event.type === "REPLY_BROADCAST_ALERT"
          ? {
              answer: enumValue(Object.keys(BROADCAST_ANSWER_LABELS) as BroadcastAnswer[], event.answer),
              beds: wholeCount(event.beds),
            }
          : {}),
        unitId,
      };
    }
    case "PULL_PATIENT":
      return { unitId, reason: null };
    case "RAISE_REFERRAL":
      // Pull the bed: the one tap raises the journey and pulls the bed, and its line says both.
      return event.pullBed === true
        ? { unitId: uniqueRecord(after.units, event.acceptedUnitId)?.id ?? null, reason: null }
        : null;
    case "RELEASE_PULL":
    case "EXTEND_PULL": {
      const movement = uniqueRecord(before.movements, fields.movementId);
      const minutes = event.type === "EXTEND_PULL" ? wholeCount(event.minutes) : null;
      return {
        unitId: uniqueRecord(before.units, movement?.acceptedUnitId)?.id ?? null,
        reason: event.type === "RELEASE_PULL" ? enumValue(RELEASE_PULL_REASONS, event.reason) : null,
        ...(minutes !== null && minutes % 60 === 0 ? { hoursAdded: minutes / 60 } : {}),
      };
    }
    case "RECORD_TRIBUNAL_OUTCOME":
      return { outcome: enumValue(TRIBUNAL_OUTCOMES, event.outcome) };
    default:
      return null;
  }
}

/**
 * The newest audit entries kept in the saved day. The server's audit table is the full record; the
 * day's copy only feeds the on-screen views, and an unbounded copy eventually passes the 8 MB row
 * limit so every save fails. Entries an audit review names are always kept, and so are this
 * scenario's newest record-access receipts, because an open record is read against its receipt.
 * The demo and the shared server keep the same bound (D-222).
 */
export const PERSISTED_AUDIT_EVENTS = 1000;
export function boundAudit<S extends Pick<WardFlowState, "auditEvents" | "auditReviews" | "worldGeneration">>(
  state: S,
): S {
  const excess = state.auditEvents.length - PERSISTED_AUDIT_EVENTS;
  if (excess <= 0) return state;
  const kept = new Set(state.auditReviews.map((review) => review.eventId));
  state.auditEvents
    .filter((entry) => entry.category === "record-access" && entry.generation === state.worldGeneration)
    .slice(-PERSISTED_AUDIT_EVENTS)
    .forEach((entry) => kept.add(entry.id));
  return {
    ...state,
    auditEvents: state.auditEvents.filter((entry, index) => index >= excess || kept.has(entry.id)),
  };
}

/**
 * Events a composite save makes on the way to its own line, which write none of their own (D-222):
 * Pull the bed's inner journey start and pull (`raiseAndPullBed`). Held by identity, so a sent
 * change can never carry the mark.
 */
const NESTED_EVENTS = new WeakSet<object>();
export function nestedHistoryEvent<E extends WardFlowEvent>(event: E): E {
  NESTED_EVENTS.add(event);
  return event;
}

export function appendAudit(
  before: WardFlowState,
  after: WardFlowState,
  event: WardFlowEvent,
  decision: AuditDecision,
): WardFlowState {
  if (!classifyAuditEvent(event) || NESTED_EVENTS.has(event)) return after;
  // The wrapper reserves this sequence before any clinical write. Never wrap/reuse an ID.
  if (!safeCounter(after.auditSequence) || after.auditSequence >= Number.MAX_SAFE_INTEGER) return before;
  const sequence = after.auditSequence + 1;
  const captured = captureAuditEvent(before, after, event, decision);
  if (!captured) return after;
  captured.id = `audit-${sequence}`;
  captured.sequence = sequence;
  // captureAuditEvent already returns a deep copy that nothing else holds, so it is stored as is.
  return boundAudit({ ...after, auditSequence: sequence, auditEvents: [...after.auditEvents, captured] });
}

export function readAuditEvents(state: WardFlowState, actor: WardRecordActor): RecordRead<readonly AuditEvent[]> {
  return validRecordActor(actor) && actor.role === "coordinator"
    ? { status: "allowed", value: structuredClone(state.auditEvents) }
    : { status: "denied" };
}
/**
 * Every governance entry a reviewer sees: the synthetic seeded ones first, then this session's.
 * Seeded entries belong to the current world (their `generation` is always the current one), so they
 * return after a reset and can be reviewed like any other entry.
 */
export function governanceAuditEvents(state: WardFlowState): readonly AuditEvent[] {
  return [...syntheticGovernanceAuditEvents(state), ...state.auditEvents];
}

/**
 * One governance entry by id, for a review or its undo. A seeded entry a shared desk derived from its
 * own part of the workspace is found about whichever record its id names.
 */
export function governanceAuditEntry(state: WardFlowState, id: unknown): AuditEvent | undefined {
  return (
    uniqueRecord(governanceAuditEvents(state), id) ?? seededGovernanceAuditEntry(state, id) ?? openingEntry(state, id)
  );
}

/**
 * D-80 item 14: a break glass opening is not in the workspace, so its review names it by id alone
 * (`ward-break-glass-review-id.ts`). The entry stands in for it in the current world; its facts are
 * read from the server or the demo on the Governance screen, never here.
 */
function openingEntry(state: WardFlowState, id: unknown): AuditEvent | undefined {
  if (!isBreakGlassReviewId(id)) return undefined;
  return {
    id,
    sequence: 0,
    generation: state.worldGeneration,
    at: null,
    actor: { role: null, actingUnitId: null, attribution: "declared-prototype-role" },
    subject: { kind: "unresolved" },
    outcome: "accepted",
    reasonCode: "none",
    origin: "break-glass-opening",
    category: "record-access",
    ...(id.startsWith(COVER_REVIEW_PREFIX)
      ? { action: "ACCESS_COVER", details: { reason: null, until: null, desk: null, place: "", cover: "" } }
      : {
          action: "BREAK_GLASS",
          details: { record: null, reason: null, until: null, desk: null, place: "", deskCount: 0 },
        }),
  } as AuditEvent;
}

/** `readAuditEvents` plus the synthetic seeded entries: for the Governance page only. */
export function readGovernanceAuditEvents(
  state: WardFlowState,
  actor: WardRecordActor,
): RecordRead<readonly AuditEvent[]> {
  return validRecordActor(actor) && actor.role === "coordinator"
    ? { status: "allowed", value: structuredClone(governanceAuditEvents(state)) }
    : { status: "denied" };
}

export function readAuditReviews(state: WardFlowState, actor: WardRecordActor): RecordRead<readonly AuditReview[]> {
  return validRecordActor(actor) && actor.role === "coordinator"
    ? { status: "allowed", value: structuredClone(state.auditReviews) }
    : { status: "denied" };
}
