import { describe, expect, it } from "vitest";

import { LEAVING_DESTINATIONS } from "../src/components/ward-management/ward-admissions";
import { lockedBedsFree } from "../src/components/ward-management/ward-bed-designation";
import {
  CANCEL_TRANSPORT_REASONS,
  GENDER_PLACEMENT_REASONS,
  RELEASE_PULL_REASONS,
} from "../src/components/ward-management/ward-change-reasons";
import {
  seedWardFlowStateAt,
  STAGE_TRANSITION_BLOCKERS,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { TRANSPORT_PROVIDERS } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const movementId = "WF-012";
const unitId = "rph-adult-secure";
const movement = (state: WardFlowState) => state.movements.find((item) => item.id === movementId)!;
const unit = (state: WardFlowState) => state.units.find((item) => item.id === unitId)!;

function apply(state: WardFlowState, event: WardFlowEvent): WardFlowState {
  const next = wardFlowReducer(state, event);
  expect(next.rejections.slice(state.rejections.length), `setup refused ${event.type}`).toEqual([]);
  return next;
}

function booked(now = NOW_ANCHOR) {
  let state = seedWardFlowStateAt(now - NOW_ANCHOR);
  state = {
    ...state,
    movements: state.movements.map((item) => (item.id === movementId ? { ...item, security: "Secure" } : item)),
    units: state.units.map((item) =>
      item.id === unitId
        ? {
            ...item,
            beds: 20,
            lockedBeds: 20,
            allocatableLocked: 6,
            allocatable: { ...item.allocatable, value: 6, confirmedAt: now },
            empty: { ...item.empty, value: 6, confirmedAt: now },
          }
        : item,
    ),
    bedReleases: state.bedReleases.filter((item) => item.unitId !== unitId),
  };
  state = apply(state, {
    type: "REFER_TO_UNITS", role: "coordinator", now, movementId, unitIds: [unitId],
    genderPlacementReason: GENDER_PLACEMENT_REASONS[0], genderPlacementChecked: true,
  });
  state = apply(state, { type: "ACCEPT_IN_PRINCIPLE", role: "ward", now, movementId, unitId });
  state = apply(state, { type: "PULL_PATIENT", role: "ward", now, movementId, unitId });
  state = apply(state, {
    type: "BOOK_TRANSPORT", role: "ed", now, movementId,
    provider: TRANSPORT_PROVIDERS[0], escortRequired: false, cadNumber: "SYNTHETIC-AUDIT",
    transportLegalStatus: "voluntary", estimatedAt: now + 20,
  });
  expect(state.admissions.find((item) => item.id === movement(state).admissionId)?.bedKind).toBe("locked");
  expect(lockedBedsFree(unit(state))).toBe(5);
  return state;
}

function ready(now = NOW_ANCHOR) {
  return apply(booked(now), { type: "HANDOVER_READY", role: "ed", now, movementId });
}

function collected() {
  let state = ready();
  for (const type of ["TRANSPORT_ACCEPTED", "TRANSPORT_EN_ROUTE", "PATIENT_COLLECTED"] as const) {
    state = apply(state, { type, role: "officer", now: NOW_ANCHOR + 1, movementId });
  }
  return state;
}

describe("WFA-001: cancellation describes the retained bed after a stage correction", () => {
  it("preserves the hold and tells both recipients it remains held", () => {
    const initial = booked();
    const corrected = apply(initial, {
      type: "STEP_BACK_STAGE", role: "coordinator", now: NOW_ANCHOR + 1,
      movementId, to: "accepted_awaiting_bed", reason: "recorded_in_error",
    });
    const next = apply(corrected, {
      type: "CANCEL_TRANSPORT", role: "coordinator", now: NOW_ANCHOR + 2,
      movementId, reason: CANCEL_TRANSPORT_REASONS[0],
    });
    expect(movement(next).admissionId).toBe(movement(initial).admissionId);
    expect(next.admissions).toEqual(initial.admissions);
    expect(unit(next)).toEqual(unit(initial));
    expect(movement(next).stage).toBe("accepted_awaiting_bed");
    expect(movement(next).blocker).toBe(STAGE_TRANSITION_BLOCKERS.transportCancelled);
    const notices = next.notices.slice(corrected.notices.length);
    expect(notices).toHaveLength(2);
    for (const notice of notices) expect(notice.sentence).toContain("the bed is still held");
  });
});

describe("WFA-002: midnight is a recorded transport milestone", () => {
  it.each(["TRANSPORT_ACCEPTED", "TRANSPORT_EN_ROUTE", "PATIENT_COLLECTED"] as const)(
    "%s at zero permits the next milestone", (zeroEvent) => {
      let state = ready(-10);
      for (const type of ["TRANSPORT_ACCEPTED", "TRANSPORT_EN_ROUTE", "PATIENT_COLLECTED"] as const) {
        state = apply(state, { type, role: "officer", now: type === zeroEvent ? 0 : type === "PATIENT_COLLECTED" ? 1 : -1, movementId });
      }
      const next = apply(state, { type: "PATIENT_ARRIVED", role: "ward", actingUnitId: unitId, now: 2, movementId });
      expect(movement(next).closure?.outcome).toBe("arrived");
      expect(next.admissions.find((item) => item.id === movement(next).admissionId)?.arrivedAt).toBe(2);
    },
  );

  it.each(["TRANSPORT_ACCEPTED", "TRANSPORT_EN_ROUTE"] as const)(
    "does not overwrite %s recorded at zero on a repeated action", (type) => {
      let state = ready(-10);
      if (type === "TRANSPORT_EN_ROUTE") state = apply(state, { type: "TRANSPORT_ACCEPTED", role: "officer", now: -1, movementId });
      state = apply(state, { type, role: "officer", now: 0, movementId });
      const next = wardFlowReducer(state, { type, role: "officer", now: 1, movementId });
      expect(next.rejections).toHaveLength(state.rejections.length + 1);
      expect(movement(next)).toEqual(movement(state));
    },
  );
});

describe("WFA-003: departure returns the recorded locked bed", () => {
  it("restores locked capacity once, alongside total capacity", () => {
    let state = apply(collected(), { type: "PATIENT_ARRIVED", role: "ward", actingUnitId: unitId, now: NOW_ANCHOR + 2, movementId });
    const admissionId = movement(state).admissionId!;
    const event = { type: "RECORD_LEAVING", role: "ward", actingUnitId: unitId, now: NOW_ANCHOR + 3, admissionId, leavingDestination: LEAVING_DESTINATIONS[0].id } as const;
    state = apply(state, event);
    expect(unit(state).allocatable.value).toBe(6);
    expect(lockedBedsFree(unit(state))).toBe(6);
    const repeated = wardFlowReducer(state, { ...event, now: NOW_ANCHOR + 4 });
    expect(repeated.rejections).toHaveLength(state.rejections.length + 1);
    expect(unit(repeated)).toEqual(unit(state));
  });
});

describe("WFA-004: stage corrections cannot erase physical collection", () => {
  it("refuses to release a pulled bed after collection even when its stage was corrected", () => {
    const state = apply(collected(), { type: "STEP_BACK_STAGE", role: "coordinator", now: NOW_ANCHOR + 2, movementId, to: "pulled", reason: "recorded_in_error" });
    const next = wardFlowReducer(state, { type: "RELEASE_PULL", role: "coordinator", now: NOW_ANCHOR + 3, movementId, reason: RELEASE_PULL_REASONS[0] });
    expect(next.rejections).toHaveLength(state.rejections.length + 1);
    expect(next.rejections.at(-1)?.reason).toContain("STOP_TRANSPORT");
    expect(next.admissions).toEqual(state.admissions);
    expect(unit(next)).toEqual(unit(state));
    expect(movement(next)).toEqual(movement(state));
  });

  it("a revoked examination after collection retains the hold after a stage correction", () => {
    const state = apply(collected(), { type: "STEP_BACK_STAGE", role: "coordinator", now: NOW_ANCHOR + 2, movementId, to: "pulled", reason: "recorded_in_error" });
    const next = apply(state, { type: "RECORD_EXAMINATION", role: "ed", now: NOW_ANCHOR + 3, movementId, outcome: "revoked" });
    expect(next.admissions).toEqual(state.admissions);
    expect(unit(next)).toEqual(unit(state));
    expect(movement(next).closure).toBeUndefined();
    expect(movement(next).transport?.collectedAt).toBeDefined();
    expect(movement(next).blocker).toBe(STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease);
  });

  it("a pre-collection examination release clears the admission link even at an earlier corrected stage", () => {
    const state = apply(booked(), { type: "STEP_BACK_STAGE", role: "coordinator", now: NOW_ANCHOR + 1, movementId, to: "destination_review", reason: "recorded_in_error" });
    const admissionId = movement(state).admissionId;
    const next = apply(state, { type: "RECORD_EXAMINATION", role: "ed", now: NOW_ANCHOR + 2, movementId, outcome: "revoked" });
    expect(next.admissions.some((item) => item.id === admissionId)).toBe(false);
    expect(movement(next).admissionId).toBeUndefined();
    expect(unit(next).allocatable.value).toBe(6);
    expect(lockedBedsFree(unit(next))).toBe(6);
  });
});
