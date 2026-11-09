// Feature 10 (Josh, 9 Nov 2026): "Staff needed". A ward logs that it needs more staff to meet current
// patient demand; every desk sees the open request until it is closed. It never changes a bed count.
import { describe, expect, it } from "vitest";

import {
  openStaffRequestFor,
  openStaffRequests,
  staffRequestTagText,
  type StaffRequestEvent,
} from "@/components/ward-management/staffing/staff-requests";
import { shiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const UNIT = "rph-adult-secure";
const ask = (extra: Partial<Extract<StaffRequestEvent, { type: "REQUEST_WARD_STAFF" }>> = {}): StaffRequestEvent => ({
  type: "REQUEST_WARD_STAFF",
  role: "ward",
  now: NOW_ANCHOR,
  unitId: UNIT,
  actingUnitId: UNIT,
  shift: "this_shift",
  count: 2,
  reasons: ["high_acuity", "constant_observation"],
  ...extra,
});
const close = (
  state: WardFlowState,
  extra: Partial<Extract<StaffRequestEvent, { type: "CLOSE_WARD_STAFF_REQUEST" }>> = {},
) => {
  const request = openStaffRequestFor(state.staffRequests, UNIT, NOW_ANCHOR)!;
  return wardFlowReducer(state, {
    type: "CLOSE_WARD_STAFF_REQUEST",
    role: "coordinator",
    now: NOW_ANCHOR + 10,
    requestId: request.id,
    unitId: UNIT,
    outcome: "arranged",
    ...extra,
  } as StaffRequestEvent);
};
const refused = (before: WardFlowState, after: WardFlowState) => after.rejections.length > before.rejections.length;

describe("staff needed requests", () => {
  const seed = seedWardFlowState();

  it("seeds one synthetic open request, and the seed passes the stored-state check", () => {
    expect(openStaffRequests(seed, NOW_ANCHOR).map((record) => record.unitId)).toEqual(["scgh-adult-open"]);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(seed)))).toBe(true);
    // A stored request holding typed text is refused.
    const typed = JSON.parse(JSON.stringify(seed)) as WardFlowState;
    typed.staffRequests![0]!.reasons = ["Short two nurses" as never];
    expect(isValidStoredWardFlowState(typed)).toBe(false);
  });

  it("logs a request with chosen values only and changes no bed figure", () => {
    const state = wardFlowReducer(seed, ask());
    expect(refused(seed, state)).toBe(false);
    const record = openStaffRequestFor(state.staffRequests, UNIT, NOW_ANCHOR)!;
    expect(record).toMatchObject({ unitId: UNIT, count: 2, requestedBy: "ward", requestedAt: NOW_ANCHOR });
    // Reasons are kept in list order, whatever order they were tapped.
    expect(record.reasons).toEqual(["constant_observation", "high_acuity"]);
    expect(state.units).toBe(seed.units);
    expect(staffRequestTagText(record, NOW_ANCHOR)).toMatch(/^Staff requested \d\d:\d\d · 2 · this shift$/);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
  });

  it("keeps one open request per ward per shift: asking again updates it", () => {
    const once = wardFlowReducer(seed, ask());
    const twice = wardFlowReducer(once, ask({ count: 4, reasons: ["other"], now: NOW_ANCHOR + 5 }));
    const open = openStaffRequests(twice, NOW_ANCHOR + 5).filter((record) => record.unitId === UNIT);
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ count: 4, reasons: ["other"], updatedAt: NOW_ANCHOR + 5 });
    // The next shift is a separate request.
    const next = wardFlowReducer(twice, ask({ shift: "next_shift" }));
    expect(openStaffRequests(next, NOW_ANCHOR).filter((record) => record.unitId === UNIT)).toHaveLength(2);
  });

  it("refuses a missing reason, an off-list value, an unknown ward and another ward's claim", () => {
    for (const event of [
      ask({ reasons: [] }),
      ask({ reasons: ["typed" as never] }),
      ask({ count: 7 as never }),
      ask({ shift: "tomorrow" as never }),
      ask({ unitId: "no-such-ward", actingUnitId: "no-such-ward" }),
      ask({ actingUnitId: "scgh-adult-open" }),
    ])
      expect(refused(seed, wardFlowReducer(seed, event))).toBe(true);
    // The executive changes nothing.
    expect(refused(seed, wardFlowReducer(seed, ask({ role: "executive" })))).toBe(true);
  });

  it("closes as arranged by the coordinator, and the request leaves the open list", () => {
    const asked = wardFlowReducer(seed, ask());
    const closed = close(asked);
    expect(refused(asked, closed)).toBe(false);
    expect(openStaffRequestFor(closed.staffRequests, UNIT, NOW_ANCHOR + 10)).toBeUndefined();
    expect(closed.staffRequests!.find((record) => record.unitId === UNIT)).toMatchObject({
      outcome: "arranged",
      closedBy: "coordinator",
      closedAt: NOW_ANCHOR + 10,
    });
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(closed)))).toBe(true);
    // Closing twice is refused.
    const id = closed.staffRequests!.find((record) => record.unitId === UNIT)!.id;
    const again = wardFlowReducer(closed, {
      type: "CLOSE_WARD_STAFF_REQUEST",
      role: "coordinator",
      now: NOW_ANCHOR + 11,
      requestId: id,
      unitId: UNIT,
      outcome: "arranged",
    });
    expect(refused(closed, again)).toBe(true);
  });

  it("lets the ward withdraw its own request but not mark it arranged", () => {
    const asked = wardFlowReducer(seed, ask());
    expect(refused(asked, close(asked, { role: "ward", actingUnitId: UNIT, outcome: "arranged" }))).toBe(true);
    expect(refused(asked, close(asked, { role: "ward", actingUnitId: UNIT, outcome: "withdrawn" }))).toBe(false);
    expect(refused(asked, close(asked, { unitId: "scgh-adult-open" }))).toBe(true);
  });

  it("drops a request from the open list once its shift has ended", () => {
    const asked = wardFlowReducer(seed, ask());
    const record = openStaffRequestFor(asked.staffRequests, UNIT, NOW_ANCHOR)!;
    const end = shiftEndInstant(record.shiftStartAt);
    expect(openStaffRequestFor(asked.staffRequests, UNIT, end - 1)).toBeDefined();
    expect(openStaffRequestFor(asked.staffRequests, UNIT, end)).toBeUndefined();
  });
});
