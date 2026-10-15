import { describe, expect, it } from "vitest";

import { BED_RELEASE_BLOCKERS } from "../src/components/ward-management/ward-change-reasons";
import { EVENT_ROLE } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function anOccupantWithNoBlocker(state: WardFlowState) {
  const found = state.admissions.find((a) => a.state === "occupied" && a.blockReason === null);
  if (!found) throw new Error("the seed has nobody in a bed without a recorded blocker");
  return found;
}

function find(state: WardFlowState, id: string) {
  const found = state.admissions.find((a) => a.id === id);
  if (!found) throw new Error(`missing admission ${id}`);
  return found;
}

function record(state: WardFlowState, admissionId: string, actingUnitId: string, blocker: string) {
  return wardFlowReducer(state, {
    type: "RECORD_STAY_DISCHARGE_BLOCKER",
    role: "ward",
    now: NOW,
    admissionId,
    actingUnitId,
    blocker: blocker as (typeof BED_RELEASE_BLOCKERS)[number],
  });
}

describe("a stay-level discharge blocker, recorded before any bed release exists", () => {
  it("is allowed for the ward and the coordinator only", () => {
    expect(EVENT_ROLE.RECORD_STAY_DISCHARGE_BLOCKER).toEqual(["ward", "coordinator"]);
    expect(EVENT_ROLE.CLEAR_STAY_DISCHARGE_BLOCKER).toEqual(["ward", "coordinator"]);
  });

  it("writes the chosen reason onto the stay and moves no bed figure", () => {
    const state = seedWardFlowState();
    const person = anOccupantWithNoBlocker(state);
    const next = record(state, person.id, person.unitId, BED_RELEASE_BLOCKERS[0]);

    expect(next.rejections).toHaveLength(state.rejections.length);
    expect(find(next, person.id).blockReason).toBe(BED_RELEASE_BLOCKERS[0]);
    expect(next.units).toEqual(state.units);
    expect(next.bedReleases).toEqual(state.bedReleases);
  });

  it("clears again, and refuses to clear one that was never recorded", () => {
    const state = seedWardFlowState();
    const person = anOccupantWithNoBlocker(state);
    const cleared = (s: WardFlowState) =>
      wardFlowReducer(s, {
        type: "CLEAR_STAY_DISCHARGE_BLOCKER",
        role: "ward",
        now: NOW,
        admissionId: person.id,
        actingUnitId: person.unitId,
      });

    const refused = cleared(state);
    expect(refused.rejections.length).toBe(state.rejections.length + 1);

    const back = cleared(record(state, person.id, person.unitId, BED_RELEASE_BLOCKERS[0]));
    expect(find(back, person.id).blockReason).toBeNull();
    expect(back.rejections.length).toBe(state.rejections.length);
  });

  it("refuses a reason that is not on the chosen list, so typed text can never be stored", () => {
    const state = seedWardFlowState();
    const person = anOccupantWithNoBlocker(state);
    const next = record(state, person.id, person.unitId, "Some typed sentence");

    expect(next.rejections.length).toBe(state.rejections.length + 1);
    expect(find(next, person.id).blockReason).toBeNull();
  });

  it("refuses another ward's patient and a person who is not in a bed", () => {
    const state = seedWardFlowState();
    const person = anOccupantWithNoBlocker(state);
    const otherUnit = state.units.find((u) => u.id !== person.unitId);
    if (!otherUnit) throw new Error("need a second unit");

    const wrongWard = record(state, person.id, otherUnit.id, BED_RELEASE_BLOCKERS[0]);
    expect(wrongWard.rejections.at(-1)?.reason).toContain("was raised acting as unit");

    const notInBed = state.admissions.find((a) => a.state !== "occupied");
    if (notInBed) {
      const refused = record(state, notInBed.id, notInBed.unitId, BED_RELEASE_BLOCKERS[0]);
      expect(refused.rejections.length).toBe(state.rejections.length + 1);
      expect(find(refused, notInBed.id).blockReason).toBe(notInBed.blockReason);
    }
  });
});
