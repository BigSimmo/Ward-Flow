import type { WardFlowState } from "./ward-flow-reducer";
import { EVENT_ROLE, WARD_FLOW_ROLE_LABELS, type WardFlowEvent } from "./ward-flow-events";
import { appendAudit, finiteInstant, reviewDecision, type AuditDecision } from "./ward-audit";
import {
  dischargeIdentity,
  readOpenedDischargeRecord,
  safeCounter,
  selectDischargeRecord,
  uniqueRecord,
  validRecordActor,
  type WardRecordActor,
} from "./ward-discharge-records";
import { isLeavingDestination, isFollowUpState, type Admission, type LeavingDestination } from "./ward-admissions";
import { recordedCommunityTransition } from "./ward-care-journey";
import {
  reduceAdmissionCare,
  type AdmissionCareOperations,
  type RecordDenial,
} from "./ward-flow-admission-care-reducer";
import type { Instant } from "./ward-clock";
import type { Unit, Movement } from "./ward-model";

type ProtectedRecordOperations = AdmissionCareOperations & {
  departAdmission: (
    state: WardFlowState,
    admission: Admission,
    unit: Unit,
    now: Instant,
    destination: LeavingDestination,
  ) => WardFlowState;
};

type ProtectedRecordEvent = Extract<
  WardFlowEvent,
  {
    type:
      | "OPEN_DISCHARGE_RECORD"
      | "REVIEW_AUDIT_EVENT"
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
              reason: rejectionReason,
            },
          ],
        };
  return appendAudit(state, rejected, event, decision);
}

export function reduceProtectedRecordEvent(
  state: WardFlowState,
  event: ProtectedRecordEvent,
  operations: ProtectedRecordOperations,
): WardFlowState {
  const deny: RecordDenial = (reasonCode, outcome = "denied", rejectionReason) =>
    protectedRefusal(state, event, { outcome, reasonCode }, rejectionReason);
  // Role is inspected before any protected payload or legacy rejection helper.
  if (!EVENT_ROLE[event.type].includes(event.role)) return deny("role");
  if (finiteInstant(event.now) === null || !safeCounter(event.expectedGeneration)) return deny("invalid-payload");
  if (event.expectedGeneration !== state.worldGeneration) return deny("generation", "stale");
  if (event.type === "REVIEW_AUDIT_EVENT") return reviewAuditRecord(state, event, deny);
  return reduceScopedRecord(state, event, { operations, deny });
}
type MutationHandler = { operations: ProtectedRecordOperations; deny: RecordDenial };
function reduceScopedRecord(
  state: WardFlowState,
  event: Exclude<ProtectedRecordEvent, { type: "REVIEW_AUDIT_EVENT" }>,
  handler: MutationHandler,
): WardFlowState {
  const { operations, deny } = handler;
  const actor = recordActor(event);
  if (!validRecordActor(actor)) return deny("scope");
  if (event.type === "OPEN_DISCHARGE_RECORD") return openDischargeRecord(state, event, actor, deny);
  const context = admissionContext(state, event, deny);
  if ("denied" in context) return context.denied;
  if (event.type === "RECORD_ADMISSION_CARE")
    return reduceAdmissionCare({ state, event, actor, ...context }, operations, deny);
  if (event.type === "RECORD_ADMISSION_FOLLOW_UP") return recordFollowUp(state, event, context, handler);
  return recordDischarge(state, event, context, handler);
}

function recordActor(event: Exclude<ProtectedRecordEvent, { type: "REVIEW_AUDIT_EVENT" }>): WardRecordActor {
  return (
    "actingUnitId" in event
      ? { role: event.role, actingUnitId: event.actingUnitId }
      : "actingTeamId" in event
        ? { role: event.role, actingTeamId: event.actingTeamId }
        : { role: event.role }
  ) as WardRecordActor;
}

function reviewAuditRecord(
  state: WardFlowState,
  event: Extract<ProtectedRecordEvent, { type: "REVIEW_AUDIT_EVENT" }>,
  deny: RecordDenial,
): WardFlowState {
  if (!safeCounter(event.expectedReviewCount) || !reviewDecision(event.decision)) return deny("invalid-payload");
  const entry = uniqueRecord(state.auditEvents, event.eventId);
  if (!reviewableEntry(entry, state.worldGeneration)) return deny("missing-or-inaccessible");
  const count = state.auditReviews.filter(
    (review) => review.eventId === entry!.id && review.generation === state.worldGeneration,
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
          eventId: entry!.id,
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

function openDischargeRecord(
  state: WardFlowState,
  event: Extract<ProtectedRecordEvent, { type: "OPEN_DISCHARGE_RECORD" }>,
  actor: WardRecordActor,
  deny: RecordDenial,
): WardFlowState {
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

type MutationEvent = Exclude<ProtectedRecordEvent, { type: "REVIEW_AUDIT_EVENT" | "OPEN_DISCHARGE_RECORD" }>;
type MutationContext = { admission: Admission; unit: Unit; revision: number };
function admissionContext(
  state: WardFlowState,
  event: MutationEvent,
  deny: RecordDenial,
): MutationContext | { denied: WardFlowState } {
  if (!safeCounter(event.expectedRevision)) return { denied: deny("invalid-payload") };
  const admission = uniqueRecord(state.admissions, event.admissionId);
  const unit = uniqueRecord(state.units, mutationUnitId(event, admission));
  if (!unit || !admission || !uniqueRecord(state.units, admission.unitId))
    return { denied: deny("missing-or-inaccessible") };
  if (admission.unitId !== unit.id) return { denied: deny("scope") };
  return linkedAdmissionContext(state, event, { admission, unit }, deny);
}

function linkedAdmissionContext(
  state: WardFlowState,
  event: MutationEvent,
  context: Omit<MutationContext, "revision">,
  deny: RecordDenial,
): MutationContext | { denied: WardFlowState } {
  const { admission, unit } = context;
  const identity = dischargeIdentity(state, admission);
  if (identity.kind !== "linked" || identity.patient.id !== event.patientId) return { denied: deny("identity-link") };
  const revision = state.dischargeRevisions[admission.id] ?? 0;
  if (!safeCounter(revision) || revision >= Number.MAX_SAFE_INTEGER) return { denied: deny("invalid-payload") };
  if (revision !== event.expectedRevision) return { denied: deny("revision", "stale") };
  return { admission, unit, revision };
}

function mutationUnitId(event: MutationEvent, admission: Admission | undefined): string | undefined {
  if (event.type === "RECORD_PATIENT_DISCHARGE") return event.actingUnitId;
  if (event.role === "coordinator" || event.role === "community") return admission?.unitId;
  return event.actingUnitId;
}

function reviewableEntry(entry: WardFlowState["auditEvents"][number] | undefined, generation: number): boolean {
  return !!entry && entry.generation === generation && entry.category !== "review";
}

function recordFollowUp(
  state: WardFlowState,
  event: Extract<MutationEvent, { type: "RECORD_ADMISSION_FOLLOW_UP" }>,
  context: MutationContext,
  handler: MutationHandler,
): WardFlowState {
  const { admission, revision } = context;
  const { operations, deny } = handler;
  if (typeof event.followUpState !== "string" || !isFollowUpState(event.followUpState)) return deny("invalid-payload");
  if (
    (admission.state !== "occupied" && admission.state !== "departed") ||
    admission.leavingDestination === "died-on-the-ward"
  )
    return deny("transition");
  if (admission.arrivedAt !== null && event.now < admission.arrivedAt) return deny("invalid-payload");
  const next = operations.replaceAdmission(state, admission.id, {
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
function recordDischarge(
  state: WardFlowState,
  event: Extract<MutationEvent, { type: "RECORD_PATIENT_DISCHARGE" }>,
  context: MutationContext,
  handler: MutationHandler,
): WardFlowState {
  const { admission, unit } = context;
  const { operations, deny } = handler;
  if (!isLeavingDestination(event.leavingDestination)) return deny("invalid-payload");
  if (admission.state !== "occupied") return deny("transition");
  if (admission.arrivedAt !== null && event.now < admission.arrivedAt) return deny("invalid-payload");

  const linkedMovement = operations.dischargeMovement(state, admission);
  const refusal = communityDepartureRefusal(state, event, { admission, linkedMovement }, operations);
  if (refusal) return deny("transition", "denied", refusal);
  // Discharge blocked while in transit
  if (dischargeIsInTransit(linkedMovement)) {
    return deny("transition", "denied", "Patient is currently in transit to another facility.");
  }
  return appendAudit(
    state,
    operations.departAdmission(state, admission, unit, event.now, event.leavingDestination),
    event,
    {
      outcome: "accepted",
      reasonCode: "none",
    },
  );
}

function communityDepartureRefusal(
  state: WardFlowState,
  event: Extract<MutationEvent, { type: "RECORD_PATIENT_DISCHARGE" }>,
  context: { admission: Admission; linkedMovement: Movement | undefined },
  operations: ProtectedRecordOperations,
): string | undefined {
  const { admission, linkedMovement } = context;
  // Involuntary patient discharge boundary (WA Mental Health Act 2014)
  const fullPatient = uniqueRecord(state.patients, event.patientId);

  if (!involuntaryDischarge(fullPatient?.legalStatus, linkedMovement, operations)) return undefined;
  if (event.leavingDestination !== "discharged-to-the-community" && event.leavingDestination !== "left-against-advice")
    return undefined;
  if (!recordedCommunityTransition(admission, linkedMovement?.statusChanges.at(-1)?.at, event.leavingDestination))
    return "Cannot discharge an involuntary patient without an explicit revocation order or recorded community treatment order transition.";
  return undefined;
}

function involuntaryDischarge(
  legalStatus: string | undefined,
  movement: Movement | undefined,
  operations: ProtectedRecordOperations,
): boolean {
  return (
    operations.patientRecordIsInvoluntary(legalStatus) ||
    (movement?.legalStatus !== undefined && movement.legalStatus !== "Voluntary")
  );
}

function dischargeIsInTransit(movement: Movement | undefined): boolean {
  if (!movement) return false;
  if (movement.stage === "moving") return true;
  return (
    movement.transport?.collectedAt !== undefined &&
    movement.transport.arrivedAt === undefined &&
    movement.transport.cancelledAt === undefined
  );
}
