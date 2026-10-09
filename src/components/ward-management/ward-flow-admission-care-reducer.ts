import type { WardFlowState } from "./ward-flow-reducer";
import { appendAudit, type AuditDecision } from "./ward-audit";
import { uniqueRecord, selectDischargeRecord, safeCounter, type WardRecordActor } from "./ward-discharge-records";
import {
  validCareChange,
  careChangeRefusal,
  applyCareChange,
  emptyCareJourney,
  type CareJourney,
} from "./ward-care-journey";
import { WARD_FLOW_ROLE_LABELS, type WardFlowEvent } from "./ward-flow-events";
import { remainingSpeciallingCapacity, remainingHighAcuityCapacity, type Admission } from "./ward-admissions";
import { eligibility } from "./ward-eligibility";
import { openBedsFree, lockedBedsFree } from "./ward-bed-designation";
import type { Movement, Unit, MovementId } from "./ward-model";

export type RecordDenial = (
  reasonCode: AuditDecision["reasonCode"],
  outcome?: AuditDecision["outcome"],
  rejectionReason?: string,
) => WardFlowState;
export type AdmissionCareContext = {
  state: WardFlowState;
  event: Extract<WardFlowEvent, { type: "RECORD_ADMISSION_CARE" }>;
  admission: Admission;
  unit: Unit;
  actor: WardRecordActor;
  revision: number;
};
export type AdmissionCareOperations = {
  replaceAdmission: (state: WardFlowState, id: string, admission: Admission) => WardFlowState;
  dischargeMovement: (state: WardFlowState, admission: Admission) => Movement | undefined;
  patientRecordIsInvoluntary: (legalStatus: string | undefined) => boolean;
  arriveCareTransfer: (
    context: AdmissionCareContext,
    next: WardFlowState,
    journey: CareJourney,
    deny: RecordDenial,
  ) => WardFlowState;
};

type CareRefusal = AuditDecision & { rejectionReason?: string };

export function reduceAdmissionCare(
  context: AdmissionCareContext,
  operations: AdmissionCareOperations,
  deny: RecordDenial,
): WardFlowState {
  const { state, event, admission, actor, revision } = context;
  if (selectDischargeRecord(state, actor, admission.id).status === "denied") return deny("scope");
  if (!validCareChange(event.change)) return deny("invalid-payload");
  const refusal = careActorRefusal(context) ?? careTransitionRefusal(context, operations);
  if (refusal) return deny(refusal.reasonCode, refusal.outcome, refusal.rejectionReason);
  const careJourney = applyCareChange(
    admission.careJourney ?? emptyCareJourney(),
    event.change,
    event.now,
    WARD_FLOW_ROLE_LABELS[event.role],
  );
  let next = operations.replaceAdmission(state, admission.id, {
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
    next = operations.arriveCareTransfer(context, next, careJourney, deny);
    if (next.auditEvents !== state.auditEvents) return next;
  }
  return appendAudit(
    state,
    { ...next, dischargeRevisions: { ...next.dischargeRevisions, [admission.id]: revision + 1 } },
    event,
    { outcome: "accepted", reasonCode: "none" },
  );
}

function careActorRefusal(context: AdmissionCareContext): CareRefusal | undefined {
  const { event, admission } = context;
  if (event.role === "community" && !["follow_up", "contact", "plan", "document"].includes(event.change.kind))
    return { reasonCode: "role", outcome: "denied" };
  if (!careStateAllowsChange(admission, event.now)) return { reasonCode: "transition", outcome: "denied" };
  if (!communityChangeIsInScope(context)) return { reasonCode: "scope", outcome: "denied" };
  // D-30: only the central bed coordinator accepts an inter-ward transfer.
  if (event.change.kind === "transfer" && event.change.step === "accepted" && event.role !== "coordinator")
    return { reasonCode: "role", outcome: "denied" };
  return undefined;
}

function careStateAllowsChange(admission: Admission, now: WardFlowEvent["now"]): boolean {
  if (admission.state !== "occupied" && admission.state !== "departed") return false;
  return !(admission.arrivedAt !== null && now < admission.arrivedAt);
}

function communityChangeIsInScope({ event, admission }: AdmissionCareContext): boolean {
  if (event.role !== "community") return true;
  if (event.change.kind === "follow_up") return event.change.serviceId === event.actingTeamId;
  if (event.change.kind === "contact" && admission.careJourney?.followUp)
    return admission.careJourney.followUp.serviceId === event.actingTeamId;
  return true;
}

function careTransitionRefusal(
  context: AdmissionCareContext,
  operations: AdmissionCareOperations,
): CareRefusal | undefined {
  const { state, event, admission } = context;
  const refusal = careChangeRefusal(admission, event.change, event.now);
  if (refusal) return { reasonCode: "transition", outcome: "denied", rejectionReason: refusal };
  if (event.change.kind === "transfer" && !uniqueRecord(state.units, event.change.receivingUnitId))
    return { reasonCode: "missing-or-inaccessible", outcome: "denied" };
  const authorityRefusal =
    transportAuthorityRefusal(context, operations) ?? continuationAuthorityRefusal(context, operations);
  return authorityRefusal
    ? { reasonCode: "transition", outcome: "denied", rejectionReason: authorityRefusal }
    : undefined;
}

function transportAuthorityRefusal(
  { state, event, admission }: AdmissionCareContext,
  operations: AdmissionCareOperations,
): string | undefined {
  if (event.change.kind !== "transport" || event.change.authority !== "none") return undefined;
  if (!["ambulance", "service_vehicle", "police", "rfds"].includes(event.change.mode)) return undefined;
  const movement = operations.dischargeMovement(state, admission);
  const patient = uniqueRecord(state.patients, admission.patientId);
  if (operations.patientRecordIsInvoluntary(patient?.legalStatus) || (movement && movement.legalStatus !== "Voluntary"))
    return "Record the checked transport authority for this involuntary arrangement.";
  return undefined;
}

function continuationAuthorityRefusal(
  { state, event, admission }: AdmissionCareContext,
  operations: AdmissionCareOperations,
): string | undefined {
  if (event.change.kind !== "legal" || event.change.authority !== "5B") return undefined;
  const previous = priorCareAuthority(state, admission, operations);
  if (previous !== "5A" && previous !== "5B")
    return "A Form 5B continuation needs a recorded Form 5A or earlier Form 5B for this stay.";
  return undefined;
}

function priorCareAuthority(
  state: WardFlowState,
  admission: Admission,
  operations: AdmissionCareOperations,
): string | undefined {
  return admission.careJourney?.legal?.authority ?? operations.dischargeMovement(state, admission)?.legalForm?.code;
}

type CareTransfer = {
  receiving: Unit;
  movement: Movement;
  bedKind: "open" | "locked";
  id: string;
  movementId: MovementId;
};
export function prepareCareTransfer(
  context: AdmissionCareContext,
  operations: Pick<AdmissionCareOperations, "dischargeMovement">,
  deny: RecordDenial,
): CareTransfer | { denied: WardFlowState } {
  const { state, event, admission } = context;
  if (event.role !== "coordinator" || admission.state !== "occupied") return { denied: deny("role") };
  if (event.change.kind !== "transfer") throw new Error("Transfer preparation requires a transfer change");
  const receiving = uniqueRecord(state.units, event.change.receivingUnitId);
  const movement = operations.dischargeMovement(state, admission);
  if (!suitableTransferBed(receiving, movement, event.now))
    return {
      denied: deny(
        "transition",
        "denied",
        "The receiving ward must have a suitable available bed and a linked placement record.",
      ),
    };
  return prepareAvailableTransfer(context, { receiving: receiving!, movement: movement! }, deny);
}

function suitableTransferBed(
  receiving: Unit | undefined,
  movement: Movement | undefined,
  now: WardFlowEvent["now"],
): boolean {
  if (!receiving || !safeCounter(receiving.empty.value) || receiving.empty.value <= 0) return false;
  return !!movement && eligibility(movement, receiving, now).eligible;
}

function prepareAvailableTransfer(
  context: AdmissionCareContext,
  target: { receiving: Unit; movement: Movement },
  deny: RecordDenial,
): CareTransfer | { denied: WardFlowState } {
  const { state, admission, revision } = context;
  const { receiving, movement } = target;
  if (state.admissions.some((a) => anotherHeldAdmission(a, admission)))
    return { denied: deny("transition", "denied", "The patient already has another occupied or held bed.") };
  if (!transferStaffingAvailable(context, receiving))
    return { denied: deny("transition", "denied", "The receiving ward must have the required staffing capacity.") };
  const bedKind =
    movement.legalStatus === "Voluntary" && openBedsFree(receiving) > 0 ? ("open" as const) : ("locked" as const);
  if (bedKind === "locked" && lockedBedsFree(receiving) <= 0) return { denied: deny("transition") };
  const id = `transfer-${admission.id}-${revision + 1}`;
  const movementId: MovementId = `WF-${id}`;
  if (transferIdentityExists(state, id, movementId)) return { denied: deny("invalid-payload") };
  return { receiving, movement, bedKind, id, movementId };
}

function anotherHeldAdmission(candidate: Admission, admission: Admission): boolean {
  if (candidate.id === admission.id || candidate.patientId !== admission.patientId) return false;
  return candidate.state === "occupied" || candidate.state === "pulled";
}

function transferIdentityExists(state: WardFlowState, id: string, movementId: MovementId): boolean {
  return state.admissions.some((a) => a.id === id) || state.movements.some((m) => m.id === movementId);
}

export function transferredCareAdmission(
  { event, admission }: AdmissionCareContext,
  transfer: CareTransfer,
  careJourney: CareJourney,
): Admission {
  return {
    ...admission,
    id: transfer.id,
    unitId: transfer.receiving.id,
    movementId: transfer.movementId,
    state: "occupied",
    bedKind: transfer.bedKind,
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
  };
}

function transferStaffingAvailable({ state, admission }: AdmissionCareContext, receiving: Unit): boolean {
  if (admission.specialling && remainingSpeciallingCapacity(receiving, state.admissions) <= 0) return false;
  return !(admission.highAcuity && remainingHighAcuityCapacity(receiving, state.admissions) <= 0);
}
