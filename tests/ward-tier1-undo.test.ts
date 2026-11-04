// Tier 1 item 6 (Josh, 4 Nov 2026: "Go ahead with all recommendations"): Undo by default for five
// minutes wherever the engine can restore exactly. Closing or reopening a bed, a return from leave,
// a community treatment order recorded or ended, a released bed, a cancelled transport or planned
// admission and a record archived in error each come back from their toast's Undo, exactly, under
// the same rules as every step undo. Synthetic seed data only.
import { describe, expect, it } from "vitest";

import { WARD_CLOSURE_REASONS } from "@/components/ward-management/capacity/ward-closure";
import { bedIsOccupied } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { CANCEL_TRANSPORT_REASONS, RELEASE_PULL_REASONS } from "@/components/ward-management/ward-change-reasons";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardStaySeats } from "@/components/ward-management/ward/ward-bed-layout";
import { UNDO_WINDOW_MINUTES, undoRecordSeqFor, undoStepSubjectId } from "@/components/ward-management/ward-undo";

const NOW = NOW_ANCHOR;

/** The records an Undo must put back exactly. */
const SLICES = [
  "units",
  "admissions",
  "movements",
  "leaveBeds",
  "patients",
  "plannedAdmissions",
  "referrals",
  "notices",
] as const;
/** Resource revisions only ever move forward (shared saves compare them), so they are left out. */
const withoutRevisions = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value ?? null, (key, item: unknown) => (key === "revision" ? undefined : item)));
const world = (state: WardFlowState) =>
  Object.fromEntries(SLICES.map((slice) => [slice, withoutRevisions((state as Record<string, unknown>)[slice])]));

/** Takes the step, then its Undo: the world is back as it was, and a second Undo is refused. */
function expectExactUndo(state: WardFlowState, step: WardFlowEvent, undo: WardFlowEvent) {
  const done = wardFlowReducer(state, step);
  expect(done.rejections, `${step.type} is accepted`).toEqual(state.rejections);
  expect(world(done)).not.toEqual(world(state));
  const undone = wardFlowReducer(done, undo);
  expect(undone.rejections, `${undo.type} is accepted`).toEqual(state.rejections);
  for (const slice of SLICES)
    expect(world(undone)[slice], `${undo.type} restores ${slice}`).toEqual(world(state)[slice]);
  expect(undone.auditEvents.at(-1)).toMatchObject({ action: undo.type, outcome: "accepted" });
  expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify({ ...undone, rejections: [] })))).toBe(true);
  expect(wardFlowReducer(undone, { ...undo, now: undo.now + 1 }).rejections.length).toBe(state.rejections.length + 1);
  return done;
}

/** An empty bed on a ward with room, seated as the reducer and the Bed board seat stays. */
function emptyBed(state: WardFlowState) {
  for (const unit of state.units) {
    const stays = state.admissions.filter((stay) => stay.unitId === unit.id);
    const seats = wardStaySeats(unit, stays);
    const taken = new Set(
      stays.flatMap((stay) => {
        const bed = bedIsOccupied(stay) ? (stay.bedNumber ?? seats.get(stay.id)) : undefined;
        return bed === undefined ? [] : [bed];
      }),
    );
    if (boundedBedAvailability(unit).available < 2 || taken.size === 0 || taken.size >= unit.beds) continue;
    const bed = [...Array(unit.beds).keys()].map((i) => unit.beds - i).find((n) => !taken.has(n));
    if (bed !== undefined) return { unit, bed };
  }
  throw new Error("the seed has an empty bed");
}

describe("Tier 1 Undo: bed steps", () => {
  it("takes back a bed closed by mistake, and its reopening", () => {
    const state = seedWardFlowState();
    const { unit, bed } = emptyBed(state);
    const close: WardFlowEvent = {
      type: "SET_BED_CLOSED",
      role: "ward",
      now: NOW,
      unitId: unit.id,
      actingUnitId: unit.id,
      bedNumber: bed,
      closed: true,
      reason: WARD_CLOSURE_REASONS[0].id,
    };
    const undo: WardFlowEvent = {
      type: "UNDO_BED_STEP",
      role: "ward",
      now: NOW + 1,
      actingUnitId: unit.id,
      unitId: unit.id,
      bedNumber: bed,
    };
    const closed = expectExactUndo(state, close, undo);
    expect(undoStepSubjectId(close)).toBe(`bed:${unit.id}:${bed}`);
    // Reopening is the same step the other way, and undoes the same way.
    const reopen: WardFlowEvent = {
      type: "SET_BED_CLOSED",
      role: "ward",
      now: NOW + 2,
      unitId: unit.id,
      actingUnitId: unit.id,
      bedNumber: bed,
      closed: false,
    };
    expectExactUndo(closed, reopen, { ...undo, now: NOW + 3 });
  });

  it("refuses another ward's Undo and an Undo after the window", () => {
    const state = seedWardFlowState();
    const { unit, bed } = emptyBed(state);
    const other = state.units.find((candidate) => candidate.id !== unit.id)!;
    const closed = wardFlowReducer(state, {
      type: "SET_BED_CLOSED",
      role: "ward",
      now: NOW,
      unitId: unit.id,
      actingUnitId: unit.id,
      bedNumber: bed,
      closed: true,
      reason: WARD_CLOSURE_REASONS[0].id,
    });
    const undo = { type: "UNDO_BED_STEP", role: "ward", unitId: unit.id, bedNumber: bed } as const;
    expect(
      wardFlowReducer(closed, { ...undo, now: NOW + 1, actingUnitId: other.id }).rejections.length,
    ).toBeGreaterThan(state.rejections.length);
    expect(
      wardFlowReducer(closed, { ...undo, now: NOW + UNDO_WINDOW_MINUTES + 1, actingUnitId: unit.id }).rejections.length,
    ).toBeGreaterThan(state.rejections.length);
  });

  it("takes back a return from leave, so the bed is held again", () => {
    const state = seedWardFlowState();
    const leave = state.leaveBeds[0];
    expect(leave, "the seed has a leave bed").toBeDefined();
    expectExactUndo(
      state,
      { type: "END_LEAVE_BED", role: "ward", now: NOW, leaveBedId: leave!.id, actingUnitId: leave!.unitId },
      { type: "UNDO_BED_STEP", role: "ward", now: NOW + 1, leaveBedId: leave!.id, actingUnitId: leave!.unitId },
    );
  });
});

describe("Tier 1 Undo: releases and cancellations", () => {
  it("takes back a pulled bed released, including its notices", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((candidate) => !candidate.closure && candidate.stage === "pulled");
    expect(movement, "the seed has a pulled bed").toBeDefined();
    const done = expectExactUndo(
      state,
      {
        type: "RELEASE_PULL",
        role: "coordinator",
        now: NOW,
        movementId: movement!.id,
        reason: RELEASE_PULL_REASONS[0],
      },
      { type: "UNDO_RELEASE_STEP", role: "coordinator", now: NOW + 1, movementId: movement!.id },
    );
    expect(undoRecordSeqFor(done.undoRecords, "UNDO_RELEASE_STEP", movement!.id)).toBeDefined();
  });

  it("takes back a cancelled transport", () => {
    const state = seedWardFlowState();
    const results = state.movements
      .filter((candidate) => !candidate.closure)
      .map((movement) => ({
        movement,
        next: wardFlowReducer(state, {
          type: "CANCEL_TRANSPORT",
          role: "coordinator",
          now: NOW,
          movementId: movement.id,
          reason: CANCEL_TRANSPORT_REASONS[0],
        }),
      }));
    const found = results.find(({ next }) => next.rejections.length === state.rejections.length);
    expect(found, "the seed has a transport the coordinator can cancel").toBeDefined();
    expectExactUndo(
      state,
      {
        type: "CANCEL_TRANSPORT",
        role: "coordinator",
        now: NOW,
        movementId: found!.movement.id,
        reason: CANCEL_TRANSPORT_REASONS[0],
      },
      { type: "UNDO_RELEASE_STEP", role: "coordinator", now: NOW + 1, movementId: found!.movement.id },
    );
  });

  it("takes back a cancelled planned admission", () => {
    const seed = seedWardFlowState();
    const unitId = "fre-adult-open";
    const booked = wardFlowReducer(seed, {
      type: "BOOK_PLANNED_ADMISSION",
      role: "coordinator",
      now: NOW,
      initials: "ab",
      sex: "Female",
      gender: "Female",
      reason: "respite",
      unitId,
      expectedArrivalAt: NOW + MINUTES_PER_DAY,
      expectedStayDays: 7,
      legalStatus: "Voluntary",
      ageBand: "Adult",
      calendarDate: "2026-10-09",
    });
    expect(booked.rejections).toEqual(seed.rejections);
    const booking = booked.plannedAdmissions.at(-1)!;
    expectExactUndo(
      booked,
      {
        type: "CANCEL_PLANNED_ADMISSION",
        role: "coordinator",
        now: NOW + 1,
        plannedAdmissionId: booking.id,
        unitId,
        reason: "no_longer_needed",
      },
      { type: "UNDO_RELEASE_STEP", role: "coordinator", now: NOW + 2, plannedAdmissionId: booking.id },
    );
  });
});

describe("Tier 1 Undo: patient record steps", () => {
  const quietPatient = (state: WardFlowState) =>
    state.patients.find(
      (patient) =>
        !patient.communityTreatmentOrder &&
        !state.admissions.some((stay) => stay.patientId === patient.id && stay.state !== "departed") &&
        !state.movements.some((m) => m.patientId === patient.id && !m.closure && m.stage !== "arrived"),
    )!;

  it("takes back a community treatment order recorded, and one ended", () => {
    const state = seedWardFlowState();
    const patient = quietPatient(state);
    const record: WardFlowEvent = {
      type: "RECORD_COMMUNITY_TREATMENT_ORDER",
      role: "community",
      now: NOW,
      patientId: patient.id,
    };
    const undo: WardFlowEvent = { type: "UNDO_PATIENT_RECORD", role: "community", now: NOW + 1, patientId: patient.id };
    const recorded = expectExactUndo(state, record, undo);
    expectExactUndo(
      recorded,
      { type: "END_COMMUNITY_TREATMENT_ORDER", role: "community", now: NOW + 2, patientId: patient.id },
      { ...undo, now: NOW + 3 },
    );
  });

  it("brings back a record archived in error", () => {
    const seed = seedWardFlowState();
    const added = wardFlowReducer(seed, {
      type: "ADD_PATIENT",
      role: "coordinator",
      now: NOW,
      umrn: "SYN-UNDO-001",
      givenName: "Demo",
      familyName: "Undo",
      dateOfBirth: "1980-01-01",
    });
    const patient = added.patients.at(-1)!;
    expectExactUndo(
      added,
      { type: "ARCHIVE_PATIENT", role: "coordinator", now: NOW + 1, patientId: patient.id, reason: "test" },
      { type: "UNDO_PATIENT_RECORD", role: "coordinator", now: NOW + 2, patientId: patient.id },
    );
  });
});
