import { describe, expect, it } from "vitest";

import { DIVERSION_REASONS, TRANSPORT_WHEREABOUTS } from "../src/components/ward-management/ward-change-reasons";
import {
  STAGE_TRANSITION_BLOCKERS,
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

/**
 * Build plan item 29 (T4a, 2026-09-17) / R2-7 / OA-29: a collected journey may be diverted; the
 * bed stays held until the coordinator, the accepting ward or the referring ED releases it.
 */

function movement(state: WardFlowState, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

function anOpenReferralWithCapacity(state: WardFlowState) {
  const found = state.movements.find(
    (candidate) =>
      candidate.referredUnitIds.length > 0 &&
      !candidate.acceptedUnitId &&
      !candidate.closure &&
      (state.units.find((unit) => unit.id === candidate.referredUnitIds[0])?.allocatable.value ?? 0) > 0,
  );
  if (!found) throw new Error("the seed contains no live, unaccepted referral at a unit with room to pull");
  return found;
}

function collected(state: WardFlowState) {
  const open = anOpenReferralWithCapacity(state);
  const unitId = open.referredUnitIds[0]!;
  const accepted = wardFlowReducer(state, {
    type: "ACCEPT_IN_PRINCIPLE",
    role: "ward",
    now: NOW,
    movementId: open.id,
    unitId,
    overrideReason: "The bed information is known to be out of date",
  });
  expect(accepted.rejections).toHaveLength(0);
  const pulled = wardFlowReducer(accepted, {
    type: "PULL_PATIENT",
    role: "ward",
    now: NOW + 1,
    movementId: open.id,
    unitId,
  });
  expect(pulled.rejections).toHaveLength(0);
  const booked = wardFlowReducer(pulled, {
    type: "BOOK_TRANSPORT",
    role: "ed",
    now: NOW + 2,
    movementId: open.id,
    provider: "Ambulance service",
    escortRequired: false,
    cadNumber: "CAD-DIV-0001",
    transportLegalStatus: "voluntary",
    estimatedAt: 0,
  });
  expect(booked.rejections).toHaveLength(0);
  const ready = wardFlowReducer(booked, { type: "HANDOVER_READY", role: "ed", now: NOW + 3, movementId: open.id });
  expect(ready.rejections).toHaveLength(0);
  const transportAccepted = wardFlowReducer(ready, {
    type: "TRANSPORT_ACCEPTED",
    role: "officer",
    now: NOW + 4,
    movementId: open.id,
  });
  expect(transportAccepted.rejections).toHaveLength(0);
  const enRoute = wardFlowReducer(transportAccepted, {
    type: "TRANSPORT_EN_ROUTE",
    role: "officer",
    now: NOW + 5,
    movementId: open.id,
  });
  expect(enRoute.rejections).toHaveLength(0);
  const patientCollected = wardFlowReducer(enRoute, {
    type: "PATIENT_COLLECTED",
    role: "officer",
    now: NOW + 6,
    movementId: open.id,
  });
  expect(patientCollected.rejections).toHaveLength(0);
  return { state: patientCollected, movementId: open.id, unitId };
}

function divert(state: WardFlowState, movementId: string, role: "officer" | "coordinator" = "officer") {
  return wardFlowReducer(state, {
    type: "RECORD_DIVERSION",
    role,
    now: NOW + 7,
    movementId,
    reason: DIVERSION_REASONS[0],
    place: TRANSPORT_WHEREABOUTS[1],
  });
}

describe("RECORD_DIVERSION — build plan item 29 / R2-7", () => {
  describe.each(["officer", "coordinator"] as const)("%s records a diversion", (role) => {
    it("keeps the bed and admission, leaves the movement open, notifies ward and ED", () => {
      const { state: patientCollected, movementId, unitId } = collected(seedWardFlowState());
      const unitBefore = patientCollected.units.find((candidate) => candidate.id === unitId)!;
      const admissionsBefore = patientCollected.admissions.length;
      const admissionIdBefore = movement(patientCollected, movementId).admissionId;

      const diverted = divert(patientCollected, movementId, role);
      expect(diverted.rejections, `${role} was refused: ${diverted.rejections.at(-1)?.reason}`).toHaveLength(0);

      const after = movement(diverted, movementId);
      const unitAfter = diverted.units.find((candidate) => candidate.id === unitId)!;
      expect(unitAfter.allocatable.value).toBe(unitBefore.allocatable.value);
      expect(diverted.admissions.length).toBe(admissionsBefore);
      expect(after.admissionId).toBe(admissionIdBefore);
      expect(after.closure).toBeUndefined();
      expect(after.blocker).toBe(STAGE_TRANSITION_BLOCKERS.divertedAwaitingRelease);
      expect(after.transport?.diversion).toEqual({
        at: NOW + 7,
        by: role,
        place: TRANSPORT_WHEREABOUTS[1],
        reason: DIVERSION_REASONS[0],
      });

      const wardNotice = diverted.notices.find((candidate) => candidate.kind === "diversion_recorded_ward");
      expect(wardNotice, "no notice reached the receiving ward").toBeDefined();
      expect(wardNotice?.to).toEqual({ role: "ward", placeId: unitId });

      const edNotice = diverted.notices.find((candidate) => candidate.kind === "diversion_recorded_ed");
      expect(edNotice, "no notice reached the referring ED").toBeDefined();
      expect(edNotice?.to.role).toBe("ed");
    });
  });

  it("refuses before collection", () => {
    const open = anOpenReferralWithCapacity(seedWardFlowState());
    const unitId = open.referredUnitIds[0]!;
    let state = seedWardFlowState();
    state = wardFlowReducer(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW,
      movementId: open.id,
      unitId,
      overrideReason: "The bed information is known to be out of date",
    });
    expect(state.rejections).toHaveLength(0);
    state = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW + 1,
      movementId: open.id,
      unitId,
    });
    expect(state.rejections).toHaveLength(0);
    state = wardFlowReducer(state, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: NOW + 2,
      movementId: open.id,
      provider: "Ambulance service",
      escortRequired: false,
      cadNumber: "CAD-DIV-PRE",
      transportLegalStatus: "voluntary",
      estimatedAt: 0,
    });
    expect(state.rejections).toHaveLength(0);
    const next = wardFlowReducer(state, {
      type: "RECORD_DIVERSION",
      role: "officer",
      now: NOW + 3,
      movementId: open.id,
      reason: DIVERSION_REASONS[0],
      place: TRANSPORT_WHEREABOUTS[0],
    });
    expect(next.rejections.at(-1)?.reason).toMatch(/not been collected/i);
  });

  it("refuses after arrival", () => {
    const { state: patientCollected, movementId } = collected(seedWardFlowState());
    const arrived = wardFlowReducer(patientCollected, {
      type: "PATIENT_ARRIVED",
      role: "officer",
      now: NOW + 7,
      movementId,
    });
    expect(arrived.rejections).toHaveLength(0);
    const next = divert(arrived, movementId);
    expect(next.rejections.at(-1)?.reason).toMatch(/already arrived|closed/i);
  });

  it("refuses when already diverted", () => {
    const { state: patientCollected, movementId } = collected(seedWardFlowState());
    const diverted = divert(patientCollected, movementId);
    expect(diverted.rejections).toHaveLength(0);
    const again = divert(diverted, movementId);
    expect(again.rejections.at(-1)?.reason).toMatch(/already diverted/i);
  });

  it("refuses an unlisted reason", () => {
    const { state: patientCollected, movementId } = collected(seedWardFlowState());
    const next = wardFlowReducer(patientCollected, {
      type: "RECORD_DIVERSION",
      role: "officer",
      now: NOW + 7,
      movementId,
      reason: "the patient improved" as (typeof DIVERSION_REASONS)[number],
      place: TRANSPORT_WHEREABOUTS[0],
    });
    expect(next.rejections.at(-1)?.reason).toMatch(/DIVERSION_REASONS/);
  });

  it("refuses a ward caller by role", () => {
    const { state: patientCollected, movementId } = collected(seedWardFlowState());
    const next = wardFlowReducer(patientCollected, {
      type: "RECORD_DIVERSION",
      role: "ward",
      now: NOW + 7,
      movementId,
      reason: DIVERSION_REASONS[0],
      place: TRANSPORT_WHEREABOUTS[0],
    });
    expect(next.rejections.at(-1)?.reason).toMatch(/not permitted|role/i);
  });

  it("refuses PATIENT_ARRIVED and STOP_TRANSPORT after a diversion", () => {
    const { state: patientCollected, movementId } = collected(seedWardFlowState());
    const diverted = divert(patientCollected, movementId);
    expect(diverted.rejections).toHaveLength(0);

    const arrived = wardFlowReducer(diverted, {
      type: "PATIENT_ARRIVED",
      role: "officer",
      now: NOW + 8,
      movementId,
    });
    expect(arrived.rejections.at(-1)?.reason).toMatch(/diverted/i);

    const stopped = wardFlowReducer(diverted, {
      type: "STOP_TRANSPORT",
      role: "coordinator",
      now: NOW + 8,
      movementId,
      reason: "The examination was revoked",
      whereabouts: TRANSPORT_WHEREABOUTS[0],
    });
    expect(stopped.rejections.at(-1)?.reason).toMatch(/diverted/i);
  });
});

describe("RELEASE_DIVERTED_BED — build plan item 29 / OA-29", () => {
  it.each(["coordinator", "ward", "ed"] as const)("%s can release a diverted bed once", (role) => {
    const { state: patientCollected, movementId, unitId } = collected(seedWardFlowState());
    const diverted = divert(patientCollected, movementId);
    expect(diverted.rejections).toHaveLength(0);
    const unitBefore = diverted.units.find((candidate) => candidate.id === unitId)!;
    const admissionsBefore = diverted.admissions.length;

    const released = wardFlowReducer(diverted, {
      type: "RELEASE_DIVERTED_BED",
      role,
      now: NOW + 8,
      movementId,
      actingUnitId: role === "ward" ? unitId : undefined,
    });
    expect(released.rejections, `${role} was refused: ${released.rejections.at(-1)?.reason}`).toHaveLength(0);

    const after = movement(released, movementId);
    const unitAfter = released.units.find((candidate) => candidate.id === unitId)!;
    expect(after.admissionId).toBeUndefined();
    expect(after.closure?.outcome).toBe("did_not_proceed");
    expect(after.closure?.reason).toBe(DIVERSION_REASONS[0]);
    expect(after.blocker).toBe(STAGE_TRANSITION_BLOCKERS.didNotProceed);
    expect(unitAfter.allocatable.value).toBe(unitBefore.allocatable.value + 1);
    expect(released.admissions.length).toBe(admissionsBefore - 1);

    if (role === "ward") {
      expect(released.notices.find((candidate) => candidate.kind === "diversion_bed_released_ward")).toBeUndefined();
    } else {
      const notice = released.notices.find((candidate) => candidate.kind === "diversion_bed_released_ward");
      expect(notice, "ward should be told when someone else releases").toBeDefined();
    }

    const again = wardFlowReducer(released, {
      type: "RELEASE_DIVERTED_BED",
      role: "coordinator",
      now: NOW + 9,
      movementId,
    });
    expect(again.rejections.at(-1)?.reason).toMatch(/holds no bed|already/i);
  });

  it("refuses another ward releasing", () => {
    const { state: patientCollected, movementId, unitId } = collected(seedWardFlowState());
    const diverted = divert(patientCollected, movementId);
    expect(diverted.rejections).toHaveLength(0);
    const otherUnit = diverted.units.find((candidate) => candidate.id !== unitId)?.id;
    expect(otherUnit).toBeDefined();
    const next = wardFlowReducer(diverted, {
      type: "RELEASE_DIVERTED_BED",
      role: "ward",
      now: NOW + 8,
      movementId,
      actingUnitId: otherUnit,
    });
    expect(next.rejections.at(-1)?.reason).toMatch(/acting as unit/);
  });

  it("refuses a release with no diversion", () => {
    const { state: patientCollected, movementId } = collected(seedWardFlowState());
    const next = wardFlowReducer(patientCollected, {
      type: "RELEASE_DIVERTED_BED",
      role: "coordinator",
      now: NOW + 7,
      movementId,
    });
    expect(next.rejections.at(-1)?.reason).toMatch(/was not diverted/);
  });
});
