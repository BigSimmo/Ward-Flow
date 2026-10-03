import type { Admission } from "./ward-admissions";
import type { Patient } from "./ward-patients";
import type { WardFlowState } from "./ward-flow-reducer";

export type WardRecordActor =
  { role: "coordinator" } | { role: "ward"; actingUnitId: string } | { role: "ed" | "officer" | "community" | "demo" };
export type RecordRead<T> = { status: "allowed"; value: T } | { status: "denied" };
export type DischargeOpenHandle = Readonly<{ generation: number; requestId: number }>;
export type DischargeIdentity =
  | { kind: "linked"; patient: Pick<Patient, "id" | "givenName" | "familyName" | "umrn"> }
  | { kind: "legacy-anonymous" }
  | { kind: "unresolved-link" };
export type DischargeRecord = Readonly<
  {
    id: string;
    generation: number;
    revision: number;
    admissionId: string;
    unitId: string;
    identity: DischargeIdentity;
    admissionState: Admission["state"];
  } & Pick<
    Admission,
    | "expectedDischargeAt"
    | "dischargeConfirmedAt"
    | "dischargeDateSetAt"
    | "dischargeDateSetBy"
    | "dischargeConfirmedBy"
    | "blockReason"
    | "leftAt"
    | "leavingDestination"
    | "followUp"
  >
>;

export const safeCounter = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Exact ID and unique subject only; no fallback to names, array position or UMRN. */
export function uniqueRecord<T extends { id: string }>(records: readonly T[], id: unknown): T | undefined {
  if (typeof id !== "string" || !id) return undefined;
  const matches = records.filter((record) => record.id === id);
  return matches.length === 1 ? matches[0] : undefined;
}

export function validRecordActor(actor: unknown): actor is WardRecordActor {
  if (!actor || typeof actor !== "object" || !("role" in actor)) return false;
  const keys = Object.keys(actor).sort();
  if (actor.role === "ward")
    return (
      keys.join() === "actingUnitId,role" &&
      "actingUnitId" in actor &&
      typeof actor.actingUnitId === "string" &&
      actor.actingUnitId.length > 0
    );
  return keys.join() === "role" && ["coordinator", "ed", "officer", "community", "demo"].includes(String(actor.role));
}

export function dischargeIdentity(state: WardFlowState, admission: Admission): DischargeIdentity {
  if (admission.patientId === null) return { kind: "legacy-anonymous" };
  const patient = uniqueRecord(state.patients, admission.patientId);
  if (!patient) return { kind: "unresolved-link" };
  const { id, givenName, familyName, umrn } = patient;
  return { kind: "linked", patient: { id, givenName, familyName, umrn } };
}

function readableScope(state: WardFlowState, actor: WardRecordActor, unitId?: string): boolean {
  if (!validRecordActor(actor) || !safeCounter(state.worldGeneration)) return false;
  if (unitId !== undefined && !uniqueRecord(state.units, unitId)) return false;
  if (actor.role === "coordinator") return true;
  return (
    actor.role === "ward" &&
    !!uniqueRecord(state.units, actor.actingUnitId) &&
    (unitId === undefined || unitId === actor.actingUnitId)
  );
}

function project(state: WardFlowState, admission: Admission): DischargeRecord {
  return structuredClone({
    id: `discharge-${admission.id}`,
    generation: state.worldGeneration,
    revision: state.dischargeRevisions[admission.id] ?? 0,
    admissionId: admission.id,
    unitId: admission.unitId,
    identity: dischargeIdentity(state, admission),
    admissionState: admission.state,
    expectedDischargeAt: admission.expectedDischargeAt,
    dischargeConfirmedAt: admission.dischargeConfirmedAt,
    dischargeDateSetAt: admission.dischargeDateSetAt,
    dischargeDateSetBy: admission.dischargeDateSetBy,
    dischargeConfirmedBy: admission.dischargeConfirmedBy,
    blockReason: admission.blockReason,
    leftAt: admission.leftAt,
    leavingDestination: admission.leavingDestination,
    followUp: admission.followUp,
  });
}

/** Plumbing only. Screens receive these through the provider's guarded methods. */
export function selectDischargeRecord(
  state: WardFlowState,
  actor: WardRecordActor,
  admissionId: string,
): RecordRead<DischargeRecord> {
  if (!readableScope(state, actor)) return { status: "denied" };
  const admission = uniqueRecord(state.admissions, admissionId);
  if (
    !admission ||
    !readableScope(state, actor, admission.unitId) ||
    !safeCounter(state.dischargeRevisions[admission.id] ?? 0)
  )
    return { status: "denied" };
  return { status: "allowed", value: project(state, admission) };
}

export function selectDischargeRecords(
  state: WardFlowState,
  actor: WardRecordActor,
  unitId?: string,
): RecordRead<readonly DischargeRecord[]> {
  if (!readableScope(state, actor, unitId)) return { status: "denied" };
  const scopedUnit = unitId ?? (actor.role === "ward" ? actor.actingUnitId : undefined);
  const value: DischargeRecord[] = [];
  for (const admission of state.admissions) {
    if (scopedUnit !== undefined && admission.unitId !== scopedUnit) continue;
    if (admission.expectedDischargeAt === null && admission.dischargeConfirmedAt === null && admission.leftAt === null)
      continue;
    const result = selectDischargeRecord(state, actor, admission.id);
    if (result.status === "allowed") value.push(result.value);
  }
  return { status: "allowed", value };
}

export function readOpenedDischargeRecord(
  state: WardFlowState,
  actor: WardRecordActor,
  admissionId: string,
  handle: DischargeOpenHandle | null,
): RecordRead<DischargeRecord> {
  if (
    !handle ||
    !safeCounter(handle.generation) ||
    !safeCounter(handle.requestId) ||
    handle.generation !== state.worldGeneration ||
    !validRecordActor(actor)
  )
    return { status: "denied" };
  const receipt = state.auditEvents.find(
    (entry) =>
      entry.category === "record-access" &&
      entry.generation === handle.generation &&
      entry.details.requestId === handle.requestId,
  );
  if (
    !receipt ||
    receipt.outcome !== "accepted" ||
    receipt.subject.kind !== "admission" ||
    receipt.subject.admissionId !== admissionId ||
    receipt.actor.role !== actor.role ||
    receipt.actor.actingUnitId !== (actor.role === "ward" ? actor.actingUnitId : null)
  )
    return { status: "denied" };
  const result = selectDischargeRecord(state, actor, admissionId);
  if (result.status === "denied") return result;
  const identity = result.value.identity;
  if (
    identity.kind === "unresolved-link" ||
    receipt.subject.patientId !== (identity.kind === "linked" ? identity.patient.id : null)
  )
    return { status: "denied" };
  return result;
}
