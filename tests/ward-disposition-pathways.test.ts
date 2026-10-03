import { describe, expect, it } from "vitest";

import { LEAVING_DESTINATIONS, type LeavingDestination } from "@/components/ward-management/ward-admissions";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function fixture() {
  const state = seedWardFlowState();
  const admission = state.admissions.find((row) => {
    const patient = state.patients.find((person) => person.id === row.patientId);
    return row.state === "occupied" && patient?.legalStatus?.startsWith("Voluntary");
  });
  if (!admission || !admission.patientId) throw new Error("Voluntary linked occupant required");
  const unit = state.units.find((row) => row.id === admission.unitId)!;
  return { state, admission, unit };
}

function departure(destination: LeavingDestination, linked = false) {
  const { state, admission, unit } = fixture();
  const shared = {
    role: "ward" as const,
    now: NOW_ANCHOR,
    admissionId: admission.id,
    actingUnitId: admission.unitId,
    leavingDestination: destination,
  };
  const event: WardFlowEvent = linked
    ? {
        ...shared,
        type: "RECORD_PATIENT_DISCHARGE",
        patientId: admission.patientId!,
        expectedGeneration: state.worldGeneration,
        expectedRevision: state.dischargeRevisions[admission.id] ?? 0,
      }
    : { ...shared, type: "RECORD_LEAVING" };
  return { state, admission, unit, event };
}

describe("departure pathways through both ward commands", () => {
  it.each(LEAVING_DESTINATIONS)("completes $label once and preserves its history and bed accounting", ({ id }) => {
    const legacy = departure(id);
    const protectedCommand = departure(id, true);
    const next = wardFlowReducer(legacy.state, legacy.event);
    const linkedNext = wardFlowReducer(protectedCommand.state, protectedCommand.event);
    expect(next.rejections).toEqual([]);
    expect(linkedNext.rejections).toEqual([]);
    expect(next.admissions.find((row) => row.id === legacy.admission.id)).toMatchObject({
      state: "departed",
      leavingDestination: id,
      leftAt: NOW_ANCHOR,
    });
    expect(linkedNext.admissions).toEqual(next.admissions);
    expect(linkedNext.units).toEqual(next.units);
    expect(next.units.find((row) => row.id === legacy.unit.id)?.empty.value).toBe(legacy.unit.empty.value + 1);
    expect(next.admissions).toHaveLength(legacy.state.admissions.length);
    expect(next.auditEvents.at(-1)).toMatchObject({ outcome: "accepted", category: "discharge" });
    const repeated = wardFlowReducer(next, legacy.event);
    expect(repeated.units).toBe(next.units);
    expect(repeated.admissions).toBe(next.admissions);
    expect(repeated.rejections).toHaveLength(1);
  });

  it.each([false, true])("refuses malformed destinations and non-finite or pre-arrival times (linked=%s)", (linked) => {
    for (const patch of [
      { leavingDestination: "unlisted-patient-text" },
      { leavingDestination: "statistical-type-change" },
      { now: NaN },
      { now: Infinity },
      { now: -Infinity },
    ]) {
      const { state, event } = departure("discharged-to-the-community", linked);
      const refused = wardFlowReducer(state, { ...event, ...patch } as WardFlowEvent);
      expect(refused.admissions, JSON.stringify(patch)).toBe(state.admissions);
      expect(refused.units).toBe(state.units);
      expect(refused.auditEvents.at(-1)?.outcome).not.toBe("accepted");
    }
    const { state, admission, event } = departure("discharged-to-the-community", linked);
    admission.arrivedAt = NOW_ANCHOR;
    const refused = wardFlowReducer(state, { ...event, now: NOW_ANCHOR - 1 });
    expect(refused.admissions).toBe(state.admissions);
    expect(refused.units).toBe(state.units);
  });

  it.each([false, true])(
    "uses the admission's movement status even when its patient label is voluntary (linked=%s)",
    (linked) => {
      const { state, admission, event } = departure("discharged-to-the-community", linked);
      const movement = state.movements[0];
      movement.admissionId = admission.id;
      movement.legalStatus = "Involuntary inpatient";
      const refused = wardFlowReducer(state, event);
      expect(refused.admissions).toBe(state.admissions);
      expect(refused.units).toBe(state.units);
      expect(refused.rejections.at(-1)?.reason).toMatch(/involuntary/i);
    },
  );

  it("does not let an unrelated historical movement override this stay's voluntary status", () => {
    const { state, admission, event } = departure("discharged-to-the-community", true);
    state.movements[0].patientId = admission.patientId!;
    state.movements[0].admissionId = "a-different-stay";
    state.movements[0].legalStatus = "Involuntary inpatient";
    const next = wardFlowReducer(state, event);
    expect(next.rejections).toEqual([]);
    expect(next.admissions.find((row) => row.id === admission.id)?.state).toBe("departed");
  });

  it("rejects off-list departure values on reload", () => {
    const fixtureState = fixture();
    const state = JSON.parse(JSON.stringify(fixtureState.state));
    const admission = state.admissions.find((row: { id: string }) => row.id === fixtureState.admission.id);
    expect(isValidStoredWardFlowState(state)).toBe(true);
    admission.leavingDestination = "unlisted-patient-text" as LeavingDestination;
    expect(isValidStoredWardFlowState(state)).toBe(false);
  });
});
