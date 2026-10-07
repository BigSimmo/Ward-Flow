import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { CareChange } from "@/components/ward-management/ward-care-journey";
import { resolvePatientNowRecord } from "@/components/ward-management/patients/patient-now-adapter";
import { buildScenarioFile, readScenarioFile } from "@/components/ward-management/ward-flow-scenario-file";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
const now = 642;
function fixture() {
  let state = seedWardFlowState();
  const send = (event: Omit<WardFlowEvent, "now">) => {
    state = wardFlowReducer(state, { now, ...event } as WardFlowEvent);
  };
  send({
    type: "ADD_PATIENT",
    role: "coordinator",
    umrn: "SYN-AUDIT-001",
    givenName: "Demo",
    familyName: "Audit",
    dateOfBirth: "1980-01-01",
  } as Omit<WardFlowEvent, "now">);
  const patient = state.patients.at(-1)!;
  const raise = () => {
    send({
      type: "RAISE_REFERRAL",
      role: "ed",
      edId: "jhc-ed",
      patientId: patient.id,
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        gender: "Female",
        specialling: false,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
    } as Omit<WardFlowEvent, "now">);
    return state.movements.at(-1)!;
  };
  const pull = (id: string, unitId: string) => {
    for (const event of [
      { type: "REFER_TO_UNITS", role: "coordinator", movementId: id, unitIds: [unitId] },
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId: id, unitId },
      { type: "PULL_PATIENT", role: "ward", movementId: id, unitId },
    ])
      send(event as Omit<WardFlowEvent, "now">);
  };
  const arrive = (id: string, unitId: string) => {
    send({ type: "RECORD_TRANSPORT_NEED", role: "ward", movementId: id, actingUnitId: unitId, needed: false } as Omit<
      WardFlowEvent,
      "now"
    >);
    send({ type: "PATIENT_ARRIVED", role: "ward", movementId: id, actingUnitId: unitId } as Omit<WardFlowEvent, "now">);
  };
  const movement = raise();
  pull(movement.id, "scgh-adult-open");
  const admission = state.admissions.find((a) => a.movementId === movement.id)!;
  const care = (admissionId: string, change: CareChange) => {
    send({
      type: "RECORD_ADMISSION_CARE",
      role: "coordinator",
      admissionId,
      patientId: patient.id,
      expectedGeneration: state.worldGeneration,
      expectedRevision: state.dischargeRevisions[admissionId] ?? 0,
      change,
    } as Omit<WardFlowEvent, "now">);
  };
  const repatriate = () => {
    arrive(movement.id, "scgh-adult-open");
    send({
      type: "RECORD_REPATRIATION",
      role: "coordinator",
      admissionId: admission.id,
      homeHospital: "RPH",
      receivingWardAgreed: true,
      mode: "road",
      provider: "Ambulance service",
      cadNumber: "SYN-CAD-AUDIT",
      transportLegalStatus: "voluntary",
      estimatedAt: 700,
    } as Omit<WardFlowEvent, "now">);
    return state.movements.at(-1)!;
  };
  return {
    get state() {
      return state;
    },
    patient,
    movement,
    admission,
    send,
    raise,
    pull,
    arrive,
    care,
    repatriate,
  };
}
describe("audit core state regressions", () => {
  it("reopens repatriation without deleting the occupied source or refunding an unreserved bed", () => {
    const f = fixture();
    const m = f.repatriate();
    f.send({ type: "REFER_TO_UNITS", role: "coordinator", movementId: m.id, unitIds: ["rph-adult-secure"] } as Omit<
      WardFlowEvent,
      "now"
    >);
    f.send({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId: m.id, unitId: "rph-adult-secure" } as Omit<
      WardFlowEvent,
      "now"
    >);
    const beds = f.state.units.find((u) => u.id === "rph-adult-secure")!.allocatable.value;
    f.send({
      type: "RELEASE_AND_REOPEN_SEARCH",
      role: "coordinator",
      movementId: m.id,
      reason: "ward_withdrew_the_bed",
    } as Omit<WardFlowEvent, "now">);
    expect(f.state.admissions.find((a) => a.id === f.admission.id)?.state).toBe("occupied");
    expect(f.state.units.find((u) => u.id === "rph-adult-secure")!.allocatable.value).toBe(beds);
  });
  it("reserves a destination for repatriation and ends the source stay only on arrival", () => {
    const f = fixture();
    const m = f.repatriate();
    f.pull(m.id, "rph-adult-secure");
    expect(f.state.rejections).toEqual([]);
    expect(f.state.admissions.find((a) => a.id === f.admission.id)?.state).toBe("occupied");
    f.arrive(m.id, "rph-adult-secure");
    expect(f.state.rejections).toEqual([]);
    expect(f.state.admissions.filter((a) => a.patientId === f.patient.id && a.state === "occupied")).toHaveLength(1);
    expect(f.state.admissions.find((a) => a.id === f.admission.id)?.state).toBe("departed");
  });
  it("refuses another ordinary bed reservation for a patient already holding a bed", () => {
    const f = fixture();
    const second = f.raise();
    f.pull(second.id, "rph-adult-secure");
    expect(f.state.rejections.at(-1)?.attempted).toBe("PULL_PATIENT");
    expect(f.state.admissions.filter((a) => a.patientId === f.patient.id && a.state !== "departed")).toHaveLength(1);
  });
  it("balances ward counts after correcting gender before arrival", () => {
    const f = fixture();
    const mix = f.state.units.find((u) => u.id === "scgh-adult-open")!.sexMix;
    f.send({ type: "RECORD_MOVEMENT_GENDER", role: "coordinator", movementId: f.movement.id, gender: "Male" } as Omit<
      WardFlowEvent,
      "now"
    >);
    f.arrive(f.movement.id, "scgh-adult-open");
    f.send({
      type: "RECORD_PATIENT_DISCHARGE",
      role: "ward",
      admissionId: f.admission.id,
      actingUnitId: "scgh-adult-open",
      patientId: f.patient.id,
      expectedGeneration: f.state.worldGeneration,
      expectedRevision: f.state.dischargeRevisions[f.admission.id] ?? 0,
      leavingDestination: "discharged-to-the-community",
    } as Omit<WardFlowEvent, "now">);
    expect(f.state.rejections).toEqual([]);
    expect(f.state.units.find((u) => u.id === "scgh-adult-open")!.sexMix).toEqual(mix);
  });
  it("allows a second transfer and resolves the patient's current stay", () => {
    const f = fixture();
    f.arrive(f.movement.id, "scgh-adult-open");
    for (const step of ["accepted", "handover", "arrived"] as const)
      f.care(f.admission.id, { kind: "transfer", receivingUnitId: "rph-adult-secure", step });
    const received = f.state.admissions.at(-1)!;
    const resolved = resolvePatientNowRecord(
      f.patient.id,
      f.state.patients,
      f.state.movements,
      f.state.referrals,
      f.state.admissions,
      f.state.units,
      now,
    );
    expect(resolved?.liveAdmission?.id).toBe(received.id);
    expect(resolved?.liveMovement?.acceptedUnitId).toBe(received.unitId);
    f.care(received.id, { kind: "transfer", receivingUnitId: "scgh-adult-open", step: "accepted" });
    expect(f.state.rejections).toEqual([]);
  });
  it("round-trips a valid care transport through the scenario boundary", () => {
    let state: WardFlowState = seedWardFlowState();
    const admission = state.admissions.find((a) => a.state === "occupied" && a.patientId)!;
    state = wardFlowReducer(state, {
      type: "RECORD_ADMISSION_CARE",
      role: "coordinator",
      now,
      admissionId: admission.id,
      patientId: admission.patientId!,
      expectedGeneration: state.worldGeneration,
      expectedRevision: 0,
      change: {
        kind: "transport",
        mode: "taxi",
        region: "metro",
        riskDocument: true,
        authority: "none",
        escortSuitable: true,
        leastRestrictiveReviewed: true,
        regionalServiceConfirmed: true,
      },
    });
    expect(state.rejections).toEqual([]);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
    const file = buildScenarioFile(state, now, 5, new Date("2026-10-07"));
    expect(file.ok).toBe(true);
    if (file.ok) expect(readScenarioFile(file.json, 5).ok).toBe(true);
  });
  it.each([{}, null, [{ id: "bad" }]])("rejects malformed broadcast collections: %j", (alerts) => {
    const file = buildScenarioFile(seedWardFlowState(), now, 5, new Date("2026-10-07"));
    expect(file.ok).toBe(true);
    if (!file.ok) return;
    const payload = JSON.parse(file.json);
    payload.state.broadcastAlerts = alerts;
    expect(readScenarioFile(JSON.stringify(payload), 5).ok).toBe(false);
  });
});
