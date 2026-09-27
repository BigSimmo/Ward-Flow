// tests/ward-acting-unit-guards.test.ts
//
// ONE WARD MUST NOT ACT ON ANOTHER WARD'S BED. Six places in the reducer say so, and until this
// file none of them had ever been executed by a test.
//
// That is a measured claim, not an impression. `docs/ward-flow/journey/refusal-coverage.mjs` reads
// a v8 lcov report, buckets every `return reject(` in `ward-flow-reducer.ts` into the case it sits
// in, and reports which ones no test reaches. Run over 573 ward test files on 2026-09-19 it could
// speak for all 313 refusals — nothing came back unknown — and thirty had never run. Six of those
// thirty were this one safeguard, repeated:
//
//   REVERT_BED_RELEASE        line 4702
//   BLOCK_BED_RELEASE         line 4734
//   CLEAR_BED_RELEASE_BLOCK   line 4780
//   SET_BED_PREPARATION       line 4814
//   RELEASE_BED               line 4850
//   RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT   line 4470  (an admission, not a release)
//
// ⚠️ WHY THIS PARTICULAR GAP IS EASY TO LEAVE OPEN, AND WHY IT MATTERS ON A WARD. Every one of
// these events carries `actingUnitId` — a CLAIM about who is acting, not proof of it, which is
// what the field's own doc comment says. The happy path always passes the right unit, so a test
// written by walking a normal journey never goes near the guard. Meanwhile the thing the guard
// stops is not exotic: two wards are looking at the same patient's move, and the one that does NOT
// hold the bed reverts, blocks, unblocks, marks-as-being-cleaned or outright releases it. The bed
// figures the other ward is reading then change under them, with nothing recorded against the ward
// that actually did it.
//
// 🔴 EACH TEST CARRIES ITS OWN CONTROL, AND THE CONTROL IS THE POINT. A refusal is easy to
// provoke by accident: a release in the wrong state, a missing field, an unknown id all refuse
// too, and any of them would make this file green while proving nothing about acting units. So
// every case dispatches the SAME event twice — once naming a ward that does not own the record,
// once naming the ward that does — and asserts the acting-unit sentence appears in the first and
// is ABSENT from the second. The second call may still be refused for its own unrelated reasons
// (a release that is not `confirmed` cannot be reverted, for instance); that is fine and is
// deliberately not asserted about. What must not happen is the acting-unit refusal firing when the
// right ward asks.
//
// The fixture reads the seed rather than hard-coding ids, so a reseed cannot silently turn these
// into tests of a record that no longer exists — it throws instead, naming what it could not find.
import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { BED_RELEASE_BLOCKERS } from "../src/components/ward-management/ward-change-reasons";
import { BED_RELEASE_WAITING_ON } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function addedRejections(before: WardFlowState, after: WardFlowState) {
  return after.rejections.slice(before.rejections.length);
}

/** A ward that is definitely not the one owning the record under test. */
function someOtherWard(state: WardFlowState, ownerUnitId: string): string {
  const other = state.units.find((unit) => unit.id !== ownerUnitId);
  if (!other) {
    throw new Error("the seed carries fewer than two units, so there is no wrong ward to act as");
  }
  return other.id;
}

function firstRelease(state: WardFlowState) {
  const release = state.bedReleases[0];
  if (!release) throw new Error("the seed carries no bed release, so these guards cannot be reached");
  return release;
}

function firstAdmission(state: WardFlowState) {
  const admission = state.admissions[0];
  if (!admission) throw new Error("the seed carries no admission, so this guard cannot be reached");
  return admission;
}

/**
 * The five bed-release events, each built twice from the same shape so the only difference between
 * the test and its control is the acting ward.
 */
const RELEASE_EVENTS: ReadonlyArray<{
  type: string;
  build: (releaseId: string, actingUnitId: string) => WardFlowEvent;
}> = [
  {
    type: "REVERT_BED_RELEASE",
    build: (releaseId, actingUnitId) => ({
      type: "REVERT_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId,
      actingUnitId,
      waitingOn: BED_RELEASE_WAITING_ON[0],
    }),
  },
  {
    type: "BLOCK_BED_RELEASE",
    build: (releaseId, actingUnitId) => ({
      type: "BLOCK_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId,
      actingUnitId,
      blocker: BED_RELEASE_BLOCKERS[0],
    }),
  },
  {
    type: "CLEAR_BED_RELEASE_BLOCK",
    build: (releaseId, actingUnitId) => ({
      type: "CLEAR_BED_RELEASE_BLOCK",
      role: "ward",
      now: NOW,
      releaseId,
      actingUnitId,
    }),
  },
  {
    type: "SET_BED_PREPARATION",
    build: (releaseId, actingUnitId) => ({
      type: "SET_BED_PREPARATION",
      role: "ward",
      now: NOW,
      releaseId,
      actingUnitId,
      preparing: true,
    }),
  },
  {
    type: "RELEASE_BED",
    build: (releaseId, actingUnitId) => ({
      type: "RELEASE_BED",
      role: "ward",
      now: NOW,
      releaseId,
      actingUnitId,
    }),
  },
] as const;

describe("a ward cannot act on another ward's bed release", () => {
  for (const { type, build } of RELEASE_EVENTS) {
    it(`${type} refuses when the acting ward does not own the release`, () => {
      const seeded = seedWardFlowState();
      const release = firstRelease(seeded);
      const intruder = someOtherWard(seeded, release.unitId);

      const after = wardFlowReducer(seeded, build(release.id, intruder));
      const added = addedRejections(seeded, after);

      expect(added.map((rejection) => rejection.reason)).toEqual([
        `${type} was raised acting as unit ${intruder} but release ${release.id} belongs to unit ${release.unitId}`,
      ]);
      expect(added[0]?.attempted).toBe(type);

      // Refused, not merely complained about: the releases themselves must be untouched.
      expect(after.bedReleases).toEqual(seeded.bedReleases);
    });

    it(`${type} does not raise that refusal for the ward that owns the release`, () => {
      const seeded = seedWardFlowState();
      const release = firstRelease(seeded);

      const after = wardFlowReducer(seeded, build(release.id, release.unitId));

      // The owning ward's call may still be refused on its own merits — a release that is not
      // `confirmed` cannot be reverted, and that is not this file's business. What it must never
      // be refused for is acting as the wrong ward.
      const actingUnitComplaints = addedRejections(seeded, after).filter((rejection) =>
        rejection.reason.includes("was raised acting as unit"),
      );
      expect(actingUnitComplaints).toEqual([]);
    });
  }
});

describe("a ward cannot record another ward's patient back from an emergency department", () => {
  const TYPE = "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT";

  const build = (admissionId: string, actingUnitId: string): WardFlowEvent => ({
    type: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT",
    role: "ward",
    now: NOW,
    admissionId,
    actingUnitId,
  });

  it("refuses when the acting ward does not hold the admission", () => {
    const seeded = seedWardFlowState();
    const admission = firstAdmission(seeded);
    const intruder = someOtherWard(seeded, admission.unitId);

    const after = wardFlowReducer(seeded, build(admission.id, intruder));
    const added = addedRejections(seeded, after);

    expect(added.map((rejection) => rejection.reason)).toEqual([
      `${TYPE} was raised acting as unit ${intruder} but admission ${admission.id} belongs to unit ${admission.unitId}`,
    ]);
    expect(added[0]?.attempted).toBe(TYPE);
    expect(after.admissions).toEqual(seeded.admissions);
  });

  it("does not raise that refusal for the ward that holds the admission", () => {
    const seeded = seedWardFlowState();
    const admission = firstAdmission(seeded);

    const after = wardFlowReducer(seeded, build(admission.id, admission.unitId));

    const actingUnitComplaints = addedRejections(seeded, after).filter((rejection) =>
      rejection.reason.includes("was raised acting as unit"),
    );
    expect(actingUnitComplaints).toEqual([]);
  });
});
