// tests/ward-audit24-1-planned-booking-authorised.test.ts
//
// Audit 24-1 CS2-19 (Josh, 24 Oct 2026): a planned booking for someone whose legal status needs an
// authorised bed, on a ward that is not authorised, is refused unless a reason is recorded, as a
// pull past the same authorisation gate is. The reason comes from `OVERRIDE_REASONS`, never typed.
// A refused booking is not kept, so the beds forecast never counts it.
import { describe, expect, it } from "vitest";

import { plannedAdmissionsStillNeedingABed } from "@/components/ward-management/capacity/planned-admissions-reducer";
import { authorisationReasonNeeded } from "@/components/ward-management/capacity/planned-admissions-draft";
import { OVERRIDE_REASONS, type OverrideReason } from "@/components/ward-management/ward-change-reasons";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import {
  OVERRIDE_REASON_REQUIRED,
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
const UNAUTHORISED = "fre-adult-open";
const AUTHORISED = "scgh-adult-open";
const REASON: OverrideReason = OVERRIDE_REASONS[1];

/**
 * The seed with one ward marked not authorised for involuntary admissions, and given one free
 * locked bed so an involuntary arrival reaches the eligibility gates (as the existing conversion
 * test in `ward-planned-admissions.test.ts` does).
 */
function notAuthorised(state: WardFlowState): WardFlowState {
  return {
    ...state,
    units: state.units.map((unit) =>
      unit.id === UNAUTHORISED
        ? { ...unit, authorised: false, allocatableLocked: 1, lockedBeds: Math.max(1, unit.lockedBeds) }
        : unit,
    ),
  };
}

function world(): WardFlowState {
  return notAuthorised(seedWardFlowState());
}

type Book = Extract<WardFlowEvent, { type: "BOOK_PLANNED_ADMISSION" }>;
type Change = Extract<WardFlowEvent, { type: "CHANGE_PLANNED_ADMISSION" }>;

function book(state: WardFlowState, overrides: Partial<Book> = {}): WardFlowState {
  return wardFlowReducer(state, {
    type: "BOOK_PLANNED_ADMISSION",
    role: "coordinator",
    now: NOW,
    initials: "ab",
    sex: "Female",
    gender: "Female",
    reason: "respite",
    unitId: UNAUTHORISED,
    expectedArrivalAt: NOW + MINUTES_PER_DAY,
    expectedStayDays: 7,
    legalStatus: "Involuntary inpatient",
    ageBand: "Adult",
    ...overrides,
  });
}

function change(state: WardFlowState, plannedAdmissionId: string, overrides: Partial<Change> = {}): WardFlowState {
  const planned = state.plannedAdmissions.find((candidate) => candidate.id === plannedAdmissionId)!;
  return wardFlowReducer(state, {
    type: "CHANGE_PLANNED_ADMISSION",
    role: "coordinator",
    now: NOW + 5,
    plannedAdmissionId,
    reason: planned.reason,
    unitId: planned.unitId,
    expectedArrivalAt: planned.expectedArrivalAt,
    expectedStayDays: planned.expectedStayDays,
    legalStatus: planned.legalStatus,
    ...overrides,
  });
}

function counted(state: WardFlowState, unitId: string) {
  return plannedAdmissionsStillNeedingABed(state.plannedAdmissions, new Set([unitId]), NOW + 14 * MINUTES_PER_DAY, []);
}

const valid = (state: WardFlowState) =>
  isValidStoredWardFlowState(JSON.parse(JSON.stringify({ ...state, rejections: [] })));

describe("Audit 24-1 CS2-19: booking onto a ward not authorised for the legal status", () => {
  it("refuses the booking without a reason, in the words a pull uses, and the forecast does not count it", () => {
    const before = world();
    const after = book(before);
    const refusal = after.rejections.at(-1)?.reason ?? "";
    expect(refusal).toMatch(/failed gate authorisation/);
    expect(refusal).toContain(OVERRIDE_REASON_REQUIRED);
    expect(refusal).toMatch(/for this planned admission/);
    expect(after.plannedAdmissions).toBe(before.plannedAdmissions);
    expect(after.plannedAdmissionSequence).toBe(before.plannedAdmissionSequence);
    expect(counted(after, UNAUTHORISED)).toEqual(counted(before, UNAUTHORISED));
  });

  it("refuses a reason that is not on the fixed list", () => {
    const after = book(world(), { overrideReason: "Because I said so" as OverrideReason });
    expect(after.rejections.at(-1)?.reason).toMatch(/overrideReason must be chosen from OVERRIDE_REASONS/);
    expect(after.plannedAdmissions.some((planned) => planned.id === "PA-01")).toBe(false);
  });

  it("accepts the booking with a listed reason and records it, and the forecast counts it", () => {
    const before = world();
    const after = book(before, { overrideReason: REASON });
    expect(after.rejections).toEqual([]);
    const booked = after.plannedAdmissions.at(-1)!;
    expect(booked.authorisationOverride).toEqual({
      reason: REASON,
      unitId: UNAUTHORISED,
      at: NOW,
      by: WARD_FLOW_ROLE_LABELS.coordinator,
    });
    expect(counted(after, UNAUTHORISED)).toContain(booked);
    expect(valid(after)).toBe(true);
  });

  it("needs no reason on an authorised ward, or for a voluntary booking, and records none sent", () => {
    const authorised = book(world(), { unitId: AUTHORISED, overrideReason: REASON });
    expect(authorised.rejections).toEqual([]);
    expect(authorised.plannedAdmissions.at(-1)!.authorisationOverride).toBeUndefined();

    const voluntary = book(world(), { legalStatus: "Voluntary" });
    expect(voluntary.rejections).toEqual([]);
    expect(voluntary.plannedAdmissions.at(-1)!.authorisationOverride).toBeUndefined();
  });

  it("refuses a change that moves a booking to the unauthorised ward without a reason", () => {
    const booked = book(world(), { unitId: AUTHORISED });
    const refused = change(booked, "PA-01", { unitId: UNAUTHORISED });
    expect(refused.rejections.at(-1)?.reason).toContain(OVERRIDE_REASON_REQUIRED);
    expect(refused.plannedAdmissions).toBe(booked.plannedAdmissions);

    const moved = change(booked, "PA-01", { unitId: UNAUTHORISED, overrideReason: REASON });
    expect(moved.rejections).toEqual([]);
    expect(moved.plannedAdmissions.at(-1)).toMatchObject({
      unitId: UNAUTHORISED,
      authorisationOverride: { reason: REASON, unitId: UNAUTHORISED },
    });
  });

  it("refuses a change of legal status that now needs an authorised bed without a reason", () => {
    const booked = book(world(), { legalStatus: "Voluntary" });
    const refused = change(booked, "PA-01", { legalStatus: "Involuntary inpatient" });
    expect(refused.rejections.at(-1)?.reason).toContain(OVERRIDE_REASON_REQUIRED);
  });

  it("keeps a recorded reason through an unrelated edit, and drops it once the booking moves away", () => {
    const booked = book(world(), { overrideReason: REASON });
    const edited = change(booked, "PA-01", { expectedStayDays: 10 });
    expect(edited.rejections).toEqual([]);
    expect(edited.plannedAdmissions.at(-1)!.authorisationOverride?.reason).toBe(REASON);

    const away = change(edited, "PA-01", { unitId: AUTHORISED });
    expect(away.rejections).toEqual([]);
    expect(away.plannedAdmissions.at(-1)!.authorisationOverride).toBeUndefined();
  });

  it("still loads, and still edits, a booking saved before the rule without a reason", () => {
    const legacyWorld = book(seedWardFlowState());
    // Saved while the ward was authorised; the ward has since lost authorisation, as an older save
    // made before this rule would read.
    const legacy: WardFlowState = {
      ...legacyWorld,
      units: legacyWorld.units.map((unit) => (unit.id === UNAUTHORISED ? { ...unit, authorised: false } : unit)),
    };
    expect(legacy.plannedAdmissions.at(-1)!.authorisationOverride).toBeUndefined();
    expect(valid(legacy)).toBe(true);
    const edited = change(legacy, "PA-01", { expectedStayDays: 9 });
    expect(edited.rejections).toEqual([]);
    expect(edited.plannedAdmissions.at(-1)!.expectedStayDays).toBe(9);
  });

  it("the form asks for a reason exactly when the reducer would refuse", () => {
    expect(authorisationReasonNeeded("Involuntary inpatient", { authorised: false })).toBe(true);
    expect(authorisationReasonNeeded("Referred for psychiatric examination", { authorised: false })).toBe(true);
    expect(authorisationReasonNeeded("Voluntary", { authorised: false })).toBe(false);
    expect(authorisationReasonNeeded("Involuntary inpatient", { authorised: true })).toBe(false);
    expect(authorisationReasonNeeded("Involuntary inpatient", undefined)).toBe(false);
  });
});

describe("Audit 24-1 CS2-19: arrival honours the reason recorded on the booking", () => {
  function convert(state: WardFlowState, plannedAdmissionId = "PA-01", unitId = UNAUTHORISED): WardFlowState {
    return wardFlowReducer(state, {
      type: "CONVERT_PLANNED_ADMISSION",
      role: "coordinator",
      now: NOW + 10,
      plannedAdmissionId,
      unitId,
    });
  }

  it("converts a booking whose reason was recorded for this same ward", () => {
    const booked = book(world(), { overrideReason: REASON });
    const arrived = convert(booked);
    expect(arrived.rejections).toEqual([]);
    const planned = arrived.plannedAdmissions.find((candidate) => candidate.id === "PA-01")!;
    expect(planned.state).toBe("arrived");
    // The reason stays on the arrived booking, which names the admission it became.
    expect(planned.authorisationOverride).toMatchObject({ reason: REASON, unitId: UNAUTHORISED });
    expect(arrived.admissions.some((admission) => admission.id === planned.admissionId)).toBe(true);
  });

  it("does not let a reason recorded for a different ward buy past the gate", () => {
    const booked = book(world(), { overrideReason: REASON });
    const elsewhere: WardFlowState = {
      ...booked,
      plannedAdmissions: booked.plannedAdmissions.map((planned) =>
        planned.id === "PA-01"
          ? { ...planned, authorisationOverride: { ...planned.authorisationOverride!, unitId: AUTHORISED } }
          : planned,
      ),
    };
    const refused = convert(elsewhere);
    expect(refused.rejections.at(-1)?.reason).toMatch(/failed gate authorisation/);
    expect(refused.admissions).toBe(elsewhere.admissions);
  });

  it("still refuses arrival for a booking with no recorded reason", () => {
    const legacy = notAuthorised(book(seedWardFlowState()));
    const refused = convert(legacy);
    expect(refused.rejections.at(-1)?.reason).toMatch(/failed gate authorisation/);
    expect(refused.admissions).toBe(legacy.admissions);
  });

  it("still asks every other gate: a recorded reason does not buy past the cohort gate", () => {
    const booked = book(world(), { overrideReason: REASON, ageBand: "Older adult" });
    const refused = convert(booked);
    expect(refused.rejections.at(-1)?.reason).toMatch(/failed gate cohort/);
    expect(refused.admissions).toBe(booked.admissions);
  });
});
