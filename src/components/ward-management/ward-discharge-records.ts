import type { AuditEvent } from "./ward-audit";
import { admissionBelongsToTeam, communityTeamById } from "./community/community-derivations";
import type { Admission } from "./ward-admissions";
import { criteriaEligibility, communityDischargeCriteria, type CriteriaEligibility } from "./ward-discharge-criteria";
import type { Movement } from "./ward-model";
import { activeCommunityTreatmentOrder, type Patient } from "./ward-patients";
import type { WardFlowState } from "./ward-flow-reducer";

export type WardRecordActor =
  | { role: "coordinator" }
  | { role: "ward"; actingUnitId: string }
  | { role: "community"; actingTeamId?: string }
  | { role: "ed" | "officer" | "demo" };
export type RecordRead<T> = { status: "allowed"; value: T } | { status: "denied" };
export type DischargeOpenHandle = Readonly<{ generation: number; requestId: number; requestNamespace?: string }>;
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
    /** D-64: whether criteria led discharge may be used, read the same way as the ward's criteria card. */
    criteriaEligibility: CriteriaEligibility;
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
    | "careJourney"
    | "dischargeCriteria"
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
  if (actor.role === "community" && "actingTeamId" in actor)
    return (
      keys.join() === "actingTeamId,role" &&
      typeof actor.actingTeamId === "string" &&
      !!communityTeamById(actor.actingTeamId)
    );
  if (actor.role === "ward")
    return (
      keys.join() === "actingUnitId,role" &&
      "actingUnitId" in actor &&
      typeof actor.actingUnitId === "string" &&
      actor.actingUnitId.length > 0
    );
  return keys.join() === "role" && ["coordinator", "ed", "officer", "community", "demo"].includes(String(actor.role));
}

/** Earlier saves retain the authoritative status on the converted booking rather than the stay. */
export function plannedAdmissionLegalStatus(
  state: Partial<Pick<WardFlowState, "plannedAdmissions">>,
  admission: Admission,
): Admission["plannedLegalStatus"] {
  return (
    admission.plannedLegalStatus ??
    state.plannedAdmissions?.find((booking) => booking.state === "arrived" && booking.admissionId === admission.id)
      ?.legalStatus
  );
}

/**
 * Whether the stay's own legal record (its linked movement, else the converted booking) makes it
 * involuntary: anything recorded other than "Voluntary". No record is not involuntary here; the
 * patient record is checked separately by `patientRecordIsInvoluntary`.
 */
export function stayLegalStatusIsInvoluntary(
  state: Pick<WardFlowState, "movements"> & Partial<Pick<WardFlowState, "plannedAdmissions">>,
  admission: Admission,
  movement: Movement | undefined = dischargeMovement(state, admission),
): boolean {
  const status = movement?.legalStatus ?? plannedAdmissionLegalStatus(state, admission);
  return status !== undefined && status !== "Voluntary";
}

/** A previous stay must never decide this admission's discharge or transport state. */
export function dischargeMovement(
  state: Pick<WardFlowState, "movements"> & Partial<Pick<WardFlowState, "plannedAdmissions">>,
  admission: Admission,
): Movement | undefined {
  const plannedStatus = plannedAdmissionLegalStatus(state, admission);
  return (
    state.movements.find((movement) => movement.admissionId === admission.id) ??
    state.movements.find(
      (movement) =>
        plannedStatus === undefined &&
        admission.patientId !== null &&
        movement.patientId === admission.patientId &&
        movement.admissionId === undefined &&
        movement.closure === undefined,
    )
  );
}

/** The single legal-status lookup used by the ward card, the command reducer and the Discharges list. */
export function admissionCriteriaEligibility(
  state: Pick<WardFlowState, "movements" | "patients"> & Partial<Pick<WardFlowState, "plannedAdmissions">>,
  admission: Admission,
): CriteriaEligibility {
  const movement = dischargeMovement(state, admission);
  const patient = uniqueRecord(state.patients, admission.patientId);
  return criteriaEligibility(
    patient?.legalStatus,
    movement?.legalStatus ?? plannedAdmissionLegalStatus(state, admission),
    activeCommunityTreatmentOrder(patient) !== undefined,
  );
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
  if (actor.role === "community") return !!actor.actingTeamId && !!communityTeamById(actor.actingTeamId);
  return (
    actor.role === "ward" &&
    !!uniqueRecord(state.units, actor.actingUnitId) &&
    (unitId === undefined || unitId === actor.actingUnitId)
  );
}

/**
 * Typed patient specific criteria (D-65) stay with the ward and the coordinator. A community reader
 * sees each one only as a numbered placeholder, so the count and tick times still match the ward's.
 */
function criteriaFor(
  actor: WardRecordActor,
  record: Admission["dischargeCriteria"],
): DischargeRecord["dischargeCriteria"] {
  if (!record || actor.role !== "community") return record ?? null;
  return communityDischargeCriteria(record);
}

function project(state: WardFlowState, admission: Admission, actor: WardRecordActor): DischargeRecord {
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
    careJourney: admission.careJourney,
    // Fixed-list criteria, typed patient specific criteria (D-65) and times. A community reader gets
    // placeholders for the typed ones (criteriaFor).
    dischargeCriteria: criteriaFor(actor, admission.dischargeCriteria),
    criteriaEligibility: admissionCriteriaEligibility(state, admission),
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
  if (actor.role === "community") {
    const team = actor.actingTeamId ? communityTeamById(actor.actingTeamId) : undefined;
    if (!team || !admissionBelongsToTeam(admission, team, state.referrals)) return { status: "denied" };
  }
  return { status: "allowed", value: project(state, admission, actor) };
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

/** New clients namespace local counters; legacy absent namespaces retain their replay identity. */
export const validDischargeRequestNamespace = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** getRandomValues remains available for local HTTP device previews without randomUUID. */
export function newDischargeRequestNamespace(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isDischargeOpenReceipt(entry: AuditEvent, handle: DischargeOpenHandle): boolean {
  return (
    entry.category === "record-access" &&
    entry.generation === handle.generation &&
    entry.details.requestId === handle.requestId &&
    entry.details.requestNamespace === handle.requestNamespace
  );
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
    (handle.requestNamespace !== undefined && !validDischargeRequestNamespace(handle.requestNamespace)) ||
    handle.generation !== state.worldGeneration ||
    !validRecordActor(actor)
  )
    return { status: "denied" };
  const receipt = state.auditEvents.find((entry) => isDischargeOpenReceipt(entry, handle));
  if (
    !receipt ||
    receipt.outcome !== "accepted" ||
    receipt.subject.kind !== "admission" ||
    receipt.subject.admissionId !== admissionId ||
    receipt.actor.role !== actor.role ||
    (actor.role === "community" && receipt.actor.actingTeamId !== actor.actingTeamId) ||
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
