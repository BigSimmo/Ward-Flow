import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { eligibility } from "@/components/ward-management/ward-eligibility";
import type { CareChange } from "@/components/ward-management/ward-care-journey";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * `RECORD_ADMISSION_CARE` with a transfer recorded as `arrived` is a STATE TRANSITION, not a plain
 * write: it ends the source admission, creates an occupied admission and an arrived movement at the
 * receiving ward, and moves both wards' bed figures. The journey explorer used to list the action in
 * `WRITES`, which made it count as write-only and report every transition accounted for. These tests
 * pin (1) what the reducer actually does, (2) that machines.json models exactly that, and (3) that
 * the build no longer files the action as a plain write.
 */
const JOURNEY = join(process.cwd(), "docs", "ward-flow", "journey");
const machinesFile = JSON.parse(readFileSync(join(JOURNEY, "machines.json"), "utf8")) as {
  machines: {
    id: string;
    states: { id: string }[];
    transitions: { from: string; to: string; action: string }[];
  }[];
  resources: { counts: { name: string; moves: { action: string }[] }[] };
};
const ACTION = "RECORD_ADMISSION_CARE";

function transitionsOf(machineId: string) {
  const machine = machinesFile.machines.find((candidate) => candidate.id === machineId)!;
  expect(machine, `machine ${machineId} exists`).toBeDefined();
  const stateIds = new Set(machine.states.map((state) => state.id));
  return machine.transitions
    .filter((transition) => transition.action === ACTION)
    .map((transition) => {
      expect(stateIds.has(transition.from), `${machineId}: unknown state ${transition.from}`).toBe(true);
      expect(stateIds.has(transition.to), `${machineId}: unknown state ${transition.to}`).toBe(true);
      return `${transition.from}->${transition.to}`;
    });
}

function transferCommand(state: WardFlowState, admissionId: string, change: CareChange) {
  const admission = state.admissions.find((candidate) => candidate.id === admissionId)!;
  return {
    type: ACTION,
    role: "coordinator",
    now: NOW_ANCHOR,
    admissionId,
    patientId: admission.patientId!,
    expectedGeneration: state.worldGeneration,
    expectedRevision: state.dischargeRevisions[admissionId] ?? 0,
    change,
  } as WardFlowEvent;
}

function arrangeTransfer() {
  const state = seedWardFlowState();
  const admission = state.admissions.find((a) => a.state === "occupied" && a.patientId)!;
  const base = state.movements.find((m) => m.cohort === state.units.find((u) => u.id === admission.unitId)?.cohort)!;
  base.admissionId = admission.id;
  base.patientId = admission.patientId!;
  base.stage = "arrived";
  base.acceptedUnitId = admission.unitId;
  admission.movementId = base.id;
  state.units = state.units.map((u) => ({
    ...u,
    allocatable: { ...u.allocatable, confirmedAt: NOW_ANCHOR },
    empty: { ...u.empty, confirmedAt: NOW_ANCHOR },
  }));
  const target = state.units.find(
    (u) => u.id !== admission.unitId && eligibility(base, u, NOW_ANCHOR).eligible && u.allocatableLocked > 0,
  )!;
  expect(target, "the seed offers a ward the transfer can arrive at").toBeDefined();
  let next = wardFlowReducer(
    state,
    transferCommand(state, admission.id, { kind: "transfer", receivingUnitId: target.id, step: "accepted" }),
  );
  next = wardFlowReducer(
    next,
    transferCommand(next, admission.id, { kind: "transfer", receivingUnitId: target.id, step: "handover" }),
  );
  return { before: next, admission, target };
}

describe("transfer arrival is modelled as state transitions (not as a plain write)", () => {
  it("is done by the reducer exactly as the machines claim", () => {
    const { before, admission, target } = arrangeTransfer();
    const after = wardFlowReducer(
      before,
      transferCommand(before, admission.id, { kind: "transfer", receivingUnitId: target.id, step: "arrived" }),
    );
    expect(after.rejections).toEqual([]);

    // admission machine: occupied -> departed for the source stay ...
    const left = after.admissions.find((a) => a.id === admission.id)!;
    expect(left.state).toBe("departed");
    expect(left.leavingDestination).toBe("transferred-to-another-psychiatric-ward");
    // ... and none -> occupied for a NEW admission at the receiving ward, never passing through "pulled".
    const created = after.admissions.find((a) => !before.admissions.some((b) => b.id === a.id))!;
    expect(created.state).toBe("occupied");
    expect(created.unitId).toBe(target.id);

    // movement machine: a new movement is created already arrived and closed as arrived.
    const movement = after.movements.find((m) => m.admissionId === created.id)!;
    expect(movement.stage).toBe("arrived");
    expect(movement.closure?.outcome).toBe("arrived");

    // both bed counts: + 1 on the ward they leave, - 1 on the ward they arrive at.
    const figure = (s: WardFlowState, unitId: string, count: "empty" | "allocatable") =>
      s.units.find((u) => u.id === unitId)![count].value;
    for (const count of ["empty", "allocatable"] as const) {
      expect(figure(after, target.id, count)).toBe(figure(before, target.id, count) - 1);
      expect(figure(after, admission.unitId, count)).toBe(figure(before, admission.unitId, count) + 1);
    }
  });

  it("is drawn in the admission, movement and bed-release machines", () => {
    expect(transitionsOf("admission").sort()).toEqual(["none->occupied", "occupied->departed"]);
    expect(transitionsOf("movement")).toEqual(["start->arrived"]);
    expect(transitionsOf("bedrelease").sort()).toEqual(["confirmed->discharged", "expected->discharged"]);
  });

  it("is listed as a mover of both bed counts", () => {
    for (const name of ["Allocatable", "Empty"]) {
      const count = machinesFile.resources.counts.find((candidate) => candidate.name === name)!;
      expect(
        count.moves.map((move) => move.action),
        name,
      ).toContain(ACTION);
    }
  });

  it("is no longer filed in the explorer build's plain-writes table", () => {
    const source = readFileSync(join(JOURNEY, "build-explorer.mjs"), "utf8");
    const writes = source.slice(
      source.indexOf("const WRITES = {"),
      source.indexOf("/* ---------------------------- integrity checks"),
    );
    expect(writes.length).toBeGreaterThan(1000);
    expect(writes).not.toMatch(/^\s*RECORD_ADMISSION_CARE:/m);
    // the sibling that really is a plain write stays one
    expect(writes).toMatch(/^\s*RECORD_ADMISSION_FOLLOW_UP:/m);
  });
});
