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
  OVERRIDE_REASONS,
  type BedPreparationNote,
  type BedReleaseBlocker,
  type LegalFormReceiptCorrectionReason,
  type OverrideReason,
} from "./ward-change-reasons";
import type { Instant } from "./ward-clock";
import {
  BED_RELEASE_STATES,
  BED_RELEASE_WAITING_ON,
  type BedRelease,
  type BedReleaseWaitingOn,
  type LegalStatus,
} from "./ward-model";
import { validateConfiguration, type WardConfiguration } from "./ward-configuration";
import { SELECTABLE_LEGAL_FORMS } from "./ward-legal-forms";
import { WARD_FLOW_ROLE_LABELS, type WardFlowRole } from "./ward-flow-roles";
import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import type { PatientId } from "./ward-patients";
import {
  uniqueRecord,
  validRecordActor,
  safeCounter,
  type RecordRead,
  type WardRecordActor,
} from "./ward-discharge-records";

export type AuditReason =
  | "none"
  | "role"
  | "scope"
  | "missing-or-inaccessible"
  | "invalid-payload"
  | "identity-link"
  | "generation"
  | "revision"
  | "transition";
export type AuditActor = {
  role: WardFlowRole | null;
  actingUnitId: string | null;
  attribution: "declared-prototype-role";
};
export type AuditSubject =
  | { kind: "admission"; admissionId: string; unitId: string; patientId: PatientId | null }
  | { kind: "movement"; movementId: string; patientId: PatientId | null }
  | { kind: "referral"; referralId: string; patientId: PatientId | null }
  | { kind: "bed-release"; releaseId: string; unitId: string }
  | { kind: "audit-event"; eventId: string }
  | { kind: "configuration" }
  | { kind: "unresolved" };
export type AuditBase = {
  id: string;
  sequence: number;
  generation: number;
  at: Instant | null;
  actor: AuditActor;
  subject: AuditSubject;
  outcome: "accepted" | "partial" | "denied" | "stale";
  reasonCode: AuditReason;
  origin: "captured-this-session";
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
export type OverrideDetails = {
  reason: OverrideReason | null;
  overrideFactRecorded: boolean;
  targets: readonly { unitId: string | null; outcome: "accepted" | "denied"; reasonCode: AuditReason }[];
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
  | { action: "CONFIRM_BED_RELEASE" | "CLEAR_BED_RELEASE_BLOCK" | "RELEASE_BED" };
export type DischargeDetails =
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
export type AuditEvent = AuditBase &
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
        details: { before: LegalStatus | null; requested: LegalStatus | null; after: LegalStatus | null };
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
        action: "RECORD_LEGAL_FORM_EXPIRY";
        details: { operation: "expiry-recorded" | "extension-recorded"; dueAt: Instant | null };
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
          | "RECORD_ADMISSION_FOLLOW_UP";
        details: DischargeDetails;
      }
    | { category: "record-access"; action: "OPEN_DISCHARGE_RECORD"; details: { requestId: number | null } }
    | { category: "review"; action: "REVIEW_AUDIT_EVENT"; details: { decision: AuditReview["decision"] | null } }
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
export type AuditCategory = AuditEvent["category"];
/** Mutable only inside one reducer call, filled at the original clinical decision branch. */
export type AuditDecision = Pick<AuditBase, "outcome" | "reasonCode"> & {
  targets?: OverrideDetails["targets"];
  overrideFactRecorded?: boolean;
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
export const reviewDecision = (value: unknown) => enumValue(["reviewed", "follow-up-required"] as const, value);

export function classifyAuditEvent(event: WardFlowEvent): AuditCategory | null {
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
    case "CORRECT_LEGAL_FORM_RECEIPT":
      return "legal-form";
    case "FLAG_BED_RELEASE":
    case "CONFIRM_BED_RELEASE":
    case "REVERT_BED_RELEASE":
    case "BLOCK_BED_RELEASE":
    case "CLEAR_BED_RELEASE_BLOCK":
    case "SET_BED_PREPARATION":
    case "RELEASE_BED":
    case "RECORD_LEAVING":
    case "RECORD_ADMISSION_FOLLOW_UP":
    case "RECORD_PATIENT_DISCHARGE":
      return "discharge";
    case "OPEN_DISCHARGE_RECORD":
      return "record-access";
    case "REVIEW_AUDIT_EVENT":
      return "review";
    case "SET_CONFIGURATION":
      return "configuration";
    default:
      return null;
  }
}

export function auditActor(state: WardFlowState, event: WardFlowEvent): AuditActor {
  const role = enumValue(Object.keys(WARD_FLOW_ROLE_LABELS) as WardFlowRole[], event.role);
  return {
    role,
    actingUnitId:
      role === "ward" && "actingUnitId" in event ? (uniqueRecord(state.units, event.actingUnitId)?.id ?? null) : null,
    attribution: "declared-prototype-role",
  };
}
function patientReference(state: WardFlowState, id: unknown): PatientId | null {
  return uniqueRecord(state.patients, id)?.id ?? null;
}
export function auditSubject(state: WardFlowState, event: WardFlowEvent): AuditSubject {
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
        patientId: patientReference(state, uniqueRecord(state.referrals, movement.referralId)?.patientId),
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
    const entry = uniqueRecord(state.auditEvents, event.eventId);
    if (entry) return { kind: "audit-event", eventId: entry.id };
  } else if (event.type === "SET_CONFIGURATION") {
    return { kind: "configuration" };
  }
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
    case "RELEASE_BED":
      return { action: event.type };
    default:
      return null;
  }
}
export function appendAudit(
  before: WardFlowState,
  after: WardFlowState,
  event: WardFlowEvent,
  decision: AuditDecision,
): WardFlowState {
  if (!classifyAuditEvent(event)) return after;
  // The wrapper reserves this sequence before any clinical write. Never wrap/reuse an ID.
  if (!safeCounter(after.auditSequence) || after.auditSequence >= Number.MAX_SAFE_INTEGER) return before;
  const sequence = after.auditSequence + 1;
  // Role/time refusal precedence is independent of whether this command can name the current world.
  // An earlier winning refusal must never make a stale command resolve a replacement subject.
  const mayResolveSubject =
    event.type === "OPEN_DISCHARGE_RECORD" ||
    event.type === "REVIEW_AUDIT_EVENT" ||
    event.type === "RECORD_PATIENT_DISCHARGE" ||
    event.type === "RECORD_ADMISSION_FOLLOW_UP"
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
        patientId: patientReference(after, uniqueRecord(after.referrals, created.referralId)?.patientId),
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
          operation: priorDueAt !== undefined ? "extension-recorded" : "expiry-recorded",
          dueAt: finiteInstant(event.dueAt),
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
    case "RELEASE_BED": {
      const requested = bedRequest(event);
      if (!requested) return after;
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
      return after;
  }
  return { ...after, auditSequence: sequence, auditEvents: [...after.auditEvents, structuredClone(captured)] };
}

export function readAuditEvents(state: WardFlowState, actor: WardRecordActor): RecordRead<readonly AuditEvent[]> {
  return validRecordActor(actor) && actor.role === "coordinator"
    ? { status: "allowed", value: structuredClone(state.auditEvents) }
    : { status: "denied" };
}
export function readAuditReviews(state: WardFlowState, actor: WardRecordActor): RecordRead<readonly AuditReview[]> {
  return validRecordActor(actor) && actor.role === "coordinator"
    ? { status: "allowed", value: structuredClone(state.auditReviews) }
    : { status: "denied" };
}
