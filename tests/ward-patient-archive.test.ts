// #816 (Josh, 26 Oct 2026: archive only, coordinator only): a patient record added in error can
// leave every list, but only by the coordinator and only while nothing else names the record.
import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { GENERAL_OBSERVATION } from "@/components/ward-management/ward-observation";
import { validSharedCommand } from "../backend/ward-flow/command-schemas";

const now = 642;
type WithoutNow<T> = T extends unknown ? Omit<T, "now"> : never;

function withNewPatient() {
  let state: WardFlowState = seedWardFlowState();
  const send = (event: WithoutNow<WardFlowEvent>) => {
    state = wardFlowReducer(state, { now, ...event } as WardFlowEvent);
    return state;
  };
  send({
    type: "ADD_PATIENT",
    role: "coordinator",
    umrn: "SYN-ARCHIVE-001",
    givenName: "Demo",
    familyName: "Archive",
    dateOfBirth: "1980-01-01",
  });
  const patient = state.patients.at(-1)!;
  return {
    send,
    patient,
    get state() {
      return state;
    },
  };
}

describe("ARCHIVE_PATIENT", () => {
  it("lets the coordinator archive a record nothing else names", () => {
    const world = withNewPatient();
    const before = world.state.patients.length;
    world.send({ type: "ARCHIVE_PATIENT", role: "coordinator", patientId: world.patient.id, reason: "test" });
    expect(world.state.patients).toHaveLength(before - 1);
    expect(world.state.patients.some((patient) => patient.id === world.patient.id)).toBe(false);
    // The id is never reused.
    world.send({
      type: "ADD_PATIENT",
      role: "coordinator",
      umrn: "SYN-ARCHIVE-002",
      givenName: "Demo",
      familyName: "Second",
      dateOfBirth: "1981-01-01",
    });
    expect(world.state.patients.at(-1)!.id).not.toBe(world.patient.id);
  });

  it("refuses every other desk", () => {
    const world = withNewPatient();
    world.send({ type: "ARCHIVE_PATIENT", role: "ward", patientId: world.patient.id, reason: "test" } as never);
    expect(world.state.patients.some((patient) => patient.id === world.patient.id)).toBe(true);
  });

  it("refuses a record with care recorded against it", () => {
    const world = withNewPatient();
    world.send({
      type: "RAISE_REFERRAL",
      role: "ed",
      edId: "jhc-ed",
      patientId: world.patient.id,
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        gender: "Female",
        observation: GENERAL_OBSERVATION,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
    });
    world.send({ type: "ARCHIVE_PATIENT", role: "coordinator", patientId: world.patient.id, reason: "duplicate" });
    expect(world.state.patients.some((patient) => patient.id === world.patient.id)).toBe(true);
    expect(world.state.rejections.at(-1)?.reason).toMatch(/care recorded against them/);
  });

  it("refuses a reason off the list, here and on the server", () => {
    const world = withNewPatient();
    const bad = { type: "ARCHIVE_PATIENT", role: "coordinator", patientId: world.patient.id, reason: "because" };
    world.send(bad as never);
    expect(world.state.patients.some((patient) => patient.id === world.patient.id)).toBe(true);
    expect(validSharedCommand({ ...bad, now })).toBe(false);
    expect(validSharedCommand({ ...bad, now, reason: "test" })).toBe(true);
    expect(validSharedCommand({ ...bad, now, reason: "test", role: "ed" })).toBe(false);
  });
});
