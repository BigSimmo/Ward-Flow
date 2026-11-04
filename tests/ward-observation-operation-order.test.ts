import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { observationEditingToken } from "@/components/ward-management/ward-flow-observation-events";
import {
  observationAt,
  observationConflict,
  type ObservationLevel,
} from "@/components/ward-management/ward-observation";
import { buildScenarioFile, readScenarioFile } from "@/components/ward-management/ward-flow-scenario-file";
import {
  WARD_FLOW_STORED_STATE_VERSION,
  isValidStoredWardFlowState,
} from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR + 5;
function fixture() {
  const state = seedWardFlowState();
  return {
    ...state,
    movements: state.movements.map((row) =>
      row.id === "WF-011" ? { ...row, transportNeed: { needed: false as const, at: NOW - 10 } } : row,
    ),
  };
}
function edit(state: WardFlowState, kind: "movement" | "admission", level: ObservationLevel, now = NOW) {
  const movement = state.movements.find((row) => row.id === "WF-011")!;
  const admission = state.admissions.find((row) => row.id === movement.admissionId)!;
  const target = kind === "movement" ? movement : admission;
  const next = wardFlowReducer(state, {
    type: "RECORD_OBSERVATION_LEVEL",
    role: "coordinator",
    now,
    target:
      kind === "movement"
        ? { kind, movementId: movement.id }
        : { kind, admissionId: admission.id, actingUnitId: admission.unitId },
    observation: observationAt(level),
    expected: observationEditingToken(kind, target.id, target.observation, target.observationChanges?.length ?? 0),
  });
  expect(next.rejections).toEqual(state.rejections);
  return next;
}
function arrive(state: WardFlowState) {
  const movement = state.movements.find((row) => row.id === "WF-011")!;
  const next = wardFlowReducer(state, {
    type: "PATIENT_ARRIVED",
    role: "ward",
    now: NOW + 2,
    movementId: movement.id,
    actingUnitId: movement.acceptedUnitId!,
  });
  expect(next.rejections).toEqual(state.rejections);
  return next.admissions.find((row) => row.id === movement.admissionId)!;
}
describe("arrival preserves accepted observation operation order", () => {
  it("keeps the later admission edit in the same minute", () => {
    const state = edit(edit(fixture(), "movement", "arms_length"), "admission", "two_staff");
    expect(arrive(state).observation.level).toBe("two_staff");
  });
  it("keeps the later movement edit in the same minute", () => {
    const state = edit(edit(fixture(), "admission", "two_staff"), "movement", "arms_length");
    const stay = arrive(state);
    expect(stay.observation.level).toBe("arms_length");
    expect(stay.observationChanges?.at(-1)?.from.level).toBe("two_staff");
  });
  it("keeps the later admission edit in the next minute", () => {
    const state = edit(edit(fixture(), "movement", "arms_length"), "admission", "two_staff", NOW + 1);
    expect(arrive(state).observation.level).toBe("two_staff");
  });
  it("retains historical disagreement until a person confirms the ward level", () => {
    const state = fixture();
    const movement = state.movements.find((row) => row.id === "WF-011")!;
    const before = state.admissions.find((row) => row.id === movement.admissionId)!;
    const arrivedState = wardFlowReducer(state, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW + 1,
      movementId: movement.id,
      actingUnitId: movement.acceptedUnitId!,
    });
    expect(arrivedState.rejections).toEqual(state.rejections);
    const arrived = arrivedState.admissions.find((row) => row.id === before.id)!;
    expect(arrived.observation).toEqual(before.observation);
    expect(observationConflict(arrived, movement)).toBe(true);
    const resolved = edit(arrivedState, "admission", arrived.observation.level);
    const stay = resolved.admissions.find((row) => row.id === arrived.id)!;
    expect(observationConflict(stay, movement)).toBe(false);
    expect(stay.observationChanges?.at(-1)?.sequence).toBeGreaterThan(0);
    expect(resolved.movements.find((row) => row.id === movement.id)?.observation).toEqual(movement.observation);
  });
  it("recognises tied historical changes as unresolved without choosing either level", () => {
    const base = fixture();
    const state = edit(edit(base, "movement", "arms_length"), "admission", "two_staff");
    const legacy = {
      ...state,
      movements: state.movements.map((row) => ({
        ...row,
        observationChanges: row.observationChanges?.map(({ at, from, to }) => ({ at, from, to })),
      })),
      admissions: state.admissions.map((row) => ({
        ...row,
        observationChanges: row.observationChanges?.map(({ at, from, to }) => ({ at, from, to })),
      })),
    };
    const stay = arrive(legacy);
    const journey = legacy.movements.find((row) => row.id === "WF-011")!;
    expect(stay.observation.level).toBe("two_staff");
    expect(observationConflict(stay, journey)).toBe(true);
  });

  it("preserves operation ordering through the real scenario export/import boundary", () => {
    const state = edit(edit(fixture(), "movement", "arms_length"), "admission", "two_staff");
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
    const built = buildScenarioFile(state, NOW + 2, WARD_FLOW_STORED_STATE_VERSION, new Date("2026-11-04T00:00:00Z"));
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error(built.reason);
    const restored = readScenarioFile(built.json, WARD_FLOW_STORED_STATE_VERSION);
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error(restored.reason);
    const imported = restored.state;
    expect(imported.movements.find((row) => row.id === "WF-011")!.observationChanges).toEqual(
      state.movements.find((row) => row.id === "WF-011")!.observationChanges,
    );
    expect(arrive(imported).observation.level).toBe("two_staff");
  });
});
