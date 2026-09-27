import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { acceptedEventsForHistory, eventLogEntryFor } from "@/components/ward-management/ward-event-log";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Event log, step 1 (25 Sept 2026): every dispatched event is recorded in memory by the provider —
// type, role, time, accepted, and the ids it touches — with no free text and no screen change.

describe("eventLogEntryFor", () => {
  it("keeps the type, role, time, outcome and ids, and never the free text", () => {
    const event = {
      type: "RECORD_MOVEMENT_BLOCKER",
      role: "coordinator",
      now: 123,
      movementId: "WF-1",
      blocker: "Synthetic typed note that must not be kept",
    } as unknown as WardFlowEvent;
    const entry = eventLogEntryFor(event, true);
    expect(entry).toEqual({
      type: "RECORD_MOVEMENT_BLOCKER",
      role: "coordinator",
      now: 123,
      accepted: true,
      movementId: "WF-1",
    });
    expect(JSON.stringify(entry)).not.toContain("Synthetic typed note");
  });

  it("never copies the patient link (D-14)", () => {
    const entry = eventLogEntryFor(
      { type: "PULL_PATIENT", role: "ward", now: 1, movementId: "WF-1", patientId: "P-1" } as unknown as WardFlowEvent,
      true,
    );
    expect(Object.keys(entry)).not.toContain("patientId");
    expect(entry.movementId).toBe("WF-1");
  });

  it("gives the history selectors only accepted events", () => {
    const accepted = eventLogEntryFor(
      { type: "CONFIRM_CAPACITY", role: "ward", now: 5, actingUnitId: "u1" } as unknown as WardFlowEvent,
      true,
    );
    const refused = eventLogEntryFor(
      { type: "CONFIRM_CAPACITY", role: "ward", now: 6, actingUnitId: "u1" } as unknown as WardFlowEvent,
      false,
    );
    const events = acceptedEventsForHistory([accepted, refused]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "CONFIRM_CAPACITY", now: 5, actingUnitId: "u1" });
  });
});

function LogProbe() {
  const { eventLog, dispatch, now } = useWardFlow();
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          dispatch({ type: "MARK_NOTICE_READ", role: "ward", now, noticeId: "no-such-notice" } as WardFlowEvent)
        }
      >
        refused
      </button>
      <button
        type="button"
        onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 5 } as WardFlowEvent)}
      >
        advance
      </button>
      <output data-testid="log">{JSON.stringify(eventLog ?? [])}</output>
    </div>
  );
}

describe("the provider records each dispatched event", () => {
  it("starts empty and appends one entry per dispatch, marking refusals", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <LogProbe />
      </WardFlowProvider>,
    );
    const log = () => JSON.parse(screen.getByTestId("log").textContent ?? "[]") as Array<Record<string, unknown>>;
    expect(log()).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "refused" }));
    expect(log()).toHaveLength(1);
    expect(log()[0]).toMatchObject({ type: "MARK_NOTICE_READ", role: "ward", accepted: false });

    fireEvent.click(screen.getByRole("button", { name: "advance" }));
    expect(log()).toHaveLength(2);
    expect(log()[1]).toMatchObject({ type: "ADVANCE_CLOCK", role: "demo" });
  });
});
