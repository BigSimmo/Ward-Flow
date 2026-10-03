import { describe, expect, it } from "vitest";
import { FOLLOW_UP_STATES } from "@/components/ward-management/ward-admissions";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { selectDischargeRecord } from "@/components/ward-management/ward-discharge-records";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function fixture() {
  const state = seedWardFlowState();
  const admission = state.admissions.find((row) => row.patientId && row.state === "occupied")!;
  const event = {
    type: "RECORD_ADMISSION_FOLLOW_UP",
    role: "coordinator",
    now: NOW_ANCHOR,
    admissionId: admission.id,
    patientId: admission.patientId!,
    expectedGeneration: state.worldGeneration,
    expectedRevision: state.dischargeRevisions[admission.id] ?? 0,
    followUpState: "arranged",
  } as const;
  return { state, admission, event };
}

describe("attributed follow-up arrangement pathway", () => {
  it.each(FOLLOW_UP_STATES)("records %s with audit and persistence without freeing any bed", (followUpState) => {
    const { state, admission, event } = fixture();
    const next = wardFlowReducer(state, { ...event, followUpState });
    expect(next.rejections).toEqual([]);
    expect(next.units).toBe(state.units);
    expect(next.movements).toBe(state.movements);
    expect(next.dischargeRevisions[admission.id]).toBe(1);
    expect(next.admissions.find((row) => row.id === admission.id)?.followUp).toEqual({
      state: followUpState,
      recordedAt: NOW_ANCHOR,
      recordedBy: "Flow coordinator",
    });
    expect(next.auditEvents.at(-1)).toMatchObject({
      outcome: "accepted",
      category: "discharge",
      action: event.type,
      details: { kind: "follow-up", requested: followUpState, after: followUpState },
    });
    expect(selectDischargeRecord(next, { role: "coordinator" }, admission.id)).toMatchObject({
      status: "allowed",
      value: { followUp: { state: followUpState } },
    });
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(next)))).toBe(true);
    const stale = wardFlowReducer(next, event);
    expect(stale.admissions).toBe(next.admissions);
    expect(stale.auditEvents.at(-1)).toMatchObject({ outcome: "stale", reasonCode: "revision" });
  });

  it("allows the owning ward and refuses other wards and excluded roles", () => {
    const { state, admission, event } = fixture();
    expect(wardFlowReducer(state, { ...event, role: "ward", actingUnitId: admission.unitId }).rejections).toEqual([]);
    const other = state.units.find((unit) => unit.id !== admission.unitId)!;
    for (const payload of [
      { role: "ward", actingUnitId: other.id },
      { role: "ward" },
      { role: "ed" },
      { role: "community" },
      { role: "officer" },
      { role: "demo" },
    ]) {
      const next = wardFlowReducer(state, { ...event, ...payload } as WardFlowEvent);
      expect(next.admissions).toBe(state.admissions);
      expect(next.units).toBe(state.units);
      expect(next.auditEvents.at(-1)?.outcome).toBe("denied");
    }
  });

  it("refuses stale worlds, mismatched people, unsupported values and invalid times", () => {
    const { state, event } = fixture();
    for (const patch of [
      { expectedGeneration: 99 },
      { patientId: "PT-UNKNOWN" },
      { expectedRevision: 99 },
      { followUpState: "completed" },
      { now: NaN },
      { now: -Infinity },
      { admissionId: "absent" },
    ]) {
      const next = wardFlowReducer(state, { ...event, ...patch } as WardFlowEvent);
      expect(next.admissions).toBe(state.admissions);
      expect(next.units).toBe(state.units);
      expect(next.auditEvents.at(-1)?.outcome).not.toBe("accepted");
    }
  });

  it("allows a recorded departure but refuses death and unoccupied admissions", () => {
    const { state, admission, event } = fixture();
    for (const [admissionState, destination, accepted] of [
      ["departed", "discharged-to-the-community", true],
      ["departed", "died-on-the-ward", false],
      ["waitlisted", null, false],
      ["pulled", null, false],
    ] as const) {
      const before = {
        ...state,
        admissions: state.admissions.map((row) =>
          row.id === admission.id ? { ...row, state: admissionState, leavingDestination: destination } : row,
        ),
      };
      const next = wardFlowReducer(before, event);
      expect(next.auditEvents.at(-1)?.outcome).toBe(accepted ? "accepted" : "denied");
      expect(next.units).toBe(before.units);
    }
  });
});
