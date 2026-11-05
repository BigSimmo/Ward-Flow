import { describe, expect, it } from "vitest";

import { bedIsOccupied } from "../src/components/ward-management/ward-admissions";
import { bedStates } from "../src/components/ward-management/ward-bed-states";
import { wardStaySeats } from "../src/components/ward-management/ward/ward-bed-layout";
import { GENERAL_OBSERVATION } from "../src/components/ward-management/ward-observation";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "../src/components/ward-management/ward-flow-storage-validation";

const NOW = 642;
const UNIT = "scgh-adult-open";
const draft = {
  cohort: "Adult",
  security: "Open",
  sex: "Female",
  gender: "Female",
  observation: GENERAL_OBSERVATION,
  highAcuity: false,
  legalStatus: "Voluntary",
  urgency: 2,
  legalFormCode: null,
} as const;

function send(state: WardFlowState, event: WardFlowEvent): WardFlowState {
  const next = wardFlowReducer(state, event);
  expect(next.rejections, `setup ${event.type}`).toEqual(state.rejections);
  return next;
}

function expectRestorable(state: WardFlowState) {
  expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify({ ...state, rejections: [] })))).toBe(true);
}

function acceptedReferral() {
  let state = send(seedWardFlowState(), {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW,
    ageBand: "Adult",
    destinations: [
      {
        kind: "psychiatric_ward",
        unitId: UNIT,
        sex: "Female",
        gender: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "unknown", reason: "not_known" },
    source: "community",
    sendingTeamName: "Synthetic audit team",
    urgency: 2,
    originSiteCode: "SCGH",
    transportNeeded: false,
    history: "",
  });
  const referralId = state.referrals.at(-1)!.id;
  state = send(state, {
    type: "ACCEPT_REFERRAL",
    role: "ward",
    actingUnitId: UNIT,
    now: NOW,
    referralId,
    destinationKind: "psychiatric_ward",
    unitId: UNIT,
  });
  expectRestorable(state);
  return { state, referralId };
}

const undo = (referralId: string): WardFlowEvent => ({
  type: "UNDO_REFERRAL_DECISION",
  role: "ward",
  actingUnitId: UNIT,
  now: NOW + 2,
  referralId,
});

describe("a referral decision consumed by a journey", () => {
  it("still permits immediate acceptance Undo before a journey uses it", () => {
    const { state, referralId } = acceptedReferral();
    const after = send(state, undo(referralId));
    expect(after.referrals.find((r) => r.id === referralId)!.destinations[0].state).toBe("queued");
    expectRestorable(after);
  });

  it.each([false, true])("preserves an acceptance after its journey is raised (pullBed=%s)", (pullBed) => {
    const accepted = acceptedReferral();
    const before = send(accepted.state, {
      type: "RAISE_REFERRAL",
      role: "ward",
      actingUnitId: UNIT,
      now: NOW + 1,
      referralId: accepted.referralId,
      acceptedUnitId: UNIT,
      draft,
      pullBed,
    });
    expectRestorable(before);
    expect(before.movements.find((m) => m.referralId === accepted.referralId)?.stage).toBe(
      pullBed ? "pulled" : "accepted_awaiting_bed",
    );
    const after = wardFlowReducer(before, undo(accepted.referralId));
    expect(after.rejections).toHaveLength(before.rejections.length + 1);
    for (const key of ["referrals", "movements", "admissions", "units", "notices", "undoRecords"] as const)
      expect(after[key]).toEqual(before[key]);
    expectRestorable(after);
  });

  it("permits acceptance Undo once its continuation is safely cancelled and holds no bed", () => {
    const accepted = acceptedReferral();
    const started = send(accepted.state, {
      type: "RAISE_REFERRAL",
      role: "ward",
      actingUnitId: UNIT,
      now: NOW + 1,
      referralId: accepted.referralId,
      acceptedUnitId: UNIT,
      draft,
    });
    const movement = started.movements.find((row) => row.referralId === accepted.referralId)!;
    const cancelled = send(started, {
      type: "WITHDRAW_REFERRAL",
      role: "coordinator",
      now: NOW + 1,
      movementId: movement.id,
    });
    expect(cancelled.movements.find((row) => row.id === movement.id)?.closure?.outcome).toBe("did_not_proceed");
    expect(cancelled.admissions.some((row) => row.movementId === movement.id && bedIsOccupied(row))).toBe(false);
    const undone = send(cancelled, undo(accepted.referralId));
    expect(undone.referrals.find((row) => row.id === accepted.referralId)!.destinations[0].state).toBe("queued");
    expect(undone.movements).toEqual(cancelled.movements);
    expectRestorable(undone);
  });
});

describe("new bed allocations after capacity reconfirmation", () => {
  it.each([
    { reconfirm: false, closed: false, commitments: 5 },
    { reconfirm: true, closed: false, commitments: 5 },
    { reconfirm: false, closed: true, commitments: 4 },
    { reconfirm: true, closed: true, commitments: 4 },
  ])(
    "keeps reservations and closures separate (reconfirm=$reconfirm, closed=$closed)",
    ({ reconfirm, closed, commitments }) => {
      let state = seedWardFlowState();
      expectRestorable(state);
      expect(state.units.find((u) => u.id === UNIT)!.empty.value).toBe(5);
      const movementIds: string[] = [];
      for (let index = 0; index < 6; index++) {
        state = send(state, { type: "RAISE_REFERRAL", role: "ed", now: NOW, edId: "jhc-ed", draft });
        const movementId = state.movements.at(-1)!.id;
        movementIds.push(movementId);
        state = send(state, { type: "REFER_TO_UNITS", role: "coordinator", now: NOW, movementId, unitIds: [UNIT] });
        state = send(state, {
          type: "ACCEPT_IN_PRINCIPLE",
          role: "ward",
          actingUnitId: UNIT,
          now: NOW,
          movementId,
          unitId: UNIT,
        });
      }
      const confirm = () => {
        const unit = state.units.find((u) => u.id === UNIT)!;
        state = send(state, {
          type: "CONFIRM_CAPACITY",
          role: "ward",
          actingUnitId: UNIT,
          now: NOW,
          unitId: UNIT,
          expectedRevision: unit.allocatable.revision ?? 0,
          value: 5,
        });
        expect(state.units.find((u) => u.id === UNIT)!.allocatable.value).toBe(5);
      };
      confirm();
      for (let index = 0; index < commitments; index++) {
        state = send(state, {
          type: "PULL_PATIENT",
          role: "ward",
          actingUnitId: UNIT,
          now: NOW,
          movementId: movementIds[index],
          unitId: UNIT,
        });
        if (index === 0 && closed) {
          const unit = state.units.find((u) => u.id === UNIT)!;
          const seats = wardStaySeats(unit, state.admissions);
          const taken = new Set(
            state.admissions
              .filter((a) => a.unitId === UNIT && bedIsOccupied(a))
              .map((a) => a.bedNumber ?? seats.get(a.id)),
          );
          const bedNumber = Array.from({ length: unit.beds }, (_, i) => i + 1).find(
            (number) =>
              !taken.has(number) &&
              !(unit.closedBeds ?? []).some((mark) => mark.bedNumber === number && mark.reopenedAt === undefined) &&
              !state.movements.some((m) => !m.closure && m.acceptedUnitId === UNIT && m.heldBedNumber === number) &&
              !state.referrals.some((r) =>
                r.destinations.some(
                  (arm) =>
                    arm.state === "accepted" &&
                    arm.destination.kind === "psychiatric_ward" &&
                    (arm.acceptedUnitId ?? arm.destination.unitId) === UNIT &&
                    arm.heldBedNumber === number,
                ),
              ),
          );
          expect(bedNumber, "the ward has a free numbered seat to close").toBeDefined();
          state = send(state, {
            type: "SET_BED_CLOSED",
            role: "ward",
            actingUnitId: UNIT,
            unitId: UNIT,
            now: NOW,
            bedNumber: bedNumber!,
            closed: true,
          });
        }
        if (reconfirm && index === 0) confirm();
      }
      expectRestorable(state);
      expect(state.admissions.filter((a) => a.movementId !== null && movementIds.includes(a.movementId))).toHaveLength(
        commitments,
      );
      const unit = state.units.find((u) => u.id === UNIT)!;
      const boxes = bedStates(unit, state.admissions, state.bedReleases, state.leaveBeds);
      expect(boxes.ready).toBe(0);
      if (closed) expect(boxes.closed).toBe(1);
      expect(boxes.ready + boxes.pulled + boxes.closed + boxes.occupied).toBe(unit.beds);
      const after = wardFlowReducer(state, {
        type: "PULL_PATIENT",
        role: "ward",
        actingUnitId: UNIT,
        now: NOW,
        movementId: movementIds[commitments],
        unitId: UNIT,
      });
      expect(after.rejections).toHaveLength(state.rejections.length + 1);
      for (const key of ["units", "admissions", "movements"] as const) expect(after[key]).toEqual(state[key]);
      expectRestorable(after);
    },
  );
});

// Real reducer events establish the reservation/preparation overlap before either allocation gate.
describe("unreserved beds still being made ready", () => {
  it.each(["pull", "planned"] as const)("does not allocate a preparing bed through %s after reconfirmation", (kind) => {
    let before = seedWardFlowState();
    let plannedAdmissionId: string | undefined;
    if (kind === "planned") {
      before = send(before, {
        type: "BOOK_PLANNED_ADMISSION",
        role: "coordinator",
        now: NOW,
        initials: "AB",
        sex: "Female",
        gender: "Female",
        reason: "respite",
        unitId: UNIT,
        expectedArrivalAt: NOW + 10,
        expectedStayDays: 7,
        legalStatus: "Voluntary",
        ageBand: "Adult",
        calendarDate: "2026-11-02",
      });
      plannedAdmissionId = before.plannedAdmissions.at(-1)!.id;
    }
    for (let index = 0; index < 2; index++) {
      let departed: WardFlowState | undefined;
      for (const admission of before.admissions.filter((a) => a.unitId === UNIT && a.state === "occupied")) {
        const candidate = wardFlowReducer(before, {
          type: "RECORD_LEAVING",
          role: "ward",
          actingUnitId: UNIT,
          now: NOW,
          admissionId: admission.id,
          leavingDestination: "transferred-to-another-psychiatric-ward",
        });
        if (candidate.rejections.length === before.rejections.length) {
          departed = candidate;
          break;
        }
      }
      expect(departed, "an occupied stay with a permitted recorded departure").toBeDefined();
      before = departed!;
      expectRestorable(before);
    }
    expect(before.units.find((u) => u.id === UNIT)!.empty.value).toBe(7);
    const confirm = () => {
      const unit = before.units.find((u) => u.id === UNIT)!;
      before = send(before, {
        type: "CONFIRM_CAPACITY",
        role: "ward",
        actingUnitId: UNIT,
        unitId: UNIT,
        now: NOW + 1,
        expectedRevision: unit.allocatable.revision ?? 0,
        value: 7,
      });
    };
    confirm();
    const movementIds: string[] = [];
    for (let index = 0; index < 7; index++) {
      before = send(before, { type: "RAISE_REFERRAL", role: "ed", now: NOW + 1, edId: "jhc-ed", draft });
      const movementId = before.movements.at(-1)!.id;
      movementIds.push(movementId);
      before = send(before, { type: "REFER_TO_UNITS", role: "coordinator", now: NOW + 1, movementId, unitIds: [UNIT] });
      before = send(before, {
        type: "ACCEPT_IN_PRINCIPLE",
        role: "ward",
        actingUnitId: UNIT,
        now: NOW + 1,
        movementId,
        unitId: UNIT,
      });
      if (index < 5)
        before = send(before, {
          type: "PULL_PATIENT",
          role: "ward",
          actingUnitId: UNIT,
          now: NOW + 1,
          movementId,
          unitId: UNIT,
        });
    }
    confirm();
    expectRestorable(before);
    const boxes = (state: WardFlowState) =>
      bedStates(
        state.units.find((u) => u.id === UNIT)!,
        state.admissions,
        state.bedReleases,
        state.leaveBeds,
      );
    expect(boxes(before)).toMatchObject({ ready: 2, beingMadeReady: 2 });
    const allocate: WardFlowEvent =
      kind === "pull"
        ? {
            type: "PULL_PATIENT",
            role: "ward",
            actingUnitId: UNIT,
            now: NOW + 10,
            movementId: movementIds[5],
            unitId: UNIT,
          }
        : {
            type: "CONVERT_PLANNED_ADMISSION",
            role: "coordinator",
            now: NOW + 10,
            unitId: UNIT,
            plannedAdmissionId: plannedAdmissionId!,
          };
    const refused = wardFlowReducer(before, allocate);
    expect(refused.rejections).toHaveLength(before.rejections.length + 1);
    expect(refused.rejections.at(-1)?.reason).toMatch(/still being made ready/);
    for (const key of ["units", "admissions", "movements", "plannedAdmissions"] as const)
      expect(refused[key]).toEqual(before[key]);
    const releaseId = before.bedReleases.find((r) => r.unitId === UNIT && r.state === "discharged" && r.preparing)!.id;
    const prepared = send(before, {
      type: "SET_BED_PREPARATION",
      role: "ward",
      actingUnitId: UNIT,
      now: NOW + 2,
      releaseId,
      preparing: false,
    });
    expect(boxes(prepared)).toMatchObject({ ready: 2, beingMadeReady: 1 });
    const allocated = send(prepared, allocate);
    expect(boxes(allocated)).toMatchObject({ ready: 1, beingMadeReady: 1 });
    expectRestorable(allocated);
    if (kind === "pull") {
      const again = wardFlowReducer(allocated, { ...allocate, movementId: movementIds[6] } as WardFlowEvent);
      expect(again.rejections).toHaveLength(allocated.rejections.length + 1);
      expect(again.rejections.at(-1)?.reason).toMatch(/still being made ready/);
    }
  });
});
