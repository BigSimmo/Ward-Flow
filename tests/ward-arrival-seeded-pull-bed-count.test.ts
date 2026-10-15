import { describe, expect, it } from "vitest";

import { bedStates } from "../src/components/ward-management/ward-bed-states";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * A seeded pulled stay already sits outside its ward's empty count, so its arrival must take no
 * second bed (release gate, 15 Oct 2026). Before the fix the ward's Occupied rose by two and Ready
 * fell by one when such a patient arrived.
 */
describe("arriving a patient into a seeded pulled stay", () => {
  function deliveredSeededPull() {
    const seed = seedWardFlowState();
    const movement = seed.movements.find((candidate) => {
      if (candidate.stage !== "pulled" || candidate.admissionId === undefined || candidate.transport) return false;
      const stay = seed.admissions.find((admission) => admission.id === candidate.admissionId);
      return stay?.state === "pulled" && stay.movementId === null;
    });
    if (!movement?.acceptedUnitId) throw new Error("the seed has no pulled movement on a seeded pulled stay");
    // Delivered by transport: moving and collected, the stage the ward confirms arrival from.
    const state = {
      ...seed,
      movements: seed.movements.map((candidate) =>
        candidate.id === movement.id
          ? {
              ...candidate,
              stage: "moving" as const,
              transport: {
                id: "TR-GATE",
                provider: "Patient transport service",
                escortRequired: false,
                acceptedAt: NOW_ANCHOR - 30,
                collectedAt: NOW_ANCHOR - 20,
                arrivedAt: NOW_ANCHOR - 5,
              },
            }
          : candidate,
      ),
    } as typeof seed;
    return { state, movement, unitId: movement.acceptedUnitId };
  }

  it("moves one bed from Pulled to Occupied and leaves Ready alone", () => {
    const { state, movement, unitId } = deliveredSeededPull();
    const unitBefore = state.units.find((unit) => unit.id === unitId)!;
    const before = bedStates(unitBefore, state.admissions, state.bedReleases, state.leaveBeds);
    const next = wardFlowReducer(state, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: movement.id,
      actingUnitId: unitId,
    });
    expect(next.rejections).toHaveLength(state.rejections.length);
    expect(next.admissions.find((admission) => admission.id === movement.admissionId)?.state).toBe("occupied");
    const unitAfter = next.units.find((unit) => unit.id === unitId)!;
    const after = bedStates(unitAfter, next.admissions, next.bedReleases, next.leaveBeds);
    expect(after.occupied).toBe(before.occupied + 1);
    expect(after.pulled).toBe(before.pulled - 1);
    expect(after.ready).toBe(before.ready);
    expect(unitAfter.empty.value).toBe(unitBefore.empty.value);
    // The stay is already in the sex mix, so the same person arriving adds no second count.
    expect(unitAfter.sexMix).toEqual(unitBefore.sexMix);
  });
});
