import { describe, expect, it } from "vitest";

import { alertActionFor, alertKindLabel, alertKindOf } from "@/components/ward-management/alerts/alerts-model";
import { buildActionInbox } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Movement } from "@/components/ward-management/ward-model";
import { formatClockAmPmWithDay } from "@/components/ward-management/ward-clock-am-pm";

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

  it("raises 'Past booking estimate' with Chase transport once 10 minutes have passed", () => {
    const [row] = passedRows(withBookingEstimate(13));
    // D-221: the title is the one arrival-timing phrase, with the clock times.
    expect(row?.title).toBe(
      `Past booking estimate ${formatClockAmPmWithDay(now - 13, now)} · late at ${formatClockAmPmWithDay(now + 47, now)}`,
    );
    expect(row?.movementId).toBe(base.id);
    expect(alertKindOf(row!.id)).toBe("transport");
    expect(alertActionFor(row!, {} as Parameters<typeof alertActionFor>[1]).label).toBe("Chase transport");
  });

  it("names its own condition in History, apart from 'Transport not yet left'", () => {
    const [row] = passedRows(withBookingEstimate(13));
    expect(alertKindLabel(row!.id)).toBe("Past ETA");
    expect(alertKindLabel("transport-WF-001")).not.toBe("Past ETA");
  });

  it("ends when the journey reads late, where the act-now Late arrival row takes over (D-221)", () => {
    expect(passedRows(withBookingEstimate(60))).toHaveLength(1);
    expect(passedRows(withBookingEstimate(61))).toEqual([]);
    const late = buildActionInbox([withBookingEstimate(61)], now, seed.units).filter((item) =>
      item.id.startsWith("arrival-late-"),
    );
    expect(late.map((item) => [item.tone, item.title, item.since])).toEqual([["danger", "Late arrival", now - 1]]);
    expect(alertKindLabel(late[0]!.id)).toBe("Late arrival");
    expect(late[0]!.owner).toMatch(/coordinator.*ward/u);
  });

  it("shows a diverted journey as act now until its pulled bed is released, never as late (D-221)", () => {
    const diverted: Movement = {
      ...withBookingEstimate(90),
      stage: "moving",
      transport: {
        ...withBookingEstimate(90).transport!,
        diversion: { at: now - 5, by: "officer", place: "Synthetic General ED", reason: "synthetic" },
      },
    };
    const rows = buildActionInbox([diverted], now, seed.units).filter((item) =>
      /^(diverted-|arrival-late-|eta-passed-)/u.test(item.id),
    );
    expect(rows.map((item) => [item.id, item.tone, item.title, item.since])).toEqual([
      [`diverted-${base.id}`, "danger", "Transport diverted", now - 5],
    ]);
    expect(alertActionFor(rows[0]!, {} as Parameters<typeof alertActionFor>[1]).label).toBe("Open journey");
    expect(
      buildActionInbox(
        [{ ...diverted, closure: { at: now, outcome: "did_not_proceed" } as Movement["closure"] }],
        now,
        seed.units,
      ).filter((item) => item.id.startsWith("diverted-")),
    ).toEqual([]);
  });
});
