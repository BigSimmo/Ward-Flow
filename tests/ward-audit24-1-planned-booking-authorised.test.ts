// tests/ward-audit24-1-planned-booking-authorised.test.ts
//
// Audit 24-1 CS2-19 (Josh, 24 Oct 2026): a planned booking for someone whose legal status needs an
// authorised bed, on a ward that is not authorised, was refused unless a reason was recorded.
// D-189 items 8(a) and 9(a) (Josh, 13 Nov 2026): every ward's authorisation is "not stated" until
// Q42 is signed, so the invented flag no longer asks a reason or refuses a booking. A reason saved
// on an older booking still loads, and is dropped at its next edit (no reason is needed).
import { describe, expect, it } from "vitest";

import { plannedAdmissionsStillNeedingABed } from "@/components/ward-management/capacity/planned-admissions-reducer";
import { authorisationReasonNeeded } from "@/components/ward-management/capacity/planned-admissions-draft";
import { OVERRIDE_REASONS, type OverrideReason } from "@/components/ward-management/ward-change-reasons";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
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
  it("D-189 item 9(a): books without a reason while authorisation is not stated, and the forecast counts it", () => {
    const after = book(world());
    expect(after.rejections).toEqual([]);
    const booked = after.plannedAdmissions.at(-1)!;
    expect(booked.authorisationOverride).toBeUndefined();
    expect(counted(after, UNAUTHORISED)).toContain(booked);
    expect(valid(after)).toBe(true);
  });

  it("records no reason sent when none is needed, listed or not", () => {
    for (const overrideReason of [REASON, "Because I said so" as OverrideReason]) {
      const after = book(world(), { overrideReason });
      expect(after.rejections).toEqual([]);
      expect(after.plannedAdmissions.at(-1)!.authorisationOverride).toBeUndefined();
    }
  });

  it("needs no reason on an authorised ward, or for a voluntary booking, and records none sent", () => {
    const authorised = book(world(), { unitId: AUTHORISED, overrideReason: REASON });
    expect(authorised.rejections).toEqual([]);
    expect(authorised.plannedAdmissions.at(-1)!.authorisationOverride).toBeUndefined();

    const voluntary = book(world(), { legalStatus: "Voluntary" });
    expect(voluntary.rejections).toEqual([]);
    expect(voluntary.plannedAdmissions.at(-1)!.authorisationOverride).toBeUndefined();
  });

  it("a change onto the flagged ward, or to a status that needs the bed, needs no reason", () => {
    const booked = book(world(), { unitId: AUTHORISED, legalStatus: "Voluntary" });
    const moved = change(booked, "PA-01", { unitId: UNAUTHORISED });
    expect(moved.rejections).toEqual([]);
    expect(moved.plannedAdmissions.at(-1)).toMatchObject({ unitId: UNAUTHORISED });
    const involuntary = change(moved, "PA-01", { legalStatus: "Involuntary inpatient" });
    expect(involuntary.rejections).toEqual([]);
    expect(involuntary.plannedAdmissions.at(-1)!.authorisationOverride).toBeUndefined();
  });

  it("drops a reason recorded on an older save at its next edit, because no reason is needed", () => {
    const booked = book(world());
    const saved: WardFlowState = {
      ...booked,
      plannedAdmissions: booked.plannedAdmissions.map((planned) =>
        planned.id === "PA-01"
          ? {
              ...planned,
              authorisationOverride: {
                reason: REASON,
                unitId: UNAUTHORISED,
                at: NOW,
                by: WARD_FLOW_ROLE_LABELS.coordinator,
              },
            }
          : planned,
      ),
    };
    expect(valid(saved)).toBe(true);
    const edited = change(saved, "PA-01", { expectedStayDays: 10 });
    expect(edited.rejections).toEqual([]);
    expect(edited.plannedAdmissions.at(-1)!.authorisationOverride).toBeUndefined();
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

  it("the form never asks for a reason while authorisation is not stated, as the reducer never refuses", () => {
    expect(authorisationReasonNeeded("Involuntary inpatient", { authorised: false })).toBe(false);
    expect(authorisationReasonNeeded("Referred for psychiatric examination", { authorised: false })).toBe(false);
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

  it("converts a booking at the flagged ward with no recorded reason", () => {
    const booked = book(world());
    const arrived = convert(booked);
    expect(arrived.rejections).toEqual([]);
    const planned = arrived.plannedAdmissions.find((candidate) => candidate.id === "PA-01")!;
    expect(planned.state).toBe("arrived");
    expect(planned.authorisationOverride).toBeUndefined();
    expect(arrived.admissions.some((admission) => admission.id === planned.admissionId)).toBe(true);
  });

  it("converts a booking saved before the rule, with no reason, at a ward flagged since", () => {
    const legacy = notAuthorised(book(seedWardFlowState()));
    const arrived = convert(legacy);
    expect(arrived.rejections).toEqual([]);
  });

  it("still asks every other gate: a recorded reason does not buy past the cohort gate", () => {
    const booked = book(world(), { overrideReason: REASON, ageBand: "Older adult" });
    const refused = convert(booked);
    expect(refused.rejections.at(-1)?.reason).toMatch(/failed gate cohort/);
    expect(refused.admissions).toBe(booked.admissions);
  });
});
