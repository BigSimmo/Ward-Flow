import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { plannedArrivalNeedsBedCountReason } from "@/components/ward-management/capacity/planned-admissions-reducer";
import { OVERRIDE_REASONS } from "@/components/ward-management/ward-change-reasons";
import { PLANNED_ARRIVAL_OVERRIDABLE_GATES } from "@/components/ward-management/ward-eligibility";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * D-223 (Josh, 14 Nov 2026), Together-X2-4: a planned arrival recorded while the ward's bed count is
 * old may name a reason from the override list. The reason answers the bed-count check only; the
 * gender check and every other gate still refuse. Synthetic seed only.
 */
const unitId = "fre-adult-open";
const now = NOW_ANCHOR;

function staleBooking() {
  const gender = "Female";
  let state = wardFlowReducer(seedWardFlowState(), {
    type: "BOOK_PLANNED_ADMISSION",
    role: "coordinator",
    now,
    initials: "ZZ",
    sex: gender,
    gender,
    reason: "respite",
    unitId,
    expectedArrivalAt: now + 60,
    expectedStayDays: 7,
    legalStatus: "Voluntary",
    ageBand: "Adult",
    calendarDate: "2026-10-09",
  });
  const booking = state.plannedAdmissions.at(-1)!;
  state = {
    ...state,
    units: state.units.map((unit) =>
      unit.id === unitId ? { ...unit, allocatable: { ...unit.allocatable, confirmedAt: now - 24 * 60 } } : unit,
    ),
  };
  return { state, booking };
}

const arrive = (state: WardFlowState, plannedAdmissionId: string, overrideReason?: string) =>
  wardFlowReducer(state, {
    type: "CONVERT_PLANNED_ADMISSION",
    role: "coordinator",
    now,
    unitId,
    plannedAdmissionId,
    ...(overrideReason === undefined ? {} : { overrideReason }),
  } as Parameters<typeof wardFlowReducer>[1]);

describe("a planned arrival with an old bed count (D-223)", () => {
  it("asks for a reason, and with one from the list records the arrival", () => {
    const { state, booking } = staleBooking();
    const unit = state.units.find((candidate) => candidate.id === unitId)!;
    expect(plannedArrivalNeedsBedCountReason(booking, unit, now)).toBe(true);
    const refused = arrive(state, booking.id);
    expect(refused.rejections.length).toBe(state.rejections.length + 1);
    expect(refused.rejections.at(-1)?.reason).toMatch(/capacity_freshness/);
    const arrived = arrive(state, booking.id, OVERRIDE_REASONS[0]);
    expect(arrived.rejections.length).toBe(state.rejections.length);
    expect(arrived.plannedAdmissions.find((row) => row.id === booking.id)?.state).toBe("arrived");
  });

  it("refuses a reason that is not on the list", () => {
    const { state, booking } = staleBooking();
    const refused = arrive(state, booking.id, "because");
    expect(refused.rejections.at(-1)?.reason).toMatch(/must be chosen from OVERRIDE_REASONS/);
  });

  it("never lets the reason past any gate but the bed count", () => {
    expect([...PLANNED_ARRIVAL_OVERRIDABLE_GATES]).toEqual(["capacity_freshness"]);
    const { state, booking } = staleBooking();
    // A ward closed to admissions stays closed whatever reason is named.
    const closed = {
      ...state,
      units: state.units.map((unit) => (unit.id === unitId ? { ...unit, isClosed: true } : unit)),
    };
    expect(arrive(closed, booking.id, OVERRIDE_REASONS[0]).rejections.at(-1)?.reason).toMatch(/closed/);
    // A fresh count needs no reason.
    const fresh = {
      ...state,
      units: state.units.map((unit) =>
        unit.id === unitId ? { ...unit, allocatable: { ...unit.allocatable, confirmedAt: now } } : unit,
      ),
    };
    expect(
      plannedArrivalNeedsBedCountReason(
        booking,
        fresh.units.find((u) => u.id === unitId)!,
        now,
      ),
    ).toBe(false);
  });
});
