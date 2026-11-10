import { describe, expect, it } from "vitest";

/**
 * Feature 14 (Josh, 9 Nov 2026): the Friday weekend discharge review. The window is Saturday to
 * Monday, widened over a joined WA public holiday; the rows are inpatients whose recorded expected
 * discharge falls inside it; the Reviewed tick keys to that weekend only.
 */
import {
  upcomingWeekendWindow,
  weekendReviewLeads,
  weekendReviewRows,
  type WeekendReviewStay,
} from "@/components/ward-management/discharges/discharge-weekend-review";
import { MINUTES_PER_DAY, perthIsoDay, calendarDateOf, perthMidnight } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import type { BedRelease } from "@/components/ward-management/ward-model";

const at = (dayZero: Date, minutes: number) => perthIsoDay(calendarDateOf(minutes, dayZero));

describe("upcomingWeekendWindow", () => {
  it("runs Friday to Monday from a weekday: the next Saturday to Monday", () => {
    const thursday = perthMidnight(2026, 10, 12);
    const window = upcomingWeekendWindow(10 * 60, thursday);
    expect(at(thursday, window.start)).toBe("2026-11-14");
    expect(at(thursday, window.end - 1)).toBe("2026-11-16");
    expect(weekendReviewLeads(10 * 60, thursday)).toBe(true);
  });

  it("moves on to the coming weekend on its Monday, and leads only on Thursday and Friday", () => {
    const monday = perthMidnight(2026, 10, 9);
    const window = upcomingWeekendWindow(9 * 60, monday);
    expect(at(monday, window.start)).toBe("2026-11-14");
    expect(at(monday, window.end - 1)).toBe("2026-11-16");
    expect(weekendReviewLeads(9 * 60, monday)).toBe(false);
  });

  it("keeps the weekend in progress on its Sunday", () => {
    const sunday = perthMidnight(2026, 10, 8);
    const window = upcomingWeekendWindow(9 * 60, sunday);
    expect(at(sunday, window.start)).toBe("2026-11-07");
    expect(at(sunday, window.end - 1)).toBe("2026-11-09");
  });

  it("widens over Christmas and Boxing Day and their additional Monday", () => {
    const wednesday = perthMidnight(2026, 11, 23);
    const window = upcomingWeekendWindow(12 * 60, wednesday);
    expect(at(wednesday, window.start)).toBe("2026-12-25");
    expect(at(wednesday, window.end - 1)).toBe("2026-12-28");
  });
});

describe("weekendReviewRows", () => {
  const dayZero = perthMidnight(2026, 10, 12); // Thursday
  const window = upcomingWeekendWindow(10 * 60, dayZero);
  const stay = (id: string, expectedDischargeAt: number | null, extra: Partial<WeekendReviewStay> = {}) =>
    ({ admissionId: id, unitId: "u1", admissionState: "occupied", expectedDischargeAt, ...extra }) as WeekendReviewStay;

  it("lists inpatients expected out inside the window only, soonest first, with open arrangements", () => {
    const saturday = 2 * MINUTES_PER_DAY + 10 * 60;
    const monday = 4 * MINUTES_PER_DAY + 9 * 60;
    const releases = [
      {
        id: "r1",
        admissionId: "a-mon",
        state: "expected",
        dependencies: [
          { kind: "medication", state: "outstanding" },
          { kind: "transport", state: "done" },
        ],
      },
    ] as unknown as BedRelease[];
    const rows = weekendReviewRows(
      [
        stay("a-mon", monday),
        stay("a-sat", saturday),
        stay("a-fri", MINUTES_PER_DAY + 10 * 60),
        stay("a-tue", 5 * MINUTES_PER_DAY + 10 * 60),
        stay("a-none", null),
        stay("a-gone", saturday, { admissionState: "departed" }),
      ],
      releases,
      window,
    );
    expect(rows.map((row) => row.stay.admissionId)).toEqual(["a-sat", "a-mon"]);
    expect(rows.map((row) => row.outstanding)).toEqual([null, 1]);
    expect(rows.every((row) => row.reviewed === null)).toBe(true);
  });

  it("counts a tick for this weekend only", () => {
    const saturday = 2 * MINUTES_PER_DAY + 10 * 60;
    const lastWeek = {
      weekendStart: window.start - 7 * MINUTES_PER_DAY,
      at: -6 * MINUTES_PER_DAY,
      by: "ward" as const,
    };
    const thisWeek = { weekendStart: window.start + 37, at: 600, by: "coordinator" as const };
    const [old] = weekendReviewRows([stay("a", saturday, { weekendDischargeReviews: [lastWeek] })], [], window);
    const [fresh] = weekendReviewRows([stay("a", saturday, { weekendDischargeReviews: [thisWeek] })], [], window);
    expect(old!.reviewed).toBeNull();
    expect(fresh!.reviewed).toEqual(thisWeek);
  });
});

describe("MARK_WEEKEND_DISCHARGE_REVIEWED", () => {
  type Mark = Extract<WardFlowEvent, { type: "MARK_WEEKEND_DISCHARGE_REVIEWED" }>;
  const weekendStart = NOW_ANCHOR + 2 * MINUTES_PER_DAY;
  function stayOf(state: WardFlowState) {
    const found = state.admissions.find((admission) => admission.state === "occupied");
    if (!found) throw new Error("the seed has no occupied stay");
    return found;
  }
  function mark(state: WardFlowState, fields: Partial<Mark>) {
    const admission = stayOf(state);
    return wardFlowReducer(state, {
      type: "MARK_WEEKEND_DISCHARGE_REVIEWED",
      role: "ward",
      now: NOW_ANCHOR + 5,
      actingUnitId: admission.unitId,
      admissionId: admission.id,
      weekendStart,
      ...fields,
    } as WardFlowEvent);
  }

  it("records the tick with its weekend, time and desk, and stays a valid save", () => {
    const before = seedWardFlowState();
    const admission = stayOf(before);
    const after = mark(before, {});
    const updated = after.admissions.find((candidate) => candidate.id === admission.id)!;
    expect(updated.weekendDischargeReviews?.at(-1)).toEqual({ weekendStart, at: NOW_ANCHOR + 5, by: "ward" });
    expect(updated.expectedDischargeAt).toBe(admission.expectedDischargeAt);
    expect(after.rejections).toHaveLength(before.rejections.length);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(after)))).toBe(true);
    const tampered = JSON.parse(JSON.stringify(after)) as WardFlowState;
    const target = tampered.admissions.find((candidate) => candidate.id === admission.id)!;
    Object.assign(target.weekendDischargeReviews!.at(-1)!, { note: "typed words" });
    expect(isValidStoredWardFlowState(tampered)).toBe(false);
  });

  it("refuses another ward's stay, a repeat for the same weekend, a far weekend and other desks", () => {
    const before = seedWardFlowState();
    const recorded = mark(before, {});
    const cases: [WardFlowState, Partial<Mark>][] = [
      [before, { actingUnitId: "some-other-ward" }],
      [recorded, { weekendStart: weekendStart + 60 }],
      [before, { weekendStart: NOW_ANCHOR + 30 * MINUTES_PER_DAY }],
      // The weekend after one in progress, a whole week on, cannot be ticked ahead of time.
      [before, { weekendStart: NOW_ANCHOR + 7 * MINUTES_PER_DAY - 60 }],
      [before, { now: Number.NaN }],
      [before, { role: "ed" }],
    ];
    for (const [state, fields] of cases) {
      const after = mark(state, fields);
      expect(after.rejections.length).toBe(state.rejections.length + 1);
      expect(after.admissions).toEqual(state.admissions);
    }
  });

  it("refuses a stay with no expected discharge, which the review never lists", () => {
    const seeded = seedWardFlowState();
    const target = stayOf(seeded);
    const before = {
      ...seeded,
      admissions: seeded.admissions.map((admission) =>
        admission.id === target.id ? { ...admission, expectedDischargeAt: null } : admission,
      ),
    };
    const after = mark(before, {});
    expect(after.rejections.length).toBe(before.rejections.length + 1);
    expect(after.admissions).toEqual(before.admissions);
  });
});
