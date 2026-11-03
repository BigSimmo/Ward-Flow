import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const unitId = "fre-adult-open";
const now = NOW_ANCHOR;

/** Synthetic one-free-bed fixture; a closure leaves the ward's reported counts intact. */
function closedLastBed() {
  let state = wardFlowReducer(seedWardFlowState(), {
    type: "BOOK_PLANNED_ADMISSION",
    role: "coordinator",
    now,
    initials: "ZZ",
    sex: "Female",
    gender: "Female",
    reason: "respite",
    unitId,
    expectedArrivalAt: now + 1440,
    expectedStayDays: 7,
    legalStatus: "Voluntary",
    ageBand: "Adult",
    calendarDate: "2026-10-09",
  });
  const booking = state.plannedAdmissions.at(-1)!;
  expect(booking.id).toBe("PA-01");
  state = {
    ...state,
    bedReleases: state.bedReleases.filter((release) => release.unitId !== unitId),
    units: state.units.map((unit) =>
      unit.id === unitId
        ? {
            ...unit,
            empty: { ...unit.empty, value: 1 },
            allocatable: { ...unit.allocatable, value: 1 },
            closedBeds: [{ bedNumber: unit.beds, at: now, by: "ward" }],
          }
        : unit,
    ),
  };
  expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
  return { state, booking };
}

describe("planned arrivals respect individually closed beds", () => {
  it("refuses a valid booking while its ward has no Ready bed, including a repeated attempt", () => {
    const { state, booking } = closedLastBed();
    expect(boundedBedAvailability(state.units.find((unit) => unit.id === unitId)!).available).toBe(0);
    const event = {
      type: "CONVERT_PLANNED_ADMISSION" as const,
      role: "coordinator" as const,
      now,
      unitId,
      plannedAdmissionId: booking.id,
    };
    const refused = wardFlowReducer(state, event);
    const retried = wardFlowReducer(refused, event);
    for (const result of [refused, retried]) {
      expect(result.rejections.at(-1)?.reason).toMatch(/no empty bed/);
      expect(result.plannedAdmissions.at(-1)?.state).toBe("booked");
      expect(result.admissions).toEqual(state.admissions);
      expect(result.units).toEqual(state.units);
      // Device saves intentionally omit refusal rows (D-18).
      expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify({ ...result, rejections: [] })))).toBe(true);
    }
  });

  it("allows the same booking after a person reopens the bed, then refuses a duplicate arrival", () => {
    const { state, booking } = closedLastBed();
    const reopened = wardFlowReducer(state, {
      type: "SET_BED_CLOSED",
      role: "ward",
      actingUnitId: unitId,
      now,
      unitId,
      bedNumber: state.units.find((unit) => unit.id === unitId)!.beds,
      closed: false,
    });
    expect(reopened.rejections).toHaveLength(state.rejections.length);
    expect(boundedBedAvailability(reopened.units.find((unit) => unit.id === unitId)!).available).toBe(1);
    const event = {
      type: "CONVERT_PLANNED_ADMISSION" as const,
      role: "coordinator" as const,
      now,
      unitId,
      plannedAdmissionId: booking.id,
    };
    const arrived = wardFlowReducer(reopened, event);
    expect(arrived.plannedAdmissions.at(-1)?.state).toBe("arrived");
    expect(arrived.admissions).toHaveLength(state.admissions.length + 1);
    const duplicate = wardFlowReducer(arrived, event);
    expect(duplicate.rejections.at(-1)?.reason).toMatch(/already arrived/);
    expect(duplicate.admissions).toEqual(arrived.admissions);
  });
});
