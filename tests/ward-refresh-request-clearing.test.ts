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

// DEC-L5-04 (CAP-REV): only the ward's own capacity confirmation answers a capacity request. It is
// read from the shared unit, so every desk and the shared site see it cleared.
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
const openFor = (s: WardFlowState) =>
  s.refreshRequests.filter((r) => refreshRequestIsOpen(r, s.units.find((u) => u.id === r.unitId)?.allocatable));
const open = (s: WardFlowState) => openFor(s).filter((r) => r.unitId === unitId);

describe("capacity refresh requests clear on the ward's confirmation", () => {
  it("records the capacity revision and stays open until the ward confirms", () => {
    const seeded = seedWardFlowStateAt(0);
    const asked = ask(seeded, 10);
    expect(asked.refreshRequests.at(-1)?.confirmations).toBe(unit(seeded).allocatable.confirmations ?? 0);
    expect(open(asked)).toHaveLength(1);

    const confirmed = confirm(asked, 10);
    expect(open(confirmed)).toHaveLength(0);
    // The request itself is left alone, so a confirmation sent from an older board does not clash
    // with the ask on the shared site.
    expect(confirmed.refreshRequests).toBe(asked.refreshRequests);
  });

  it("orders a same-minute ask after a confirmation by event, not timestamp", () => {
    const confirmedFirst = confirm(seedWardFlowStateAt(0), 10);
    const asked = ask(confirmedFirst, 10);
    expect(open(asked)).toHaveLength(1);
    // Another bed change in that minute moves the capacity revision on but is not a confirmation.
    const moved = { ...unit(asked).allocatable, revision: (unit(asked).allocatable.revision ?? 0) + 3 };
    expect(capacityRequestIsOpen(asked.refreshRequests.at(-1)!, moved)).toBe(true);
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
    expect(remaining.filter((r) => capacityRequestIsOpen(r, unit(s).allocatable))).toHaveLength(0);
  });

  it("leaves other wards' requests open and survives a save round trip", () => {
    const seeded = seedWardFlowStateAt(0);
    const other = seeded.units.find((u) => u.id !== unitId)!;
    let s = apply(seeded, { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 3, unitId: other.id });
    s = confirm(ask(s, 4), 5);
    expect(openFor(s).map((r) => r.unitId)).toEqual([other.id]);
    const reloaded: unknown = JSON.parse(JSON.stringify(s));
    expect(isValidStoredWardFlowState(reloaded)).toBe(true);
    expect(openFor(reloaded as WardFlowState).map((r) => r.unitId)).toEqual([other.id]);
  });

  it("reopens the request when the confirmation is undone", () => {
    const confirmed = confirm(ask(seedWardFlowStateAt(0), 10), 12);
    expect(open(confirmed)).toHaveLength(0);
    // Undo restores the unit as it was before the confirmation, with its earlier count.
    const asked = ask(seedWardFlowStateAt(0), 10);
    const undone = { ...unit(asked).allocatable, revision: (unit(confirmed).allocatable.revision ?? 0) + 1 };
    expect(capacityRequestIsOpen(confirmed.refreshRequests.at(-1)!, undone)).toBe(true);
  });

  it("answers a legacy request by a later ward confirmation only", () => {
    const legacy = { id: "buzz:0:1", unitId, at: 10, byRole: "coordinator" };
    expect(refreshRequestIsOpen(legacy, { source: "ward", confirmedAt: 11 })).toBe(false);
    expect(refreshRequestIsOpen(legacy, { source: "ward", confirmedAt: 10 })).toBe(true);
    expect(refreshRequestIsOpen(legacy, { source: "feed", confirmedAt: 11 })).toBe(true);
  });
});
