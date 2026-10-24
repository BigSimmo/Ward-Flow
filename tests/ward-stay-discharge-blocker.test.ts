import { describe, expect, it } from "vitest";

import {
  BED_RELEASE_BLOCKERS,
  DISCHARGE_DELAY_CLEAR_REASONS,
} from "../src/components/ward-management/ward-change-reasons";
import { EVENT_ROLE } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function anOccupantWithNoBlocker(state: WardFlowState) {
  const found = state.admissions.find(
    (a) => a.state === "occupied" && a.blockReason === null && !state.bedReleases.some((r) => r.admissionId === a.id),
  );
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
  it("is allowed for the ward, the site bed manager (D-80) and the coordinator only", () => {
    expect(EVENT_ROLE.RECORD_STAY_DISCHARGE_BLOCKER).toEqual(["ward", "bed_manager", "coordinator"]);
    expect(EVENT_ROLE.CLEAR_STAY_DISCHARGE_BLOCKER).toEqual(["ward", "bed_manager", "coordinator"]);
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

  it("keeps the clearance on the stay when no bed release exists to hold it", () => {
    const state = seedWardFlowState();
    const person = state.admissions.find(
      (a) => a.state === "occupied" && a.blockReason === null && !state.bedReleases.some((r) => r.admissionId === a.id),
    );
    if (!person) throw new Error("the seed has nobody in a bed without a bed release");
    const blocked = record(state, person.id, person.unitId, BED_RELEASE_BLOCKERS[0]);
    expect(blocked.bedReleases.some((r) => r.admissionId === person.id)).toBe(false);
    const clear = (s: WardFlowState, reason?: (typeof DISCHARGE_DELAY_CLEAR_REASONS)[number]) =>
      wardFlowReducer(s, {
        type: "CLEAR_STAY_DISCHARGE_BLOCKER",
        role: "coordinator",
        now: NOW + 5,
        admissionId: person.id,
        actingUnitId: person.unitId,
        ...(reason === undefined ? {} : { reason }),
      });

    const withReason = clear(blocked, DISCHARGE_DELAY_CLEAR_REASONS[0]);
    expect(find(withReason, person.id).stayBlockClearances).toEqual([
      { at: NOW + 5, by: "coordinator", reason: DISCHARGE_DELAY_CLEAR_REASONS[0], blocker: BED_RELEASE_BLOCKERS[0] },
    ]);
    expect(withReason.bedReleases).toEqual(blocked.bedReleases);

    // A second clearance appends, and an omitted reason stays omitted rather than defaulted.
    const again = clear(record(withReason, person.id, person.unitId, BED_RELEASE_BLOCKERS[1]));
    const history = find(again, person.id).stayBlockClearances ?? [];
    expect(history).toHaveLength(2);
    expect(history[1]).toEqual({ at: NOW + 5, by: "coordinator", blocker: BED_RELEASE_BLOCKERS[1] });
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

  describe("stays in step with the bed release", () => {
    function flag(state: WardFlowState, person: { id: string; unitId: string }) {
      return wardFlowReducer(state, {
        type: "FLAG_BED_RELEASE",
        role: "ward",
        now: NOW,
        unitId: person.unitId,
        actingUnitId: person.unitId,
        admissionId: person.id,
        waitingOn: "Nothing outstanding",
        expectedAt: NOW + 60,
      });
    }

    function freshOccupant(state: WardFlowState) {
      const found = state.admissions.find(
        (a) =>
          a.state === "occupied" &&
          a.blockReason === null &&
          !state.bedReleases.some((r) => r.admissionId === a.id && r.state !== "discharged"),
      );
      if (!found) throw new Error("the seed has nobody in a bed with no live release and no blocker");
      return found;
    }

    function releaseOf(state: WardFlowState, admissionId: string) {
      const found = state.bedReleases.find((r) => r.admissionId === admissionId && r.state !== "discharged");
      if (!found) throw new Error("no live release");
      return found;
    }

    it("a release flagged after the stay blocker starts out blocked with that reason", () => {
      const state = seedWardFlowState();
      const person = freshOccupant(state);
      const withBlocker = record(state, person.id, person.unitId, BED_RELEASE_BLOCKERS[1]);
      const flagged = flag(withBlocker, person);

      expect(flagged.rejections).toHaveLength(state.rejections.length);
      expect(releaseOf(flagged, person.id).blocker).toBe(BED_RELEASE_BLOCKERS[1]);
      expect(releaseOf(flagged, person.id).blockedBy).not.toBeNull();
    });

    it("a release flagged with an explicit blocker puts that blocker on the stay too", () => {
      const state = seedWardFlowState();
      const person = freshOccupant(state);
      const withFlag = (s: WardFlowState) =>
        wardFlowReducer(s, {
          type: "FLAG_BED_RELEASE",
          role: "ward",
          now: NOW,
          unitId: person.unitId,
          actingUnitId: person.unitId,
          admissionId: person.id,
          waitingOn: "Nothing outstanding",
          expectedAt: NOW + 60,
          blocker: BED_RELEASE_BLOCKERS[2],
        });

      // Stay had no reason.
      const fromNone = withFlag(state);
      expect(fromNone.rejections).toHaveLength(state.rejections.length);
      expect(releaseOf(fromNone, person.id).blocker).toBe(BED_RELEASE_BLOCKERS[2]);
      expect(find(fromNone, person.id).blockReason).toBe(BED_RELEASE_BLOCKERS[2]);

      // Stay had a different reason: the flag's explicit blocker wins on both.
      const fromOther = withFlag(record(state, person.id, person.unitId, BED_RELEASE_BLOCKERS[0]));
      expect(releaseOf(fromOther, person.id).blocker).toBe(BED_RELEASE_BLOCKERS[2]);
      expect(find(fromOther, person.id).blockReason).toBe(BED_RELEASE_BLOCKERS[2]);
    });

    it("leaving clears the blocker on both the release and the stay", () => {
      const state = seedWardFlowState();
      const person = freshOccupant(state);
      const flagged = flag(record(state, person.id, person.unitId, BED_RELEASE_BLOCKERS[0]), person);
      expect(releaseOf(flagged, person.id).blocker).toBe(BED_RELEASE_BLOCKERS[0]);

      const left = wardFlowReducer(flagged, {
        type: "RECORD_LEAVING",
        role: "ward",
        now: NOW,
        admissionId: person.id,
        actingUnitId: person.unitId,
        leavingDestination: "discharged-to-the-community",
      });

      expect(left.rejections).toHaveLength(state.rejections.length);
      const gone = find(left, person.id);
      expect(gone.state).toBe("departed");
      expect(gone.blockReason).toBeNull();
      const release = left.bedReleases.find((r) => r.admissionId === person.id);
      expect(release?.state).toBe("discharged");
      expect(release?.blocker).toBeNull();
    });

    it("a release flagged with no stay blocker stays unblocked", () => {
      const state = seedWardFlowState();
      const person = freshOccupant(state);
      const flagged = flag(state, person);

      expect(releaseOf(flagged, person.id).blocker).toBeNull();
      expect(releaseOf(flagged, person.id).blockedBy).toBeNull();
    });

    it("clearing the release blocker (discharge board) also clears the stay's reason", () => {
      const state = seedWardFlowState();
      const person = freshOccupant(state);
      const flagged = flag(record(state, person.id, person.unitId, BED_RELEASE_BLOCKERS[0]), person);
      const release = releaseOf(flagged, person.id);

      const cleared = wardFlowReducer(flagged, {
        type: "CLEAR_BED_RELEASE_BLOCK",
        role: "ward",
        now: NOW,
        releaseId: release.id,
        actingUnitId: person.unitId,
      });

      expect(cleared.rejections).toHaveLength(state.rejections.length);
      expect(releaseOf(cleared, person.id).blocker).toBeNull();
      expect(find(cleared, person.id).blockReason).toBeNull();
    });

    it("replacing the release blocker also replaces the stay's reason", () => {
      const state = seedWardFlowState();
      const person = freshOccupant(state);
      const flagged = flag(record(state, person.id, person.unitId, BED_RELEASE_BLOCKERS[0]), person);
      const release = releaseOf(flagged, person.id);

      const replaced = wardFlowReducer(flagged, {
        type: "BLOCK_BED_RELEASE",
        role: "ward",
        now: NOW,
        releaseId: release.id,
        actingUnitId: person.unitId,
        blocker: BED_RELEASE_BLOCKERS[2],
      });

      expect(replaced.rejections).toHaveLength(state.rejections.length);
      expect(releaseOf(replaced, person.id).blocker).toBe(BED_RELEASE_BLOCKERS[2]);
      expect(find(replaced, person.id).blockReason).toBe(BED_RELEASE_BLOCKERS[2]);
    });
  });
});
