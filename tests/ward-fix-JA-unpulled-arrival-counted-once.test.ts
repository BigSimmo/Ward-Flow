import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * A9-08 edge (journey review JR3, helper JA, 13 Nov 2026): a ward can hold an allocatable count above
 * its empty count (a ward's own Confirm numbers may record them so). An arrival with no pulled stay
 * on such a ward with no empty bed has no Ready bed (Ready is never above Empty), so it must be
 * counted once, as a capacity conflict, and not also take an allocatable bed. Otherwise the
 * departure that resolves the conflict never gives that allocatable bed back. Synthetic records only.
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

const unitOf = (state: WardFlowState, unitId: string) => state.units.find((unit) => unit.id === unitId)!;

function send(state: WardFlowState, event: Record<string, unknown>): WardFlowState {
  const next = wardFlowReducer(state, { now: NOW_ANCHOR + state.clockOffsetMinutes, ...event } as WardFlowEvent);
  expect(next.rejections.at(-1)?.reason ?? "", `${String(event.type)} was refused`).toBe(
    state.rejections.at(-1)?.reason ?? "",
  );
  expect(next.rejections.length).toBe(state.rejections.length);
  return next;
}

describe("an arrival with no pulled stay on a ward with no empty bed", () => {
  const seed = seedWardFlowState();
  const movement = inTransitWithoutPulledBed(seed);
  const unitId = movement.acceptedUnitId!;
  const full: WardFlowState = {
    ...seed,
    units: seed.units.map((unit) =>
      unit.id === unitId
        ? {
            ...unit,
            empty: { ...unit.empty, value: 0 },
            allocatable: { ...unit.allocatable, value: Math.max(2, unit.allocatable.value) },
            arrivalCapacityConflicts: [],
          }
        : unit,
    ),
  };
  const before = unitOf(full, unitId);

  it("is recorded once, as a capacity conflict, without also taking an allocatable bed", () => {
    expect(before.allocatable.value).toBeGreaterThan(before.empty.value);
    const arrived = send(full, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      actingUnitId: unitId,
      movementId: movement.id,
    });
    const after = unitOf(arrived, unitId);
    expect(after.arrivalCapacityConflicts).toHaveLength(1);
    expect(after.allocatable.value).toBe(before.allocatable.value);
    expect(after.allocatableLocked).toBe(before.allocatableLocked);
    expect(after.empty.value).toBe(0);
  });

  it("leaves the ward's figures as they were once that stay has left again", () => {
    const arrived = send(full, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      actingUnitId: unitId,
      movementId: movement.id,
    });
    const stayId = arrived.movements.find((candidate) => candidate.id === movement.id)!.admissionId!;
    const left = send(arrived, {
      type: "RECORD_LEAVING",
      role: "ward",
      actingUnitId: unitId,
      admissionId: stayId,
      leavingDestination: "transferred-to-another-psychiatric-ward",
    });
    const after = unitOf(left, unitId);
    expect(after.arrivalCapacityConflicts ?? []).toHaveLength(0);
    expect(after.allocatable.value).toBe(before.allocatable.value);
    expect(after.allocatableLocked).toBe(before.allocatableLocked);
    expect(after.empty.value).toBe(before.empty.value);
  });
});
