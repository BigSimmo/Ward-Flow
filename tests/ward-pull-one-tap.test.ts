import { describe, expect, it } from "vitest";

import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { observationAt } from "@/components/ward-management/ward-observation";
import { acceptedAddressing } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * WT-08 (walk-through, 26 Oct 2026; Josh approved one tap): the first Pull the bed tap started the
 * journey before the confirm step, so cancelling left a half-started journey. One event now starts
 * the journey and pulls its bed, and a refused pull starts nothing. Synthetic seed only.
 */
function onePull(state: WardFlowState): { event: WardFlowEvent; referralId: string; unitId: string } {
  const [item] = acceptedReferralsAwaitingPull(state.referrals, state.units, state.movements);
  expect(item).toBeDefined();
  const { referral, unitId } = item!;
  const accepted = acceptedAddressing(referral)!;
  const destination = accepted.destination;
  if (destination.kind !== "psychiatric_ward") throw new Error("seed referral was not accepted at a ward");
  const event: WardFlowEvent = {
    type: "RAISE_REFERRAL",
    role: "coordinator",
    now: NOW_ANCHOR,
    referralId: referral.id,
    acceptedUnitId: unitId,
    pullBed: true,
    draft: {
      cohort: referral.ageBand!,
      security: destination.secureBedNeeded ? "Secure" : "Open",
      sex: destination.sex,
      gender: destination.gender,
      highAcuity: destination.highAcuityNursingNeeded === true,
      observation: observationAt("general"),
      legalStatus: "Voluntary",
      legalFormCode: null,
      urgency: referral.urgency,
      atsCategory: referral.atsCategory,
    },
  };
  return { event, referralId: referral.id, unitId };
}

describe("Pull the bed is one tap (WT-08)", () => {
  it("starts the journey and pulls the bed at the ward that accepted in one event", () => {
    const state = seedWardFlowState();
    const { event, referralId, unitId } = onePull(state);
    const next = wardFlowReducer(state, event);
    expect(next.rejections).toEqual(state.rejections);
    const journey = next.movements.find((movement) => movement.referralId === referralId);
    expect(journey?.stage).toBe("pulled");
    expect(journey?.acceptedUnitId).toBe(unitId);
  });

  it("starts nothing when the pull is refused, and says why", () => {
    const seeded = seedWardFlowState();
    const { event, referralId, unitId } = onePull(seeded);
    // No bed is offered at the accepting ward, so the pull is refused.
    const state: WardFlowState = {
      ...seeded,
      units: seeded.units.map((unit) =>
        unit.id === unitId ? { ...unit, allocatable: { ...unit.allocatable, value: 0 } } : unit,
      ),
    };
    const next = wardFlowReducer(state, event);
    expect(next.movements).toEqual(state.movements);
    expect(next.movements.some((movement) => movement.referralId === referralId)).toBe(false);
    expect(next.rejections).toHaveLength(state.rejections.length + 1);
    expect(next.rejections.at(-1)?.attempted).toBe("RAISE_REFERRAL");
    expect(next.rejections.at(-1)?.reason).toMatch(/no Ready bed/u);
  });
});
