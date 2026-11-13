import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { GENERAL_OBSERVATION } from "@/components/ward-management/ward-observation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const send = (state: WardFlowState, event: WardFlowEvent) => {
  const next = wardFlowReducer(state, event);
  expect(next.rejections, event.type).toEqual(state.rejections);
  return next;
};

describe("WF-INV-01 coordinator transfer capacity", () => {
  it.each([
    { reconfirm: false, remaining: 1, accepted: false },
    { reconfirm: true, remaining: 1, accepted: false },
    { reconfirm: true, remaining: 2, accepted: true },
  ])("respects reservations (reconfirm=$reconfirm, remaining=$remaining)", ({ reconfirm, remaining, accepted }) => {
    let state = seedWardFlowState();
    const admission = state.admissions.find((a) => a.state === "occupied" && a.patientId)!;
    const movement = state.movements.find(
      (m) => m.cohort === state.units.find((u) => u.id === admission.unitId)!.cohort,
    )!;
    movement.legalStatus = "Voluntary";
    const patient = state.patients.find((p) => p.id === admission.patientId)!;
    patient.legalStatus = "Voluntary";
    patient.communityTreatmentOrder = undefined;
    movement.admissionId = admission.id;
    movement.patientId = admission.patientId!;
    movement.stage = "arrived";
    movement.acceptedUnitId = admission.unitId;
    admission.movementId = movement.id;
    state.units = state.units.map((u) => ({
      ...u,
      allocatable: { ...u.allocatable, confirmedAt: NOW_ANCHOR },
      empty: { ...u.empty, confirmedAt: NOW_ANCHOR },
    }));
    const target = state.units.find(
      (u) => u.id !== admission.unitId && eligibility(movement, u, NOW_ANCHOR).eligible && u.allocatableLocked > 0,
    )!;
    expect(target).toBeDefined();
    // Isolate one remaining physical bed, then reserve it through ordinary reducer events.
    target.empty.value = remaining;
    target.allocatable.value = remaining;
    target.allocatableLocked = 1;
    const care = (s: WardFlowState, step: "accepted" | "handover" | "arrived"): WardFlowEvent => ({
      type: "RECORD_ADMISSION_CARE",
      role: "coordinator",
      now: NOW_ANCHOR,
      admissionId: admission.id,
      patientId: admission.patientId!,
      expectedGeneration: s.worldGeneration,
      expectedRevision: s.dischargeRevisions[admission.id] ?? 0,
      change: { kind: "transfer", receivingUnitId: target.id, step },
    });
    state = send(state, care(state, "accepted"));
    state = send(state, care(state, "handover"));
    state = send(state, {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW_ANCHOR,
      edId: "jhc-ed",
      draft: {
        cohort: movement.cohort,
        security: movement.security,
        sex: movement.sex,
        gender: movement.gender,
        observation: GENERAL_OBSERVATION,
        highAcuity: false,
        legalStatus: "Voluntary",
        legalFormCode: null,
        urgency: 2,
      },
    });
    const movementId = state.movements.at(-1)!.id;
    state = send(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId,
      unitIds: [target.id],
    });
    state = send(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      actingUnitId: target.id,
      now: NOW_ANCHOR,
      movementId,
      unitId: target.id,
    });
    state = send(state, {
      type: "PULL_PATIENT",
      role: "ward",
      actingUnitId: target.id,
      now: NOW_ANCHOR,
      movementId,
      unitId: target.id,
    });
    if (reconfirm)
      state = send(state, {
        type: "CONFIRM_CAPACITY",
        role: "ward",
        actingUnitId: target.id,
        now: NOW_ANCHOR,
        unitId: target.id,
        expectedRevision: state.units.find((u) => u.id === target.id)!.allocatable.revision ?? 0,
        value: remaining,
      });
    const receiving = state.units.find((u) => u.id === target.id)!;
    expect(receiving.empty.value).toBe(remaining);
    expect(receiving.allocatable.value).toBe(reconfirm ? remaining : remaining - 1);
    expect(bedStates(receiving, state.admissions, state.bedReleases, state.leaveBeds, []).ready).toBe(accepted ? 1 : 0);
    const after = wardFlowReducer(state, care(state, "arrived"));
    if (accepted) {
      expect(after.rejections).toEqual(state.rejections);
      expect(after.admissions.find((a) => a.id === admission.id)?.state).toBe("departed");
      expect(after.units.find((u) => u.id === target.id)!.empty.value).toBe(remaining - 1);
      expect(
        after.admissions.filter((a) => a.unitId === target.id && a.state === "pulled" && a.movementId === movementId),
      ).toHaveLength(1);
      return;
    }
    expect(after.rejections).toHaveLength(state.rejections.length + 1);
    for (const key of ["units", "admissions", "movements", "dischargeRevisions", "notices", "undoRecords"] as const)
      expect(after[key]).toEqual(state[key]);
  });
});
