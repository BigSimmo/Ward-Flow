import { describe, expect, it } from "vitest";

import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  STAGE_TRANSITION_BLOCKERS,
  wardFlowReducer,
} from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * TASK-L3-06 (8 Nov 2026): every event that ends a movement's bed search without the patient
 * arriving goes through one shared close step, so each leaves the closed movement in the same shape:
 * no ward, admission or held bed; every live ward request withdrawn with its cause; a booked job
 * cancelled; nothing left blocking. Synthetic seed data only.
 */
const MOVEMENT = "WF-002";
const NOW = NOW_ANCHOR + 1;

/** WF-002 with a booked job, and its referral (RF-012) still waiting on the ward WF-002 asked. */
function withBookedJob(): WardFlowState {
  const seed = seedWardFlowState();
  const movement = seed.movements.find((entry) => entry.id === MOVEMENT)!;
  return {
    ...seed,
    referrals: seed.referrals.map((referral) =>
      referral.id === movement.referralId
        ? {
            ...referral,
            destinations: [
              {
                state: "queued",
                destination: {
                  kind: "psychiatric_ward",
                  unitId: movement.referredUnitIds[0],
                  sex: "Female",
                  secureBedNeeded: false,
                  involuntaryBedNeeded: false,
                  highAcuityNursingNeeded: false,
                },
              },
            ],
          }
        : referral,
    ),
    movements: seed.movements.map((movement) =>
      movement.id === MOVEMENT
        ? ({
            ...movement,
            transport: { id: "TR-SYN-L306", provider: "Patient transport service", escortRequired: false },
          } as typeof movement)
        : movement,
    ),
  };
}

const team = communityTeamOptions()[0]!;
const ENDINGS: [string, WardFlowEvent, string][] = [
  [
    "RECORD_ED_OUTCOME",
    {
      type: "RECORD_ED_OUTCOME",
      role: "coordinator",
      now: NOW,
      movementId: MOVEMENT,
      outcome: "for_discharge",
    } as WardFlowEvent,
    "ed_outcome_recorded",
  ],
  [
    "REFER_TO_COMMUNITY_TEAM",
    { type: "REFER_TO_COMMUNITY_TEAM", role: "coordinator", now: NOW, movementId: MOVEMENT, team } as WardFlowEvent,
    "ed_outcome_recorded",
  ],
  [
    "WITHDRAW_REFERRAL",
    { type: "WITHDRAW_REFERRAL", role: "coordinator", now: NOW, movementId: MOVEMENT } as WardFlowEvent,
    "coordinator_withdrew",
  ],
  [
    "RECORD_REFERRER_WITHDRAWAL",
    { type: "RECORD_REFERRER_WITHDRAWAL", role: "coordinator", now: NOW, referralId: "RF-012" } as WardFlowEvent,
    "referrer_withdrew",
  ],
];

describe("shared movement close step (TASK-L3-06)", () => {
  it.each(ENDINGS)("%s leaves the closed movement in the shared shape", (_name, event, cause) => {
    const state = withBookedJob();
    const before = state.movements.find((movement) => movement.id === MOVEMENT)!;
    expect(before.referredUnitIds.length).toBeGreaterThan(0);
    const next = wardFlowReducer(state, event);
    expect(next.rejections.slice(state.rejections.length)).toEqual([]);
    const closed = next.movements.find((movement) => movement.id === MOVEMENT)!;
    expect(closed.closure).toMatchObject({ at: NOW, outcome: "did_not_proceed" });
    expect(closed.blocker).toBe(STAGE_TRANSITION_BLOCKERS.didNotProceed);
    expect(closed.acceptedUnitId).toBeUndefined();
    expect(closed.admissionId).toBeUndefined();
    expect(closed.heldBedNumber).toBeUndefined();
    expect(closed.referredUnitIds).toEqual([]);
    expect(closed.transport?.cancelledAt).toBe(NOW);
    const ended = before.referredUnitIds.map((unitId) => ({ unitId, at: NOW, reason: cause }));
    expect(closed.withdrawnReferrals).toEqual([...before.withdrawnReferrals, ...ended]);
    expect(closed.referralAnswerHistory).toEqual([
      ...(before.referralAnswerHistory ?? []),
      ...before.referredUnitIds.map((unitId) => ({ unitId, at: NOW, answer: "withdrawn" })),
    ]);
  });
});
