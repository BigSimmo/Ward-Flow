import { describe, expect, it } from "vitest";

import { bedIsOccupied } from "../src/components/ward-management/ward-admissions";
import { unitCapacity } from "../src/components/ward-management/ward-derivations";
import { EVENT_ROLE } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function admission(state: WardFlowState, id: string) {
  const found = state.admissions.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing admission ${id}`);
  return found;
}

function unit(state: WardFlowState, id: string) {
  const found = state.units.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing unit ${id}`);
  return found;
}

/** Somebody in a bed, on the ward, chosen from state rather than hard-coded. */
function anOccupantOnTheWard(state: WardFlowState) {
  const found = state.admissions.find(
    (candidate) =>
      candidate.state === "occupied" &&
      candidate.awayAtEmergencyDepartmentSince === null &&
      candidate.absentWithoutLeaveSince === null,
  );
  if (!found) throw new Error("the seed contains nobody occupying a bed who is on the ward");
  return found;
}

function recordAbsent(state: WardFlowState, admissionId: string, actingUnitId: string, now = NOW) {
  return wardFlowReducer(state, { type: "RECORD_ABSENT_WITHOUT_LEAVE", role: "ward", now, admissionId, actingUnitId });
}

function recordReturned(state: WardFlowState, admissionId: string, actingUnitId: string, now = NOW) {
  return wardFlowReducer(state, { type: "RECORD_RETURNED_FROM_ABSENCE", role: "ward", now, admissionId, actingUnitId });
}

describe("recording that a patient is absent without leave, and back", () => {
  it("records only the time the ward recorded it", () => {
    const state = seedWardFlowState();
    const person = anOccupantOnTheWard(state);

    const next = recordAbsent(state, person.id, person.unitId);

    expect(next.rejections).toHaveLength(0);
    expect(admission(next, person.id).absentWithoutLeaveSince).toBe(NOW);
  });

  it("clears it on return and moves no capacity figure either way", () => {
    const state = seedWardFlowState();
    const person = anOccupantOnTheWard(state);
    const before = unitCapacity(unit(state, person.unitId), state.bedReleases);

    const absent = recordAbsent(state, person.id, person.unitId);
    expect(absent.rejections).toHaveLength(0);
    expect(bedIsOccupied(admission(absent, person.id))).toBe(true);
    expect(unit(absent, person.unitId)).toEqual(unit(state, person.unitId));
    expect(unitCapacity(unit(absent, person.unitId), absent.bedReleases)).toEqual(before);

    const back = recordReturned(absent, person.id, person.unitId, NOW + 120);
    expect(back.rejections).toHaveLength(0);
    expect(admission(back, person.id).absentWithoutLeaveSince).toBeNull();
    expect(unit(back, person.unitId)).toEqual(unit(state, person.unitId));
  });

  it("refuses a ward acting on another ward's patient", () => {
    const state = seedWardFlowState();
    const person = anOccupantOnTheWard(state);
    const other = state.units.find((candidate) => candidate.id !== person.unitId);
    if (!other) throw new Error("the seed contains only one unit");

    const next = recordAbsent(state, person.id, other.id);
    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0]?.reason).toContain("belongs to unit");
    expect(admission(next, person.id).absentWithoutLeaveSince).toBeNull();

    const absent = recordAbsent(state, person.id, person.unitId);
    const wrongReturn = recordReturned(absent, person.id, other.id);
    expect(wrongReturn.rejections).toHaveLength(1);
    expect(admission(wrongReturn, person.id).absentWithoutLeaveSince).toBe(NOW);
  });

  it("refuses a second record, keeping the first recorded time", () => {
    const state = seedWardFlowState();
    const person = anOccupantOnTheWard(state);

    const absent = recordAbsent(state, person.id, person.unitId);
    const again = recordAbsent(absent, person.id, person.unitId, NOW + 60);

    expect(again.rejections).toHaveLength(1);
    expect(again.rejections[0]?.reason).toContain("already recorded as absent without leave");
    expect(admission(again, person.id).absentWithoutLeaveSince).toBe(NOW);
  });

  it("refuses a return for somebody not recorded as absent", () => {
    const state = seedWardFlowState();
    const person = anOccupantOnTheWard(state);

    const back = recordReturned(state, person.id, person.unitId);
    expect(back.rejections).toHaveLength(1);
    expect(back.rejections[0]?.reason).toContain("not recorded as absent without leave");
  });

  it("refuses somebody who is not occupying a bed", () => {
    const state = seedWardFlowState();
    const notOccupying = state.admissions.find((candidate) => candidate.state !== "occupied");
    if (!notOccupying) throw new Error("the seed contains nobody who is not occupying a bed");

    const next = recordAbsent(state, notOccupying.id, notOccupying.unitId);
    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0]?.reason).toContain("only somebody occupying a bed");
    expect(admission(next, notOccupying.id).absentWithoutLeaveSince).toBeNull();
  });

  it("does not let one person be both away at an emergency department and absent without leave", () => {
    const state = seedWardFlowState();
    const person = anOccupantOnTheWard(state);

    const atEd = wardFlowReducer(state, {
      type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
      role: "ward",
      now: NOW,
      admissionId: person.id,
      actingUnitId: person.unitId,
    });
    const absentWhileAtEd = recordAbsent(atEd, person.id, person.unitId);
    expect(absentWhileAtEd.rejections).toHaveLength(1);
    expect(absentWhileAtEd.rejections[0]?.reason).toContain("recorded as away at an emergency department");

    const absent = recordAbsent(state, person.id, person.unitId);
    const edWhileAbsent = wardFlowReducer(absent, {
      type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
      role: "ward",
      now: NOW,
      admissionId: person.id,
      actingUnitId: person.unitId,
    });
    expect(edWhileAbsent.rejections).toHaveLength(1);
    expect(edWhileAbsent.rejections[0]?.reason).toContain("recorded as absent without leave");
    expect(admission(edWhileAbsent, person.id).awayAtEmergencyDepartmentSince).toBeNull();
  });

  it("is a ward-only pair of events", () => {
    expect([...EVENT_ROLE.RECORD_ABSENT_WITHOUT_LEAVE]).toEqual(["ward"]);
    expect([...EVENT_ROLE.RECORD_RETURNED_FROM_ABSENCE]).toEqual(["ward"]);

    const state = seedWardFlowState();
    const person = anOccupantOnTheWard(state);
    for (const role of ["coordinator", "ed", "officer", "community", "demo"] as const) {
      const next = wardFlowReducer(state, {
        type: "RECORD_ABSENT_WITHOUT_LEAVE",
        role,
        now: NOW,
        admissionId: person.id,
        actingUnitId: person.unitId,
      });
      expect(next.rejections, `${role} was allowed to record absent without leave`).toHaveLength(1);
      expect(admission(next, person.id).absentWithoutLeaveSince).toBeNull();
    }
  });
});
