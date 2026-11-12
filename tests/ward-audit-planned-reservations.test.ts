import { describe, expect, it } from "vitest";

import { bedIsOccupied } from "../src/components/ward-management/ward-admissions";
import { readyBedsNow } from "../src/components/ward-management/ward-bed-states";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "../src/components/ward-management/ward-flow-storage-validation";
import { GENERAL_OBSERVATION } from "../src/components/ward-management/ward-observation";
import { wardStaySeats } from "../src/components/ward-management/ward/ward-bed-layout";

const UNIT = "scgh-adult-open";
const NOW = 642;
const draft = {
  cohort: "Adult",
  security: "Open",
  sex: "Female",
  gender: "Female",
  observation: GENERAL_OBSERVATION,
  highAcuity: false,
  legalStatus: "Voluntary",
  urgency: 2,
  legalFormCode: null,
} as const;

function send(state: WardFlowState, event: WardFlowEvent) {
  const after = wardFlowReducer(state, event);
  expect(after.rejections, `setup ${event.type}`).toEqual(state.rejections);
  return after;
}
function restorable(state: WardFlowState) {
  expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify({ ...state, rejections: [] })))).toBe(true);
}
function booked() {
  const state = send(seedWardFlowState(), {
    type: "BOOK_PLANNED_ADMISSION",
    role: "coordinator",
    now: NOW,
    initials: "AB",
    sex: "Female",
    gender: "Female",
    reason: "respite",
    unitId: UNIT,
    expectedArrivalAt: NOW + 10,
    expectedStayDays: 7,
    legalStatus: "Voluntary",
    ageBand: "Adult",
    calendarDate: "2026-11-02",
  });
  restorable(state);
  return { state, plannedAdmissionId: state.plannedAdmissions.at(-1)!.id };
}
const convert = (plannedAdmissionId: string): WardFlowEvent => ({
  type: "CONVERT_PLANNED_ADMISSION",
  role: "coordinator",
  now: NOW + 10,
  unitId: UNIT,
  plannedAdmissionId,
});
function closeFreeNumber(state: WardFlowState) {
  const unit = state.units.find((u) => u.id === UNIT)!;
  const seats = wardStaySeats(unit, state.admissions);
  const taken = new Set(
    state.admissions.filter((a) => a.unitId === UNIT && bedIsOccupied(a)).map((a) => a.bedNumber ?? seats.get(a.id)),
  );
  const bedNumber = Array.from({ length: unit.beds }, (_, i) => i + 1).find(
    (number) =>
      !taken.has(number) &&
      !(unit.closedBeds ?? []).some((mark) => mark.bedNumber === number && mark.reopenedAt === undefined) &&
      !state.movements.some((m) => !m.closure && m.acceptedUnitId === UNIT && m.heldBedNumber === number) &&
      !state.referrals.some((r) =>
        r.destinations.some(
          (arm) =>
            arm.state === "accepted" &&
            arm.destination.kind === "psychiatric_ward" &&
            (arm.acceptedUnitId ?? arm.destination.unitId) === UNIT &&
            arm.heldBedNumber === number,
        ),
      ),
  );
  expect(bedNumber, "a currently empty, unreserved numbered bed").toBeDefined();
  return {
    state: send(state, {
      type: "SET_BED_CLOSED",
      role: "ward",
      actingUnitId: UNIT,
      unitId: UNIT,
      now: NOW + 1,
      bedNumber: bedNumber!,
      closed: true,
    }),
    bedNumber: bedNumber!,
  };
}

describe("planned conversion consumes only unreserved open capacity", () => {
  it("refuses exact closed capacity, then permits one open stay after reopening", () => {
    const booking = booked();
    let before = booking.state;
    let lastClosed: number | undefined;
    const ready = () =>
      readyBedsNow(
        before.units.find((u) => u.id === UNIT)!,
        before.admissions,
        before.bedReleases,
        [],
      );
    expect(ready()).toBeGreaterThan(0);
    for (let step = 0; ready() > 0 && step < before.units.find((u) => u.id === UNIT)!.beds; step++) {
      const closed = closeFreeNumber(before);
      before = closed.state;
      lastClosed = closed.bedNumber;
    }
    expect(ready()).toBe(0);
    expect(before.units.find((u) => u.id === UNIT)!.lockedBeds).toBe(0);
    restorable(before);
    const refused = wardFlowReducer(before, convert(booking.plannedAdmissionId));
    expect(refused.rejections).toHaveLength(before.rejections.length + 1);
    for (const key of ["units", "admissions", "plannedAdmissions"] as const) expect(refused[key]).toEqual(before[key]);
    const reopened = send(before, {
      type: "SET_BED_CLOSED",
      role: "ward",
      actingUnitId: UNIT,
      unitId: UNIT,
      now: NOW + 2,
      bedNumber: lastClosed!,
      closed: false,
    });
    const arrived = send(reopened, convert(booking.plannedAdmissionId));
    expect(arrived.admissions).toHaveLength(before.admissions.length + 1);
    expect(arrived.admissions.at(-1)).toMatchObject({ state: "occupied", bedKind: "open" });
    restorable(arrived);
    const duplicate = wardFlowReducer(arrived, convert(booking.plannedAdmissionId));
    expect(duplicate.rejections).toHaveLength(arrived.rejections.length + 1);
    expect(duplicate.admissions).toEqual(arrived.admissions);
  });

  it.each([4, 5])("respects %i existing pulls after a current capacity reconfirmation", (pulls) => {
    const booking = booked();
    let before = booking.state;
    const confirm = () => {
      const unit = before.units.find((u) => u.id === UNIT)!;
      before = send(before, {
        type: "CONFIRM_CAPACITY",
        role: "ward",
        actingUnitId: UNIT,
        unitId: UNIT,
        now: NOW + 1,
        expectedRevision: unit.allocatable.revision ?? 0,
        value: 5,
      });
    };
    confirm();
    for (let index = 0; index < pulls; index++) {
      before = send(before, { type: "RAISE_REFERRAL", role: "ed", now: NOW + 1, edId: "jhc-ed", draft });
      const movementId = before.movements.at(-1)!.id;
      before = send(before, { type: "REFER_TO_UNITS", role: "coordinator", now: NOW + 1, movementId, unitIds: [UNIT] });
      before = send(before, {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        actingUnitId: UNIT,
        now: NOW + 1,
        movementId,
        unitId: UNIT,
      });
      before = send(before, {
        type: "PULL_PATIENT",
        role: "ward",
        actingUnitId: UNIT,
        now: NOW + 1,
        movementId,
        unitId: UNIT,
      });
    }
    confirm();
    restorable(before);
    expect(
      readyBedsNow(
        before.units.find((u) => u.id === UNIT)!,
        before.admissions,
        before.bedReleases,
        [],
      ),
    ).toBe(pulls === 4 ? 1 : 0);
    const after = wardFlowReducer(before, convert(booking.plannedAdmissionId));
    if (pulls === 4) {
      expect(after.rejections).toEqual(before.rejections);
      expect(after.admissions).toHaveLength(before.admissions.length + 1);
      expect(after.admissions.at(-1)).toMatchObject({ state: "occupied", bedKind: "open" });
    } else {
      expect(after.rejections).toHaveLength(before.rejections.length + 1);
      for (const key of ["units", "admissions", "plannedAdmissions"] as const) expect(after[key]).toEqual(before[key]);
    }
    restorable(after);
  });
});
