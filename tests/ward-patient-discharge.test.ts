import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { selectDischargeRecord } from "@/components/ward-management/ward-discharge-records";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function fixture() {
  const state = seedWardFlowState();
  const admission = state.admissions.find((row) => row.patientId !== null && row.state === "occupied");
  if (!admission || admission.patientId === null) throw new Error("Linked occupied admission required");
  const record = selectDischargeRecord(state, { role: "ward", actingUnitId: admission.unitId }, admission.id);
  if (record.status !== "allowed") throw new Error("Own ward projection required");
  const event: Extract<WardFlowEvent, { type: "RECORD_PATIENT_DISCHARGE" }> = {
    type: "RECORD_PATIENT_DISCHARGE",
    role: "ward",
    now: NOW_ANCHOR,
    actingUnitId: admission.unitId,
    admissionId: admission.id,
    patientId: admission.patientId,
    expectedGeneration: record.value.generation,
    expectedRevision: record.value.revision,
    leavingDestination: "discharged-to-the-community",
  };
  return { state, admission, event };
}

describe("patient-linked discharge transition", () => {
  it.each([
    { patch: { now: NaN }, reason: "invalid-payload" },
    { patch: { role: "officer" }, reason: "role" },
  ])("never attaches a reset subject when an earlier refusal wins: $reason", ({ patch, reason }) => {
    const { state, event } = fixture();
    const reset = wardFlowReducer(state, { type: "RESET_SCENARIO", role: "demo", now: NOW_ANCHOR });
    const refused = wardFlowReducer(reset, { ...event, ...patch } as WardFlowEvent);
    expect(refused.admissions).toBe(reset.admissions);
    expect(refused.units).toBe(reset.units);
    expect(refused.auditEvents.at(-1)).toMatchObject({
      outcome: "denied",
      reasonCode: reason,
      subject: { kind: "unresolved" },
      details: { kind: "departure", before: null, after: null, recordedDestination: null },
    });
    if (reason === "invalid-payload") expect(refused.auditEvents.at(-1)?.at).toBeNull();
  });
  it("arrival increments the actual selected DTO revision before the linked departure can run", () => {
    // The previous fixture transplanted WF-006 onto an unrelated occupied stay, changed the
    // stay to pulled, and left its patient/backpointer mismatched. Produce the actual held stay
    // instead so this tests revision invalidation without bypassing arrival identity checks.
    let state = seedWardFlowState();
    const send = (event: WardFlowEvent) => {
      state = wardFlowReducer(state, event);
    };
    send({
      type: "ADD_PATIENT",
      role: "coordinator",
      now: NOW_ANCHOR,
      umrn: "SYN-DISCHARGE-REVISION",
      givenName: "Synthetic",
      familyName: "Revision",
      dateOfBirth: "1980-01-01",
    });
    const patientId = state.patients.at(-1)!.id;
    send({
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW_ANCHOR,
      edId: "jhc-ed",
      patientId,
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        gender: "Female",
        specialling: false,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
    });
    const movementId = state.movements.at(-1)!.id;
    const unitId = "scgh-adult-open";
    send({ type: "REFER_TO_UNITS", role: "coordinator", now: NOW_ANCHOR, movementId, unitIds: [unitId] });
    send({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", now: NOW_ANCHOR, movementId, unitId });
    send({ type: "PULL_PATIENT", role: "ward", now: NOW_ANCHOR, movementId, unitId });
    send({ type: "RECORD_TRANSPORT_NEED", role: "ward", now: NOW_ANCHOR, movementId, needed: false });
    expect(state.rejections).toEqual([]);
    const admissionId = state.movements.at(-1)!.admissionId!;
    expect(admissionId).toBeTruthy();
    const held = state.admissions.find((row) => row.id === admissionId)!;
    expect(held).toMatchObject({ state: "pulled", unitId, patientId, movementId });
    const selected = selectDischargeRecord(state, { role: "ward", actingUnitId: unitId }, admissionId);
    if (selected.status !== "allowed") throw new Error("Selected DTO required");
    const arrived = wardFlowReducer(state, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW_ANCHOR,
      movementId,
      actingUnitId: unitId,
    });
    expect(arrived.rejections).toEqual([]);
    expect(arrived.admissions.find((row) => row.id === admissionId)?.state).toBe("occupied");
    expect(arrived.dischargeRevisions[admissionId]).toBe(selected.value.revision + 1);
    const stale = wardFlowReducer(arrived, {
      type: "RECORD_PATIENT_DISCHARGE",
      role: "ward",
      now: NOW_ANCHOR,
      actingUnitId: unitId,
      admissionId,
      patientId,
      expectedGeneration: selected.value.generation,
      expectedRevision: selected.value.revision,
      leavingDestination: "discharged-to-the-community",
    });
    expect(stale.units).toBe(arrived.units);
    expect(stale.auditEvents.at(-1)).toMatchObject({ outcome: "stale", reasonCode: "revision" });
  });
  it("uses the legacy departure arithmetic exactly once, retains anonymous releases, and invalidates its DTO", () => {
    const { state, admission, event } = fixture();
    const legacy = wardFlowReducer(state, {
      type: "RECORD_LEAVING",
      role: "ward",
      now: event.now,
      actingUnitId: admission.unitId,
      admissionId: admission.id,
      leavingDestination: event.leavingDestination,
    });
    const next = wardFlowReducer(state, event);
    expect(next.units).toEqual(legacy.units);
    expect(next.admissions).toEqual(legacy.admissions);
    // CHANGED 25 September 2026: bed releases are now derived per named admission (owner ruling
    // 2026-09-25), so a departure that names an admission with a live release completes that
    // release in the same write — it is no longer true that a discharge never touches
    // `bedReleases`. The property this guards is unchanged in spirit: the patient-linked path and
    // the legacy `RECORD_LEAVING` path must produce IDENTICAL release bookkeeping, and every
    // release belonging to a DIFFERENT admission must be left untouched.
    expect(next.bedReleases).toEqual(legacy.bedReleases);
    const beforeLiveRelease = state.bedReleases.find(
      (release) => release.admissionId === admission.id && release.state !== "discharged",
    );
    const otherReleasesBefore = state.bedReleases.filter((release) => release.admissionId !== admission.id);
    const otherReleasesAfter = next.bedReleases.filter((release) => release.admissionId !== admission.id);
    expect(otherReleasesAfter).toEqual(otherReleasesBefore);
    if (beforeLiveRelease) {
      expect(next.bedReleases.find((release) => release.id === beforeLiveRelease.id)).toMatchObject({
        state: "discharged",
        waitingOn: null,
        blocker: null,
        blockedBy: null,
        confirmedAt: event.now,
      });
    } else {
      expect(next.bedReleases).toBe(state.bedReleases);
    }
    const beforeUnit = state.units.find((unit) => unit.id === admission.unitId)!;
    const afterUnit = next.units.find((unit) => unit.id === admission.unitId)!;
    expect(afterUnit.empty.value).toBe(Math.min(beforeUnit.beds, beforeUnit.empty.value + 1));
    expect(afterUnit.allocatable).toEqual({
      ...beforeUnit.allocatable,
      value: Math.min(beforeUnit.beds, beforeUnit.allocatable.value + 1),
      confirmedAt: event.now,
      revision: (beforeUnit.allocatable.revision ?? 0) + 1,
    });
    expect(next.dischargeRevisions[admission.id]).toBe(1);
    expect(next.auditEvents.at(-1)).toMatchObject({
      outcome: "accepted",
      category: "discharge",
      details: {
        kind: "departure",
        before: "occupied",
        after: "departed",
        recordedDestination: event.leavingDestination,
      },
    });
    const repeat = wardFlowReducer(next, event);
    expect(repeat.units).toBe(next.units);
    expect(repeat.admissions).toBe(next.admissions);
    expect(repeat.auditEvents.at(-1)).toMatchObject({ outcome: "stale", reasonCode: "revision" });
  });

  it.each([
    { role: "coordinator" },
    { role: "ed" },
    { role: "not-a-role" },
    { actingUnitId: "missing" },
    { admissionId: "missing" },
    { patientId: "missing" },
    { expectedRevision: -1 },
    { expectedRevision: 0.5 },
    { expectedRevision: Infinity },
    { expectedGeneration: NaN },
    { expectedGeneration: -1 },
    { expectedGeneration: 0.5 },
    { expectedGeneration: 1 },
    { expectedRevision: 1 },
    { now: NaN },
    { now: Infinity },
    { leavingDestination: "unlisted-patient-text" },
  ])("refuses invalid, stale or excluded command %j without clinical mutation", (patch) => {
    const { state, event } = fixture();
    const next = wardFlowReducer(state, { ...event, ...patch } as WardFlowEvent);
    expect(next.admissions).toBe(state.admissions);
    expect(next.units).toBe(state.units);
    expect(next.bedReleases).toBe(state.bedReleases);
    expect(next.auditEvents).toHaveLength(1);
    expect(next.auditEvents[0].outcome).not.toBe("accepted");
    expect(
      next.rejections.every((row) => row.reason === "Request could not be completed" && row.movementId === "none"),
    ).toBe(true);
    if (patch.now !== undefined) {
      expect(next.rejections).toEqual([]);
      expect(next.auditEvents[0].at).toBeNull();
    }
  });

  it.each(["waitlisted", "pulled", "departed"] as const)("refuses %s admissions", (stateValue) => {
    const { state, admission, event } = fixture();
    admission.state = stateValue;
    const next = wardFlowReducer(state, event);
    expect(next.units).toBe(state.units);
    expect(next.auditEvents[0]).toMatchObject({ outcome: "denied", reasonCode: "transition" });
  });

  it.each(["patient", "admission", "unit", "null-link", "cross-ward"])(
    "refuses ambiguous or mismatched %s linkage",
    (kind) => {
      const { state, admission, event } = fixture();
      if (kind === "patient") state.patients.push({ ...state.patients.find((row) => row.id === admission.patientId)! });
      if (kind === "admission") state.admissions.push({ ...admission });
      if (kind === "unit") state.units.push({ ...state.units.find((row) => row.id === admission.unitId)! });
      if (kind === "null-link") admission.patientId = null;
      if (kind === "cross-ward") event.actingUnitId = state.units.find((row) => row.id !== admission.unitId)!.id;
      const next = wardFlowReducer(state, event);
      expect(next.admissions).toBe(state.admissions);
      expect(next.units).toBe(state.units);
      expect(next.auditEvents[0].outcome).toBe("denied");
    },
  );

  it("an old DTO cannot write after legacy departure or reset reseeds revision zero", () => {
    const { state, admission, event } = fixture();
    const left = wardFlowReducer(state, {
      type: "RECORD_LEAVING",
      role: "ward",
      now: NOW_ANCHOR,
      actingUnitId: admission.unitId,
      admissionId: admission.id,
      leavingDestination: event.leavingDestination,
    });
    expect(wardFlowReducer(left, event).auditEvents.at(-1)).toMatchObject({ outcome: "stale", reasonCode: "revision" });
    const reset = wardFlowReducer(left, { type: "RESET_SCENARIO", role: "demo", now: NOW_ANCHOR });
    const stale = wardFlowReducer(reset, event);
    expect(stale.units).toBe(reset.units);
    expect(stale.auditEvents.at(-1)).toMatchObject({
      outcome: "stale",
      reasonCode: "generation",
      subject: { kind: "unresolved" },
      details: { before: null, after: null, recordedDestination: null },
    });
  });

  it("keeps anonymous legacy departures working and refuses counter exhaustion", () => {
    const { state, admission, event } = fixture();
    admission.patientId = null;
    const anonymous = wardFlowReducer(state, {
      type: "RECORD_LEAVING",
      role: "ward",
      now: NOW_ANCHOR,
      actingUnitId: admission.unitId,
      admissionId: admission.id,
      leavingDestination: event.leavingDestination,
    });
    expect(anonymous.admissions.find((row) => row.id === admission.id)?.state).toBe("departed");
    state.auditSequence = Number.MAX_SAFE_INTEGER;
    expect(wardFlowReducer(state, event)).toBe(state);
    state.worldGeneration = Number.MAX_SAFE_INTEGER;
    expect(wardFlowReducer(state, { type: "RESET_SCENARIO", role: "demo", now: NOW_ANCHOR })).toBe(state);
  });
});
