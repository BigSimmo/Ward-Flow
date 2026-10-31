import { describe, expect, it } from "vitest";

import {
  type CountedFigure,
  UNCHANGED_SHIFTS_LISTED,
  unchangedConfirmations,
} from "@/components/ward-management/capacity/shift-confirmations";
import { currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Capacity's This shift lists wards that confirmed the same number 3 or more shifts in a row
 * (Josh, 31 Oct 2026). The run is counted by CONFIRM_CAPACITY itself, so a ward's real confirmations
 * build it: one more each new shift with the same number, none when the number changes. Synthetic
 * seed only.
 */
const HOUR = 60 * 60 * 1000;

function confirm(state: WardFlowState, unitId: string, value: number, now: number): WardFlowState {
  const unit = state.units.find((candidate) => candidate.id === unitId)!;
  const next = wardFlowReducer(state, {
    type: "CONFIRM_CAPACITY",
    role: "ward",
    now,
    unitId,
    actingUnitId: unitId,
    value,
    expectedRevision: unit.allocatable.revision ?? 0,
  });
  expect(next.rejections, "the confirmation was rejected").toHaveLength(state.rejections.length);
  return next;
}

const runOf = (state: WardFlowState, unitId: string) =>
  (state.units.find((unit) => unit.id === unitId)!.allocatable as CountedFigure).unchangedShifts ?? 0;

/** One instant inside each of `count` consecutive shifts, starting with the shift after NOW_ANCHOR. */
function laterShifts(count: number): number[] {
  const instants: number[] = [];
  let at = NOW_ANCHOR;
  while (instants.length < count) {
    at += HOUR;
    if (currentShiftStartInstant(at) > currentShiftStartInstant(instants.at(-1) ?? NOW_ANCHOR)) instants.push(at);
  }
  return instants;
}

describe("CONFIRM_CAPACITY counts a run of unchanged confirmations", () => {
  const seed = seedWardFlowState();
  const ward = seed.units.find((unit) => !unit.isClosed && unit.beds > 1)!;
  const value = Math.min(ward.allocatable.value, ward.beds);

  it("lists a ward once it confirms the same number for 3 shifts after its first", () => {
    let state = confirm(seed, ward.id, value, NOW_ANCHOR);
    expect(runOf(state, ward.id)).toBe(0);
    const shifts = laterShifts(UNCHANGED_SHIFTS_LISTED);
    shifts.forEach((at, index) => {
      state = confirm(state, ward.id, value, at);
      expect(runOf(state, ward.id)).toBe(index + 1);
    });
    expect(unchangedConfirmations(state.units).map((row) => row.unit.id)).toContain(ward.id);
  });

  it("does not add to the run for a second confirmation in the same shift", () => {
    const first = confirm(seed, ward.id, value, NOW_ANCHOR);
    const [next] = laterShifts(1);
    const once = confirm(first, ward.id, value, next!);
    const twice = confirm(once, ward.id, value, next! + 1);
    expect(runOf(twice, ward.id)).toBe(runOf(once, ward.id));
  });

  it("starts again when the number changes", () => {
    let state = confirm(seed, ward.id, value, NOW_ANCHOR);
    const shifts = laterShifts(3);
    state = confirm(state, ward.id, value, shifts[0]!);
    state = confirm(state, ward.id, value, shifts[1]!);
    expect(runOf(state, ward.id)).toBe(2);
    state = confirm(state, ward.id, value === 0 ? 1 : value - 1, shifts[2]!);
    expect(runOf(state, ward.id)).toBe(0);
  });
});
