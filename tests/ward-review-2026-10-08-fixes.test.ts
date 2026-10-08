/**
 * Regression tests for the P1 findings of the 8 October 2026 review
 * (`docs/ward-flow/audit-2026-10-08-issue-list.md`). Each case replays the reported scenario
 * from the standard seed and asserts the corrected behaviour.
 */
import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { DIVERSION_REASONS, TRANSPORT_WHEREABOUTS } from "@/components/ward-management/ward-change-reasons";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
import { DISCHARGE_BARRIERS } from "@/components/ward-management/ward-admissions";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";

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

describe("S2-1: a seeded journey with no admission record can still release its bed", () => {
  const SEEDED = "WF-006"; // hand-authored to `moving`, collected, no admissionId

  it("releases a diverted seeded journey once, refunding the bed and closing it", () => {
    const h = harness();
    const seeded = h.state.movements.find((m) => m.id === SEEDED)!;
    expect(seeded.admissionId).toBeUndefined();
    const unitId = seeded.acceptedUnitId!;
    const before = h.state.units.find((u) => u.id === unitId)!.allocatable.value;
    h.ok({
      type: "RECORD_DIVERSION",
      role: "officer",
      movementId: SEEDED,
      reason: DIVERSION_REASONS[0],
      place: TRANSPORT_WHEREABOUTS[1],
    });
    h.ok({ type: "RELEASE_DIVERTED_BED", role: "coordinator", movementId: SEEDED });
    expect(h.state.movements.find((m) => m.id === SEEDED)?.closure?.outcome).toBe("did_not_proceed");
    expect(h.state.units.find((u) => u.id === unitId)!.allocatable.value).toBe(before + 1);
    expect(h.send({ type: "RELEASE_DIVERTED_BED", role: "coordinator", movementId: SEEDED })).toMatch(/holds no bed/);
    expect(h.state.units.find((u) => u.id === unitId)!.allocatable.value).toBe(before + 1);
  });

  it("releases a stopped seeded journey once, refunding the bed", () => {
    const h = harness();
    const unitId = h.state.movements.find((m) => m.id === SEEDED)!.acceptedUnitId!;
    const before = h.state.units.find((u) => u.id === unitId)!.allocatable.value;
    h.ok({
      type: "STOP_TRANSPORT",
      role: "coordinator",
      movementId: SEEDED,
      reason: "The referral was withdrawn",
      whereabouts: TRANSPORT_WHEREABOUTS[1],
    });
    h.ok({ type: "RELEASE_HELD_BED", role: "coordinator", movementId: SEEDED });
    expect(h.state.units.find((u) => u.id === unitId)!.allocatable.value).toBe(before + 1);
    expect(h.send({ type: "RELEASE_HELD_BED", role: "coordinator", movementId: SEEDED })).toMatch(/holds no bed/);
    expect(h.state.units.find((u) => u.id === unitId)!.allocatable.value).toBe(before + 1);
  });
});

describe("S1-2: a journey raised from a referral must be for that referral's patient", () => {
  function referralFor(h: Harness, umrn: string) {
    h.ok({
      type: "ADD_PATIENT",
      role: "coordinator",
      umrn,
      givenName: "Demo",
      familyName: "Referred",
      dateOfBirth: "1981-01-01",
    });
    const patient = h.state.patients.at(-1)!;
    h.ok({
      type: "RECEIVE_REFERRAL",
      role: "community",
      patientId: patient.id,
      ageBand: "Adult",
      destinations: [{ kind: "emergency_department", edId: "jhc-ed", purpose: "psychiatric_review" }],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    });
    return { patient, referral: h.state.referrals.at(-1)! };
  }

  it("refuses a different patient", () => {
    const h = harness();
    const { referral } = referralFor(h, "SYN-FIX-010");
    h.ok({
      type: "ADD_PATIENT",
      role: "coordinator",
      umrn: "SYN-FIX-011",
      givenName: "Demo",
      familyName: "Other",
      dateOfBirth: "1982-01-01",
    });
    const other = h.state.patients.at(-1)!;
    const before = h.state.movements.length;
    const refusal = h.send({
      type: "RAISE_REFERRAL",
      role: "ed",
      edId: "jhc-ed",
      referralId: referral.id,
      patientId: other.id,
      draft,
    });
    expect(refusal).toMatch(/is for patient/);
    expect(h.state.movements).toHaveLength(before);
  });

  it("accepts the referral's own patient, named or not", () => {
    const named = harness();
    const a = referralFor(named, "SYN-FIX-012");
    named.ok({
      type: "RAISE_REFERRAL",
      role: "ed",
      edId: "jhc-ed",
      referralId: a.referral.id,
      patientId: a.patient.id,
      draft,
    });
    expect(named.state.movements.at(-1)?.patientId).toBe(a.patient.id);

    const unnamed = harness();
    const b = referralFor(unnamed, "SYN-FIX-013");
    unnamed.ok({ type: "RAISE_REFERRAL", role: "ed", edId: "jhc-ed", referralId: b.referral.id, draft });
    expect(unnamed.state.movements.at(-1)?.patientId).toBe(b.patient.id);
  });
});

describe("S2-12 / A2-2: a discharge barrier is a list value, never typed text", () => {
  const LONG_STAY = "AD-RPHS-01"; // seeded occupied stay of more than 7 days

  it("refuses free text and keeps the list values working", () => {
    const h = harness();
    const refusal = h.send({
      type: "SET_DISCHARGE_BARRIER",
      role: "coordinator",
      admissionId: LONG_STAY,
      barrier: "housing - lives with mum at 12 X St",
    });
    expect(refusal).toMatch(/DISCHARGE_BARRIERS/);
    expect(h.state.admissions.find((a) => a.id === LONG_STAY)?.dischargeBarrier ?? null).toBeNull();
    h.ok({
      type: "SET_DISCHARGE_BARRIER",
      role: "coordinator",
      admissionId: LONG_STAY,
      barrier: DISCHARGE_BARRIERS[0],
    });
    expect(h.state.admissions.find((a) => a.id === LONG_STAY)?.dischargeBarrier).toBe(DISCHARGE_BARRIERS[0]);
  });

  it("refuses to restore stored state carrying a free-text barrier", () => {
    const seeded = JSON.parse(JSON.stringify(seedWardFlowState())) as WardFlowState;
    expect(isValidStoredWardFlowState(seeded)).toBe(true);
    const tampered = {
      ...seeded,
      admissions: seeded.admissions.map((a) => (a.id === LONG_STAY ? { ...a, dischargeBarrier: "typed note" } : a)),
    };
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(tampered)))).toBe(false);
  });
});
