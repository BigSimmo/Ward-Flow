import { describe, expect, it } from "vitest";

import { bedIsOccupied } from "@/components/ward-management/ward-admissions";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardStaySeats } from "@/components/ward-management/ward/ward-bed-layout";
import type { Unit } from "@/components/ward-management/ward-model";

/**
 * H-0978 / WS-15 (Josh 26 Oct 2026, "Close the exact bed"): `SET_BED_CLOSED` records a closed mark
 * on one exact empty bed, refuses a bed someone is in, and reopening ends the mark. A closed bed is
 * not offered, so Ready drops by one while it is closed and comes back when it reopens. Synthetic
 * seeded state only.
 */
const NOW = NOW_ANCHOR;

/** The bed numbers a current stay sits in, as the reducer and the Bed board seat them. */
function takenBeds(state: WardFlowState, unit: Unit): Set<number> {
  const stays = state.admissions.filter((admission) => admission.unitId === unit.id);
  const seats = wardStaySeats(unit, stays);
  return new Set(
    stays.flatMap((stay) => {
      const bed = bedIsOccupied(stay) ? (stay.bedNumber ?? seats.get(stay.id)) : undefined;
      return bed === undefined ? [] : [bed];
    }),
  );
}

function setup() {
  const state = seedWardFlowState();
  const unit = state.units.find((candidate) => {
    const taken = takenBeds(state, candidate);
    return boundedBedAvailability(candidate).available >= 2 && taken.size > 0 && taken.size < candidate.beds;
  })!;
  const taken = takenBeds(state, unit);
  const freeBed = [...Array(unit.beds).keys()].map((i) => unit.beds - i).find((bed) => !taken.has(bed))!;
  const occupiedBed = [...taken][0]!;
  return { state, unit, freeBed, occupiedBed };
}

const setBedClosed = (state: WardFlowState, unitId: string, bedNumber: number, closed: boolean) =>
  wardFlowReducer(state, {
    type: "SET_BED_CLOSED",
    role: "ward",
    now: NOW,
    unitId,
    actingUnitId: unitId,
    bedNumber,
    closed,
  });

const unitOf = (state: WardFlowState, unitId: string) => state.units.find((unit) => unit.id === unitId)!;
const readyOf = (state: WardFlowState, unitId: string) =>
  bedStates(unitOf(state, unitId), state.admissions, state.bedReleases, state.leaveBeds).ready;

describe("SET_BED_CLOSED", () => {
  it("closes the exact empty bed, refuses an occupied one, and reopens it", () => {
    const { state, unit, freeBed, occupiedBed } = setup();
    const readyBefore = readyOf(state, unit.id);

    const closed = setBedClosed(state, unit.id, freeBed, true);
    expect(closed.rejections).toEqual(state.rejections);
    expect(unitOf(closed, unit.id).closedBeds).toEqual([{ bedNumber: freeBed, at: NOW, by: expect.any(String) }]);
    // Not offered while closed; the ward's own confirmed figure is left as it stated it.
    expect(readyOf(closed, unit.id)).toBe(readyBefore - 1);
    expect(unitOf(closed, unit.id).allocatable.value).toBe(unit.allocatable.value);
    expect(setBedClosed(closed, unit.id, freeBed, true).rejections.at(-1)?.reason).toMatch(/already closed/);

    const refused = setBedClosed(state, unit.id, occupiedBed, true);
    expect(refused.rejections).toHaveLength(state.rejections.length + 1);
    expect(refused.rejections.at(-1)?.reason).toMatch(/has someone in it/);
    expect(unitOf(refused, unit.id).closedBeds).toBeUndefined();

    const reopened = setBedClosed(closed, unit.id, freeBed, false);
    expect(reopened.rejections).toEqual(state.rejections);
    // The mark ends but stays as seat history, so nobody seated meanwhile moves into the bed.
    expect(unitOf(reopened, unit.id).closedBeds).toEqual([
      { bedNumber: freeBed, at: NOW, by: expect.any(String), reopenedAt: NOW },
    ]);
    expect(readyOf(reopened, unit.id)).toBe(readyBefore);
    expect(setBedClosed(reopened, unit.id, freeBed, false).rejections.at(-1)?.reason).toMatch(/is not closed/);
  });

  it("refuses a ward acting for another ward and a desk that may not raise it", () => {
    const { state, unit, freeBed } = setup();
    const other = state.units.find((candidate) => candidate.id !== unit.id)!;
    const crossWard = wardFlowReducer(state, {
      type: "SET_BED_CLOSED",
      role: "ward",
      now: NOW,
      unitId: unit.id,
      actingUnitId: other.id,
      bedNumber: freeBed,
      closed: true,
    });
    expect(crossWard.rejections).toHaveLength(state.rejections.length + 1);
    const ed = wardFlowReducer(state, {
      type: "SET_BED_CLOSED",
      role: "ed",
      now: NOW,
      unitId: unit.id,
      actingUnitId: unit.id,
      bedNumber: freeBed,
      closed: true,
    });
    expect(ed.rejections).toHaveLength(state.rejections.length + 1);
    expect(unitOf(ed, unit.id).closedBeds).toBeUndefined();
  });
});
