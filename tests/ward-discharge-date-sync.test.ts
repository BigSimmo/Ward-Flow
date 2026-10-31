import { describe, expect, it } from "vitest";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { BED_PREPARATION_NOTES, BED_RELEASE_BLOCKERS } from "../src/components/ward-management/ward-change-reasons";
import type { BedRelease } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const ORIGINAL_DATE = NOW_ANCHOR + 60;
const MOVED_DATE = NOW_ANCHOR + 3 * 1440;

function fixture(releaseState: "expected" | "confirmed" = "expected") {
  const seed = seedWardFlowState();
  const stay = {
    ...seed.admissions[0],
    id: "AD-DATE-SYNC",
    state: "occupied" as const,
    expectedDischargeAt: ORIGINAL_DATE,
    dischargeDateMoves: 2,
    dischargeDateSetAt: NOW_ANCHOR - 20,
    dischargeDateSetBy: "Ward manager" as const,
  };
  const release: BedRelease = {
    id: "WR-DATE-SYNC",
    admissionId: stay.id,
    unitId: stay.unitId,
    state: releaseState,
    expectedAt: ORIGINAL_DATE,
    confirmedAt: NOW_ANCHOR - 30,
    confirmedBy: "Ward manager",
    waitingOn: null,
    blocker: BED_RELEASE_BLOCKERS[0],
    blockedBy: "Ward manager",
    preparing: true,
    preparationNote: BED_PREPARATION_NOTES[0] ?? null,
  };
  const historical: BedRelease = { ...release, id: "WR-DATE-HISTORY", state: "discharged" };
  const unrelated: BedRelease = { ...release, id: "WR-DATE-OTHER", admissionId: "AD-DATE-OTHER" };
  const state: WardFlowState = { ...seed, admissions: [stay], bedReleases: [release, historical, unrelated] };
  return { state, stay, release, historical, unrelated };
}

describe("pending bed releases follow an edited stay discharge date", () => {
  it.each([
    ["expected", "ward"],
    ["confirmed", "ward"],
    ["expected", "coordinator"],
    ["confirmed", "coordinator"],
  ] as const)("moves a %s release for a %s edit while retaining confirmation provenance", (stage, role) => {
    const { state, stay, release, historical, unrelated } = fixture(stage);
    const changed = wardFlowReducer(state, {
      type: "UPDATE_EXPECTED_DISCHARGE",
      role,
      now: NOW_ANCHOR,
      admissionId: stay.id,
      ...(role === "ward" ? { actingUnitId: stay.unitId } : {}),
      expectedDischargeAt: MOVED_DATE,
    });

    expect(changed.rejections).toEqual(state.rejections);
    expect(changed.admissions[0]).toEqual({
      ...stay,
      expectedDischargeAt: MOVED_DATE,
      dischargeDateMoves: 3,
      dischargeDateSetAt: NOW_ANCHOR,
      dischargeDateSetBy: role === "ward" ? "Nurse in charge" : null,
    });
    expect(changed.bedReleases[0]).toEqual({ ...release, expectedAt: MOVED_DATE });
    expect(changed.bedReleases[1]).toBe(historical);
    expect(changed.bedReleases[2]).toBe(unrelated);
    expect(changed.units).toBe(state.units);
    expect(changed.leaveBeds).toBe(state.leaveBeds);
    expect(changed.movements).toBe(state.movements);
    expect(state.admissions[0]).toBe(stay);
    expect(state.bedReleases[0]).toBe(release);
  });

  it("repairs a stale linked release when the existing stay date is saved again, without adding a date move", () => {
    const { state, stay, release } = fixture();
    state.bedReleases[0] = { ...release, expectedAt: ORIGINAL_DATE - 1440 };
    const changed = wardFlowReducer(state, {
      type: "UPDATE_EXPECTED_DISCHARGE",
      role: "ward",
      now: NOW_ANCHOR,
      actingUnitId: stay.unitId,
      admissionId: stay.id,
      expectedDischargeAt: ORIGINAL_DATE,
    });

    expect(changed.rejections).toEqual(state.rejections);
    expect(changed.bedReleases[0]).toEqual(release);
    expect(changed.admissions[0].dischargeDateMoves).toBe(stay.dischargeDateMoves);
  });

  it.each([NaN, Infinity, -Infinity])("refuses invalid date %s before changing either record", (date) => {
    const { state, stay } = fixture();
    const changed = wardFlowReducer(state, {
      type: "UPDATE_EXPECTED_DISCHARGE",
      role: "ward",
      now: NOW_ANCHOR,
      actingUnitId: stay.unitId,
      admissionId: stay.id,
      expectedDischargeAt: date,
    });
    expect(changed.rejections).toHaveLength(state.rejections.length + 1);
    expect(changed.admissions).toBe(state.admissions);
    expect(changed.bedReleases).toBe(state.bedReleases);
    expect(changed.units).toBe(state.units);
  });

  it.each(["other-ward", undefined])("refuses an unscoped ward edit (%s) atomically", (actingUnitId) => {
    const { state, stay } = fixture();
    const changed = wardFlowReducer(state, {
      type: "UPDATE_EXPECTED_DISCHARGE",
      role: "ward",
      now: NOW_ANCHOR,
      actingUnitId,
      admissionId: stay.id,
      expectedDischargeAt: MOVED_DATE,
    });
    expect(changed.rejections).toHaveLength(state.rejections.length + 1);
    expect(changed.admissions).toBe(state.admissions);
    expect(changed.bedReleases).toBe(state.bedReleases);
  });

  it("refuses a departed stay without changing its historical release", () => {
    const { state, stay } = fixture();
    state.admissions[0] = { ...stay, state: "departed" };
    const changed = wardFlowReducer(state, {
      type: "UPDATE_EXPECTED_DISCHARGE",
      role: "coordinator",
      now: NOW_ANCHOR,
      admissionId: stay.id,
      expectedDischargeAt: MOVED_DATE,
    });
    expect(changed.rejections).toHaveLength(state.rejections.length + 1);
    expect(changed.admissions).toBe(state.admissions);
    expect(changed.bedReleases).toBe(state.bedReleases);
  });
});
