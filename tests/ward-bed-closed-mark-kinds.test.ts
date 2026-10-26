import { describe, expect, it } from "vitest";

import { lockedBedsFree, openBedsFree } from "@/components/ward-management/ward-bed-designation";
import { OVERRIDE_REASONS, RELEASE_PULL_REASONS } from "@/components/ward-management/ward-change-reasons";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { GENERAL_OBSERVATION } from "@/components/ward-management/ward-observation";
import { wardStaySeats } from "@/components/ward-management/ward/ward-bed-layout";

/**
 * H-0978 / WS-15 review (PR #858): a bed closed by number on a MIXED ward.
 *
 * 1. It comes off the free figure of its own kind, so closing the last free locked bed stops a Secure
 *    pull being taken as a locked bed (Codex P1).
 * 2. Automatic seating never puts a new stay in a closed bed (Codex P1).
 * 3. The reducer's "is someone in this bed" replay reads the released pull spans the Bed board reads,
 *    so a bed the board shows Ready can be closed (Codex P2).
 *
 * `bty-adult-secure` widened as `tests/ward-bed-kind-pull.test.ts` widens it: 20 beds, 1 to 4
 * locked, five free of which two are locked, and no stays, so a refusal is on the fact under test.
 * Synthetic seeded state only.
 */
const UNIT_ID = "bty-adult-secure";
const NOW = 11 * 60 + 5;

function staged(source: Movement, id: Movement["id"]): Movement {
  return {
    ...source,
    id,
    highAcuity: false,
    observation: GENERAL_OBSERVATION,
    stage: "accepted_awaiting_bed",
    acceptedUnitId: UNIT_ID,
    referredUnitIds: [],
    declines: [],
    closure: undefined,
    transport: undefined,
    pullExpiresAt: undefined,
    admissionId: undefined,
    examination: undefined,
  };
}

function bench(): WardFlowState {
  const seeded = seedWardFlowState();
  const base = seeded.units.find((candidate) => candidate.id === UNIT_ID)!;
  const unit: Unit = {
    ...base,
    beds: 20,
    lockedBeds: 4,
    empty: { ...base.empty, value: 5, confirmedAt: NOW },
    allocatable: { ...base.allocatable, value: 5, confirmedAt: NOW },
    allocatableLocked: 2,
  };
  const of = (security: Movement["security"]) =>
    seeded.movements.filter((candidate) => candidate.cohort === unit.cohort && candidate.security === security);
  return {
    ...seeded,
    units: seeded.units.map((candidate) => (candidate.id === UNIT_ID ? unit : candidate)),
    movements: [
      staged(of("Open")[0]!, "WF-BC-OPEN"),
      staged(of("Secure")[0]!, "WF-BC-SEC-A"),
      staged(of("Secure")[1]!, "WF-BC-SEC-B"),
    ],
    referrals: [],
    admissions: seeded.admissions.filter((admission) => admission.unitId !== UNIT_ID),
    bedReleases: seeded.bedReleases.filter((release) => release.unitId !== UNIT_ID),
    rejections: [],
  };
}

const unitIn = (state: WardFlowState) => state.units.find((candidate) => candidate.id === UNIT_ID)!;
const close = (state: WardFlowState, bedNumber: number, now = NOW) =>
  wardFlowReducer(state, {
    type: "SET_BED_CLOSED",
    role: "ward",
    now,
    unitId: UNIT_ID,
    actingUnitId: UNIT_ID,
    bedNumber,
    closed: true,
  });
const pull = (
  state: WardFlowState,
  movementId: string,
  now = NOW,
  overrideReason?: (typeof OVERRIDE_REASONS)[number],
) => wardFlowReducer(state, { type: "PULL_PATIENT", role: "ward", now, movementId, unitId: UNIT_ID, overrideReason });
const admissionOf = (state: WardFlowState, movementId: string) =>
  state.admissions.find((admission) => admission.id === state.movements.find((m) => m.id === movementId)?.admissionId)!;

describe("a bed closed by number on a mixed ward", () => {
  it("comes off its own kind, so closing the last free locked beds stops a Secure pull taking a locked bed", () => {
    let state = bench();
    expect(lockedBedsFree(unitIn(state))).toBe(2);
    state = close(close(state, 3), 4);
    expect(state.rejections).toEqual([]);
    expect(lockedBedsFree(unitIn(state))).toBe(0);
    expect(openBedsFree(unitIn(state))).toBe(3);

    const refused = pull(state, "WF-BC-SEC-A");
    expect(refused.rejections.at(-1)?.reason).toMatch(/No locked bed is free/);
    const overridden = pull(state, "WF-BC-SEC-A", NOW, OVERRIDE_REASONS[0]);
    expect(overridden.rejections).toEqual([]);
    expect(admissionOf(overridden, "WF-BC-SEC-A").bedKind).toBe("open");
  });

  it("never seats a new stay in a closed bed", () => {
    // Open stays on a mixed ward take the open beds first, so bed 5 is the next automatic seat.
    let state = close(bench(), 5);
    expect(state.rejections).toEqual([]);
    state = pull(state, "WF-BC-OPEN");
    expect(state.rejections).toEqual([]);
    const seat = wardStaySeats(unitIn(state), state.admissions).get(admissionOf(state, "WF-BC-OPEN").id);
    expect(seat).toBe(6);
    // The reducer agrees: bed 6 is taken, and bed 5 is still closed and free of anybody.
    expect(close(state, 6).rejections.at(-1)?.reason).toMatch(/has someone in it/);
  });

  it("reads released pull spans as the Bed board does, so a bed shown Ready can be closed", () => {
    let state = pull(bench(), "WF-BC-SEC-A");
    state = pull(state, "WF-BC-SEC-B", NOW + 1);
    expect(state.rejections).toEqual([]);
    const seatB = () => wardStaySeats(unitIn(state), state.admissions).get(admissionOf(state, "WF-BC-SEC-B").id);
    expect(seatB()).toBe(2);
    state = wardFlowReducer(state, {
      type: "RELEASE_PULL",
      role: "coordinator",
      now: NOW + 5,
      movementId: "WF-BC-SEC-A",
      reason: RELEASE_PULL_REASONS[0],
    });
    expect(state.rejections).toEqual([]);
    expect(unitIn(state).releasedPullSpans?.length).toBe(1);
    // B keeps bed 2, so bed 1 is the empty one the board shows Ready, and it can be closed.
    expect(seatB()).toBe(2);
    const closed = close(state, 1, NOW + 6);
    expect(closed.rejections).toEqual([]);
    expect(unitIn(closed).closedBeds?.map((mark) => mark.bedNumber)).toEqual([1]);
  });
});
