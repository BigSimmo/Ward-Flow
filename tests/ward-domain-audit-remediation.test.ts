import { describe, expect, it } from "vitest";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { bedMapWards } from "@/components/ward-management/capacity/bed-map";
import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
const now = 642;
// The provider deliberately omits rejections from its persistence projection (D-18).
const valid = (state: WardFlowState) =>
  isValidStoredWardFlowState(JSON.parse(JSON.stringify({ ...state, rejections: [] })));
function journey(atsCategory?: number) {
  let state = seedWardFlowState();
  const send = (event: Omit<WardFlowEvent, "now"> | Record<string, unknown>) => {
    state = wardFlowReducer(state, { now, ...event } as WardFlowEvent);
    return state;
  };
  send({
    type: "ADD_PATIENT",
    role: "coordinator",
    umrn: "SYN-REMEDIATION-001",
    givenName: "Synthetic",
    familyName: "Domain",
    dateOfBirth: "1980-01-01",
  });
  const patientId = state.patients.at(-1)!.id;
  const unitId = "scgh-adult-open";
  send({
    type: "RAISE_REFERRAL",
    role: "ed",
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
      ...(atsCategory === undefined ? {} : { atsCategory }),
      legalFormCode: null,
    },
  });
  const movementId = state.movements.at(-1)!.id;
  send({ type: "REFER_TO_UNITS", role: "coordinator", movementId, unitIds: [unitId] });
  send({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId, unitId });
  send({ type: "PULL_PATIENT", role: "ward", movementId, unitId });
  expect(state.rejections).toEqual([]);
  return {
    get state() {
      return state;
    },
    send,
    patientId,
    unitId,
    movementId,
    arrive() {
      send({ type: "RECORD_TRANSPORT_NEED", role: "ward", movementId, needed: false });
      send({ type: "PATIENT_ARRIVED", role: "ward", movementId, actingUnitId: unitId });
    },
    book() {
      send({
        type: "BOOK_TRANSPORT",
        role: "ed",
        movementId,
        provider: "Ambulance service",
        escortRequired: false,
        cadNumber: "SYN-CAD",
        transportLegalStatus: "voluntary",
        estimatedAt: 700,
      });
    },
  };
}
const deterioration = (f: ReturnType<typeof journey>, extra: Record<string, unknown> = {}) =>
  f.send({
    type: "RECORD_ED_MEDICAL_DETERIORATION",
    role: "ed",
    movementId: f.movementId,
    actingPlaceId: "jhc-ed",
    ...extra,
  });

describe("audit domain regressions — valid producers and complete recovery", () => {
  it("atomically cancels a pre-collection booking, releases one held bed, pauses and requires re-clearance/re-acceptance", () => {
    const f = journey();
    const before = f.state.units.find((u) => u.id === f.unitId)!;
    const held = f.state.movements.find((m) => m.id === f.movementId)!.admissionId!;
    f.book();
    deterioration(f);
    const m = f.state.movements.find((m) => m.id === f.movementId)!;
    expect(m.acceptedUnitId).toBeUndefined();
    expect(m.admissionId).toBeUndefined();
    expect(f.state.admissions.find((a) => a.id === held)).toBeUndefined();
    expect(f.state.units.find((u) => u.id === f.unitId)!.allocatable.value).toBe(before.allocatable.value + 1);
    expect(m.transport?.cancelledAt).toBe(now);
    expect(m.blocker).toContain("Medical Deterioration");
    expect(m.unwinds.some((u) => u.reason === "Medical Deterioration - ED Resuscitation Required")).toBe(true);
    expect(valid(f.state)).toBe(true);
    const unit = f.state.units.find((u) => u.id === f.unitId)!;
    deterioration(f);
    expect(f.state.units.find((u) => u.id === f.unitId)!.allocatable.value).toBe(unit.allocatable.value);
    for (const event of [
      { type: "REFER_TO_UNITS", role: "coordinator", unitIds: [f.unitId] },
      { type: "PULL_PATIENT", role: "ward", unitId: f.unitId },
      {
        type: "BOOK_TRANSPORT",
        role: "ed",
        provider: "Ambulance service",
        escortRequired: false,
        cadNumber: "SYN-RETRY",
        transportLegalStatus: "voluntary",
        estimatedAt: 700,
      },
      { type: "PATIENT_ARRIVED", role: "ward", actingUnitId: f.unitId },
    ]) {
      const count = f.state.rejections.length;
      f.send({ ...event, movementId: f.movementId });
      expect(f.state.rejections.length).toBe(count + 1);
    }
    f.send({
      type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
      role: "ed",
      movementId: f.movementId,
      cleared: true,
      now: now + 1,
    });
    f.send({ type: "REFER_TO_UNITS", role: "coordinator", movementId: f.movementId, unitIds: [f.unitId] });
    f.send({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId: f.movementId, unitId: f.unitId });
    f.send({ type: "PULL_PATIENT", role: "ward", movementId: f.movementId, unitId: f.unitId });
    expect(f.state.movements.find((m) => m.id === f.movementId)!.stage).toBe("pulled");
    expect(valid(f.state)).toBe(true);
  });
  it("allows explicit no-transport deterioration but does not reinterpret an ordinary unknown clearance", () => {
    const f = journey();
    f.send({ type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE", role: "ed", movementId: f.movementId, cleared: false });
    expect(f.state.movements.find((m) => m.id === f.movementId)!.admissionId).toBeDefined();
    deterioration(f);
    expect(f.state.movements.find((m) => m.id === f.movementId)!.admissionId).toBeUndefined();
  });
  it("refuses another ED and refuses collected-patient cancellation without changing clinical state", () => {
    const f = journey();
    const before = f.state;
    deterioration(f, { actingPlaceId: "scgh-ed" });
    expect(f.state.movements).toBe(before.movements);
    expect(f.state.units).toBe(before.units);
    f.book();
    for (const event of [
      { type: "HANDOVER_READY", role: "ed" },
      { type: "TRANSPORT_ACCEPTED", role: "officer" },
      { type: "TRANSPORT_EN_ROUTE", role: "officer" },
      { type: "PATIENT_COLLECTED", role: "officer" },
    ])
      f.send({ ...event, movementId: f.movementId });
    const collected = f.state;
    deterioration(f);
    expect(f.state.movements).toBe(collected.movements);
    expect(f.state.admissions).toBe(collected.admissions);
    expect(f.state.units).toBe(collected.units);
  });
  it("rejects wrong-ward linked admission at restore and arrival without moving either census", () => {
    const f = journey();
    const id = f.state.movements.find((m) => m.id === f.movementId)!.admissionId!;
    const corrupted = {
      ...f.state,
      admissions: f.state.admissions.map((a) => (a.id === id ? { ...a, unitId: "rph-adult-secure" } : a)),
    };
    expect(valid(corrupted)).toBe(false);
    const ready = wardFlowReducer(corrupted, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ward",
      now,
      movementId: f.movementId,
      needed: false,
    });
    const next = wardFlowReducer(ready, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now,
      movementId: f.movementId,
      actingUnitId: f.unitId,
    });
    expect(next.units).toBe(ready.units);
    expect(next.admissions).toBe(ready.admissions);
    expect(next.rejections.length).toBe(ready.rejections.length + 1);
  });
  it("rejects wrong backpointer, wrong state, and duplicate linked reservation without excluding the seed", () => {
    expect(valid(seedWardFlowState())).toBe(true);
    const f = journey();
    const m = f.state.movements.find((m) => m.id === f.movementId)!;
    for (const changes of [
      { movementId: f.state.movements[0].id },
      { state: "occupied" as const },
      { state: "departed" as const },
    ]) {
      const state = {
        ...f.state,
        admissions: f.state.admissions.map((a) => (a.id === m.admissionId ? { ...a, ...changes } : a)),
      };
      expect(valid(state)).toBe(false);
    }
    const admission = f.state.admissions.find((a) => a.id === m.admissionId)!;
    expect(valid({ ...f.state, admissions: [...f.state.admissions, { ...admission, id: "SYN-DUPLICATE-HOLD" }] })).toBe(
      false,
    );
  });
  it("keeps actual preparation visible when a valid ward confirmation offers zero beds", () => {
    const state = seedWardFlowState();
    const release = state.bedReleases.find((r) => r.state === "discharged" && r.preparing)!;
    const unit = state.units.find((u) => u.id === release.unitId)!;
    const next = wardFlowReducer(state, {
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now,
      unitId: unit.id,
      actingUnitId: unit.id,
      value: 0,
      expectedRevision: unit.allocatable.revision ?? 0,
    });
    expect(next.rejections).toEqual([]);
    expect(valid(next)).toBe(true);
    const ward = bedMapWards(next.units, next.bedReleases, next.admissions, next.leaveBeds).find(
      (w) => w.unit.id === unit.id,
    )!;
    expect(ward.ready).toBe(0);
    expect(ward.pendingPreparation).toBe(1);
    expect(ward.ready + ward.pulled + ward.closed + ward.occupied).toBe(unit.beds);
  });
  it("round-trips a recorded arrival amid full/stale counts with an explicit discrepancy and no duplicate increment", () => {
    const f = journey();
    const full = {
      ...f.state,
      units: f.state.units.map((u) =>
        u.id === f.unitId ? { ...u, empty: { ...u.empty, value: 0 }, sexMix: { Female: u.beds, Male: 0 } } : u,
      ),
    };
    expect(valid(full)).toBe(true);
    const ready = wardFlowReducer(full, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ward",
      now,
      movementId: f.movementId,
      needed: false,
    });
    const arrived = wardFlowReducer(ready, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now,
      movementId: f.movementId,
      actingUnitId: f.unitId,
    });
    expect(arrived.movements.find((m) => m.id === f.movementId)!.stage).toBe("arrived");
    expect(valid(arrived)).toBe(true);
    const row = networkWardRows(arrived.units, now, arrived.bedReleases, arrived.admissions, arrived.leaveBeds).find(
      (r) => r.unit.id === f.unitId,
    )!;
    expect((row as unknown as { arrivalCapacityConflicts: number }).arrivalCapacityConflicts).toBe(1);
    const duplicate = wardFlowReducer(arrived, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now,
      movementId: f.movementId,
      actingUnitId: f.unitId,
    });
    expect(duplicate.units).toBe(arrived.units);
    const admission = arrived.admissions.find((a) => a.movementId === f.movementId)!;
    const left = wardFlowReducer(arrived, {
      type: "RECORD_PATIENT_DISCHARGE",
      role: "ward",
      now: now + 1,
      admissionId: admission.id,
      actingUnitId: f.unitId,
      patientId: f.patientId,
      expectedGeneration: arrived.worldGeneration,
      expectedRevision: arrived.dischargeRevisions[admission.id] ?? 0,
      leavingDestination: "discharged-to-the-community",
    });
    expect(left.units.find((u) => u.id === f.unitId)!.empty.value).toBe(0);
    expect(valid(left)).toBe(true);
  });
});

describe("recorded ATS category, separate from operational urgency", () => {
  it("retains each supplied ATS category and leaves the operational urgency unchanged", () => {
    for (const category of [1, 2, 3, 4, 5]) {
      const f = journey(category);
      const movement = f.state.movements.find((m) => m.id === f.movementId)!;
      expect((movement as unknown as { atsCategory?: number }).atsCategory).toBe(category);
      expect(movement.urgency).toBe(2);
      expect(valid(f.state)).toBe(true);
    }
    expect((journey().state.movements.at(-1) as unknown as { atsCategory?: number }).atsCategory).toBeUndefined();
  });
  it("rejects invalid restored ATS rather than deriving or rounding a category", () => {
    const f = journey();
    for (const atsCategory of [0, 6, 1.5, "1", null]) {
      expect(
        valid({
          ...f.state,
          movements: f.state.movements.map((m) => (m.id === f.movementId ? { ...m, atsCategory } : m)),
        } as WardFlowState),
      ).toBe(false);
    }
  });
});

describe("medical clearance and recorded category boundaries", () => {
  it("blocks explicit medical-not-cleared onward actions without silently releasing the reservation", () => {
    const f = journey();
    const units = f.state.units;
    const admission = f.state.movements.find((m) => m.id === f.movementId)!.admissionId;
    f.send({ type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE", role: "ed", movementId: f.movementId, cleared: false });
    const before = f.state.rejections.length;
    f.book();
    expect(f.state.rejections.length).toBe(before + 1);
    const beforeArrival = f.state.rejections.length;
    f.arrive();
    expect(f.state.rejections.length).toBe(beforeArrival + 1);
    expect(f.state.units).toBe(units);
    expect(f.state.movements.find((m) => m.id === f.movementId)!.admissionId).toBe(admission);
    expect(f.state.movements.find((m) => m.id === f.movementId)!.stage).toBe("pulled");
  });
  it("records ATS on intake, rejects invalid values at both runtime boundaries and restores valid values", () => {
    const intake = (atsCategory?: unknown) =>
      ({
        type: "RECEIVE_REFERRAL",
        role: "community",
        now,
        ageBand: "Adult",
        destinations: [
          {
            kind: "psychiatric_ward",
            sex: "Female",
            secureBedNeeded: false,
            involuntaryBedNeeded: false,
            highAcuityNursingNeeded: false,
          },
        ],
        homeRegion: "Perth Metropolitan",
        suburb: { kind: "named", name: "Armadale" },
        source: "community",
        urgency: 2,
        originSiteCode: "RPH",
        transportNeeded: false,
        ...FIXTURE_HISTORY,
        ...(atsCategory === undefined ? {} : { atsCategory }),
      }) as WardFlowEvent;
    for (const category of [1, 2, 3, 4, 5]) {
      const state = wardFlowReducer(seedWardFlowState(), intake(category));
      expect(state.rejections).toEqual([]);
      expect(state.referrals.at(-1)?.atsCategory).toBe(category);
      expect(state.referrals.at(-1)?.urgency).toBe(2);
    }
    const f = journey();
    for (const atsCategory of [0, 6, 1.5, "1", null, Number.NaN]) {
      const initial = seedWardFlowState();
      const invalid = wardFlowReducer(initial, intake(atsCategory));
      expect(invalid.referrals).toBe(initial.referrals);
      expect(invalid.rejections.at(-1)?.reason).toContain("ATS category");
      const invalidRaised = wardFlowReducer(f.state, {
        type: "RAISE_REFERRAL",
        role: "ed",
        now,
        edId: "jhc-ed",
        patientId: f.patientId,
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
          atsCategory,
        },
      } as WardFlowEvent);
      expect(invalidRaised.movements).toBe(f.state.movements);
      expect(invalidRaised.rejections.at(-1)?.reason).toContain("ATS category");
    }
  });
});

describe("historical seed exceptions and bounded recovery conflicts", () => {
  it("arrives the authored seeded reservation with its documented null backpointer at the actual ward", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((row) => row.id === "WF-318")!;
    const held = state.admissions.find((row) => row.id === movement.admissionId)!;
    expect(held.movementId).toBeNull();
    expect(held.unitId).toBe(movement.acceptedUnitId);
    const ready = wardFlowReducer(state, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ward",
      now,
      movementId: movement.id,
      needed: false,
    });
    const next = wardFlowReducer(ready, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now,
      movementId: movement.id,
      actingUnitId: movement.acceptedUnitId,
    });
    expect(next.rejections).toEqual([]);
    expect(next.admissions.find((row) => row.id === held.id)?.state).toBe("occupied");
    expect(valid(next)).toBe(true);
  });
  it("also restores an authored null-backpointer arrival when the ward observation is full", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((row) => row.id === "WF-318")!;
    const full = {
      ...state,
      units: state.units.map((unit) =>
        unit.id === movement.acceptedUnitId
          ? { ...unit, empty: { ...unit.empty, value: 0 }, sexMix: { Female: unit.beds, Male: 0 } }
          : unit,
      ),
    };
    expect(valid(full)).toBe(true);
    const ready = wardFlowReducer(full, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ward",
      now,
      movementId: movement.id,
      needed: false,
    });
    const next = wardFlowReducer(ready, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now,
      movementId: movement.id,
      actingUnitId: movement.acceptedUnitId,
    });
    expect(next.rejections).toEqual([]);
    expect(valid(next)).toBe(true);
    expect(next.units.find((unit) => unit.id === movement.acceptedUnitId)?.arrivalCapacityConflicts).toHaveLength(1);
  });
  it("retains a legitimate authored moving journey without inventing an admission", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find(
      (row) => row.stage === "moving" && !row.admissionId && row.transport?.collectedAt !== undefined,
    )!;
    expect(movement).toBeDefined();
    const next = wardFlowReducer(state, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now,
      movementId: movement.id,
      actingUnitId: movement.acceptedUnitId,
    });
    expect(next.rejections).toEqual([]);
    expect(next.admissions).toBe(state.admissions);
    expect(valid(next)).toBe(true);
  });
  it("does not accept invented conflict records as authority for an excess census", () => {
    const f = journey();
    const corrupt = {
      ...f.state,
      units: f.state.units.map((unit) =>
        unit.id === f.unitId
          ? {
              ...unit,
              sexMix: { Female: unit.beds + 1, Male: 0 },
              arrivalCapacityConflicts: [{ movementId: f.movementId, at: now }],
            }
          : unit,
      ),
    };
    expect(valid(corrupt)).toBe(false);
    const full = {
      ...f.state,
      units: f.state.units.map((unit) =>
        unit.id === f.unitId
          ? { ...unit, empty: { ...unit.empty, value: 0 }, sexMix: { Female: unit.beds, Male: 0 } }
          : unit,
      ),
    };
    const ready = wardFlowReducer(full, {
      type: "RECORD_TRANSPORT_NEED",
      role: "ward",
      now,
      movementId: f.movementId,
      needed: false,
    });
    const arrived = wardFlowReducer(ready, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now,
      movementId: f.movementId,
      actingUnitId: f.unitId,
    });
    expect(valid(arrived)).toBe(true);
    const unit = arrived.units.find((row) => row.id === f.unitId)!;
    const conflict = unit.arrivalCapacityConflicts![0];
    for (const conflicts of [
      [{ ...conflict, at: now + 1 }],
      [{ ...conflict, movementId: "SYN-MISSING" }],
      [conflict, conflict],
    ]) {
      expect(
        valid({
          ...arrived,
          units: arrived.units.map((row) =>
            row.id === unit.id ? { ...row, arrivalCapacityConflicts: conflicts } : row,
          ),
        }),
      ).toBe(false);
    }
  });
});
