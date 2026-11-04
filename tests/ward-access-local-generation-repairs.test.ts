import { beforeEach, expect, it } from "vitest";

import {
  breakGlass,
  readWardAccessSnapshot,
  resetWardAccessStoreForTests,
  setWardAccess,
} from "../src/components/ward-management/shell/ward-access-store";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { scopeWardFlowState } from "../src/components/ward-management/ward-access-state";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const initial = seedWardFlowState();
const places = wardPlaceLookup(initial.units);
const desk: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [initial.units[0].id] } };
const own = scopeWardFlowState(initial, desk, { now: NOW_ANCHOR, places });
const foreign = initial.patients.find((patient) => !own.state.patients.some(({ id }) => patient.id === id))!;

beforeEach(() => {
  resetWardAccessStoreForTests();
  setWardAccess(desk);
});

function open(generation?: number) {
  return breakGlass({
    patientId: foreign.id,
    now: NOW_ANCHOR,
    windowMinutes: 60,
    reason: "handover",
    placeLabel: "Synthetic ward",
    ...(generation === undefined ? {} : { generation }),
  });
}
function visible(generation: number) {
  return scopeWardFlowState({ ...initial, worldGeneration: generation }, desk, {
    now: NOW_ANCHOR,
    places,
    grants: readWardAccessSnapshot().records,
  }).state.patients.some(({ id }) => id === foreign.id);
}

it("local opening preserves its original generation when a reset reuses the patient ID", () => {
  expect(visible(0)).toBe(false);
  expect(open(0)?.generation).toBe(0);
  expect(visible(0)).toBe(true);
  expect(visible(1)).toBe(false);
  expect(readWardAccessSnapshot().records).toHaveLength(1);
  expect(readWardAccessSnapshot().records[0].generation).toBe(0);
});

it("a new local opening after reset grants the new record without changing the original opening", () => {
  open(0);
  expect(visible(1)).toBe(false);
  expect(open(1)?.generation).toBe(1);
  expect(visible(1)).toBe(true);
  expect(readWardAccessSnapshot().records.map(({ generation }) => generation)).toEqual([0, 1]);
});

it("an older caller without a generation remains confined to the original workspace", () => {
  expect(open()?.generation).toBe(0);
  expect(visible(0)).toBe(true);
  expect(visible(1)).toBe(false);
});
