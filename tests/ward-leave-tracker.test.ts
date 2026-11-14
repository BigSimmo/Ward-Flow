import { describe, expect, it } from "vitest";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  leaveBedLabels,
  leaveOpenWarning,
  leaveStatus,
  leaveTrackerRows,
} from "@/components/ward-management/leave/leave-tracker";
import type { LeaveBed } from "@/components/ward-management/ward-model";
import { wardStaySeats } from "@/components/ward-management/ward/ward-bed-layout";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Feature 23: the Leave page's status. Recorded times only; no new threshold. Synthetic records. */
const now = 10 * 60;
const leave = (extra: Partial<LeaveBed>): LeaveBed => ({
  id: "LB-T",
  unitId: "u",
  admissionId: "a",
  expectedReturn: now + 60,
  confirmedAt: now - 120,
  confirmedBy: "ward",
  ...extra,
});

describe("leaveStatus", () => {
  it("names absent, overdue, due back today and on leave", () => {
    expect(leaveStatus(leave({ absentWithoutLeave: { since: now - 10, steps: [] } }), now)).toBe("absent");
    expect(leaveStatus(leave({ expectedReturn: now - 1 }), now)).toBe("overdue");
    expect(leaveStatus(leave({ expectedReturn: now + 60 }), now)).toBe("due_today");
    expect(leaveStatus(leave({ expectedReturn: now + 24 * 60 }), now)).toBe("on_leave");
  });
});

describe("leaveTrackerRows", () => {
  it("lists the seed's leave on the chosen wards only, most pressing first", () => {
    const state = seedWardFlowState();
    const all = leaveTrackerRows(state, NOW_ANCHOR, () => true);
    expect(all.length).toBe(state.leaveBeds.length);
    expect(all.length).toBeGreaterThan(0);
    const order = ["absent", "overdue", "due_today", "on_leave"];
    // Status first, then the soonest expected return within a status.
    expect(all).toEqual(
      [...all].sort(
        (left, right) =>
          order.indexOf(left.status) - order.indexOf(right.status) || left.expectedReturn - right.expectedReturn,
      ),
    );
    const oneWard = all[0]!.unitId;
    const scoped = leaveTrackerRows(state, NOW_ANCHOR, (unitId) => unitId === oneWard);
    expect(scoped.every((row) => row.unitId === oneWard)).toBe(true);
    expect(scoped.length).toBeGreaterThan(0);
  });
});

describe("leaveOpenWarning (signed 24 hours)", () => {
  it("is silent before 24 hours and says to consider opening the bed from then on", () => {
    expect(leaveOpenWarning(leave({ confirmedAt: now - (24 * 60 - 1) }), now)).toBeUndefined();
    expect(leaveOpenWarning(leave({ confirmedAt: now - 24 * 60 }), now)).toContain("Consider opening the bed");
    expect(leaveOpenWarning(leave({ confirmedAt: now - 33 * 60 }), now)).toContain("Consider opening the bed");
  });
  it("flags a medical trip expected to last over 24 hours for review, never at exactly 24 hours (D-106)", () => {
    const trip = (hours: number, kind: LeaveBed["kind"] = "medical_trip") =>
      leave({ kind, confirmedAt: now - 10, expectedReturn: now - 10 + hours * 60 });
    expect(leaveOpenWarning(trip(24.5), now)).toContain("Review the held bed");
    expect(leaveOpenWarning(trip(24), now)).toBeUndefined();
    expect(leaveOpenWarning(trip(6), now)).toBeUndefined();
    expect(leaveOpenWarning(trip(48, "off_ward"), now)).toBeUndefined();
    const rows = leaveTrackerRows(
      { ...seedWardFlowState(), leaveBeds: [{ ...trip(30), unitId: seedWardFlowState().units[0]!.id }] },
      now,
      () => true,
    );
    expect(rows[0]?.openWarning).toContain("Review the held bed");
  });
  it("reaches the Leave page rows", () => {
    const state = seedWardFlowState();
    const rows = leaveTrackerRows(
      { ...state, leaveBeds: state.leaveBeds.map((bed) => ({ ...bed, confirmedAt: NOW_ANCHOR - 25 * 60 })) },
      NOW_ANCHOR,
      () => true,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.openWarning !== undefined)).toBe(true);
  });
});

describe("leaveBedLabels", () => {
  it("names the bed the ward board seats the stay in", () => {
    const state = seedWardFlowState();
    for (const row of leaveTrackerRows(state, NOW_ANCHOR, () => true)) {
      const unit = state.units.find((entry) => entry.id === row.unitId)!;
      const seat = wardStaySeats(unit, state.admissions).get(row.admission!.id);
      const expected = row.admission!.bedNumber ?? seat;
      if (expected !== undefined) expect(row.bedLabel).toBe(`Bed ${String(expected).padStart(2, "0")}`);
    }
    expect(leaveBedLabels).toBeTypeOf("function");
  });
});
