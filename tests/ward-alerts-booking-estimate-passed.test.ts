import { describe, expect, it } from "vitest";

import { alertActionFor, alertKindOf } from "@/components/ward-management/alerts/alerts-model";
import { buildActionInbox } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Movement } from "@/components/ward-management/ward-model";

// P068, approved by Josh in chat, 27 Oct 2026, 10:02 PM AWST: "P068: yes, approve the Alerts entry,
// title and 'Chase transport' action exactly as shown, raised after 10 minutes". Booking-ETA clock.
const now = NOW_ANCHOR;
const seed = seedWardFlowState();
const base = seed.movements.find((movement) => movement.transport && movement.acceptedUnitId)!;

function withBookingEstimate(minutesAgo: number): Movement {
  return {
    ...base,
    closure: undefined,
    transport: { ...base.transport!, estimatedAt: now - minutesAgo, arrivedAt: undefined, cancelledAt: undefined },
  };
}

const passedRows = (movement: Movement) =>
  buildActionInbox([movement], now, seed.units).filter((item) => item.id.startsWith("eta-passed-"));

describe("Alerts raise a passed booking estimate after 10 minutes (P068)", () => {
  it("raises nothing before 10 minutes have passed", () => {
    expect(passedRows(withBookingEstimate(9))).toEqual([]);
  });

  it("raises 'Booking estimate passed 13m ago' with Chase transport once 10 minutes have passed", () => {
    const [row] = passedRows(withBookingEstimate(13));
    expect(row?.title).toBe("Booking estimate passed 13m ago");
    expect(row?.movementId).toBe(base.id);
    expect(alertKindOf(row!.id)).toBe("transport");
    expect(alertActionFor(row!, {} as Parameters<typeof alertActionFor>[1]).label).toBe("Chase transport");
  });
});
