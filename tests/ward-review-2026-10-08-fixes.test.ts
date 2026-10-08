/**
 * Regression tests for the P1 findings of the 8 October 2026 review
 * (`docs/ward-flow/audit-2026-10-08-issue-list.md`). Each case replays the reported scenario
 * from the standard seed and asserts the corrected behaviour.
 */
import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";

const now = 642;
type WithoutNow<T> = T extends unknown ? Omit<T, "now"> : never;
type TestEvent = WithoutNow<WardFlowEvent>;

function harness(initial: WardFlowState = seedWardFlowState()) {
  let state = initial;
  let t = now;
  const send = (event: TestEvent | Record<string, unknown>): string | null => {
    const before = state.rejections.length;
    state = wardFlowReducer(state, { now: t++, ...event } as WardFlowEvent);
    return state.rejections.length === before ? null : state.rejections.at(-1)!.reason;
  };
  const ok = (event: TestEvent | Record<string, unknown>) => {
    const refusal = send(event);
    if (refusal) throw new Error(`${(event as { type: string }).type} refused: ${refusal}`);
  };
  return {
    get state() {
      return state;
    },
    set state(next: WardFlowState) {
      state = next;
    },
    send,
    ok,
  };
}
type Harness = ReturnType<typeof harness>;

const draft = {
  cohort: "Adult",
  security: "Open",
  sex: "Female",
  gender: "Female",
  specialling: false,
  highAcuity: false,
  legalStatus: "Voluntary",
  urgency: 2,
  legalFormCode: null,
} as const;

function admittedPatient(h: Harness, umrn: string, unitId = "scgh-adult-open") {
  h.ok({
    type: "ADD_PATIENT",
    role: "coordinator",
    umrn,
    givenName: "Demo",
    familyName: "Review",
    dateOfBirth: "1980-01-01",
  });
  const patient = h.state.patients.at(-1)!;
  h.ok({ type: "RAISE_REFERRAL", role: "ed", edId: "jhc-ed", patientId: patient.id, draft });
  const inbound = h.state.movements.at(-1)!;
  h.ok({ type: "REFER_TO_UNITS", role: "coordinator", movementId: inbound.id, unitIds: [unitId] });
  h.ok({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId: inbound.id, unitId });
  h.ok({ type: "PULL_PATIENT", role: "ward", movementId: inbound.id, unitId });
  h.ok({ type: "RECORD_TRANSPORT_NEED", role: "ward", movementId: inbound.id, needed: false });
  h.ok({ type: "PATIENT_ARRIVED", role: "ward", movementId: inbound.id, actingUnitId: unitId });
  const admission = h.state.admissions.find((a) => a.movementId === inbound.id)!;
  expect(admission.state).toBe("occupied");
  return { patient, admission };
}

/** A repatriation from `admissionId` taken all the way to a collected patient on the road. */
function collectedRepatriation(h: Harness, admissionId: string, sendingUnitId: string, dest = "rph-adult-secure") {
  h.ok({
    type: "RECORD_REPATRIATION",
    role: "coordinator",
    admissionId,
    homeHospital: "RPH",
    receivingWardAgreed: true,
    mode: "road",
    provider: "Ambulance service",
    cadNumber: "SYN-CAD-FIX",
    transportLegalStatus: "voluntary",
    estimatedAt: 700,
  });
  const movement = h.state.movements.at(-1)!;
  h.ok({ type: "REFER_TO_UNITS", role: "coordinator", movementId: movement.id, unitIds: [dest] });
  h.ok({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId: movement.id, unitId: dest });
  h.ok({ type: "PULL_PATIENT", role: "ward", movementId: movement.id, unitId: dest });
  h.ok({
    type: "BOOK_TRANSPORT",
    role: "ward",
    actingUnitId: sendingUnitId,
    movementId: movement.id,
    provider: "Ambulance service",
    escortRequired: false,
    cadNumber: "CAD-FIX-0001",
    transportLegalStatus: "voluntary",
    estimatedAt: 0,
  });
  h.ok({ type: "HANDOVER_READY", role: "ed", movementId: movement.id });
  h.ok({ type: "TRANSPORT_ACCEPTED", role: "officer", movementId: movement.id });
  h.ok({ type: "TRANSPORT_EN_ROUTE", role: "officer", movementId: movement.id });
  h.ok({ type: "PATIENT_COLLECTED", role: "officer", movementId: movement.id });
  return movement;
}

describe("S1-1: discharge is refused while an outbound journey is on the road", () => {
  it("refuses RECORD_PATIENT_DISCHARGE and still lets the journey arrive", () => {
    const h = harness();
    const { patient, admission } = admittedPatient(h, "SYN-FIX-001");
    const movement = collectedRepatriation(h, admission.id, admission.unitId);
    const refusal = h.send({
      type: "RECORD_PATIENT_DISCHARGE",
      role: "ward",
      actingUnitId: admission.unitId,
      admissionId: admission.id,
      patientId: patient.id,
      expectedGeneration: h.state.worldGeneration,
      expectedRevision: h.state.dischargeRevisions[admission.id] ?? 0,
      leavingDestination: "discharged-to-the-community",
    });
    expect(refusal).toMatch(/in transit/);
    expect(h.state.admissions.find((a) => a.id === admission.id)?.state).toBe("occupied");
    h.ok({ type: "PATIENT_ARRIVED", role: "ward", movementId: movement.id, actingUnitId: "rph-adult-secure" });
    expect(h.state.movements.find((m) => m.id === movement.id)?.closure?.outcome).toBe("arrived");
  });

  it("refuses RECORD_LEAVING the same way", () => {
    const h = harness();
    const { admission } = admittedPatient(h, "SYN-FIX-002");
    const movement = collectedRepatriation(h, admission.id, admission.unitId);
    const refusal = h.send({
      type: "RECORD_LEAVING",
      role: "ward",
      admissionId: admission.id,
      actingUnitId: admission.unitId,
      leavingDestination: "discharged-to-the-community",
    });
    expect(refusal).toMatch(new RegExp(`in transit \\(movement ${movement.id}\\)`));
  });

  it("still allows an ordinary discharge with no journey on the road", () => {
    const h = harness();
    const { admission } = admittedPatient(h, "SYN-FIX-003");
    h.ok({
      type: "RECORD_LEAVING",
      role: "ward",
      admissionId: admission.id,
      actingUnitId: admission.unitId,
      leavingDestination: "discharged-to-the-community",
    });
    expect(h.state.admissions.find((a) => a.id === admission.id)?.state).toBe("departed");
  });
});
