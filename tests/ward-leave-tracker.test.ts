import { describe, expect, it } from "vitest";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { leaveStatus, leaveTrackerRows } from "@/components/ward-management/leave/leave-tracker";
import type { LeaveBed } from "@/components/ward-management/ward-model";
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
    const ranks = all.map((row) => order.indexOf(row.status));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    const oneWard = all[0]!.unitId;
    const scoped = leaveTrackerRows(state, NOW_ANCHOR, (unitId) => unitId === oneWard);
    expect(scoped.every((row) => row.unitId === oneWard)).toBe(true);
    expect(scoped.length).toBeGreaterThan(0);
  });
});
