import { describe, expect, it } from "vitest";

import { boardArrivalAllowed } from "../src/components/ward-management/board/ward-board";
import { seedWardFlowStateAt, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * Walkthrough fixes on the bed board, 25 September 2026 (T2, D8). The board used to offer
 * "Patient arrived" on every pulled tile while the reducer refused most of them, and the
 * discharges board recorded "Ward manager" for a date a coordinator set.
 */
describe("the bed board offers only what the reducer accepts", () => {
  it("T2: boardArrivalAllowed agrees with PATIENT_ARRIVED for every seeded open movement", () => {
    const state = seedWardFlowStateAt(0);
    const candidates = state.movements.filter((movement) => !movement.closure && movement.acceptedUnitId);
    expect(candidates.length, "the seed has no open accepted movement to check").toBeGreaterThan(0);
    let allowed = 0;
    for (const movement of candidates) {
      const after = wardFlowReducer(state, {
        type: "PATIENT_ARRIVED",
        role: "ward",
        now: NOW_ANCHOR,
        movementId: movement.id,
        actingUnitId: movement.acceptedUnitId!,
      });
      const accepted = after.rejections.length === state.rejections.length;
      expect(boardArrivalAllowed(movement), `${movement.id} at stage ${movement.stage}`).toBe(accepted);
      if (accepted) allowed += 1;
    }
    // Both answers must occur, or this agreement proves nothing about the refusal half.
    expect(allowed, "no seeded movement can arrive, so the accepting half is untested").toBeGreaterThan(0);
    expect(allowed, "every seeded movement can arrive, so the refusing half is untested").toBeLessThan(candidates.length);
  });
});

describe("D8: who set a discharge date is recorded truthfully", () => {
  function occupant() {
    const state = seedWardFlowStateAt(0);
    const found = state.admissions.find((a) => a.state === "occupied");
    if (!found) throw new Error("the seed has no occupied stay");
    return { state, found };
  }

  it("a ward setting the date is recorded as Ward manager", () => {
    const { state, found } = occupant();
    const after = wardFlowReducer(state, {
      type: "UPDATE_EXPECTED_DISCHARGE",
      role: "ward",
      now: NOW_ANCHOR,
      admissionId: found.id,
      actingUnitId: found.unitId,
      expectedDischargeAt: NOW_ANCHOR + 120,
    });
    expect(after.admissions.find((a) => a.id === found.id)?.dischargeDateSetBy).toBe("Ward manager");
  });

  it("a coordinator setting the date is not recorded as a ward manager", () => {
    const { state, found } = occupant();
    const after = wardFlowReducer(state, {
      type: "UPDATE_EXPECTED_DISCHARGE",
      role: "coordinator",
      now: NOW_ANCHOR,
      admissionId: found.id,
      expectedDischargeAt: NOW_ANCHOR + 120,
    });
    expect(after.rejections).toEqual(state.rejections);
    const updated = after.admissions.find((a) => a.id === found.id);
    expect(updated?.expectedDischargeAt).toBe(NOW_ANCHOR + 120);
    expect(updated?.dischargeDateSetBy).toBeNull();
  });
});
