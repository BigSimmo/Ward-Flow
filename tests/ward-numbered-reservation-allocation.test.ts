import { describe, expect, it } from "vitest";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { GENERAL_OBSERVATION } from "../src/components/ward-management/ward-observation";

const UNIT = "scgh-adult-open";
const now = 642;
function send(state: WardFlowState, event: Record<string, unknown>) {
  return wardFlowReducer(state, { now, role: "coordinator", ...event } as WardFlowEvent);
}
function accepted() {
  let state = seedWardFlowState();
  state = { ...state, movements: [], referrals: [], admissions: state.admissions.filter((a) => a.unitId !== UNIT) };
  state = {
    ...state,
    units: state.units.map((u) =>
      u.id !== UNIT
        ? u
        : {
            ...u,
            allocatable: { ...u.allocatable, value: 1 },
            empty: { ...u.empty, value: 1 },
            allocatableLocked: 0,
            closedBeds: [],
          },
    ),
  };
  for (let n = 0; n < 2; n++) {
    state = send(state, {
      type: "RAISE_REFERRAL",
      role: "ed",
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        gender: "Female",
        observation: GENERAL_OBSERVATION,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
    });
    const movementId = state.movements.at(-1)!.id;
    state = send(state, { type: "REFER_TO_UNITS", movementId, unitIds: [UNIT] });
    state = send(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      movementId,
      unitId: UNIT,
      ...(n === 1 ? { bedNumber: 16 } : {}),
    });
  }
  expect(state.rejections).toEqual([]);
  return state;
}
function withReferral(state: WardFlowState, movementIndex: number, linked = true) {
  const template = seedWardFlowState().referrals[0]!;
  const movement = state.movements[movementIndex]!;
  const referral = {
    ...template,
    id: "RF-RESERVATION",
    patientId: null,
    destinations: [
      {
        destination: { kind: "psychiatric_ward" as const, unitId: UNIT, secureBedNeeded: false },
        state: "accepted" as const,
        acceptedUnitId: UNIT,
        heldBedNumber: 16,
      },
    ],
  } as unknown as WardFlowState["referrals"][number];
  return {
    ...state,
    referrals: [referral],
    movements: state.movements.map((m) =>
      m.id !== movement.id
        ? m
        : { ...m, heldBedNumber: linked ? 16 : undefined, referralId: linked ? referral.id : undefined },
    ),
  };
}
function pull(state: WardFlowState, index: number) {
  return send(state, { type: "PULL_PATIENT", role: "ward", movementId: state.movements[index]!.id, unitId: UNIT });
}

describe("numbered reservations survive unrelated allocations and release completely", () => {
  it("refuses an unnumbered pull against an independent movement's reservation", () => {
    const state = accepted();
    const after = pull(state, 0);
    expect(after.rejections).toHaveLength(1);
    expect(after.admissions).toEqual(state.admissions);
    expect(pull(state, 1).rejections).toEqual([]);
  });
  it("refuses an unnumbered pull against a referral-only reservation", () => {
    const state = withReferral(accepted(), 1, false);
    expect(pull(state, 0).rejections).toHaveLength(1);
  });
  it("ordinary acceptances remain waitlisting and do not consume capacity", () => {
    const state = accepted();
    const unnumbered = { ...state, movements: state.movements.map((m) => ({ ...m, heldBedNumber: undefined })) };
    expect(pull(unnumbered, 0).rejections).toEqual([]);
  });
  it("deduplicates a linked referral reservation and permits its own pull", () => {
    const state = withReferral(accepted(), 1);
    expect(pull(state, 1).rejections).toEqual([]);
  });
  it("counts linked copies once and admissions do not count again", () => {
    let state = withReferral(accepted(), 1);
    state = {
      ...state,
      units: state.units.map((u) =>
        u.id !== UNIT ? u : { ...u, allocatable: { ...u.allocatable, value: 2 }, empty: { ...u.empty, value: 2 } },
      ),
    };
    const first = pull(state, 0);
    expect(first.rejections).toEqual([]);
    const second = pull(first, 1);
    expect(second.rejections).toEqual([]);
    expect(second.admissions.filter((a) => a.unitId === UNIT)).toHaveLength(2);
  });
  it("automatic bed-kind selection leaves another person's open reservation intact", () => {
    let state = accepted();
    state = {
      ...state,
      units: state.units.map((u) =>
        u.id !== UNIT
          ? u
          : {
              ...u,
              lockedBeds: 1,
              allocatableLocked: 1,
              allocatable: { ...u.allocatable, value: 2 },
              empty: { ...u.empty, value: 2 },
            },
      ),
    };
    const after = pull(state, 0);
    expect(after.rejections).toEqual([]);
    expect(after.admissions.find((a) => a.movementId === state.movements[0]!.id)?.bedKind).toBe("locked");
    expect(pull(after, 1).rejections).toEqual([]);
  });
  it("clears both owners on release while keeping acceptance", () => {
    const state = pull(withReferral(accepted(), 1), 1);
    expect(state.rejections).toEqual([]);
    const after = send(state, {
      type: "RELEASE_PULL",
      movementId: state.movements[1]!.id,
      reason: "bed_needed_for_another_patient",
    });
    expect(after.rejections).toEqual([]);
    expect(after.movements[1]).toMatchObject({ stage: "accepted_awaiting_bed", acceptedUnitId: UNIT });
    expect(after.movements[1]!.heldBedNumber).toBeUndefined();
    expect(after.referrals[0]!.destinations[0]!.heldBedNumber).toBeUndefined();
    expect(pull(after, 0).rejections).toEqual([]);
  });
  it("clears the updated reservation after a stay changes numbered beds", () => {
    const state = pull(withReferral(accepted(), 1), 1);
    const moved = send(state, { type: "PLACE_IN_BED", admissionId: state.movements[1]!.admissionId!, bedNumber: 21 });
    expect(moved.rejections).toEqual([]);
    const after = send(moved, {
      type: "RELEASE_PULL",
      movementId: state.movements[1]!.id,
      reason: "bed_needed_for_another_patient",
    });
    expect(after.rejections).toEqual([]);
    expect(after.movements[1]!.heldBedNumber).toBeUndefined();
    expect(after.referrals[0]!.destinations[0]!.heldBedNumber).toBeUndefined();
  });
  it("a refused release preserves both owners and all domain state", () => {
    const pulled = pull(withReferral(accepted(), 1), 1);
    const state = {
      ...pulled,
      admissions: pulled.admissions.map((a) =>
        a.movementId !== pulled.movements[1]!.id ? a : { ...a, state: "occupied" as const },
      ),
    };
    const after = send(state, {
      type: "RELEASE_PULL",
      movementId: state.movements[1]!.id,
      reason: "bed_needed_for_another_patient",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.movements).toEqual(state.movements);
    expect(after.referrals).toEqual(state.referrals);
    expect(after.admissions).toEqual(state.admissions);
    expect(after.units).toEqual(state.units);
  });
  it("withdrawal before any pull clears its linked referral reservation", () => {
    const state = withReferral(accepted(), 1);
    const after = send(state, {
      type: "WITHDRAW_ACCEPTANCE",
      movementId: state.movements[1]!.id,
      reason: "recorded_in_error",
    });
    expect(after.rejections).toEqual([]);
    expect(after.referrals[0]!.destinations[0]!.heldBedNumber).toBeUndefined();
    expect(pull(after, 0).rejections).toEqual([]);
  });
  it("planned admission conversion cannot consume a numbered reservation", () => {
    let state = accepted();
    state = send(state, {
      type: "BOOK_PLANNED_ADMISSION",
      initials: "AB",
      sex: "Female",
      gender: "Female",
      reason: "respite",
      unitId: UNIT,
      expectedArrivalAt: now + 10,
      expectedStayDays: 7,
      legalStatus: "Voluntary",
      ageBand: "Adult",
      calendarDate: "2026-11-04",
    });
    expect(state.rejections).toEqual([]);
    const after = send(state, {
      type: "CONVERT_PLANNED_ADMISSION",
      now: now + 10,
      unitId: UNIT,
      plannedAdmissionId: state.plannedAdmissions.at(-1)!.id,
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.admissions).toEqual(state.admissions);
  });
});
