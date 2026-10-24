import { describe, expect, it } from "vitest";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { NOW_ANCHOR as now } from "../src/components/ward-management/ward-sites";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
import { isValidStoredWardFlowState } from "../src/components/ward-management/ward-flow-storage-validation";
import { liveMovementForAdmission } from "../src/components/ward-management/ward-admissions";
const UNIT = "scgh-adult-open";
function fixture() {
  const state = seedWardFlowState();
  const original = state.units.find((u) => u.id === UNIT)!;
  const unit = {
    ...original,
    beds: 2,
    lockedBeds: 1,
    allocatableLocked: 1,
    allocatable: { ...original.allocatable, value: 2 },
    empty: { ...original.empty, value: 2 },
  };
  return {
    ...state,
    units: state.units.map((u) => (u.id === UNIT ? unit : u)),
    admissions: [],
    movements: [],
    referrals: [],
    bedReleases: [],
    leaveBeds: [],
  } as WardFlowState;
}
function received(initial = fixture()) {
  const state = wardFlowReducer(initial, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now,
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
    urgency: 2,
    originSiteCode: "SCGH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  });
  expect(state.rejections).toEqual([]);
  return state;
}
const accept = (s: WardFlowState, bedNumber?: number) =>
  wardFlowReducer(s, {
    type: "ACCEPT_REFERRAL",
    role: "ward",
    actingUnitId: UNIT,
    now,
    referralId: s.referrals.at(-1)!.id,
    destinationKind: "psychiatric_ward",
    unitId: UNIT,
    ...(bedNumber ? { bedNumber } : {}),
  });
const hold = (s: WardFlowState, bedNumber: number) =>
  wardFlowReducer(s, {
    type: "HOLD_REFERRAL_BED",
    role: "ward",
    actingUnitId: UNIT,
    now: now + 1,
    referralId: s.referrals.at(-1)!.id,
    unitId: UNIT,
    bedNumber,
  } as unknown as WardFlowEvent);
function acceptedMovement() {
  let state = wardFlowReducer(fixture(), {
    type: "RAISE_REFERRAL",
    role: "ed",
    now,
    edId: "jhc-ed",
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
  const events: WardFlowEvent[] = [
    { type: "REFER_TO_UNITS", role: "coordinator", now, movementId, unitIds: [UNIT] },
    { type: "ACCEPT_IN_PRINCIPLE", role: "ward", actingUnitId: UNIT, now, movementId, unitId: UNIT, bedNumber: 2 },
    { type: "RECORD_TRANSPORT_NEED", role: "ed", actingPlaceId: "jhc-ed", now, movementId, needed: false },
  ];
  state = events.reduce(wardFlowReducer, state);
  expect(state.rejections).toEqual([]);
  return { state, movementId };
}
describe("review regressions: numbered bed accounting and accepted direct referrals", () => {
  function seededNumberedPull() {
    const seed = seedWardFlowState();
    const movement = seed.movements.find((candidate) => candidate.id === "WF-004")!;
    const admission = seed.admissions.find((candidate) => candidate.id === movement.admissionId)!;
    expect(admission.movementId).toBeNull();
    const moved = wardFlowReducer(seed, {
      type: "PLACE_IN_BED",
      role: "ward",
      actingUnitId: admission.unitId,
      now,
      admissionId: admission.id,
      bedNumber: 1,
    });
    expect(moved.rejections).toEqual([]);
    return { seed, moved, movement, admission };
  }
  function deliverSeededPull(state: WardFlowState, movementId: string) {
    return {
      ...state,
      movements: state.movements.map((movement) =>
        movement.id === movementId
          ? {
              ...movement,
              stage: "moving" as const,
              transport: {
                id: "TR-SEEDED-NUMBER",
                provider: "Patient transport service" as const,
                escortRequired: false,
                acceptedAt: now - 30,
                collectedAt: now - 20,
                arrivedAt: now - 5,
              },
            }
          : movement,
      ),
    };
  }
  it("keeps a seeded reciprocal pulled stay's numbered move, hold and undo in agreement", () => {
    const { seed, moved, movement, admission } = seededNumberedPull();
    expect(liveMovementForAdmission(admission, seed.movements)?.id).toBe(movement.id);
    expect(
      liveMovementForAdmission(admission, [...seed.movements, { ...movement, id: "WF-AMBIGUOUS" }]),
    ).toBeUndefined();
    expect(moved.movements.find((candidate) => candidate.id === movement.id)).toMatchObject({ heldBedNumber: 1 });
    const undone = wardFlowReducer(moved, {
      type: "UNDO_PLACE_IN_BED",
      role: "ward",
      actingUnitId: admission.unitId,
      now: now + 1,
      admissionId: admission.id,
    });
    expect(undone.rejections).toEqual([]);
    expect(undone.admissions).toEqual(seed.admissions);
    expect(undone.movements).toEqual(seed.movements);
    const arrived = wardFlowReducer(deliverSeededPull(moved, movement.id), {
      type: "PATIENT_ARRIVED",
      role: "ward",
      actingUnitId: admission.unitId,
      now: now + 2,
      movementId: movement.id,
    });
    expect(arrived.rejections).toEqual([]);
    expect(arrived.admissions.find((candidate) => candidate.id === admission.id)).toMatchObject({
      state: "occupied",
      bedNumber: 1,
      bedKind: "locked",
    });
  });
  it("revalidates an existing stay number on arrival when no movement or referral number is held", () => {
    const { moved, movement, admission } = seededNumberedPull();
    const noNewerHold = {
      ...moved,
      movements: moved.movements.map((candidate) =>
        candidate.id === movement.id ? { ...candidate, heldBedNumber: undefined } : candidate,
      ),
    };
    const delivered = deliverSeededPull(noNewerHold, movement.id);
    const arrival: WardFlowEvent = {
      type: "PATIENT_ARRIVED",
      role: "ward",
      actingUnitId: admission.unitId,
      now: now + 2,
      movementId: movement.id,
    };
    const arrived = wardFlowReducer(delivered, arrival);
    expect(arrived.rejections).toEqual([]);
    expect(arrived.admissions.find((candidate) => candidate.id === admission.id)).toMatchObject({
      bedNumber: 1,
      bedKind: "locked",
    });
    const collision = {
      ...delivered,
      admissions: delivered.admissions.map((candidate) =>
        candidate.unitId === admission.unitId && candidate.id !== admission.id && candidate.state === "occupied"
          ? { ...candidate, bedNumber: 1 }
          : candidate,
      ),
    };
    const collided = wardFlowReducer(collision, arrival);
    expect(collided.rejections).toEqual([]);
    expect(collided.admissions.find((candidate) => candidate.id === admission.id)?.bedNumber).toBeUndefined();
    const wrongDesignation = {
      ...delivered,
      movements: delivered.movements.map((candidate) =>
        candidate.id === movement.id ? { ...candidate, heldBedNumber: 5 } : candidate,
      ),
    };
    const mismatched = wardFlowReducer(wrongDesignation, arrival);
    expect(mismatched.rejections).toEqual([]);
    expect(mismatched.admissions.find((candidate) => candidate.id === admission.id)?.bedNumber).toBeUndefined();
  });
  it("keeps an open request on an open numbered bed while open capacity remains", () => {
    const before = received();
    const refused = accept(before, 1);
    expect(refused.rejections.at(-1)?.reason).toMatch(/open bed first/i);
    expect(refused.referrals).toEqual(before.referrals);
    expect(accept(before, 2).rejections).toEqual([]);
  });
  it("refuses a number beyond the physical ward and a designation with no capacity", () => {
    const before = received();
    expect(accept(before, 3).rejections.at(-1)?.reason).toMatch(/not one of/);
    const unavailable = {
      ...before,
      units: before.units.map((unit) =>
        unit.id === UNIT
          ? {
              ...unit,
              allocatable: { ...unit.allocatable, value: 1 },
              allocatableLocked: 0,
            }
          : unit,
      ),
    };
    expect(accept(unavailable, 1).rejections.at(-1)?.reason).toMatch(/open bed first|No locked capacity/);
    const stay = {
      ...seedWardFlowState().admissions.find((admission) => admission.state === "occupied")!,
      id: "AD-NO-LOCKED",
      unitId: UNIT,
      bedNumber: 2,
      bedKind: "open" as const,
    };
    const refused = wardFlowReducer(
      { ...unavailable, admissions: [stay] },
      {
        type: "PLACE_IN_BED",
        role: "ward",
        actingUnitId: UNIT,
        now,
        admissionId: stay.id,
        bedNumber: 1,
      },
    );
    expect(refused.rejections.at(-1)?.reason).toMatch(/No locked capacity/);
    expect(refused.admissions[0]).toEqual(stay);
    expect(refused.units).toEqual(unavailable.units);
  });
  it("holds a bed on the same accepted arm without another acceptance or Movement", () => {
    const accepted = accept(received());
    expect(accepted.rejections).toEqual([]);
    const before = accepted.referrals.at(-1)!.destinations[0]!;
    const held = hold(accepted, 2);
    expect(held.rejections).toEqual([]);
    expect(held.referrals.at(-1)!.destinations[0]).toEqual({ ...before, heldBedNumber: 2 });
    expect(held.movements).toEqual([]);
    expect(held.auditEvents.at(-1)).toMatchObject({
      action: "HOLD_REFERRAL_BED",
      outcome: "accepted",
      details: { fromBed: null, toBed: 2 },
    });
    const complete = hold(accept(received(seedWardFlowState())), 24);
    expect(complete.rejections).toEqual([]);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(complete)))).toBe(true);
  });
  it("refuses wrong ward, queued arm, duplicate physical bed and an already started journey", () => {
    const queued = received();
    expect(hold(queued, 2).rejections.at(-1)?.reason).toMatch(/accepted referral/);
    const accepted = accept(queued);
    const wrong = wardFlowReducer(accepted, {
      type: "HOLD_REFERRAL_BED",
      role: "ward",
      actingUnitId: "rph-adult-secure",
      now,
      referralId: accepted.referrals.at(-1)!.id,
      unitId: UNIT,
      bedNumber: 2,
    });
    expect(wrong.rejections.at(-1)?.reason).toMatch(/own beds/);
    const taken = {
      ...accepted,
      admissions: [
        { ...seedWardFlowState().admissions.find((a) => a.state === "occupied")!, unitId: UNIT, bedNumber: 2 },
      ],
    };
    expect(hold(taken, 2).rejections.at(-1)?.reason).toMatch(/already taken/);
    const journey = {
      ...accepted,
      movements: [{ ...seedWardFlowState().movements[0]!, referralId: accepted.referrals.at(-1)!.id }],
    };
    expect(hold(journey, 2).rejections.at(-1)?.reason).toMatch(/already has a bed journey/);
  });
  it("reassigns the numbered hold while retaining the exact acceptance author and time", () => {
    const initial = received();
    const allOpen = {
      ...initial,
      units: initial.units.map((u) => (u.id === UNIT ? { ...u, lockedBeds: 0, allocatableLocked: 0 } : u)),
    };
    const accepted = accept(allOpen, 1);
    const reassigned = hold(accepted, 2);
    expect(reassigned.rejections).toEqual([]);
    expect(reassigned.referrals.at(-1)!.destinations[0]).toEqual({
      ...accepted.referrals.at(-1)!.destinations[0],
      heldBedNumber: 2,
    });
    expect(reassigned.auditEvents.at(-1)).toMatchObject({
      action: "HOLD_REFERRAL_BED",
      details: { fromBed: 1, toBed: 2 },
    });
  });
  it("agrees on number, kind and capacity through pull, release, arrival, move, departure and undo", () => {
    const { state: accepted, movementId } = acceptedMovement();
    const pull: WardFlowEvent = {
      type: "PULL_PATIENT",
      role: "ward",
      actingUnitId: UNIT,
      now,
      movementId,
      unitId: UNIT,
    };
    const pulled = wardFlowReducer(accepted, pull);
    expect(pulled.rejections).toEqual([]);
    const admissionId = pulled.movements.at(-1)!.admissionId!;
    expect(pulled.admissions.find((a) => a.id === admissionId)).toMatchObject({
      bedNumber: 2,
      bedKind: "open",
      state: "pulled",
    });
    expect(pulled.units.find((u) => u.id === UNIT)).toMatchObject({ allocatable: { value: 1 }, allocatableLocked: 1 });
    const movedHold = wardFlowReducer(pulled, {
      type: "PLACE_IN_BED",
      role: "ward",
      actingUnitId: UNIT,
      now,
      admissionId,
      bedNumber: 1,
    });
    expect(movedHold.rejections).toEqual([]);
    expect(movedHold.movements.at(-1)).toMatchObject({ heldBedNumber: 1 });
    expect(movedHold.admissions[0]).toMatchObject({ bedNumber: 1, bedKind: "locked" });
    expect(movedHold.units.find((u) => u.id === UNIT)).toMatchObject({
      allocatable: { value: 1 },
      allocatableLocked: 0,
    });
    const undoneHold = wardFlowReducer(movedHold, {
      type: "UNDO_PLACE_IN_BED",
      role: "ward",
      actingUnitId: UNIT,
      now,
      admissionId,
    });
    expect(undoneHold.rejections).toEqual([]);
    expect(undoneHold.movements.at(-1)).toMatchObject({ heldBedNumber: 2 });
    expect(undoneHold.admissions[0]).toMatchObject({ bedNumber: 2, bedKind: "open" });
    expect(undoneHold.units.find((u) => u.id === UNIT)).toMatchObject({
      allocatable: { value: 1 },
      allocatableLocked: 1,
    });
    const released = wardFlowReducer(pulled, {
      type: "RELEASE_PULL",
      role: "coordinator",
      now,
      movementId,
      reason: "pull_made_in_error",
    });
    expect(released.rejections).toEqual([]);
    expect(released.admissions).toEqual([]);
    expect(released.units.find((u) => u.id === UNIT)).toMatchObject({
      allocatable: { value: 2 },
      allocatableLocked: 1,
    });
    const arrived = wardFlowReducer(pulled, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      actingUnitId: UNIT,
      now: now + 1,
      movementId,
      exception: { gaps: ["fit_to_travel_missing"], reason: "treating_team_confirmed" },
    });
    expect(arrived.rejections).toEqual([]);
    expect(arrived.admissions.find((a) => a.id === admissionId)).toMatchObject({
      bedNumber: 2,
      bedKind: "open",
      state: "occupied",
    });
    const moved = wardFlowReducer(arrived, {
      type: "PLACE_IN_BED",
      role: "ward",
      actingUnitId: UNIT,
      now: now + 2,
      admissionId,
      bedNumber: 1,
    });
    expect(moved.rejections).toEqual([]);
    expect(moved.units.find((u) => u.id === UNIT)).toMatchObject({ allocatable: { value: 1 }, allocatableLocked: 0 });
    const left = wardFlowReducer(moved, {
      type: "RECORD_LEAVING",
      role: "ward",
      actingUnitId: UNIT,
      now: now + 3,
      admissionId,
      leavingDestination: "discharged-to-the-community",
    });
    expect(left.rejections).toEqual([]);
    expect(left.units.find((u) => u.id === UNIT)).toMatchObject({ allocatable: { value: 2 }, allocatableLocked: 1 });
    const undone = wardFlowReducer(left, {
      type: "UNDO_DEPARTURE",
      role: "ward",
      actingUnitId: UNIT,
      now: now + 4,
      admissionId,
    });
    expect(undone.rejections).toEqual([]);
    expect(undone.admissions.find((a) => a.id === admissionId)).toMatchObject({
      bedNumber: 1,
      bedKind: "locked",
      state: "occupied",
    });
    expect(undone.units.find((u) => u.id === UNIT)).toMatchObject({ allocatable: { value: 1 }, allocatableLocked: 0 });
  });
  it("reconciles a stay's designation and locked free capacity on a move and undo", () => {
    const initial = fixture();
    const source = seedWardFlowState().admissions.find((a) => a.state === "occupied")!;
    const stay = {
      ...source,
      id: "AD-MIXED",
      unitId: UNIT,
      bedNumber: 2,
      bedKind: "open" as const,
      state: "occupied" as const,
    };
    const state = {
      ...initial,
      admissions: [stay],
      units: initial.units.map((u) => (u.id === UNIT ? { ...u, allocatable: { ...u.allocatable, value: 1 } } : u)),
    };
    const moved = wardFlowReducer(state, {
      type: "PLACE_IN_BED",
      role: "ward",
      actingUnitId: UNIT,
      now,
      admissionId: stay.id,
      bedNumber: 1,
    });
    expect(moved.rejections).toEqual([]);
    expect(moved.admissions[0]).toMatchObject({ bedNumber: 1, bedKind: "locked" });
    expect(moved.units.find((u) => u.id === UNIT)?.allocatableLocked).toBe(0);
    const undone = wardFlowReducer(moved, {
      type: "UNDO_PLACE_IN_BED",
      role: "ward",
      actingUnitId: UNIT,
      now: now + 1,
      admissionId: stay.id,
    });
    expect(undone.rejections).toEqual([]);
    expect(undone.admissions).toEqual(state.admissions);
    expect(undone.units.find((u) => u.id === UNIT)).toMatchObject({ allocatable: { value: 1 }, allocatableLocked: 1 });
  });
});
