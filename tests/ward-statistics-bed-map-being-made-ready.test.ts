// D-179 item 8 on the Statistics bed map (review of PR C, 13 Nov 2026). `bedStates` already keeps a
// bed being made ready off Ready, so the projected bed map must not take it off Ready a second time:
// its Ready squares equal the Ready figure, and the six kinds still add up to the ward's beds.
// Synthetic seed only.
import { describe, expect, it } from "vitest";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { projectExecutiveReportingFoundation } from "@/components/ward-management/statistics/executive-statistics-projector";
import { bedMapCells } from "@/components/ward-management/statistics/statistics-bed-map";

describe("Statistics bed map with a bed being made ready", () => {
  it("counts the bed once, as being made ready, and leaves Ready as the Ready figure", () => {
    const state = seedWardFlowState();
    const places = wardPlaceLookup(state.units);
    const before = projectExecutiveReportingFoundation(
      state,
      { role: "executive", scope: { kind: "statewide" } },
      { now: NOW_ANCHOR, dayZero: "2026-10-24T00:00:00.000Z", startedAt: "2026-10-24T00:00:00.000Z", places },
    );
    // A ward with a ready bed and no bed being made ready yet, chosen from the seed, not by position.
    const chosen = before.wards.find(
      (ward) =>
        ward.beds.ready > 0 &&
        ward.beds.beingMadeReady === 0 &&
        state.bedReleases.some((release) => release.unitId === ward.id),
    );
    expect(chosen, "fixture assumption: a ward with a ready bed and a release").toBeDefined();
    const template = state.bedReleases.find((release) => release.unitId === chosen!.id)!;
    state.bedReleases = [
      ...state.bedReleases,
      { ...template, id: `${template.id}-made-ready`, state: "discharged", preparing: true },
    ];

    const after = projectExecutiveReportingFoundation(
      state,
      { role: "executive", scope: { kind: "statewide" } },
      { now: NOW_ANCHOR, dayZero: "2026-10-24T00:00:00.000Z", startedAt: "2026-10-24T00:00:00.000Z", places },
    );
    const ward = after.wards.find((item) => item.id === chosen!.id)!;
    expect(ward.beds.beingMadeReady).toBe(1);
    expect(ward.bedMapCounts.ready).toBe(ward.beds.ready);
    expect(ward.bedMapCounts.prep).toBe(1);
    const unit = state.units.find((item) => item.id === ward.id)!;
    const total = Object.values(ward.bedMapCounts).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(unit.beds);
    // The ward's own bed map draws the same squares.
    expect(ward.bedMapCounts).toEqual(
      bedMapCells(unit, state.admissions, state.bedReleases, state.leaveBeds, NOW_ANCHOR).counts,
    );
  });
});
