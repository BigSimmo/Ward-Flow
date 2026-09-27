import { describe, expect, it } from "vitest";

import { capacityBreakdown } from "../src/components/ward-management/ward-bed-availability";
import {
  seedWardFlowStateAt,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "../src/components/ward-management/ward-flow-storage-validation";
import { leaveBeds } from "../src/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

/**
 * Owner ruling, Josh, 25 September 2026: each bed on leave is linked to the patient stay it belongs
 * to, the same way bed releases are (`LeaveBed.admissionId`). Tests L1 to L8 of the leave-bed plan
 * (D:/Temp/claude/leave-bed-link-plan.md). People are chosen from state, never hard-coded, so a seed
 * change cannot silently make a test exercise a different case from the one it names.
 */

function seeded() {
  return seedWardFlowStateAt(0);
}

function unit(state: WardFlowState, id: string) {
  const found = state.units.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing unit ${id}`);
  return found;
}

/** An occupant who is not on leave, optionally on a given unit or not a given person. */
function anOccupantNotOnLeave(state: WardFlowState, options: { unitId?: string; notId?: string } = {}) {
  const found = state.admissions.find(
    (a) =>
      a.state === "occupied" &&
      (options.unitId === undefined || a.unitId === options.unitId) &&
      a.id !== options.notId &&
      !state.leaveBeds.some((bed) => bed.admissionId === a.id),
  );
  if (!found) throw new Error("the seed has no occupant who is not on leave");
  return found;
}

function recordLeave(state: WardFlowState, person: { id: string; unitId: string }, unitId = person.unitId) {
  return wardFlowReducer(state, {
    type: "RECORD_LEAVE_BED",
    role: "ward",
    now: NOW,
    unitId,
    actingUnitId: unitId,
    admissionId: person.id,
    expectedReturn: NOW + 240,
  });
}

function leaveWard(state: WardFlowState, person: { id: string; unitId: string }) {
  return wardFlowReducer(state, {
    type: "RECORD_LEAVING",
    role: "ward",
    now: NOW,
    admissionId: person.id,
    actingUnitId: person.unitId,
    leavingDestination: "discharged-to-the-community",
  });
}

function onLeaveFigure(state: WardFlowState, unitId: string) {
  return capacityBreakdown(unit(state, unitId), state.bedReleases, state.leaveBeds, NOW).onLeave;
}

describe("a leave bed names the stay it belongs to (owner ruling, 2026-09-25)", () => {
  it("L1: recording leave for an occupant creates a row naming them on their own ward", () => {
    const state = seeded();
    const person = anOccupantNotOnLeave(state);
    const after = recordLeave(state, person);
    expect(after.rejections).toEqual(state.rejections);
    const created = after.leaveBeds.at(-1);
    expect(created?.admissionId).toBe(person.id);
    expect(created?.unitId).toBe(person.unitId);
  });

  describe("L2: refusals, each leaving the leave list and the id sequence untouched", () => {
    function expectRefused(before: WardFlowState, after: WardFlowState) {
      expect(after.rejections.length).toBe(before.rejections.length + 1);
      expect(after.leaveBeds).toEqual(before.leaveBeds);
      expect(after.leaveBedSequence).toBe(before.leaveBedSequence);
    }

    it("an unknown stay", () => {
      const state = seeded();
      const person = anOccupantNotOnLeave(state);
      expectRefused(state, recordLeave(state, { id: "AD-NOBODY", unitId: person.unitId }));
    });

    it("a stay on another ward", () => {
      const state = seeded();
      const person = anOccupantNotOnLeave(state);
      const otherWard = state.units.find((candidate) => candidate.id !== person.unitId)!;
      expectRefused(state, recordLeave(state, person, otherWard.id));
    });

    it.each(["departed", "pulled", "waitlisted"] as const)("a stay that is %s, not in a bed", (notInBed) => {
      const state = seeded();
      const person = state.admissions.find((a) => a.state === notInBed);
      if (!person) {
        // The seed may hold nobody in this state; put one there by rewriting a copy, never the seed.
        const occupant = anOccupantNotOnLeave(state);
        const rewritten: WardFlowState = {
          ...state,
          admissions: state.admissions.map((a) => (a.id === occupant.id ? { ...a, state: notInBed } : a)),
        };
        expectRefused(rewritten, recordLeave(rewritten, occupant));
        return;
      }
      expectRefused(state, recordLeave(state, person));
    });

    it("a second leave for the same stay", () => {
      const state = seeded();
      const person = anOccupantNotOnLeave(state);
      const once = recordLeave(state, person);
      expect(once.rejections).toEqual(state.rejections);
      expectRefused(once, recordLeave(once, person));
    });
  });

  it("L3: leaving while on leave ends the leave exactly once, and the ward's figures match leaving without leave", () => {
    const state = seeded();
    const person = anOccupantNotOnLeave(state);
    const onLeave = recordLeave(state, person);
    const before = onLeaveFigure(onLeave, person.unitId);

    const leftWhileOnLeave = leaveWard(onLeave, person);
    expect(leftWhileOnLeave.rejections).toEqual(onLeave.rejections);
    expect(leftWhileOnLeave.leaveBeds.some((bed) => bed.admissionId === person.id)).toBe(false);
    expect(onLeaveFigure(leftWhileOnLeave, person.unitId)).toBe(before - 1);

    const leftWithoutLeave = leaveWard(state, person);
    expect(leftWhileOnLeave.units).toEqual(leftWithoutLeave.units);
  });

  it("L5: somebody else on the same ward leaving leaves this person's leave untouched", () => {
    const state = seeded();
    const person = anOccupantNotOnLeave(state);
    const onLeave = recordLeave(state, person);
    const other = anOccupantNotOnLeave(onLeave, { unitId: person.unitId, notId: person.id });
    const row = onLeave.leaveBeds.find((bed) => bed.admissionId === person.id);

    const after = leaveWard(onLeave, other);
    expect(after.leaveBeds.find((bed) => bed.admissionId === person.id)).toEqual(row);
  });

  it("L6: after a leave ends, the same person can go on leave again, under a new id", () => {
    const state = seeded();
    const person = anOccupantNotOnLeave(state);
    const first = recordLeave(state, person);
    const firstRow = first.leaveBeds.find((bed) => bed.admissionId === person.id)!;
    const ended = wardFlowReducer(first, {
      type: "END_LEAVE_BED",
      role: "ward",
      now: NOW,
      leaveBedId: firstRow.id,
      actingUnitId: person.unitId,
    });
    expect(ended.rejections).toEqual(first.rejections);

    const again = recordLeave(ended, person);
    expect(again.rejections).toEqual(ended.rejections);
    const secondRow = again.leaveBeds.find((bed) => bed.admissionId === person.id);
    expect(secondRow?.id).toMatch(/^WL-9\d+$/);
    expect(secondRow?.id).not.toBe(firstRow.id);
  });

  it("L7: storage accepts a linked leave row and refuses a missing, unknown, wrong-ward, not-in-bed or doubled link", () => {
    const state = seeded();
    const person = anOccupantNotOnLeave(state);
    const withLeave = recordLeave(state, person);
    const payload = JSON.parse(JSON.stringify(withLeave)) as Record<string, unknown>;
    expect(isValidStoredWardFlowState(payload)).toBe(true);

    const mine = withLeave.leaveBeds.find((bed) => bed.admissionId === person.id)!;
    const elsewhere = state.admissions.find((a) => a.state === "occupied" && a.unitId !== person.unitId)!;
    const notInBed = state.admissions.find((a) => a.state !== "occupied" && a.unitId === person.unitId);

    function withMyRow(change: (row: Record<string, unknown>) => Record<string, unknown> | Record<string, unknown>[]) {
      const clone = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
      const rows = clone.leaveBeds as Record<string, unknown>[];
      clone.leaveBeds = rows.flatMap((row) => (row.id === mine.id ? change(row) : [row]));
      return clone;
    }

    expect(
      isValidStoredWardFlowState(
        withMyRow((row) => {
          const copy = { ...row };
          delete copy.admissionId;
          return copy;
        }),
      ),
    ).toBe(false);
    expect(isValidStoredWardFlowState(withMyRow((row) => ({ ...row, admissionId: "AD-NOBODY" })))).toBe(false);
    expect(isValidStoredWardFlowState(withMyRow((row) => ({ ...row, admissionId: elsewhere.id })))).toBe(false);
    if (notInBed) {
      expect(isValidStoredWardFlowState(withMyRow((row) => ({ ...row, admissionId: notInBed.id })))).toBe(false);
    }
    expect(isValidStoredWardFlowState(withMyRow((row) => [row, { ...row, id: "WL-999" }]))).toBe(false);
  });

  it("L8: every seeded leave bed names an occupied stay on its own ward, at most one per stay", () => {
    // Anti-vacuity: the standard seed carries the authored on-leave patients (demo draft, 25 Sept).
    expect(leaveBeds.length).toBeGreaterThan(0);
    const state = seeded();
    expect(state.leaveBeds.length).toBeGreaterThan(0);
    for (const bed of state.leaveBeds) {
      const stay = state.admissions.find((a) => a.id === bed.admissionId);
      expect(stay?.unitId, bed.id).toBe(bed.unitId);
      expect(stay?.state, bed.id).toBe("occupied");
    }
    expect(new Set(state.leaveBeds.map((bed) => bed.admissionId)).size).toBe(state.leaveBeds.length);
  });
});
