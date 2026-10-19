import { describe, expect, it } from "vitest";
import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { admissionCriteriaEligibility } from "@/components/ward-management/ward-discharge-records";
import {
  seedWardFlowState,
  wardFlowReducer,
  admissionLegalStatus,
  type WardFlowState,
} from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { CareChange } from "@/components/ward-management/ward-care-journey";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { NOW_ANCHOR as NOW } from "@/components/ward-management/ward-sites";

const UNIT = "fsh-adult-secure";
function book(state: WardFlowState, patch: Partial<Extract<WardFlowEvent, { type: "BOOK_PLANNED_ADMISSION" }>> = {}) {
  return wardFlowReducer(state, {
    type: "BOOK_PLANNED_ADMISSION",
    role: "coordinator",
    now: NOW,
    initials: "AB",
    sex: "Male",
    gender: "Male",
    reason: "respite",
    unitId: UNIT,
    expectedArrivalAt: NOW + 30,
    expectedStayDays: 7,
    legalStatus: "Involuntary inpatient",
    ageBand: "Adult",
    calendarDate: "2026-10-09",
    ...patch,
  });
}
function convert(state: WardFlowState) {
  const booking = state.plannedAdmissions.at(-1)!;
  return wardFlowReducer(state, {
    type: "CONVERT_PLANNED_ADMISSION",
    role: "coordinator",
    now: NOW + 30,
    plannedAdmissionId: booking.id,
    unitId: booking.unitId,
  });
}
function care(state: WardFlowState, admissionId: string, change: CareChange) {
  const admission = state.admissions.find((a) => a.id === admissionId)!;
  return wardFlowReducer(state, {
    type: "RECORD_ADMISSION_CARE",
    role: "coordinator",
    now: NOW + 31,
    admissionId,
    patientId: admission.patientId!,
    expectedGeneration: state.worldGeneration,
    expectedRevision: state.dischargeRevisions[admissionId] ?? 0,
    change,
  });
}

describe("planned arrival preserves checked authority and allocation gates", () => {
  it.each([false, true])(
    "retains involuntary booking authority after reload and ward scoping (linked=%s)",
    (linked) => {
      const seed = seedWardFlowState();
      // A voluntary patient record must not erase the admission's checked involuntary booking.
      seed.patients = seed.patients.map((p) =>
        p.id === "PT-002" ? { ...p, legalStatus: "Voluntary", gender: "Male" } : p,
      );
      seed.movements = seed.movements.filter((m) => m.patientId !== "PT-002");
      seed.admissions = seed.admissions.filter((a) => a.patientId !== "PT-002");
      const booked = book(seed, linked ? { initials: null, patientId: "PT-002" } : {});
      expect(booked.rejections).toEqual([]);
      const arrived = convert(booked);
      expect(arrived.rejections).toEqual([]);
      const stay = arrived.admissions.at(-1)!;
      expect(stay.plannedLegalStatus).toBe("Involuntary inpatient");
      const reload = JSON.parse(JSON.stringify(arrived)) as WardFlowState;
      expect(isValidStoredWardFlowState(reload)).toBe(true);
      // Older saves stored this fact only on the joined, arrived booking.
      const oldSave = structuredClone(reload);
      delete oldSave.admissions.at(-1)!.plannedLegalStatus;
      expect(isValidStoredWardFlowState(oldSave)).toBe(true);
      expect(admissionLegalStatus(oldSave, oldSave.admissions.at(-1)!)).toBe("Involuntary inpatient");
      expect(admissionCriteriaEligibility(oldSave, oldSave.admissions.at(-1)!)).toBe("involuntary");
      const { state: ward } = scopeWardFlowState(
        reload,
        { role: "ward", scope: { kind: "ward", unitIds: [UNIT] } },
        { now: NOW + 31, places: wardPlaceLookup(reload.units) },
      );
      expect(ward.plannedAdmissions).toEqual([]);
      const scopedStay = ward.admissions.find((a) => a.id === stay.id)!;
      expect(admissionLegalStatus(ward, scopedStay)).toBe("Involuntary inpatient");
      expect(admissionCriteriaEligibility(ward, scopedStay)).toBe("involuntary");
      const scopeOptions = { now: NOW + 31, places: wardPlaceLookup(oldSave.units) };
      const oldWard = scopeWardFlowState(
        oldSave,
        { role: "ward", scope: { kind: "ward", unitIds: [UNIT] } },
        scopeOptions,
      ).state;
      expect(
        admissionLegalStatus(
          oldWard,
          oldWard.admissions.find((a) => a.id === stay.id)!,
        ),
      ).toBe("Involuntary inpatient");
      const executive = scopeWardFlowState(
        oldSave,
        { role: "executive", scope: { kind: "statewide" } },
        scopeOptions,
      ).state;
      expect(executive.admissions.find((a) => a.id === stay.id)).not.toHaveProperty("plannedLegalStatus");
      if (linked) {
        const person = oldSave.patients.find((p) => p.id === stay.patientId)!;
        person.catchmentCommunityTeam = oldSave.patients.find((p) => p.catchmentCommunityTeam)?.catchmentCommunityTeam;
        expect(person.catchmentCommunityTeam).toBeTruthy();
        const community = scopeWardFlowState(
          oldSave,
          { role: "community", scope: { kind: "team", teamName: person.catchmentCommunityTeam! } },
          scopeOptions,
        );
        expect(community.scoped.datesOnlyAdmissionIds.has(stay.id)).toBe(true);
        expect(community.state.admissions.find((a) => a.id === stay.id)).not.toHaveProperty("plannedLegalStatus");
      }
      const leave: WardFlowEvent = linked
        ? {
            type: "RECORD_PATIENT_DISCHARGE",
            role: "coordinator",
            now: NOW + 31,
            actingUnitId: stay.unitId,
            admissionId: stay.id,
            patientId: stay.patientId!,
            expectedGeneration: reload.worldGeneration,
            expectedRevision: reload.dischargeRevisions[stay.id] ?? 0,
            leavingDestination: "discharged-to-the-community",
          }
        : {
            type: "RECORD_LEAVING",
            role: "ward",
            now: NOW + 31,
            admissionId: stay.id,
            actingUnitId: stay.unitId,
            leavingDestination: "discharged-to-the-community",
          };
      const refused = wardFlowReducer(reload, leave);
      expect(refused.admissions).toBe(reload.admissions);
      expect(refused.units).toBe(reload.units);
      expect(refused.rejections.at(-1)?.reason).toMatch(/involuntary/i);
      const oldSaveRefused = wardFlowReducer(oldSave, leave);
      expect(oldSaveRefused.admissions).toBe(oldSave.admissions);
      expect(oldSaveRefused.rejections.at(-1)?.reason).toMatch(/involuntary/i);
      if (linked) {
        const transport = care(reload, stay.id, {
          kind: "transport",
          mode: "ambulance",
          region: "metro",
          riskDocument: true,
          authority: "none",
          escortSuitable: true,
          leastRestrictiveReviewed: true,
          regionalServiceConfirmed: true,
        });
        expect(transport.admissions).toBe(reload.admissions);
        expect(transport.rejections.at(-1)?.reason).toMatch(/transport authority/);
        const revoked = care(reload, stay.id, {
          kind: "legal",
          authority: "revocation",
          writtenAt: NOW + 31,
          paperChecked: true,
        });
        expect(revoked.rejections).toEqual([]);
        const lawfulDeparture = wardFlowReducer(revoked, {
          ...leave,
          expectedRevision: revoked.dischargeRevisions[stay.id] ?? 0,
        } as WardFlowEvent);
        expect(lawfulDeparture.rejections).toEqual([]);
        expect(lawfulDeparture.admissions.find((a) => a.id === stay.id)?.state).toBe("departed");
      }
      const invalid = structuredClone(reload);
      invalid.admissions.at(-1)!.plannedLegalStatus = "Invented" as never;
      expect(isValidStoredWardFlowState(invalid)).toBe(false);
    },
  );

  it.each([
    { gender: undefined, sex: "Female" },
    { gender: "Non-binary", sex: "Female" },
    { gender: "Female", sex: "Not recorded" },
  ] as const)("requires the R7 review even at an undesignated ward: %j", (patch) => {
    const booked = book(seedWardFlowState(), { unitId: "fre-adult-open", legalStatus: "Voluntary", ...patch });
    expect(booked.rejections).toEqual([]);
    const refused = convert(booked);
    expect(refused.rejections.at(-1)?.reason).toMatch(/coordinator gender placement review/);
    expect(refused.admissions).toBe(booked.admissions);
    expect(refused.units).toBe(booked.units);
    expect(refused.plannedAdmissions).toBe(booked.plannedAdmissions);
  });

  it("refuses a closed ward without consuming the booking or capacity", () => {
    const booked = book(seedWardFlowState());
    booked.units = booked.units.map((u) => (u.id === UNIT ? { ...u, isClosed: true } : u));
    const refused = convert(booked);
    expect(refused.rejections.at(-1)?.reason).toMatch(/closed/);
    expect(refused.admissions).toBe(booked.admissions);
    expect(refused.units).toBe(booked.units);
    expect(refused.plannedAdmissions).toBe(booked.plannedAdmissions);
  });
});

describe("alternate discharge and transfer commands remain consistent", () => {
  it("synchronises stay-level blocker replacement with a live release, then clears both", () => {
    const seed = seedWardFlowState();
    const release = seed.bedReleases.find((r) => r.state !== "discharged" && r.admissionId && r.blocker)!;
    expect(release).toBeDefined();
    const stay = seed.admissions.find((a) => a.id === release.admissionId)!;
    const replacement = BED_RELEASE_BLOCKERS.find((b) => b !== release.blocker)!;
    const blocked = wardFlowReducer(seed, {
      type: "RECORD_STAY_DISCHARGE_BLOCKER",
      role: "ward",
      now: NOW,
      admissionId: stay.id,
      actingUnitId: stay.unitId,
      blocker: replacement,
    });
    expect(blocked.rejections).toEqual([]);
    expect(blocked.admissions.find((a) => a.id === stay.id)?.blockReason).toBe(replacement);
    expect(blocked.bedReleases.find((r) => r.id === release.id)?.blocker).toBe(replacement);
    const cleared = wardFlowReducer(blocked, {
      type: "CLEAR_STAY_DISCHARGE_BLOCKER",
      role: "ward",
      now: NOW + 1,
      admissionId: stay.id,
      actingUnitId: stay.unitId,
    });
    expect(cleared.admissions.find((a) => a.id === stay.id)?.blockReason).toBeNull();
    expect(cleared.bedReleases.find((r) => r.id === release.id)?.blocker).toBeNull();
    expect(cleared.units).toBe(seed.units);
  });

  it("refuses new care-transfer allocation to a closed receiving unit after handover", () => {
    const seed = seedWardFlowState();
    const stay = seed.admissions.find((a) => a.state === "occupied" && a.patientId)!;
    const movement = seed.movements[0];
    movement.admissionId = stay.id;
    movement.patientId = stay.patientId!;
    movement.stage = "arrived";
    movement.acceptedUnitId = stay.unitId;
    stay.movementId = movement.id;
    seed.units = seed.units.map((u) => ({
      ...u,
      allocatable: { ...u.allocatable, confirmedAt: NOW },
      empty: { ...u.empty, confirmedAt: NOW },
    }));
    const target = seed.units.find(
      (u) => u.id !== stay.unitId && eligibility(movement, u, NOW).eligible && u.allocatableLocked > 0,
    )!;
    expect(target).toBeDefined();
    let next = care(seed, stay.id, { kind: "transfer", receivingUnitId: target.id, step: "accepted" });
    next = care(next, stay.id, { kind: "transfer", receivingUnitId: target.id, step: "handover" });
    expect(next.rejections).toEqual([]);
    next = { ...next, units: next.units.map((u) => (u.id === target.id ? { ...u, isClosed: true } : u)) };
    const refused = care(next, stay.id, { kind: "transfer", receivingUnitId: target.id, step: "arrived" });
    expect(refused.admissions).toBe(next.admissions);
    expect(refused.units).toBe(next.units);
    expect(refused.movements).toBe(next.movements);
    expect(refused.rejections.at(-1)?.reason).toMatch(/suitable available bed/);
  });
});
