import { describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  seedWardFlowStateAt,
  wardFlowReducer,
  type WardFlowState,
} from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { waitlistStands } from "@/components/ward-management/ward-waitlist";

const UNIT = "unit-under-test";

function bareMovement(): Movement {
  const movement = seedWardFlowStateAt(0).movements[0];
  if (!movement) throw new Error("expected a seeded movement");
  return {
    ...movement,
    referredUnitIds: [],
    waitlistedUnitIds: [],
    declines: [],
    withdrawnReferrals: [],
    referralAnswerHistory: undefined,
  };
}

describe("waitlistStands", () => {
  it("is false when the ward never waitlisted the person", () => {
    expect(waitlistStands(bareMovement(), UNIT)).toBe(false);
  });

  it("holds while the waitlist answer is the latest word from the ward", () => {
    const movement: Movement = {
      ...bareMovement(),
      waitlistedUnitIds: [UNIT],
      declines: [{ unitId: UNIT, at: 1_000, reason: "no_bed" }],
    };
    expect(waitlistStands(movement, UNIT)).toBe(true);
  });

  it("ends when the referral to that ward is withdrawn after the waitlist answer", () => {
    const movement: Movement = {
      ...bareMovement(),
      waitlistedUnitIds: [UNIT],
      declines: [{ unitId: UNIT, at: 1_000, reason: "no_bed" }],
      withdrawnReferrals: [{ unitId: UNIT, at: 2_000, reason: "coordinator_withdrew" }],
    };
    expect(waitlistStands(movement, UNIT)).toBe(false);
  });

  it("holds again when the ward waitlists a later re-referral", () => {
    const movement: Movement = {
      ...bareMovement(),
      waitlistedUnitIds: [UNIT],
      declines: [
        { unitId: UNIT, at: 1_000, reason: "no_bed" },
        { unitId: UNIT, at: 3_000, reason: "bed_pulled_for_earlier_referral" },
      ],
      withdrawnReferrals: [{ unitId: UNIT, at: 2_000, reason: "coordinator_withdrew" }],
    };
    expect(waitlistStands(movement, UNIT)).toBe(true);
  });

  it("does not count a same-minute ordinary decline after waitlisting", () => {
    const movement: Movement = {
      ...bareMovement(),
      waitlistedUnitIds: [UNIT],
      declines: [
        { unitId: UNIT, at: 1_000, reason: "no_bed" },
        { unitId: UNIT, at: 2_000, reason: "out_of_catchment" },
      ],
      referralAnswerHistory: [
        { unitId: UNIT, at: 1_000, answer: "waitlisted" },
        { unitId: UNIT, at: 2_000, answer: "declined" },
      ],
    };
    expect(waitlistStands(movement, UNIT)).toBe(false);
  });

  it("counts a same-minute re-waitlist after an ending answer", () => {
    const movement: Movement = {
      ...bareMovement(),
      waitlistedUnitIds: [UNIT],
      declines: [
        { unitId: UNIT, at: 1_000, reason: "no_bed" },
        { unitId: UNIT, at: 2_000, reason: "out_of_catchment" },
      ],
      withdrawnReferrals: [{ unitId: UNIT, at: 2_000, reason: "coordinator_withdrew" }],
      referralAnswerHistory: [
        { unitId: UNIT, at: 1_000, answer: "waitlisted" },
        { unitId: UNIT, at: 2_000, answer: "withdrawn" },
        { unitId: UNIT, at: 2_000, answer: "waitlisted" },
      ],
    };
    expect(waitlistStands(movement, UNIT)).toBe(true);
  });

  it("ends a same minute withdrawal and re-referral, which leaves no fresh waitlist answer", () => {
    const movement: Movement = {
      ...bareMovement(),
      referredUnitIds: [UNIT],
      waitlistedUnitIds: [UNIT],
      declines: [{ unitId: UNIT, at: 1_000, reason: "no_bed" }],
      withdrawnReferrals: [{ unitId: UNIT, at: 1_000, reason: "coordinator_withdrew" }],
      referralAnswerHistory: [
        { unitId: UNIT, at: 1_000, answer: "waitlisted" },
        { unitId: UNIT, at: 1_000, answer: "withdrawn" },
      ],
    };
    expect(waitlistStands(movement, UNIT)).toBe(false);
  });

  it("ends when a later withdrawal was written without an answer history entry", () => {
    const movement: Movement = {
      ...bareMovement(),
      waitlistedUnitIds: [UNIT],
      declines: [{ unitId: UNIT, at: 1_000, reason: "no_bed" }],
      withdrawnReferrals: [{ unitId: UNIT, at: 2_000, reason: "referrer_withdrew" }],
      referralAnswerHistory: [{ unitId: UNIT, at: 1_000, answer: "waitlisted" }],
    };
    expect(waitlistStands(movement, UNIT)).toBe(false);
  });

  describe("records from before the answer history", () => {
    it("ends when the withdrawal lands in the same minute as the waitlist answer", () => {
      const movement: Movement = {
        ...bareMovement(),
        waitlistedUnitIds: [UNIT],
        declines: [{ unitId: UNIT, at: 1_000, reason: "no_bed" }],
        withdrawnReferrals: [{ unitId: UNIT, at: 1_000, reason: "coordinator_withdrew" }],
      };
      expect(waitlistStands(movement, UNIT)).toBe(false);
    });

    it("holds when a same minute waitlist answer leaves the referral live", () => {
      const movement: Movement = {
        ...bareMovement(),
        referredUnitIds: [UNIT],
        waitlistedUnitIds: [UNIT],
        declines: [
          { unitId: UNIT, at: 1_000, reason: "no_bed" },
          { unitId: UNIT, at: 2_000, reason: "no_bed" },
        ],
        withdrawnReferrals: [{ unitId: UNIT, at: 2_000, reason: "coordinator_withdrew" }],
      };
      expect(waitlistStands(movement, UNIT)).toBe(true);
    });
  });

  it("ends through the reducer when the ward is waitlisted and withdrawn in the same minute", () => {
    const seeded = seedWardFlowState();
    const unit = seeded.units[0];
    const source = seeded.movements.find((movement) => !movement.closure);
    if (!unit || !source) throw new Error("expected a seeded ward and open movement");
    const movementId = "WF-WAITLIST-SAME-MINUTE";
    let state: WardFlowState = {
      ...seeded,
      movements: [
        ...seeded.movements,
        {
          ...source,
          id: movementId,
          stage: "destination_review",
          referredUnitIds: [unit.id],
          acceptedUnitId: undefined,
          admissionId: undefined,
          declines: [],
          withdrawnReferrals: [],
          waitlistedUnitIds: undefined,
          referralAnswerHistory: undefined,
          closure: undefined,
        },
      ],
    };
    state = wardFlowReducer(state, {
      type: "DECLINE",
      role: "ward",
      now: NOW_ANCHOR,
      movementId,
      unitId: unit.id,
      reason: "no_bed",
    });
    const waitlisted = state.movements.find((movement) => movement.id === movementId)!;
    expect(waitlistStands(waitlisted, unit.id)).toBe(true);
    state = wardFlowReducer(state, {
      type: "WITHDRAW_WARD_REQUEST",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId,
      unitId: unit.id,
      reason: "another_reason",
    });
    expect(state.rejections).toEqual([]);
    const withdrawn = state.movements.find((movement) => movement.id === movementId)!;
    expect(withdrawn.waitlistedUnitIds).toEqual([unit.id]);
    expect(waitlistStands(withdrawn, unit.id)).toBe(false);
  });
});

describe("restoring a saved answer history", () => {
  function savedWithHistory(history: unknown): unknown {
    const state = JSON.parse(JSON.stringify(seedWardFlowState())) as { movements: Record<string, unknown>[] };
    const [first] = state.movements;
    if (!first) throw new Error("expected a seeded movement");
    first.referralAnswerHistory = history;
    return state;
  }

  it("accepts a well formed history", () => {
    expect(isValidStoredWardFlowState(savedWithHistory([{ unitId: UNIT, at: NOW_ANCHOR, answer: "waitlisted" }]))).toBe(
      true,
    );
  });

  it("refuses a history that is not a list of answers", () => {
    expect(isValidStoredWardFlowState(savedWithHistory("waitlisted"))).toBe(false);
    expect(isValidStoredWardFlowState(savedWithHistory({ unitId: UNIT }))).toBe(false);
    expect(isValidStoredWardFlowState(savedWithHistory([{ unitId: UNIT, at: NOW_ANCHOR }]))).toBe(false);
    expect(isValidStoredWardFlowState(savedWithHistory([{ unitId: UNIT, at: NOW_ANCHOR, answer: "maybe" }]))).toBe(
      false,
    );
  });
});
