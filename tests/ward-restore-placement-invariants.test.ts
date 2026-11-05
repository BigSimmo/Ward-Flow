import { describe, expect, it } from "vitest";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  isValidStoredWardFlowState,
  WARD_FLOW_STORED_STATE_VERSION,
} from "@/components/ward-management/ward-flow-storage-validation";
import { buildScenarioFile, readScenarioFile } from "@/components/ward-management/ward-flow-scenario-file";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";

const valid = (state: WardFlowState) => {
  const built = buildScenarioFile(
    seedWardFlowState(),
    NOW_ANCHOR + 1440,
    WARD_FLOW_STORED_STATE_VERSION,
    new Date("2026-11-04T00:00:00Z"),
  );
  expect(built.ok).toBe(true);
  if (!built.ok) throw new Error(built.reason);
  const envelope = JSON.parse(built.json);
  envelope.state = state;
  const restored = readScenarioFile(JSON.stringify(envelope), WARD_FLOW_STORED_STATE_VERSION);
  const verdict = isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)));
  expect(restored.ok).toBe(verdict);
  return verdict;
};
const seed = () => {
  const state = structuredClone(seedWardFlowState());
  expect(valid(state)).toBe(true);
  return state;
};

function movementReservation() {
  const state = seed();
  const movement = structuredClone(state.movements[0]);
  movement.id = "WF-SYNTHETIC-RESERVED";
  for (const key of ["referralId", "admissionId", "closure", "sourceAdmissionId", "referralSourceAdmissionId"] as const)
    delete movement[key];
  movement.stage = "accepted_awaiting_bed";
  movement.acceptedUnitId = state.units[0].id;
  movement.referredUnitIds = [state.units[0].id];
  movement.heldBedNumber = 1;
  state.movements.push(movement);
  expect(valid(state)).toBe(true);
  return { state, movement };
}

function addReferralReservation(state: WardFlowState, unitId: string) {
  const template = state.referrals.find((row) =>
    row.destinations.some((arm) => arm.destination.kind === "psychiatric_ward"),
  )!;
  const referral = structuredClone(template);
  referral.id = "RF-SYNTHETIC-RESERVED";
  delete referral.patientId;
  const arm = structuredClone(referral.destinations.find((row) => row.destination.kind === "psychiatric_ward")!);
  arm.state = "accepted";
  arm.acceptedUnitId = unitId;
  arm.heldBedNumber = 1;
  referral.destinations = [arm];
  state.referrals.push(referral);
  return referral;
}

describe("restore placement invariants", () => {
  it.each(WARD_SCENARIOS)("keeps scenario %s restorable", (scenario) => {
    expect(valid(seedWardFlowState(scenario))).toBe(true);
  });

  it("refuses a stay simultaneously on leave and away at ED", () => {
    const state = seed();
    const leave = state.leaveBeds[0];
    state.admissions.find((row) => row.id === leave.admissionId)!.awayAtEmergencyDepartmentSince = leave.confirmedAt;
    expect(valid(state)).toBe(false);
  });

  it("keeps a departed stay's historical ED-away timestamp", () => {
    const state = seed();
    const stay = state.admissions.find((row) => row.state === "departed")!;
    expect(stay).toBeDefined();
    stay.awayAtEmergencyDepartmentSince = 10;
    expect(valid(state)).toBe(true);
  });

  it("refuses unrelated active stays for one patient", () => {
    const state = seed();
    const occupied = state.admissions.filter(
      (row) => row.state === "occupied" && row.movementId === null && row.patientId !== null,
    );
    expect(occupied.length).toBeGreaterThan(1);
    occupied[1].patientId = occupied[0].patientId;
    expect(valid(state)).toBe(false);
  });

  it("refuses two active admissions claiming the same numbered bed", () => {
    const state = seed();
    const first = state.admissions.find((row) => row.state === "occupied")!;
    const second = state.admissions.find(
      (row) => row.id !== first.id && row.unitId === first.unitId && row.state === "occupied",
    )!;
    expect(second).toBeDefined();
    first.bedNumber = 1;
    second.bedNumber = 1;
    expect(valid(state)).toBe(false);
  });

  it("allows departed bed history beside a current numbered occupant", () => {
    const state = seed();
    const first = state.admissions.find((row) => row.state === "occupied")!;
    first.bedNumber = 1;
    const departed = structuredClone(first);
    departed.id = "AD-SYNTHETIC-HISTORY";
    departed.state = "departed";
    departed.movementId = null;
    departed.referralId = null;
    state.admissions.push(departed);
    expect(valid(state)).toBe(true);
  });

  it("refuses unrelated numbered movement reservations for the same bed", () => {
    const { state, movement } = movementReservation();
    state.movements.push({ ...structuredClone(movement), id: "WF-SYNTHETIC-OTHER" });
    expect(valid(state)).toBe(false);
  });

  it("allows different numbered movement reservations", () => {
    const { state, movement } = movementReservation();
    state.movements.push({ ...structuredClone(movement), id: "WF-SYNTHETIC-OTHER", heldBedNumber: 2 });
    expect(valid(state)).toBe(true);
  });

  it("refuses a movement reservation colliding with another active admission", () => {
    const { state, movement } = movementReservation();
    const stay = state.admissions.find((row) => row.unitId === movement.acceptedUnitId && row.state === "occupied")!;
    stay.bedNumber = 1;
    expect(valid(state)).toBe(false);
  });

  it("counts a linked numbered movement and admission as one owner", () => {
    const { state, movement } = movementReservation();
    const stay = structuredClone(state.admissions.find((row) => row.state === "occupied")!);
    stay.id = "AD-SYNTHETIC-RESERVED";
    stay.patientId = null;
    delete movement.patientId;
    stay.unitId = movement.acceptedUnitId!;
    stay.state = "pulled";
    stay.movementId = movement.id;
    stay.referralId = null;
    stay.bedNumber = 1;
    stay.awayAtEmergencyDepartmentSince = null;
    movement.stage = "pulled";
    movement.admissionId = stay.id;
    state.admissions.push(stay);
    expect(valid(state)).toBe(true);
  });

  it("refuses an independent referral reservation colliding with a movement", () => {
    const { state, movement } = movementReservation();
    addReferralReservation(state, movement.acceptedUnitId!);
    expect(valid(state)).toBe(false);
  });

  it("counts a linked referral and movement reservation once", () => {
    const { state, movement } = movementReservation();
    const referral = addReferralReservation(state, movement.acceptedUnitId!);
    movement.referralId = referral.id;
    expect(valid(state)).toBe(true);
  });
});
