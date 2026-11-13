import { describe, expect, it } from "vitest";

import { bedStates, networkNamedHolds } from "@/components/ward-management/ward-bed-states";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * A9-08 (Audit 9, approved by Josh 13 Nov 2026): confirming an arrival for a journey with no pulled
 * bed turned a closed bed into an unnamed "Occupied" one. The arrival now takes a ready bed, as a
 * pull would, with a named stay; with no ready bed the closed beds stay closed.
 */
function inTransitWithoutPulledBed(state: WardFlowState) {
  const movement = state.movements.find(
    (candidate) =>
      !candidate.closure &&
      candidate.stage === "moving" &&
      candidate.transport?.collectedAt !== undefined &&
      candidate.admissionId === undefined &&
      candidate.acceptedUnitId !== undefined,
  );
  if (!movement) throw new Error("The seed must hold a journey in transit with no pulled bed");
  return movement;
}

function counts(state: WardFlowState, unitId: string) {
  const unit = state.units.find((candidate) => candidate.id === unitId)!;
  return bedStates(
    unit,
    state.admissions,
    state.bedReleases,
    state.leaveBeds,
    networkNamedHolds(state.movements, state.referrals),
  );
}

function arrive(state: WardFlowState, movementId: string, unitId: string): WardFlowState {
  return wardFlowReducer(state, {
    type: "PATIENT_ARRIVED",
    role: "ward",
    actingUnitId: unitId,
    now: NOW_ANCHOR + state.clockOffsetMinutes,
    movementId,
  } as WardFlowEvent);
}

describe("A9-08: arrival with no pulled bed", () => {
  it("takes a ready bed with a named stay, and leaves the closed beds closed", () => {
    const seed = seedWardFlowState();
    const movement = inTransitWithoutPulledBed(seed);
    const unitId = movement.acceptedUnitId!;
    const before = counts(seed, unitId);
    expect(before.ready).toBeGreaterThan(0);

    const next = arrive(seed, movement.id, unitId);
    expect(next.rejections.length).toBe(seed.rejections.length);
    const after = counts(next, unitId);
    expect(after.closed).toBe(before.closed);
    expect(after.ready).toBe(before.ready - 1);
    expect(after.occupied).toBe(before.occupied + 1);

    const arrived = next.movements.find((candidate) => candidate.id === movement.id)!;
    expect(arrived.stage).toBe("arrived");
    const stay = next.admissions.find((admission) => admission.id === arrived.admissionId);
    expect(stay).toMatchObject({ unitId, state: "occupied", patientId: movement.patientId, movementId: movement.id });
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify({ ...next, rejections: [] })))).toBe(true);
  });

  it("with no ready bed, records the arrival without taking a closed bed", () => {
    const seed = seedWardFlowState();
    const movement = inTransitWithoutPulledBed(seed);
    const unitId = movement.acceptedUnitId!;
    const full: WardFlowState = {
      ...seed,
      units: seed.units.map((unit) =>
        unit.id === unitId ? { ...unit, allocatable: { ...unit.allocatable, value: 0 }, allocatableLocked: 0 } : unit,
      ),
    };
    const before = counts(full, unitId);
    expect(before.closed).toBeGreaterThan(0);
    const next = arrive(full, movement.id, unitId);
    const after = counts(next, unitId);
    expect(after.closed).toBe(before.closed);
    expect(after.occupied).toBe(before.occupied);
    const arrived = next.movements.find((candidate) => candidate.id === movement.id)!;
    expect(arrived.stage).toBe("arrived");
    const stay = next.admissions.find((admission) => admission.id === arrived.admissionId);
    expect(stay?.patientId).toBe(movement.patientId);
    expect(stay?.blockReason).toBe("Awaiting clean");
  });
});
