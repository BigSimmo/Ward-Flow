import { describe, expect, it } from "vitest";

import {
  intakeDayStart,
  intakeWindowFromClockText,
  intakeWindowLine,
  tonightIntakeWindow,
} from "@/components/ward-management/capacity/ward-intake-window";
import { tonightIntakeWindowList } from "@/components/ward-management/capacity/ward-intake-window-list";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { Unit } from "@/components/ward-management/ward-model";

/** Day 0's clock face as an instant: `at(18)` is 18:00 on the demo's first day. */
const at = (hours: number, minutes = 0, day = 0) => day * MINUTES_PER_DAY + hours * 60 + minutes;

const windowSetAt = (setAt: number): Pick<Unit, "intakeWindow"> => ({
  intakeWindow: { ...intakeWindowFromClockText("21:00", "02:00", setAt)!, at: setAt, by: "Nurse in charge" },
});

describe("tonightIntakeWindow", () => {
  it("shows a window set at 18:00 until 07:00 the next day", () => {
    const unit = windowSetAt(at(18));
    expect(tonightIntakeWindow(unit, at(18))).not.toBeNull();
    expect(tonightIntakeWindow(unit, at(6, 59, 1))).not.toBeNull();
    expect(tonightIntakeWindow(unit, at(7, 0, 1))).toBeNull();
  });

  it("still shows a window set at 23:30 at 03:00, and it is gone at 07:00", () => {
    const unit = windowSetAt(at(23, 30));
    expect(tonightIntakeWindow(unit, at(3, 0, 1))).not.toBeNull();
    expect(tonightIntakeWindow(unit, at(7, 0, 1))).toBeNull();
  });

  it("reads nothing when no window is set", () => {
    expect(tonightIntakeWindow({}, at(20))).toBeNull();
    expect(intakeWindowLine(null)).toBe("Tonight: not set");
  });
});

describe("intakeWindowFromClockText", () => {
  it("reads a window across midnight into the next morning", () => {
    const intake = intakeWindowFromClockText("21:00", "0200", at(18))!;
    expect(intake).toEqual({ from: at(21), to: at(2, 0, 1) });
    expect(intakeWindowLine({ ...intake, at: at(18), by: "Nurse in charge" })).toBe("Tonight: admit 21:00 to 02:00");
  });

  it("reads a typed time after midnight as tonight, not this morning", () => {
    // Set at 01:00 on day 1: the day started at 07:00 on day 0, so 03:00 is day 1's 03:00.
    expect(intakeWindowFromClockText("03:00", "05:00", at(1, 0, 1))).toEqual({ from: at(3, 0, 1), to: at(5, 0, 1) });
    expect(intakeDayStart(at(1, 0, 1))).toBe(at(7));
  });

  it("refuses half-typed times and a window with no length", () => {
    expect(intakeWindowFromClockText("21", "02:00", at(18))).toBeUndefined();
    expect(intakeWindowFromClockText("21:00", "", at(18))).toBeUndefined();
    expect(intakeWindowFromClockText("21:00", "21:00", at(18))).toBeUndefined();
    expect(intakeWindowFromClockText("25:00", "02:00", at(18))).toBeUndefined();
  });
});

describe("SET_INTAKE_WINDOW", () => {
  const NOW = at(18);
  const setup = () => {
    const state = seedWardFlowState();
    const unit = state.units.find((candidate) => !candidate.intakeWindow)!;
    return { state, unitId: unit.id };
  };
  const send = (state: WardFlowState, event: Partial<Extract<WardFlowEvent, { type: "SET_INTAKE_WINDOW" }>>) =>
    wardFlowReducer(state, {
      type: "SET_INTAKE_WINDOW",
      role: "coordinator",
      now: NOW,
      unitId: "",
      intake: null,
      ...event,
    } as WardFlowEvent);
  const unitOf = (state: WardFlowState, unitId: string) => state.units.find((unit) => unit.id === unitId)!;

  it("sets a window for the ward itself and clears it again", () => {
    const { state, unitId } = setup();
    const intake = { from: at(21), to: at(2, 0, 1) };
    const set = send(state, { role: "ward", actingUnitId: unitId, unitId, intake });
    expect(set.rejections).toEqual([]);
    expect(unitOf(set, unitId).intakeWindow).toEqual({ ...intake, at: NOW, by: "Nurse in charge" });
    // Information only: no count moves.
    expect(unitOf(set, unitId).allocatable.value).toBe(unitOf(state, unitId).allocatable.value);
    expect(unitOf(set, unitId).empty.value).toBe(unitOf(state, unitId).empty.value);

    const cleared = send(set, { unitId, intake: null });
    expect(cleared.rejections).toEqual([]);
    expect(unitOf(cleared, unitId).intakeWindow).toBeUndefined();
    // Nothing left to clear.
    expect(send(cleared, { unitId, intake: null }).rejections).toHaveLength(1);
  });

  it("refuses another ward acting, a desk that is not the ward or the coordinator, and invalid times", () => {
    const { state, unitId } = setup();
    const other = state.units.find((unit) => unit.id !== unitId)!.id;
    const intake = { from: at(21), to: at(23) };
    expect(send(state, { role: "ward", actingUnitId: other, unitId, intake }).rejections).toHaveLength(1);
    expect(send(state, { role: "ward", unitId, intake }).rejections).toHaveLength(1);
    expect(send(state, { role: "ed", unitId, intake }).rejections).toHaveLength(1);
    expect(send(state, { role: "bed_manager", unitId, intake }).rejections).toHaveLength(1);
    // End before start, a whole day or more, a start before this morning's 07:00, and part minutes.
    expect(send(state, { unitId, intake: { from: at(21), to: at(20) } }).rejections).toHaveLength(1);
    expect(send(state, { unitId, intake: { from: at(21), to: at(21, 0, 1) } }).rejections).toHaveLength(1);
    expect(send(state, { unitId, intake: { from: at(6), to: at(8) } }).rejections).toHaveLength(1);
    expect(send(state, { unitId, intake: { from: at(21, 0.5), to: at(23) } }).rejections).toHaveLength(1);
    expect(send(state, { unitId: "no-such-ward", intake }).rejections).toHaveLength(1);
    expect(send(state, { unitId, intake }).rejections).toEqual([]);
  });
});

describe("tonightIntakeWindowList", () => {
  it("keeps the neutral service-then-name order and never sorts by the hours", () => {
    const units = seedWardFlowState().units;
    const now = at(18);
    // Give every ward a window, the earliest start on the ward that sorts last, and check the order.
    const withWindows = units.map((unit, index) => ({
      ...unit,
      intakeWindow: {
        from: at(20) + (units.length - index) * 5,
        to: at(23, 30),
        at: now - 10,
        by: "Nurse in charge",
      },
    }));
    const { set, notSetCount } = tonightIntakeWindowList(withWindows, now);
    expect(notSetCount).toBe(0);
    const shuffled = tonightIntakeWindowList([...withWindows].reverse(), now);
    expect(shuffled.set.map(({ unit }) => unit.id)).toEqual(set.map(({ unit }) => unit.id));
    const names = set.map(({ unit }) => unit.name);
    const byFrom = [...set].sort((a, b) => a.intake.from - b.intake.from).map(({ unit }) => unit.name);
    expect(names).not.toEqual(byFrom);
  });

  it("counts the wards with no window tonight, including one set before this morning", () => {
    const units = seedWardFlowState().units;
    const now = at(8, 0, 1);
    const { set, notSetCount } = tonightIntakeWindowList(units, now);
    // The seed's windows were set on day 0, so they have cleared by 08:00 on day 1.
    expect(set).toEqual([]);
    expect(notSetCount).toBe(units.length);
  });

  it("shows the seeded demo windows on the demo clock", () => {
    const state = seedWardFlowState();
    const { set } = tonightIntakeWindowList(state.units, at(10, 42));
    expect(set.length).toBeGreaterThanOrEqual(2);
  });
});

describe("stored intake windows", () => {
  it("loads a saved state with and without an intake window, and refuses a malformed one", () => {
    const state = seedWardFlowState();
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
    const withoutAny = { ...state, units: state.units.map((unit) => ({ ...unit, intakeWindow: undefined })) };
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(withoutAny)))).toBe(true);
    const broken = {
      ...state,
      units: state.units.map((unit, index) =>
        index === 0 ? { ...unit, intakeWindow: { from: "21:00", to: 120, at: 0, by: "x" } } : unit,
      ),
    };
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(broken)))).toBe(false);
  });
});
