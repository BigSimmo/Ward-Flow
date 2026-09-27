import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import {
  selectDischargeRecord,
  selectDischargeRecords,
  readOpenedDischargeRecord,
  type WardRecordActor,
} from "@/components/ward-management/ward-discharge-records";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const coordinator = { role: "coordinator" } as const;
function fixture() {
  const state = seedWardFlowState();
  const admission = state.admissions.find((row) => row.patientId !== null && row.state === "occupied");
  if (!admission) throw new Error("Linked occupied admission fixture required");
  admission.expectedDischargeAt = NOW_ANCHOR + 30;
  return { state, admission, actor: { role: "ward", actingUnitId: admission.unitId } as const };
}

describe("guarded discharge projection", () => {
  it("allows coordinator network and ward own scope, without exposing other episodes", () => {
    const { state, admission, actor } = fixture();
    const network = selectDischargeRecords(state, coordinator);
    const ward = selectDischargeRecords(state, actor);
    expect(network.status).toBe("allowed");
    expect(ward.status).toBe("allowed");
    if (ward.status !== "allowed") throw new Error("Own ward denied");
    expect(ward.value.length).toBeGreaterThan(0);
    expect(ward.value.every((row) => row.unitId === admission.unitId)).toBe(true);
    const record = selectDischargeRecord(state, actor, admission.id);
    if (record.status !== "allowed") throw new Error("Own record denied");
    expect(record.value.id).toBe(`discharge-${admission.id}`);
    expect(record.value.revision).toBe(0);
    expect(record.value.generation).toBe(0);
    expect(record.value.identity.kind).toBe("linked");
    if (record.value.identity.kind === "linked")
      expect(Object.keys(record.value.identity.patient).sort()).toEqual(["familyName", "givenName", "id", "umrn"]);
    expect(record.value).not.toHaveProperty("referralId");
  });

  it.each([
    { role: "ed" },
    { role: "officer" },
    { role: "community" },
    { role: "demo" },
    { role: "unknown" },
    { role: "ward" },
    { role: "ward", actingUnitId: "absent" },
    { role: "coordinator", actingUnitId: "extra" },
    null,
  ])("denies malformed or excluded actor %j with no metadata", (actor) => {
    const { state, admission } = fixture();
    expect(selectDischargeRecords(state, actor as WardRecordActor)).toEqual({ status: "denied" });
    expect(selectDischargeRecord(state, actor as WardRecordActor, admission.id)).toEqual({ status: "denied" });
  });

  it("denies cross-ward filters and details and unknown coordinator filters", () => {
    const { state, admission, actor } = fixture();
    const other = state.units.find((unit) => unit.id !== admission.unitId)!;
    expect(selectDischargeRecords(state, actor, other.id)).toEqual({ status: "denied" });
    expect(selectDischargeRecord(state, { role: "ward", actingUnitId: other.id }, admission.id)).toEqual({
      status: "denied",
    });
    expect(selectDischargeRecords(state, coordinator, "absent")).toEqual({ status: "denied" });
  });

  it("keeps null anonymous and broken or duplicate links unresolved; never substitutes a similar person", () => {
    const { state, admission } = fixture();
    const identity = () => {
      const result = selectDischargeRecord(state, coordinator, admission.id);
      if (result.status !== "allowed") throw new Error("Projection denied");
      return result.value.identity;
    };
    const patient = state.patients.find((person) => person.id === admission.patientId)!;
    state.patients.push({ ...patient, id: "PT-SIMILAR" });
    expect(identity()).toMatchObject({ kind: "linked", patient: { id: patient.id } });
    state.patients.push({ ...patient });
    expect(identity()).toEqual({ kind: "unresolved-link" });
    admission.patientId = "PT-NOT-PRESENT";
    expect(identity()).toEqual({ kind: "unresolved-link" });
    admission.patientId = null;
    expect(identity()).toEqual({ kind: "legacy-anonymous" });
  });

  it.each(["admission", "unit"])("omits ambiguous %s subjects without a hidden count", (duplicate) => {
    const { state, admission } = fixture();
    if (duplicate === "admission") state.admissions.push({ ...admission });
    else state.units.push({ ...state.units.find((unit) => unit.id === admission.unitId)! });
    expect(selectDischargeRecord(state, coordinator, admission.id)).toEqual({ status: "denied" });
    const list = selectDischargeRecords(state, coordinator);
    if (list.status !== "allowed") throw new Error("Network denied");
    expect(list.value.some((row) => row.admissionId === admission.id)).toBe(false);
    expect(Object.keys(list).sort()).toEqual(["status", "value"]);
  });

  it("preserves confirmed-undated records and excludes admissions without discharge facts", () => {
    const { state, admission } = fixture();
    admission.expectedDischargeAt = null;
    admission.dischargeConfirmedAt = NOW_ANCHOR;
    const list = selectDischargeRecords(state, coordinator);
    if (list.status !== "allowed") throw new Error("Network denied");
    expect(list.value.find((row) => row.admissionId === admission.id)?.expectedDischargeAt).toBeNull();
    admission.dischargeConfirmedAt = null;
    const empty = selectDischargeRecords(state, coordinator);
    if (empty.status !== "allowed") throw new Error("Network denied");
    expect(empty.value.some((row) => row.admissionId === admission.id)).toBe(false);
  });
});

describe("deliberate discharge-open receipts", () => {
  it("requires a matching processed receipt, and exact replay is idempotent", () => {
    const { state, admission, actor } = fixture();
    const handle = { generation: 0, requestId: 7 };
    const event = {
      type: "OPEN_DISCHARGE_RECORD",
      ...actor,
      now: NOW_ANCHOR,
      admissionId: admission.id,
      expectedGeneration: 0,
      requestId: 7,
    } as const;
    expect(readOpenedDischargeRecord(state, actor, admission.id, handle)).toEqual({ status: "denied" });
    const opened = wardFlowReducer(state, event);
    expect(readOpenedDischargeRecord(opened, actor, admission.id, handle).status).toBe("allowed");
    expect(wardFlowReducer(opened, event)).toBe(opened);
    expect(readOpenedDischargeRecord(opened, coordinator, admission.id, handle)).toEqual({ status: "denied" });
    expect(readOpenedDischargeRecord(opened, actor, "other", handle)).toEqual({ status: "denied" });
    const result = readOpenedDischargeRecord(opened, actor, admission.id, handle);
    if (result.status !== "allowed" || result.value.identity.kind !== "linked") throw new Error("Identity missing");
    result.value.identity.patient.givenName = "changed outside reducer";
    expect(state.patients.some((patient) => patient.givenName === "changed outside reducer")).toBe(false);
    opened.admissions.find((row) => row.id === admission.id)!.patientId = null;
    expect(readOpenedDischargeRecord(opened, actor, admission.id, handle)).toEqual({ status: "denied" });
  });

  it("cannot upgrade a denied request, or revalidate a pre-reset handle by reusing its ID", () => {
    const { state, admission, actor } = fixture();
    const event = {
      type: "OPEN_DISCHARGE_RECORD",
      ...actor,
      now: NOW_ANCHOR,
      admissionId: admission.id,
      expectedGeneration: 0,
      requestId: 2,
    } as const;
    const denied = wardFlowReducer(state, { ...event, role: "ed" });
    const retried = wardFlowReducer(denied, event);
    expect(retried.auditEvents.map((row) => row.outcome)).toEqual(["denied", "denied"]);
    const opened = wardFlowReducer(state, event);
    const reset = wardFlowReducer(opened, { type: "RESET_SCENARIO", role: "demo", now: NOW_ANCHOR });
    const reopened = wardFlowReducer(reset, { ...event, expectedGeneration: 1 });
    expect(readOpenedDischargeRecord(reopened, actor, admission.id, { generation: 0, requestId: 2 })).toEqual({
      status: "denied",
    });
    expect(readOpenedDischargeRecord(reopened, actor, admission.id, { generation: 1, requestId: 2 }).status).toBe(
      "allowed",
    );
    const stale = wardFlowReducer(reopened, event);
    expect(stale.auditEvents.at(-1)).toMatchObject({
      outcome: "stale",
      reasonCode: "generation",
      subject: { kind: "unresolved" },
    });
  });
});
