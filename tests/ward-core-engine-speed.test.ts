import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { CARE_PLAN_ITEMS } from "@/components/ward-management/ward-care-journey";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";

function fixture() {
  const state = seedWardFlowState();
  const admission = state.admissions.find((a) => a.patientId && a.state === "occupied")!;
  const event = {
    type: "RECORD_ADMISSION_CARE",
    role: "coordinator",
    now: NOW_ANCHOR,
    expectedGeneration: state.worldGeneration,
    expectedRevision: 0,
    admissionId: admission.id,
    patientId: admission.patientId!,
    change: { kind: "plan", item: CARE_PLAN_ITEMS[0], status: "completed" },
  } as WardFlowEvent;
  return { state, admission, event };
}

describe("protected record delegation preserves reducer boundary outcomes", () => {
  it("refuses an excluded role before invalid protected payloads", () => {
    const { state, event } = fixture();
    const after = wardFlowReducer(state, {
      ...event,
      role: "ed",
      expectedGeneration: -1,
      change: null,
    } as unknown as WardFlowEvent);
    expect(after.auditEvents.at(-1)).toMatchObject({ outcome: "denied", reasonCode: "role" });
    expect(after.admissions).toBe(state.admissions);
    expect(after.units).toBe(state.units);
  });

  it("refuses a stale revision before interpreting an invalid care change", () => {
    const { state, event } = fixture();
    const after = wardFlowReducer(state, { ...event, expectedRevision: 1, change: null } as unknown as WardFlowEvent);
    expect(after.auditEvents.at(-1)).toMatchObject({ outcome: "stale", reasonCode: "revision" });
    expect(after.dischargeRevisions).toBe(state.dischargeRevisions);
    expect(after.admissions).toBe(state.admissions);
  });

  it("retains exact input identity when replaying the same permitted record access", () => {
    const { state, admission } = fixture();
    const event: WardFlowEvent = {
      type: "OPEN_DISCHARGE_RECORD",
      role: "coordinator",
      now: NOW_ANCHOR,
      admissionId: admission.id,
      expectedGeneration: state.worldGeneration,
      requestId: 23,
    };
    const opened = wardFlowReducer(state, event);
    expect(opened.auditEvents.at(-1)?.outcome).toBe("accepted");
    expect(wardFlowReducer(opened, event)).toBe(opened);
  });

  it("records an accepted care fact once with the original generation and revision attribution", () => {
    const { state, admission, event } = fixture();
    const beforeCareJourney = structuredClone(admission.careJourney);
    const after = wardFlowReducer(state, event);
    expect(after.auditEvents).toHaveLength(state.auditEvents.length + 1);
    expect(after.auditEvents.at(-1)).toMatchObject({
      outcome: "accepted",
      generation: state.worldGeneration,
      details: { kind: "care", operation: "plan" },
    });
    expect(after.dischargeRevisions[admission.id]).toBe(1);
    expect(after.units).toBe(state.units);
    expect(state.admissions.find((a) => a.id === admission.id)?.careJourney).toEqual(beforeCareJourney);
  });
});
