import { describe, expect, it } from "vitest";
// Offline synthetic diagnostics. No network or writes.
import {
  seedWardFlowStateAt,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { capacityRequestIsOpen, refreshRequestIsOpen } from "../src/components/ward-management/ward/ward-buzz-keys";
import { isValidStoredWardFlowState } from "../src/components/ward-management/ward-flow-storage-validation";

// DEC-L5-04 (CAP-REV): only the ward's own capacity confirmation answers a capacity request, and
// it does so in the shared record, so every desk and the shared site see it cleared.
const unitId = "rph-adult-secure";
const unit = (s: WardFlowState) => s.units.find((u) => u.id === unitId)!;
const apply = (s: WardFlowState, e: WardFlowEvent) => {
  const next = wardFlowReducer(s, e);
  const refused = next.rejections.slice(s.rejections.length);
  if (refused.length) throw new Error(`Setup ${e.type}: ${JSON.stringify(refused)}`);
  return next;
};
const ask = (s: WardFlowState, now: number) =>
  apply(s, { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now, unitId });
const confirm = (s: WardFlowState, now: number) =>
  apply(s, {
    type: "CONFIRM_CAPACITY",
    role: "ward",
    now,
    unitId,
    actingUnitId: unitId,
    value: unit(s).allocatable.value,
    expectedRevision: unit(s).allocatable.revision ?? 0,
  });
const open = (s: WardFlowState) => s.refreshRequests.filter((r) => r.unitId === unitId && refreshRequestIsOpen(r));

describe("capacity refresh requests clear on the ward's confirmation", () => {
  it("records the capacity revision and stays open until the ward confirms", () => {
    const seeded = seedWardFlowStateAt(0);
    const asked = ask(seeded, 10);
    expect(asked.refreshRequests.at(-1)?.allocatableRevision).toBe(unit(seeded).allocatable.revision ?? 0);
    expect(open(asked)).toHaveLength(1);

    const confirmed = confirm(asked, 10);
    expect(open(confirmed)).toHaveLength(0);
    expect(confirmed.refreshRequests.at(-1)?.answeredAt).toBe(10);
  });

  it("orders a same-minute ask after a confirmation by event, not timestamp", () => {
    const confirmedFirst = confirm(seedWardFlowStateAt(0), 10);
    expect(open(ask(confirmedFirst, 10))).toHaveLength(1);
  });

  it("clears capacity buzzes but leaves the placement buzz for the ward to dismiss", () => {
    let s = apply(seedWardFlowStateAt(0), {
      type: "SEND_WARD_BUZZ",
      role: "coordinator",
      now: 5,
      unitId,
      message: "Please review and confirm ward capacity.",
    });
    s = apply(s, {
      type: "SEND_WARD_BUZZ",
      role: "coordinator",
      now: 6,
      unitId,
      message: "Please review the current placement request.",
    });
    const remaining = open(confirm(s, 7));
    expect(remaining.map((r) => r.message)).toEqual(["Please review the current placement request."]);
    // The open placement buzz is not a capacity ask, so the capacity screens may ask again.
    expect(remaining.filter((r) => capacityRequestIsOpen(r))).toHaveLength(0);
  });

  it("leaves other wards' requests open and survives a save round trip", () => {
    const seeded = seedWardFlowStateAt(0);
    const other = seeded.units.find((u) => u.id !== unitId)!;
    let s = apply(seeded, { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 3, unitId: other.id });
    s = confirm(ask(s, 4), 5);
    expect(s.refreshRequests.filter((r) => refreshRequestIsOpen(r)).map((r) => r.unitId)).toEqual([other.id]);
    const reloaded: unknown = JSON.parse(JSON.stringify(s));
    expect(isValidStoredWardFlowState(reloaded)).toBe(true);
    expect(
      (reloaded as WardFlowState).refreshRequests.filter((r) => refreshRequestIsOpen(r)).map((r) => r.unitId),
    ).toEqual([other.id]);
  });

  it("answers a legacy request by a later ward confirmation only", () => {
    const legacy = { id: "buzz:0:1", unitId, at: 10, byRole: "coordinator" };
    expect(refreshRequestIsOpen(legacy, { source: "ward", confirmedAt: 11 })).toBe(false);
    expect(refreshRequestIsOpen(legacy, { source: "ward", confirmedAt: 10 })).toBe(true);
    expect(refreshRequestIsOpen(legacy, { source: "feed", confirmedAt: 11 })).toBe(true);
  });
});
