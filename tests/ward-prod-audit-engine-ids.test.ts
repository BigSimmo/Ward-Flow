// Production audit 24 Oct 2026, ENG-01: an Undo shortens a list, and the next id must not reuse a
// live one. Synthetic seed data only.
import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { Movement } from "@/components/ward-management/ward-model";
import { nextRuntimeIdNumber } from "@/components/ward-management/ward-runtime-ids";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("nextRuntimeIdNumber", () => {
  it("counts past the highest live number, never below the floor", () => {
    expect(nextRuntimeIdNumber([], "SN-", 1)).toBe(1);
    expect(nextRuntimeIdNumber(["SN-2"], "SN-", 2)).toBe(3);
    expect(nextRuntimeIdNumber(["WR-001", "WR-9212", "WR-9213"], "WR-9", 2)).toBe(214);
    expect(nextRuntimeIdNumber(["notice-RF-1-accepted-0", "notice-WF-4-bed_pull_released-1"], "notice-", 1)).toBe(2);
    expect(nextRuntimeIdNumber(["SN-x", "OTHER-9"], "SN-", 4)).toBe(4);
  });
});

describe("support notification ids after an Undo (ENG-01)", () => {
  function involuntary(): WardFlowState {
    const state = seedWardFlowState();
    return {
      ...state,
      movements: state.movements.map((movement): Movement =>
        movement.id === "WF-300" || movement.id === "WF-321"
          ? { ...movement, legalStatus: "Involuntary inpatient" }
          : movement,
      ),
    };
  }
  const told = (movementId: string, now: number): WardFlowEvent => ({
    type: "RECORD_SUPPORT_NOTIFICATION",
    role: "ward",
    now,
    occasion: "admission",
    movementId,
    party: "carer",
    outcome: "told",
    who: "Synthetic carer",
  });

  it("never gives a new record the id of one still held", () => {
    let state = wardFlowReducer(involuntary(), told("WF-300", NOW_ANCHOR));
    state = wardFlowReducer(state, told("WF-321", NOW_ANCHOR + 1));
    state = wardFlowReducer(state, {
      type: "UNDO_SUPPORT_NOTIFICATION",
      role: "ward",
      now: NOW_ANCHOR + 2,
      movementId: "WF-300",
    });
    expect(state.rejections).toHaveLength(0);
    expect(state.supportNotifications?.map((record) => record.id)).toEqual(["SN-2"]);
    state = wardFlowReducer(state, told("WF-300", NOW_ANCHOR + 3));
    expect(state.rejections).toHaveLength(0);
    const ids = state.supportNotifications?.map((record) => record.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
