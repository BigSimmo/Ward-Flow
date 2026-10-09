// tests/ward-planned-admissions.test.ts
//
// Planned admissions calendar (stream D, 9 October 2026): the four reducer actions, the beds
// forecast counting bookings ahead, the overdue row in the action inbox, and the restore fence.
import { describe, expect, it } from "vitest";

import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import { plannedAdmissionAgenda, plannedAdmissionDays } from "@/components/ward-management/capacity/planned-admissions";
import type { PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { buildActionInbox } from "@/components/ward-management/ward-derivations";
import { eventLogEntryFor } from "@/components/ward-management/ward-event-log";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import {
  WARD_FLOW_TEXT_SAFE_EVENT_TYPES,
  WARD_FLOW_TYPED_TEXT_EVENT_TYPES,
} from "@/components/ward-management/ward-flow-persistence-classification";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { EVENT_HISTORY_TABLE } from "@/components/ward-management/ward-history";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { patientDisplayName } from "@/components/ward-management/ward-patients";
import { shiftInstants } from "@/components/ward-management/ward-reanchor";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
const UNIT = "fre-adult-open";
const OTHER_UNIT = "scgh-adult-open";

function apply(state: WardFlowState, event: WardFlowEvent): WardFlowState {
  return wardFlowReducer(state, event);
}

function book(
  state: WardFlowState,
  overrides: Partial<Extract<WardFlowEvent, { type: "BOOK_PLANNED_ADMISSION" }>> = {},
) {
  return apply(state, {
    type: "BOOK_PLANNED_ADMISSION",
    role: "coordinator",
    now: NOW,
    initials: "ab",
    sex: "Female",
    reason: "respite",
    unitId: UNIT,
    expectedArrivalAt: NOW + MINUTES_PER_DAY,
    expectedStayDays: 7,
    legalStatus: "Voluntary",
    ...overrides,
  });
}

function lastRejection(state: WardFlowState): string | undefined {
  return state.rejections.at(-1)?.reason;
}

function newest(state: WardFlowState): PlannedAdmission {
  return state.plannedAdmissions.at(-1)!;
}

describe("seeded planned admissions", () => {
  it("seeds three bookings on the standard night and none on the network scenarios", () => {
    const state = seedWardFlowState();
    expect(state.plannedAdmissions.map((planned) => planned.id)).toEqual(["PA-SEED-01", "PA-SEED-02", "PA-SEED-03"]);
    expect(state.plannedAdmissions.every((planned) => planned.state === "booked")).toBe(true);
    // Exactly one names an existing patient; the others carry initials only.
    expect(state.plannedAdmissions.filter((planned) => planned.patientId !== null)).toHaveLength(1);
    const linked = state.plannedAdmissions.find((planned) => planned.patientId !== null)!;
    expect(state.patients.some((patient) => patient.id === linked.patientId)).toBe(true);
    expect(seedWardFlowState("emhs-demo").plannedAdmissions).toEqual([]);
  });

  it("restores through the storage fence, and the fence refuses a broken booking", () => {
    const state = book(seedWardFlowState());
    const roundTrip = JSON.parse(JSON.stringify(state));
    expect(isValidStoredWardFlowState(roundTrip)).toBe(true);

    const withBoth = JSON.parse(JSON.stringify(state));
    withBoth.plannedAdmissions[0].patientId = "PT-002";
    expect(isValidStoredWardFlowState(withBoth)).toBe(false);

    const longInitials = JSON.parse(JSON.stringify(state));
    longInitials.plannedAdmissions.at(-1).initials = "Alice";
    expect(isValidStoredWardFlowState(longInitials)).toBe(false);

    const staleSequence = JSON.parse(JSON.stringify({ ...state, plannedAdmissionSequence: 0 }));
    expect(isValidStoredWardFlowState(staleSequence)).toBe(false);
  });

  it("moves every booking instant with the demo clock", () => {
    const shifted = shiftInstants(seedWardFlowState(), 100);
    const before = seedWardFlowState().plannedAdmissions[0]!;
    const after = shifted.plannedAdmissions[0]!;
    expect(after.expectedArrivalAt).toBe(before.expectedArrivalAt + 100);
    expect(after.bookedAt).toBe(before.bookedAt + 100);
  });
});

describe("BOOK_PLANNED_ADMISSION", () => {
  it("books initials only, normalised, holding no bed", () => {
    const seed = seedWardFlowState();
    const state = book(seed);
    expect(state.rejections).toEqual([]);
    const booked = newest(state);
    expect(booked).toMatchObject({
      id: "PA-01",
      initials: "AB",
      patientId: null,
      state: "booked",
      unitId: UNIT,
      bookedAt: NOW,
      bookedBy: "Flow coordinator",
    });
    expect(state.plannedAdmissionSequence).toBe(1);
    expect(state.units).toBe(seed.units);
    expect(state.admissions).toBe(seed.admissions);
  });

  it("books an existing synthetic patient", () => {
    const state = book(seedWardFlowState(), { initials: null, patientId: "PT-002", sex: "Male" });
    expect(state.rejections).toEqual([]);
    expect(newest(state)).toMatchObject({ patientId: "PT-002", initials: null });
  });

  it("refuses both, neither, bad initials, an unknown patient and a second booking for one patient", () => {
    expect(lastRejection(book(seedWardFlowState(), { patientId: "PT-002" }))).toMatch(/not both/);
    expect(lastRejection(book(seedWardFlowState(), { initials: null }))).toMatch(/not both/);
    expect(lastRejection(book(seedWardFlowState(), { initials: "Alice" }))).toMatch(/one to three letters/);
    expect(lastRejection(book(seedWardFlowState(), { initials: null, patientId: "PT-NOPE" }))).toMatch(
      /no patient found/,
    );
    const once = book(seedWardFlowState(), { initials: null, patientId: "PT-002" });
    expect(lastRejection(book(once, { initials: null, patientId: "PT-002" }))).toMatch(/already has a planned/);
  });

  it("refuses an unlisted reason, an unknown ward, a past or out-of-window arrival and a bad stay", () => {
    const seed = seedWardFlowState();
    expect(lastRejection(book(seed, { reason: "holiday" as never }))).toMatch(/reason/);
    expect(lastRejection(book(seed, { unitId: "nowhere" }))).toMatch(/no unit found/);
    expect(lastRejection(book(seed, { expectedArrivalAt: NOW - 1 }))).toMatch(/past/);
    expect(lastRejection(book(seed, { expectedArrivalAt: NOW + 15 * MINUTES_PER_DAY }))).toMatch(/next 14 days/);
    expect(lastRejection(book(seed, { expectedStayDays: 0 }))).toMatch(/expectedStayDays/);
    expect(lastRejection(book(seed, { expectedStayDays: 2.5 }))).toMatch(/expectedStayDays/);
    expect(lastRejection(book(seed, { legalStatus: "Detained" as never }))).toMatch(/legalStatus/);
  });

  it("lets a ward book only for itself, and refuses an unpermitted role", () => {
    const seed = seedWardFlowState();
    expect(lastRejection(book(seed, { role: "ward" }))).toMatch(/actingUnitId/);
    expect(lastRejection(book(seed, { role: "ward", actingUnitId: OTHER_UNIT }))).toMatch(/own planned/);
    expect(book(seed, { role: "ward", actingUnitId: UNIT }).rejections).toEqual([]);
    expect(lastRejection(book(seed, { role: "ed" }))).toMatch(/requires role/);
  });
});

describe("CHANGE_PLANNED_ADMISSION and CANCEL_PLANNED_ADMISSION", () => {
  it("changes a booking and counts the change", () => {
    const booked = book(seedWardFlowState());
    const changed = apply(booked, {
      type: "CHANGE_PLANNED_ADMISSION",
      role: "bed_manager",
      now: NOW + 5,
      plannedAdmissionId: "PA-01",
      reason: "planned_transfer",
      unitId: OTHER_UNIT,
      expectedArrivalAt: NOW + 2 * MINUTES_PER_DAY,
      expectedStayDays: 10,
      legalStatus: "Involuntary inpatient",
    });
    expect(changed.rejections).toEqual([]);
    expect(newest(changed)).toMatchObject({
      reason: "planned_transfer",
      unitId: OTHER_UNIT,
      expectedArrivalAt: NOW + 2 * MINUTES_PER_DAY,
      expectedStayDays: 10,
      legalStatus: "Involuntary inpatient",
      changedAt: NOW + 5,
      changeCount: 1,
      initials: "AB",
    });
  });

  it("cancels with a listed reason, and refuses to change or cancel it again", () => {
    const booked = book(seedWardFlowState());
    const cancelled = apply(booked, {
      type: "CANCEL_PLANNED_ADMISSION",
      role: "coordinator",
      now: NOW + 1,
      plannedAdmissionId: "PA-01",
      reason: "no_longer_needed",
    });
    expect(cancelled.rejections).toEqual([]);
    expect(newest(cancelled)).toMatchObject({
      state: "cancelled",
      cancelledAt: NOW + 1,
      cancelReason: "no_longer_needed",
    });
    const again = apply(cancelled, {
      type: "CANCEL_PLANNED_ADMISSION",
      role: "coordinator",
      now: NOW + 2,
      plannedAdmissionId: "PA-01",
      reason: "no_longer_needed",
    });
    expect(lastRejection(again)).toMatch(/already cancelled/);
    expect(
      lastRejection(
        apply(booked, {
          type: "CANCEL_PLANNED_ADMISSION",
          role: "coordinator",
          now: NOW,
          plannedAdmissionId: "PA-01",
          reason: "whatever" as never,
        }),
      ),
    ).toMatch(/listed reasons/);
    expect(
      lastRejection(
        apply(seedWardFlowState(), {
          type: "CANCEL_PLANNED_ADMISSION",
          role: "coordinator",
          now: NOW,
          plannedAdmissionId: "PA-99",
          reason: "no_longer_needed",
        }),
      ),
    ).toMatch(/planned admission was not found/);
  });
});

describe("CONVERT_PLANNED_ADMISSION", () => {
  it("turns the booking into an occupied admission taking one empty, allocatable bed", () => {
    const booked = book(seedWardFlowState(), { initials: null, patientId: "PT-002", sex: "Male" });
    const unitBefore = booked.units.find((unit) => unit.id === UNIT)!;
    const arrived = apply(booked, {
      type: "CONVERT_PLANNED_ADMISSION",
      role: "ward",
      actingUnitId: UNIT,
      now: NOW + 30,
      plannedAdmissionId: "PA-01",
    });
    expect(arrived.rejections).toEqual([]);
    const planned = newest(arrived);
    expect(planned.state).toBe("arrived");
    expect(planned.convertedAt).toBe(NOW + 30);
    const admission = arrived.admissions.find((entry) => entry.id === planned.admissionId)!;
    expect(admission).toMatchObject({
      unitId: UNIT,
      patientId: "PT-002",
      sex: "Male",
      state: "occupied",
      arrivedAt: NOW + 30,
      movementId: null,
    });
    expect(admission.id).toMatch(/^AD-ARR-/);
    const unitAfter = arrived.units.find((unit) => unit.id === UNIT)!;
    expect(unitAfter.empty.value).toBe(unitBefore.empty.value - 1);
    expect(unitAfter.allocatable.value).toBe(unitBefore.allocatable.value - 1);
    expect(unitAfter.sexMix.Male).toBe(unitBefore.sexMix.Male + 1);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(arrived)))).toBe(true);

    const twice = apply(arrived, {
      type: "CONVERT_PLANNED_ADMISSION",
      role: "coordinator",
      now: NOW + 31,
      plannedAdmissionId: "PA-01",
    });
    expect(lastRejection(twice)).toMatch(/already arrived/);
  });

  it("refuses when the ward has no bed to give: a booking creates no bed", () => {
    const booked = book(seedWardFlowState());
    const full: WardFlowState = {
      ...booked,
      units: booked.units.map((unit) =>
        unit.id === UNIT ? { ...unit, allocatable: { ...unit.allocatable, value: 0 }, allocatableLocked: 0 } : unit,
      ),
    };
    const refused = apply(full, {
      type: "CONVERT_PLANNED_ADMISSION",
      role: "coordinator",
      now: NOW,
      plannedAdmissionId: "PA-01",
    });
    expect(lastRejection(refused)).toMatch(/no empty bed/);
    expect(refused.admissions).toBe(full.admissions);
  });

  it("applies the placement eligibility gates: a single-sex ward refuses, with no override path", () => {
    // fsh-adult-secure is Male only. A booking records sex, never gender, so the gender_designation
    // gate cannot pass there, exactly as it refuses a movement with no gender recorded.
    const booked = book(seedWardFlowState(), { unitId: "fsh-adult-secure", sex: "Male", initials: "cd" });
    const refused = apply(booked, {
      type: "CONVERT_PLANNED_ADMISSION",
      role: "coordinator",
      now: NOW,
      plannedAdmissionId: "PA-01",
    });
    const reason = lastRejection(refused)!;
    expect(reason).toMatch(/failed gate gender_designation/);
    expect(reason).toMatch(/not something a recorded reason can override/);
    expect(reason).toMatch(/for this planned admission/);
    expect(reason).not.toMatch(/PA-01|WF-/);
    expect(refused.admissions).toBe(booked.admissions);
    expect(newest(refused).state).toBe("booked");
  });

  it("applies the suitability gates: an involuntary arrival needs an authorised ward", () => {
    const booked = book(seedWardFlowState(), { legalStatus: "Involuntary inpatient" });
    const unauthorised: WardFlowState = {
      ...booked,
      units: booked.units.map((unit) =>
        unit.id === UNIT
          ? { ...unit, authorised: false, allocatableLocked: 1, lockedBeds: Math.max(1, unit.lockedBeds) }
          : unit,
      ),
    };
    const refused = apply(unauthorised, {
      type: "CONVERT_PLANNED_ADMISSION",
      role: "coordinator",
      now: NOW,
      plannedAdmissionId: "PA-01",
    });
    expect(lastRejection(refused)).toMatch(/failed gate authorisation/);
    expect(refused.admissions).toBe(unauthorised.admissions);
  });

  it("refuses a ward recording another ward's arrival", () => {
    const booked = book(seedWardFlowState());
    const refused = apply(booked, {
      type: "CONVERT_PLANNED_ADMISSION",
      role: "ward",
      actingUnitId: OTHER_UNIT,
      now: NOW,
      plannedAdmissionId: "PA-01",
    });
    expect(lastRejection(refused)).toMatch(/own planned/);
  });
});

describe("the event log and persistence classification", () => {
  it("logs each action with its booking id and plain wording, never the initials", () => {
    const event: WardFlowEvent = {
      type: "BOOK_PLANNED_ADMISSION",
      role: "coordinator",
      now: NOW,
      initials: "AB",
      sex: "Female",
      reason: "respite",
      unitId: UNIT,
      expectedArrivalAt: NOW + 60,
      expectedStayDays: 3,
      legalStatus: "Voluntary",
    };
    const entry = eventLogEntryFor(event, true);
    expect(entry).toMatchObject({ type: "BOOK_PLANNED_ADMISSION", unitId: UNIT, accepted: true });
    expect(JSON.stringify(entry)).not.toContain("AB");
    expect(
      eventLogEntryFor(
        { type: "CONVERT_PLANNED_ADMISSION", role: "coordinator", now: NOW, plannedAdmissionId: "PA-01" },
        true,
      ).plannedAdmissionId,
    ).toBe("PA-01");
    for (const type of [
      "BOOK_PLANNED_ADMISSION",
      "CHANGE_PLANNED_ADMISSION",
      "CANCEL_PLANNED_ADMISSION",
      "CONVERT_PLANNED_ADMISSION",
    ] as const) {
      expect(EVENT_HISTORY_TABLE[type].plainWording).toMatch(/Planned admission/);
    }
    expect(WARD_FLOW_TYPED_TEXT_EVENT_TYPES.has("BOOK_PLANNED_ADMISSION")).toBe(true);
    expect(WARD_FLOW_TEXT_SAFE_EVENT_TYPES.has("CONVERT_PLANNED_ADMISSION")).toBe(true);
  });
});

describe("beds forecast counts planned admissions ahead", () => {
  it("subtracts bookings due in each window from every figure and reports them", () => {
    const state = seedWardFlowState();
    const without = bedsForecast(state.units, state.bedReleases, state.admissions, state.movements, NOW);
    const withPlanned = bedsForecast(
      state.units,
      state.bedReleases,
      state.admissions,
      state.movements,
      NOW,
      state.plannedAdmissions,
    );
    // Seed: one overdue today (counts in both windows), one tomorrow (both), one in three days (neither).
    const [day1, day2] = withPlanned.horizons;
    expect(day1!.plannedAdmissions).toBe(2);
    expect(day2!.plannedAdmissions).toBe(2);
    expect(day1!.bedsNeeded).toBe(day1!.waitingForBed + 2);
    expect(day1!.likely).toBe(without.horizons[0]!.likely - 2);
    expect(day1!.low).toBe(without.horizons[0]!.low - 2);
    expect(day1!.high).toBe(without.horizons[0]!.high - 2);
    expect(without.horizons[0]!.plannedAdmissions).toBe(0);
  });

  it("ignores cancelled and arrived bookings and bookings outside the window", () => {
    const booked = book(seedWardFlowState(), { expectedArrivalAt: NOW + 3 * MINUTES_PER_DAY });
    const cancelled = apply(booked, {
      type: "CANCEL_PLANNED_ADMISSION",
      role: "coordinator",
      now: NOW,
      plannedAdmissionId: "PA-SEED-01",
      reason: "rebooked",
    });
    const forecast = bedsForecast(
      cancelled.units,
      cancelled.bedReleases,
      cancelled.admissions,
      cancelled.movements,
      NOW,
      cancelled.plannedAdmissions,
    );
    expect(forecast.horizons[0]!.plannedAdmissions).toBe(1);
    expect(forecast.horizons[1]!.plannedAdmissions).toBe(1);
  });
});

describe("overdue planned arrivals surface in the action inbox", () => {
  it("raises one fact row per booking past its expected arrival, and clears it on arrival", () => {
    const state = seedWardFlowState();
    const rows = buildActionInbox([], NOW, state.units, state.plannedAdmissions);
    expect(rows.map((row) => row.id)).toEqual(["planned-arrival-PA-SEED-03"]);
    expect(rows[0]).toMatchObject({ kind: "fact", tone: "warning", movementId: "", personLabel: "Initials RK" });
    expect(rows[0]!.title).toBe("Planned arrival not recorded");
    // The person is named; the booking id is never shown.
    expect(`${rows[0]!.title} ${rows[0]!.detail} ${rows[0]!.owner}`).not.toMatch(/PA-/);

    const acknowledged = apply(state, {
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "coordinator",
      now: NOW,
      inboxItemId: "planned-arrival-PA-SEED-03",
    });
    expect(acknowledged.rejections).toEqual([]);

    const arrived = apply(state, {
      type: "CONVERT_PLANNED_ADMISSION",
      role: "coordinator",
      now: NOW,
      plannedAdmissionId: "PA-SEED-03",
    });
    expect(arrived.rejections).toEqual([]);
    expect(buildActionInbox([], NOW, arrived.units, arrived.plannedAdmissions)).toEqual([]);
  });
});

describe("an overdue linked booking", () => {
  it("names the linked person through the patient resolver, never the booking id", () => {
    const booked = book(seedWardFlowState(), { initials: null, patientId: "PT-002", expectedArrivalAt: NOW + 5 });
    const rows = buildActionInbox([], NOW + 60, booked.units, booked.plannedAdmissions);
    const row = rows.find((candidate) => candidate.id === "planned-arrival-PA-01")!;
    expect(row.personLabel).toBeUndefined();
    expect(row.detail).not.toMatch(/PA-|PT-/);
    const person = booked.patients.find((patient) => patient.id === "PT-002")!;
    expect(resolveSubjectPatient(row.plannedAdmission, booked).displayName).toBe(patientDisplayName(person));
  });
});

describe("calendar derivation", () => {
  it("lays out fourteen days with counts per day per service", () => {
    const state = seedWardFlowState();
    const days = plannedAdmissionDays(state.plannedAdmissions, state.units, NOW);
    expect(days).toHaveLength(14);
    expect(days[0]!.dayOffset).toBe(0);
    expect(days.reduce((sum, day) => sum + day.total, 0)).toBe(3);
    expect(days[1]!.total).toBe(1);
    expect(days[3]!.byService).toEqual([{ service: "North Metro", count: 1 }]);
    const agenda = plannedAdmissionAgenda(state.plannedAdmissions);
    expect(agenda.map((planned) => planned.id)).toEqual(["PA-SEED-03", "PA-SEED-01", "PA-SEED-02"]);
  });
});
