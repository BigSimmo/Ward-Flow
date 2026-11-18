import { describe, expect, it } from "vitest";

import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { observationAt } from "@/components/ward-management/ward-observation";
import { acceptedAddressing } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR, allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { startsAcceptedJourneyAtEd } from "@/components/ward-management/referrals/accepted-awaiting-pull";
import { bedPullUndoEvent, startedJourneyPull } from "@/components/ward-management/ward-bed-pull-undo";
import { openEdJourneys } from "@/components/ward-management/ward-shared-figures";

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
  // A9-13: a referral made in an ED starts at that department, as the pull sheet sends it.
  const ed = startsAcceptedJourneyAtEd(referral.source)
    ? allEmergencyDepartments().find((place) => place.siteCode === referral.originSiteCode)
    : undefined;
  const event: WardFlowEvent = {
    type: "RAISE_REFERRAL",
    role: "coordinator",
    now: NOW_ANCHOR,
    ...(ed ? { edId: ed.id } : {}),
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

  it("Undo of a one-tap pull also ends the journey it started, so the counts are as before (D-262)", () => {
    const state = seedWardFlowState();
    const { event, referralId, unitId } = onePull(state);
    const before = new Set(state.movements.filter((m) => m.referralId === referralId).map(({ id }) => id));
    const waitingBefore = openEdJourneys(state.movements, NOW_ANCHOR).total;
    const awaitingBefore = acceptedReferralsAwaitingPull(state.referrals, state.units, state.movements).length;
    const pulled = wardFlowReducer(state, event);
    const target = startedJourneyPull(pulled.movements, referralId, before, unitId);
    expect(target?.startedJourney).toBe(true);
    const undone = wardFlowReducer(pulled, bedPullUndoEvent("coordinator", NOW_ANCHOR + 1, target!));
    expect(undone.rejections).toEqual(pulled.rejections);
    const journey = undone.movements.find((m) => m.id === target!.movementId);
    expect(journey?.closure?.outcome).toBe("did_not_proceed");
    expect(openEdJourneys(undone.movements, NOW_ANCHOR + 1).total).toBe(waitingBefore);
    const awaiting = acceptedReferralsAwaitingPull(undone.referrals, undone.units, undone.movements);
    expect(awaiting).toHaveLength(awaitingBefore);
    expect(awaiting.some((item) => item.referral.id === referralId)).toBe(true);
    // The referral can be pulled again after the Undo.
    const again = wardFlowReducer(undone, { ...event, now: NOW_ANCHOR + 2 } as WardFlowEvent);
    expect(again.rejections).toEqual(undone.rejections);
  });

  it("an Undo of a pull on a journey already on the board still leaves the journey open", () => {
    const state = seedWardFlowState();
    const { event, referralId, unitId } = onePull(state);
    const before = new Set<string>();
    const pulled = wardFlowReducer(state, event);
    const target = startedJourneyPull(pulled.movements, referralId, before, unitId)!;
    const plain = { movementId: target.movementId, unitId: target.unitId, stageIndex: target.stageIndex };
    const undone = wardFlowReducer(pulled, bedPullUndoEvent("coordinator", NOW_ANCHOR + 1, plain));
    const journey = undone.movements.find((m) => m.id === target.movementId);
    expect(journey?.closure).toBeUndefined();
    expect(journey?.stage).toBe("accepted_awaiting_bed");
  });
});
