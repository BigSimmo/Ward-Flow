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
import { deviceCopyFromEvents } from "../src/components/ward-management/ward-flow-typed-text-scrub";
import { OVERRIDE_REASONS } from "../src/components/ward-management/ward-change-reasons";
import { movementBedReservation } from "../src/components/ward-management/ward-movement-bed-hold";
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
      observation: { level: "general" as const, intervalMinutes: null, reviewAt: null },
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
  it("refuses undo when a legacy pulled stay's former movement hold has been reserved again", () => {
    const { state, movementId } = acceptedMovement();
    const pulled = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      actingUnitId: UNIT,
      now,
      movementId,
      unitId: UNIT,
    });
    expect(pulled.rejections).toEqual([]);
    const admission = pulled.admissions.at(-1)!;
    // Main before this fix could pull a numbered movement into an unnumbered stay.
    delete admission.bedNumber;
    const moved = wardFlowReducer(pulled, {
      type: "PLACE_IN_BED",
      role: "ward",
      actingUnitId: UNIT,
      now: now + 1,
      admissionId: admission.id,
      bedNumber: 1,
    });
    expect(moved.rejections).toEqual([]);
    const reservedAgain = hold(accept(received(moved)), 2);
    expect(reservedAgain.rejections).toEqual([]);
    const undone = wardFlowReducer(reservedAgain, {
      type: "UNDO_PLACE_IN_BED",
      role: "ward",
      actingUnitId: UNIT,
      now: now + 2,
      admissionId: admission.id,
    });
    expect(undone.rejections.at(-1)?.reason).toMatch(/already pulled/);
    expect(undone.movements).toEqual(reservedAgain.movements);
    expect(undone.referrals).toEqual(reservedAgain.referrals);
    expect(undone.admissions).toEqual(reservedAgain.admissions);
    expect(undone.units).toEqual(reservedAgain.units);
  });
  function seededNumberedPull() {
    const seed = seedWardFlowState();
    const movement = seed.movements.find((candidate) => candidate.id === "WF-004")!;
    const admission = seed.admissions.find((candidate) => candidate.id === movement.admissionId)!;
    expect(admission.movementId).toBeNull();
    // This mixed-ward fixture records its original kind; the reciprocal link remains seed-shaped.
    admission.bedKind = "locked";
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
  it("consumes an any-ward accepted arm reservation when its movement has no separate number", () => {
    const accepted = accept(received(), 2);
    const referral = accepted.referrals.at(-1)!;
    const arm = referral.destinations[0]!;
    expect(arm.destination.kind).toBe("psychiatric_ward");
    if (arm.destination.kind !== "psychiatric_ward") throw new Error("Expected a ward arm");
    delete arm.destination.unitId;
    const source = acceptedMovement();
    const movement = { ...source.state.movements.at(-1)!, referralId: referral.id, heldBedNumber: undefined };
    expect(movementBedReservation(movement, accepted.referrals, UNIT).bedNumber).toBe(2);
    const pulled = wardFlowReducer(
      { ...accepted, movements: [movement] },
      {
        type: "PULL_PATIENT",
        role: "ward",
        actingUnitId: UNIT,
        unitId: UNIT,
        movementId: movement.id,
        now,
      },
    );
    expect(pulled.rejections).toEqual([]);
    expect(pulled.admissions.at(-1)).toMatchObject({ bedNumber: 2, bedKind: "open", state: "pulled" });
  });
  it("rechecks physical ownership at pull after a numbered reservation was accepted", () => {
    const { state, movementId } = acceptedMovement();
    const stay = {
      ...seedWardFlowState().admissions.find((a) => a.state === "occupied")!,
      id: "AD-LATER-HOLDER",
      unitId: UNIT,
      bedNumber: 2,
      bedKind: "open" as const,
    };
    const current = { ...state, admissions: [stay] };
    const refused = wardFlowReducer(current, {
      type: "PULL_PATIENT",
      role: "ward",
      actingUnitId: UNIT,
      unitId: UNIT,
      movementId,
      now,
    });
    expect(refused.rejections.at(-1)?.reason).toMatch(/already taken/);
    expect(refused.admissions).toEqual(current.admissions);
    expect(refused.units).toEqual(current.units);
  });
  it("does not create a new numbered hold after the ward closes to admissions", () => {
    const accepted = accept(received());
    const closed = { ...accepted, units: accepted.units.map((u) => (u.id === UNIT ? { ...u, isClosed: true } : u)) };
    const refused = hold(closed, 2);
    expect(refused.rejections.at(-1)?.reason).toMatch(/closed to admissions/);
    expect(refused.referrals).toEqual(closed.referrals);
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
    expect(refused.rejections.at(-1)?.reason).toMatch(/free bed-kind counts/);
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

describe("final review: reservation and admission lifecycle boundaries", () => {
  function joinedPull(initial = fixture(), bed = 2, duplicateArm = false) {
    const direct = accept(received(initial), bed);
    const referral = direct.referrals.at(-1)!;
    if (duplicateArm) referral.destinations.push({ ...referral.destinations[0]!, heldBedNumber: 1 });
    const source = acceptedMovement();
    const movement = { ...source.state.movements.at(-1)!, referralId: referral.id, heldBedNumber: undefined };
    const pulled = wardFlowReducer(
      {
        ...direct,
        // Keep the runtime movement ID and its source sequence coherent in this joined fixture.
        referralSequence: Math.max(direct.referralSequence, source.state.referralSequence),
        movements: [...direct.movements, movement],
      },
      {
        type: "PULL_PATIENT",
        role: "ward",
        actingUnitId: UNIT,
        unitId: UNIT,
        movementId: movement.id,
        now,
      },
    );
    expect(pulled.rejections).toEqual([]);
    return {
      pulled,
      movementId: movement.id,
      admissionId: pulled.movements.at(-1)!.admissionId!,
      referralId: referral.id,
    };
  }
  function moveJoined(initial = fixture(), bed = 2, target = 1, duplicateArm = false) {
    const join = joinedPull(initial, bed, duplicateArm);
    const moved = wardFlowReducer(join.pulled, {
      type: "PLACE_IN_BED",
      role: "ward",
      actingUnitId: UNIT,
      admissionId: join.admissionId,
      bedNumber: target,
      now: now + 1,
    });
    expect(moved.rejections).toEqual([]);
    return { ...join, moved };
  }
  it("undo restores only the arm changed by the numbered move when accepted ward arms are duplicated", () => {
    const restoredInput = accept(received(seedWardFlowState()));
    const restoredReferral = restoredInput.referrals.at(-1)!;
    restoredReferral.destinations.push(structuredClone(restoredReferral.destinations[0]!));
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(restoredInput)))).toBe(true);
    const { moved, admissionId, referralId } = moveJoined(fixture(), 2, 1, true);
    const beforeUndo = moved.referrals.find((r) => r.id === referralId)!.destinations;
    expect(beforeUndo.map((a) => a.heldBedNumber)).toEqual([1, 1]);
    const record = moved.undoRecords!.find((r) => r.kind === "bed-placement")!;
    expect(record).toMatchObject({ beforeReferralArmIndex: 0 });
    const undone = wardFlowReducer(moved, {
      type: "UNDO_PLACE_IN_BED",
      role: "ward",
      actingUnitId: UNIT,
      admissionId,
      now: now + 2,
    });
    expect(undone.rejections).toEqual([]);
    const arms = undone.referrals.find((r) => r.id === referralId)!.destinations;
    expect(arms[0]).toEqual({ ...beforeUndo[0], heldBedNumber: 2 });
    expect(arms[1]).toEqual(beforeUndo[1]);
  });
  it("keeps legacy Undo available when the accepted ward arm is unique", () => {
    const { moved, pulled, admissionId } = moveJoined();
    const legacy = structuredClone(moved);
    const record = legacy.undoRecords!.find((r) => r.kind === "bed-placement")!;
    if (record.kind !== "bed-placement") throw new Error("Expected bed move");
    delete record.beforeReferralArmIndex;
    const undone = wardFlowReducer(legacy, {
      type: "UNDO_PLACE_IN_BED",
      role: "ward",
      actingUnitId: UNIT,
      admissionId,
      now: now + 2,
    });
    expect(undone.rejections).toEqual([]);
    expect(undone.referrals).toEqual(pulled.referrals);
    expect(undone.admissions).toEqual(pulled.admissions);
  });
  it("refuses an ambiguous legacy arm restore without mutating any linked record", () => {
    const { moved, admissionId } = moveJoined(fixture(), 2, 1, true);
    const legacy = structuredClone(moved);
    const record = legacy.undoRecords!.find((r) => r.kind === "bed-placement")!;
    if (record.kind !== "bed-placement") throw new Error("Expected bed move");
    delete record.beforeReferralArmIndex;
    const undone = wardFlowReducer(legacy, {
      type: "UNDO_PLACE_IN_BED",
      role: "ward",
      actingUnitId: UNIT,
      admissionId,
      now: now + 2,
    });
    expect(undone.rejections.at(-1)?.reason).toMatch(/referral arm.*changed/);
    expect(undone.admissions).toEqual(legacy.admissions);
    expect(undone.movements).toEqual(legacy.movements);
    expect(undone.referrals).toEqual(legacy.referrals);
    expect(undone.units).toEqual(legacy.units);
  });
  it("keeps the numeric arm slot through a safe device copy and rejects malformed slot metadata", () => {
    const { pulled, moved } = moveJoined(seedWardFlowState(), 24, 23);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(pulled)))).toBe(true);
    const stored = JSON.parse(JSON.stringify(moved));
    expect(isValidStoredWardFlowState(stored)).toBe(true);
    const copied = deviceCopyFromEvents(moved, [], () => [seedWardFlowState()]);
    expect(copied).not.toBeNull();
    expect(copied!.undoRecords!.find((r) => r.kind === "bed-placement")).toMatchObject({ beforeReferralArmIndex: 0 });
    const malformed = structuredClone(stored);
    malformed.undoRecords.find((r: { kind: string }) => r.kind === "bed-placement").beforeReferralArmIndex = -1;
    expect(isValidStoredWardFlowState(malformed)).toBe(false);
  });
  it("pulls a valid locked reservation after Open capacity becomes free", () => {
    const { state, movementId } = acceptedMovement();
    const movement = state.movements.at(-1)!;
    const start = {
      ...state,
      movements: [
        {
          ...movement,
          stage: "destination_review" as const,
          acceptedUnitId: undefined,
          heldBedNumber: undefined,
          referredUnitIds: [UNIT],
        },
      ],
      units: state.units.map((u) => (u.id === UNIT ? { ...u, allocatable: { ...u.allocatable, value: 1 } } : u)),
    };
    const reserved = wardFlowReducer(start, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      actingUnitId: UNIT,
      unitId: UNIT,
      movementId,
      bedNumber: 1,
      now,
    });
    expect(reserved.rejections).toEqual([]);
    const opened = {
      ...reserved,
      units: reserved.units.map((u) => (u.id === UNIT ? { ...u, allocatable: { ...u.allocatable, value: 2 } } : u)),
    };
    const pulled = wardFlowReducer(opened, {
      type: "PULL_PATIENT",
      role: "ward",
      actingUnitId: UNIT,
      unitId: UNIT,
      movementId,
      now: now + 1,
    });
    expect(pulled.rejections).toEqual([]);
    expect(pulled.admissions.at(-1)).toMatchObject({ bedNumber: 1, bedKind: "locked", state: "pulled" });
    expect(pulled.units.find((u) => u.id === UNIT)).toMatchObject({ allocatable: { value: 1 }, allocatableLocked: 0 });
  });
  it("still requires a recorded override for a reserved Open bed on a Secure request", () => {
    const { state, movementId } = acceptedMovement();
    const source = state.movements.at(-1)!;
    const initial = {
      ...state,
      movements: [
        {
          ...source,
          security: "Secure" as const,
          stage: "destination_review" as const,
          acceptedUnitId: undefined,
          heldBedNumber: undefined,
          referredUnitIds: [UNIT],
        },
      ],
      units: state.units.map((u) => (u.id === UNIT ? { ...u, allocatableLocked: 0 } : u)),
    };
    const reserved = wardFlowReducer(initial, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      actingUnitId: UNIT,
      unitId: UNIT,
      movementId,
      bedNumber: 2,
      now,
    });
    expect(reserved.rejections).toEqual([]);
    const reopened = {
      ...reserved,
      units: reserved.units.map((u) => (u.id === UNIT ? { ...u, allocatableLocked: 1 } : u)),
    };
    const pull = {
      type: "PULL_PATIENT",
      role: "ward",
      actingUnitId: UNIT,
      unitId: UNIT,
      movementId,
      now: now + 1,
    } as const;
    const refused = wardFlowReducer(reopened, pull);
    expect(refused.rejections).toHaveLength(1);
    expect(refused.rejections[0]!.reason).toMatch(/numbered reservation.*open bed/);
    expect(refused.admissions).toEqual(reopened.admissions);
    const pulled = wardFlowReducer(reopened, { ...pull, overrideReason: OVERRIDE_REASONS[0] });
    expect(pulled.rejections).toEqual([]);
    expect(pulled.admissions.at(-1)).toMatchObject({ bedNumber: 2, bedKind: "open" });
    expect(pulled.movements.at(-1)!.overrides).toContainEqual(
      expect.objectContaining({ gate: "locked_bed_capacity", reason: OVERRIDE_REASONS[0] }),
    );
  });
  it("clears the accepted any-ward arm's reservation when its linked arrival is recorded", () => {
    const joined = joinedPull();
    const current = joined.pulled;
    const referral = current.referrals.find((r) => r.id === joined.referralId)!;
    const arm = referral.destinations[0]!;
    if (arm.destination.kind !== "psychiatric_ward") throw new Error("Expected ward arm");
    delete arm.destination.unitId;
    const arrived = wardFlowReducer(current, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      actingUnitId: UNIT,
      movementId: joined.movementId,
      now: now + 1,
      exception: { gaps: ["fit_to_travel_missing"], reason: "treating_team_confirmed" },
    });
    expect(arrived.rejections).toEqual([]);
    expect(arrived.admissions.find((a) => a.id === joined.admissionId)).toMatchObject({
      bedNumber: 2,
      state: "occupied",
    });
    expect(arrived.referrals.find((r) => r.id === joined.referralId)!.destinations[0]!.heldBedNumber).toBeUndefined();
    expect(arrived.referrals.find((r) => r.id === joined.referralId)!.destinations[0]!.decidedAt).toBe(arm.decidedAt);
  });
  it("never reholds a consumed direct referral after departure or after Undo departure", () => {
    const accepted = accept(received());
    const referralId = accepted.referrals.at(-1)!.id;
    const occupied = {
      ...seedWardFlowState().admissions.find((a) => a.state === "occupied")!,
      id: "AD-DIRECT-CONSUMED",
      unitId: UNIT,
      referralId,
      movementId: null,
      patientId: null,
      bedNumber: 2,
      bedKind: "open" as const,
    };
    const state = {
      ...accepted,
      admissions: [occupied],
      units: accepted.units.map((u) =>
        u.id === UNIT ? { ...u, allocatable: { ...u.allocatable, value: 1 }, empty: { ...u.empty, value: 1 } } : u,
      ),
    };
    const departed = wardFlowReducer(state, {
      type: "RECORD_LEAVING",
      role: "ward",
      actingUnitId: UNIT,
      admissionId: occupied.id,
      leavingDestination: "discharged-to-the-community",
      now,
    });
    expect(departed.rejections).toEqual([]);
    expect(departed.admissions[0]!.state).toBe("departed");
    expect(hold(departed, 2).rejections).toHaveLength(1);
    expect(hold(departed, 2).referrals).toEqual(departed.referrals);
    const undone = wardFlowReducer(departed, {
      type: "UNDO_DEPARTURE",
      role: "ward",
      actingUnitId: UNIT,
      admissionId: occupied.id,
      now: now + 1,
    });
    expect(undone.rejections).toEqual([]);
    expect(undone.admissions[0]!.state).toBe("occupied");
    expect(hold(undone, 2).rejections).toHaveLength(1);
    const newReferral = accept(received(departed));
    expect(hold(newReferral, 2).rejections).toEqual([]);
  });
});
