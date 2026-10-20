import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR as NOW } from "@/components/ward-management/ward-sites";

const UNIT = "fsh-adult-secure";

// The field allowlists in ward-access-scope already drop the status for executive and dates-only
// views. This switch hands closeReferences a restricted admission that still carries it, so the
// final projection is proven to strip it on its own rather than relying on that upstream step.
const upstream = vi.hoisted(() => ({ keepPlannedLegalStatus: false }));
vi.mock("@/components/ward-management/ward-access-scope", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-access-scope")>();
  return {
    ...actual,
    scopeWorkspace: ((...args: Parameters<typeof actual.scopeWorkspace>) => {
      const scoped = actual.scopeWorkspace(...args);
      if (!upstream.keepPlannedLegalStatus) return scoped;
      const whole = new Map((args[0].admissions as Admission[]).map((a) => [a.id, a]));
      return {
        ...scoped,
        admissions: scoped.admissions.map((a: Admission) =>
          whole.get(a.id)?.plannedLegalStatus ? { ...a, plannedLegalStatus: whole.get(a.id)!.plannedLegalStatus } : a,
        ),
      };
    }) as typeof actual.scopeWorkspace,
  };
});

/** A converted stay that already carries the booking's retained legal status on the admission. */
function convertedStay(): { state: WardFlowState; stayId: string; team: string } {
  const seed = seedWardFlowState();
  seed.movements = seed.movements.filter((m) => m.patientId !== "PT-002");
  seed.admissions = seed.admissions.filter((a) => a.patientId !== "PT-002");
  const team = seed.patients.find((p) => p.catchmentCommunityTeam)!.catchmentCommunityTeam!;
  seed.patients = seed.patients.map((p) =>
    p.id === "PT-002" ? { ...p, gender: "Male", catchmentCommunityTeam: team } : p,
  );
  const booked = wardFlowReducer(seed, {
    type: "BOOK_PLANNED_ADMISSION",
    role: "coordinator",
    now: NOW,
    initials: null,
    patientId: "PT-002",
    sex: "Male",
    gender: "Male",
    reason: "respite",
    unitId: UNIT,
    expectedArrivalAt: NOW + 30,
    expectedStayDays: 7,
    legalStatus: "Involuntary inpatient",
    ageBand: "Adult",
    calendarDate: "2026-10-09",
  });
  expect(booked.rejections).toEqual([]);
  const booking = booked.plannedAdmissions.at(-1)!;
  const arrived = wardFlowReducer(booked, {
    type: "CONVERT_PLANNED_ADMISSION",
    role: "coordinator",
    now: NOW + 30,
    plannedAdmissionId: booking.id,
    unitId: booking.unitId,
  });
  expect(arrived.rejections).toEqual([]);
  const stay = arrived.admissions.at(-1)!;
  expect(stay.plannedLegalStatus).toBe("Involuntary inpatient");
  return { state: arrived, stayId: stay.id, team };
}

describe.each([false, true])(
  "restricted admission views never keep a retained planned legal status (upstream keeps it=%s)",
  (keep) => {
    const { state, stayId, team } = convertedStay();
    const options = { now: NOW + 31, places: wardPlaceLookup(state.units) };
    beforeEach(() => {
      upstream.keepPlannedLegalStatus = keep;
    });
    afterEach(() => {
      upstream.keepPlannedLegalStatus = false;
    });

    it.each([
      ["executive (statewide)", { role: "executive", scope: { kind: "statewide" } }],
      ["executive (ward)", { role: "executive", scope: { kind: "ward", unitIds: [UNIT] } }],
    ] as const)("strips it for %s", (_label, access) => {
      const scoped = scopeWardFlowState(state, access, options).state;
      const stay = scoped.admissions.find((a) => a.id === stayId);
      expect(stay).toBeDefined();
      expect(stay).not.toHaveProperty("plannedLegalStatus");
    });

    it("strips it for the dates-only community view", () => {
      const community = scopeWardFlowState(
        state,
        { role: "community", scope: { kind: "team", teamName: team } },
        options,
      );
      expect(community.scoped.datesOnlyAdmissionIds.has(stayId)).toBe(true);
      const stay = community.state.admissions.find((a) => a.id === stayId);
      expect(stay).toBeDefined();
      expect(stay).not.toHaveProperty("plannedLegalStatus");
    });

    it("keeps it for an allowed ward view", () => {
      const ward = scopeWardFlowState(state, { role: "ward", scope: { kind: "ward", unitIds: [UNIT] } }, options).state;
      expect(ward.admissions.find((a) => a.id === stayId)?.plannedLegalStatus).toBe("Involuntary inpatient");
    });
  },
);
