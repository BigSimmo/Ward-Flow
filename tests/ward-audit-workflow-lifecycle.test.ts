import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { resolvePatientNowRecord } from "@/components/ward-management/patients/patient-now-adapter";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function journey() {
  let state = seedWardFlowState();
  const send = (event: WardFlowEvent) => {
    state = wardFlowReducer(state, event);
  };
  send({
    type: "ADD_PATIENT",
    role: "coordinator",
    now: NOW_ANCHOR,
    umrn: "SYN-WORKFLOW-AUDIT",
    givenName: "Synthetic",
    familyName: "Journey",
    dateOfBirth: "1980-01-01",
  });
  const patient = state.patients.at(-1)!;
  send({
    type: "RAISE_REFERRAL",
    role: "ed",
    now: NOW_ANCHOR,
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
  });
  const movement = state.movements.at(-1)!;
  const resolve = (id: string) =>
    resolvePatientNowRecord(
      id,
      state.patients,
      state.movements,
      state.referrals,
      state.admissions,
      state.units,
      NOW_ANCHOR,
    )!;
  const accept = () => {
    send({
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: movement.id,
      unitIds: ["scgh-adult-open"],
    });
    send({
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: movement.id,
      unitId: "scgh-adult-open",
    });
    send({ type: "PULL_PATIENT", role: "ward", now: NOW_ANCHOR, movementId: movement.id, unitId: "scgh-adult-open" });
  };
  return {
    get state() {
      return state;
    },
    send,
    resolve,
    accept,
    patient,
    movement,
  };
}

describe("patient and movement routes share lifecycle truth", () => {
  it("both report departure after an actual arrival and discharge", () => {
    const f = journey();
    f.accept();
    f.send({ type: "RECORD_TRANSPORT_NEED", role: "ward", now: NOW_ANCHOR, movementId: f.movement.id, needed: false });
    f.send({
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: f.movement.id,
      actingUnitId: "scgh-adult-open",
    });
    const admission = f.state.admissions.find((a) => a.movementId === f.movement.id)!;
    f.send({
      type: "RECORD_PATIENT_DISCHARGE",
      role: "ward",
      now: NOW_ANCHOR,
      admissionId: admission.id,
      actingUnitId: admission.unitId,
      patientId: f.patient.id,
      expectedGeneration: f.state.worldGeneration,
      expectedRevision: f.state.dischargeRevisions[admission.id] ?? 0,
      leavingDestination: "discharged-to-the-community",
    });
    expect(f.state.rejections).toHaveLength(0);
    for (const id of [f.patient.id, f.movement.id]) {
      const record = f.resolve(id).record;
      expect(record.verdict.short).toBe("Departed");
      expect(record.next[0].w).toBe("Departure recorded");
      expect(record.presentations[0].current).toBe(false);
      expect(record.presentations[0].outcome).toBe("Departure recorded; no current ward stay.");
    }
  });
  it.each([false, true])("withdrawal closes both routes before/after acceptance (%s)", (accepted) => {
    const f = journey();
    if (accepted) f.accept();
    else
      f.send({
        type: "REFER_TO_UNITS",
        role: "coordinator",
        now: NOW_ANCHOR,
        movementId: f.movement.id,
        unitIds: ["scgh-adult-open"],
      });
    f.send({ type: "WITHDRAW_REFERRAL", role: "ed", now: NOW_ANCHOR, movementId: f.movement.id });
    expect(f.state.rejections).toHaveLength(0);
    const closure = f.state.movements.find((m) => m.id === f.movement.id)!.closure!;
    for (const id of [f.patient.id, f.movement.id]) {
      const record = f.resolve(id).record;
      expect(record.verdict.short).toBe("Movement Closed");
      expect(record.verdict.title).toBe(closure.reason);
      expect(record.next[0].w).toBe("Movement Closed");
      expect(record.presentations[0].current).toBe(false);
      expect(record.presentations[0].outcome).toBe(closure.reason);
    }
  });
});
