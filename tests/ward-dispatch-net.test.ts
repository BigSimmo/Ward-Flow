import { describe, expect, it } from "vitest";

import { dispatchNetRefusal } from "@/components/ward-management/ward-dispatch-net";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOT_YOUR_ROLE } from "@/components/ward-management/ward-permit";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** R-STRUCT-1 (D-223): the local demo refuses, in the server's words, what the server refuses. */
const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } };
const statewide: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };
const service: WardAccess = { role: "coordinator", scope: { kind: "service", service: "East Metro" } };
const refresh = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: NOW_ANCHOR } as unknown as WardFlowEvent;

describe("dispatchNetRefusal", () => {
  it("refuses a coordinator's change sent from a ward desk, as the server does", () => {
    expect(dispatchNetRefusal(ward, refresh)).toBe(NOT_YOUR_ROLE);
  });

  it("asks the whole network nothing, and leaves the demonstration controls to the public demo", () => {
    expect(dispatchNetRefusal(statewide, refresh)).toBeNull();
    const clock = { type: "ADVANCE_CLOCK", role: "demo", now: NOW_ANCHOR, minutes: 15 } as unknown as WardFlowEvent;
    expect(dispatchNetRefusal(ward, clock)).toBeNull();
  });

  it("lets a service coordinator act on a ward page, and refuses the outage record in the server's words", () => {
    const confirm = { type: "CONFIRM_CAPACITY", role: "ward", now: NOW_ANCHOR } as unknown as WardFlowEvent;
    expect(dispatchNetRefusal(service, confirm)).toBeNull();
    const outage = { type: "RECORD_OUTAGE_WINDOW", role: "coordinator", now: NOW_ANCHOR } as unknown as WardFlowEvent;
    expect(dispatchNetRefusal(service, outage)).toBe("Only the statewide coordinator records an outage.");
  });
});
