import { expect, it } from "vitest";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { eligibility } from "../src/components/ward-management/ward-eligibility";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { isValidStoredWardFlowState } from "../src/components/ward-management/ward-flow-storage-validation";

function setup(linked: boolean) {
  const state = seedWardFlowState();
  const admission = state.admissions.find((a) => a.state === "occupied" && a.patientId)!;
  const movement = structuredClone(
    state.movements.find((m) => m.cohort === state.units.find((u) => u.id === admission.unitId)?.cohort)!,
  );
  movement.id = "WF-RECOVERY-PLACEMENT";
  delete movement.referralId;
  delete movement.sourceAdmissionId;
  delete movement.referralSourceAdmissionId;
  if (linked) {
    state.movements.push(movement);
    movement.closure = { at: NOW_ANCHOR, outcome: "arrived", reason: "Synthetic fixture arrival" };
    movement.admissionId = admission.id;
    movement.patientId = admission.patientId!;
    movement.stage = "arrived";
    movement.acceptedUnitId = admission.unitId;
    admission.movementId = movement.id;
  } else {
    admission.movementId = null;
    state.movements = state.movements.filter((m) => m.patientId !== admission.patientId);
  }
  state.units = state.units.map((u) => ({
    ...u,
    allocatable: { ...u.allocatable, confirmedAt: NOW_ANCHOR },
    empty: { ...u.empty, confirmedAt: NOW_ANCHOR },
  }));
  const targets = state.units.filter(
    (u) =>
      u.id !== admission.unitId &&
      eligibility(movement, u, NOW_ANCHOR).eligible &&
      u.empty.value > 0 &&
      u.allocatableLocked > 0,
  );
  expect(targets.length).toBeGreaterThanOrEqual(2);
  const command = (world: WardFlowState, ward: string, step: string, patch = {}) =>
    ({
      type: "RECORD_ADMISSION_CARE",
      role: "coordinator",
      now: NOW_ANCHOR,
      admissionId: admission.id,
      patientId: admission.patientId!,
      expectedGeneration: world.worldGeneration,
      expectedRevision: world.dischargeRevisions[admission.id] ?? 0,
      change: { kind: "transfer", receivingUnitId: ward, step },
      ...patch,
    }) as WardFlowEvent;
  return { state, admission, targets, command };
}
it("preflights placement linkage before recording transfer acceptance", () => {
  const { state, admission, targets, command } = setup(false);
  const next = wardFlowReducer(state, command(state, targets[0].id, "accepted"));
  expect(next.admissions).toBe(state.admissions);
  expect(next.rejections.at(-1)?.reason).toMatch(/placement record/i);
  expect(next.admissions.find((a) => a.id === admission.id)?.careJourney?.transfer).toBeUndefined();
});
it("cancels an unavailable destination, rejects stale steps, and completes a replacement once", () => {
  const { state, admission, targets, command } = setup(true);
  const [a, b] = targets;
  let next = wardFlowReducer(state, command(state, a.id, "accepted"));
  next = wardFlowReducer(next, command(next, a.id, "handover"));
  next.units = next.units.map((u) => (u.id === a.id ? { ...u, empty: { ...u.empty, value: 0 } } : u));
  const stale = command(next, a.id, "arrived");
  const cancel = command(next, a.id, "cancelled");
  const denied = wardFlowReducer(next, { ...cancel, role: "ward", actingUnitId: admission.unitId } as WardFlowEvent);
  expect(denied.admissions).toBe(next.admissions);
  next = wardFlowReducer(next, cancel);
  expect(next.admissions.find((row) => row.id === admission.id)?.careJourney?.transfer?.step).toBe("cancelled");
  expect(next.auditEvents.at(-1)).toMatchObject({
    details: { recorded: { kind: "transfer", receivingUnitId: a.id, step: "cancelled" } },
  });
  expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(next)))).toBe(true);
  const events = next.auditEvents.length;
  expect(wardFlowReducer(next, stale).admissions).toBe(next.admissions);
  next = wardFlowReducer(next, command(next, b.id, "accepted"));
  next = wardFlowReducer(next, command(next, b.id, "handover"));
  next = wardFlowReducer(next, command(next, b.id, "arrived"));
  expect(next.rejections).toEqual([]);
  expect(next.auditEvents.length).toBeGreaterThan(events);
  expect(next.admissions.find((row) => row.id === admission.id)?.state).toBe("departed");
  expect(
    next.admissions.filter((row) => row.patientId === admission.patientId && row.state === "occupied"),
  ).toHaveLength(1);
  expect(wardFlowReducer(next, command(next, b.id, "arrived")).units).toBe(next.units);
  expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(next)))).toBe(true);
});
