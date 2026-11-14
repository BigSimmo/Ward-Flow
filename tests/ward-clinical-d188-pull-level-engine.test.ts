import { describe, expect, it } from "vitest";

import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { startsAcceptedJourneyAtEd } from "@/components/ward-management/referrals/accepted-awaiting-pull";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { observationEditingToken } from "@/components/ward-management/ward-flow-observation-events";
import type { Movement } from "@/components/ward-management/ward-model";
import {
  NOT_RECORDED_OBSERVATION,
  PULL_NEEDS_OBSERVATION_LEVEL,
  observationAt,
} from "@/components/ward-management/ward-observation";
import { acceptedAddressing } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR, allEmergencyDepartments } from "@/components/ward-management/ward-sites";

/**
 * D-188, tightened to every pull (Josh, 13 Nov 2026): the engine refuses a bed pull that would leave
 * the observation level "Not recorded". Recording a level first (the existing
 * RECORD_OBSERVATION_LEVEL on the movement) lets the same pull through. Synthetic seed only; no
 * clinical value is involved, and the level used here is only a recorded choice.
 */

/** A seeded journey waiting for its bed whose pull the engine accepts as seeded. */
function pullableJourney(state: WardFlowState): Movement {
  for (const movement of state.movements) {
    if (movement.closure || movement.stage !== "accepted_awaiting_bed" || !movement.acceptedUnitId) continue;
    const pulled = wardFlowReducer(state, pullEvent(movement));
    if (pulled.movements.find(({ id }) => id === movement.id)?.stage === "pulled") return movement;
  }
  throw new Error("the seed has no journey whose pull is accepted");
}

function pullEvent(movement: Movement, now = NOW_ANCHOR): WardFlowEvent {
  return {
    type: "PULL_PATIENT",
    role: "coordinator",
    now,
    movementId: movement.id,
    unitId: movement.acceptedUnitId!,
  };
}

function withLevelNotRecorded(state: WardFlowState, movementId: string): WardFlowState {
  return {
    ...state,
    movements: state.movements.map((movement) =>
      movement.id === movementId
        ? { ...movement, observation: { ...NOT_RECORDED_OBSERVATION }, observationChanges: undefined }
        : movement,
    ),
  };
}

function recordLevel(state: WardFlowState, movementId: string, now = NOW_ANCHOR): WardFlowState {
  const movement = state.movements.find(({ id }) => id === movementId)!;
  return wardFlowReducer(state, {
    type: "RECORD_OBSERVATION_LEVEL",
    role: "coordinator",
    now,
    target: { kind: "movement", movementId },
    observation: observationAt("general"),
    expected: observationEditingToken(
      "movement",
      movement.id,
      movement.observation,
      movement.observationChanges?.length ?? 0,
    ),
  });
}

describe("D-188: the engine refuses a pull with no observation level", () => {
  it("refuses PULL_PATIENT while the level is Not recorded, and changes nothing else", () => {
    const seeded = seedWardFlowState();
    const journey = pullableJourney(seeded);
    const state = withLevelNotRecorded(seeded, journey.id);
    const next = wardFlowReducer(state, pullEvent(journey));
    expect(next.rejections).toHaveLength(state.rejections.length + 1);
    expect(next.rejections.at(-1)).toMatchObject({ attempted: "PULL_PATIENT", reason: PULL_NEEDS_OBSERVATION_LEVEL });
    expect(next.movements).toEqual(state.movements);
    expect(next.admissions).toEqual(state.admissions);
    expect(next.units).toEqual(state.units);
  });

  it("names the fix in plain words", () => {
    expect(PULL_NEEDS_OBSERVATION_LEVEL).toBe(
      "No observation level is recorded. Record an observation level before pulling the bed.",
    );
  });

  it("accepts the same pull once RECORD_OBSERVATION_LEVEL is accepted, and the bed carries that level", () => {
    const seeded = seedWardFlowState();
    const journey = pullableJourney(seeded);
    const recorded = recordLevel(withLevelNotRecorded(seeded, journey.id), journey.id);
    expect(recorded.rejections).toHaveLength(seeded.rejections.length);
    const next = wardFlowReducer(recorded, pullEvent(journey, NOW_ANCHOR + 1));
    expect(next.rejections).toHaveLength(recorded.rejections.length);
    const pulled = next.movements.find(({ id }) => id === journey.id)!;
    expect(pulled.stage).toBe("pulled");
    const stay = next.admissions.find(({ id }) => id === pulled.admissionId);
    expect(stay?.state).toBe("pulled");
    expect(stay?.observation.level).toBe("general");
  });

  it("a refused record pulls nothing: the pull after it is still refused", () => {
    const seeded = seedWardFlowState();
    const journey = pullableJourney(seeded);
    const state = withLevelNotRecorded(seeded, journey.id);
    // A stale editing token is refused, so no level is recorded.
    const refused = wardFlowReducer(state, {
      type: "RECORD_OBSERVATION_LEVEL",
      role: "coordinator",
      now: NOW_ANCHOR,
      target: { kind: "movement", movementId: journey.id },
      observation: observationAt("general"),
      expected: "stale",
    });
    expect(refused.rejections.at(-1)?.attempted).toBe("RECORD_OBSERVATION_LEVEL");
    const next = wardFlowReducer(refused, pullEvent(journey));
    expect(next.rejections.at(-1)?.reason).toBe(PULL_NEEDS_OBSERVATION_LEVEL);
    expect(next.movements.find(({ id }) => id === journey.id)?.stage).toBe("accepted_awaiting_bed");
  });

  it("refuses restoring a held bed to pulled while the level is Not recorded", () => {
    const seeded = seedWardFlowState();
    const journey = pullableJourney(seeded);
    const pulled = wardFlowReducer(seeded, pullEvent(journey));
    // A step back keeps the bed and its admission (rulings E/F); the next pull restores it.
    const steppedBack = wardFlowReducer(pulled, {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now: NOW_ANCHOR + 1,
      movementId: journey.id,
      to: "accepted_awaiting_bed",
      reason: "the_decision_changed",
    });
    const held = steppedBack.movements.find(({ id }) => id === journey.id)!;
    expect(held.stage).toBe("accepted_awaiting_bed");
    expect(held.admissionId).toBeDefined();
    const state = withLevelNotRecorded(steppedBack, journey.id);
    const next = wardFlowReducer(state, pullEvent(journey, NOW_ANCHOR + 2));
    expect(next.rejections.at(-1)?.reason).toBe(PULL_NEEDS_OBSERVATION_LEVEL);
    expect(next.movements.find(({ id }) => id === journey.id)?.stage).toBe("accepted_awaiting_bed");
  });

  it("refuses the one-tap start-and-pull (RAISE_REFERRAL with pullBed) with no level, starting nothing", () => {
    const state = seedWardFlowState();
    const [item] = acceptedReferralsAwaitingPull(state.referrals, state.units, state.movements);
    expect(item).toBeDefined();
    const { referral, unitId } = item!;
    const destination = acceptedAddressing(referral)!.destination;
    if (destination.kind !== "psychiatric_ward") throw new Error("seed referral was not accepted at a ward");
    const ed = startsAcceptedJourneyAtEd(referral.source)
      ? allEmergencyDepartments().find((place) => place.siteCode === referral.originSiteCode)
      : undefined;
    const raise = (observation: typeof NOT_RECORDED_OBSERVATION): WardFlowEvent => ({
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
        observation,
        legalStatus: "Voluntary",
        legalFormCode: null,
        urgency: referral.urgency,
        atsCategory: referral.atsCategory,
      },
    });
    const refused = wardFlowReducer(state, raise({ ...NOT_RECORDED_OBSERVATION }));
    expect(refused.movements).toEqual(state.movements);
    expect(refused.rejections.at(-1)).toMatchObject({
      attempted: "RAISE_REFERRAL",
      reason: PULL_NEEDS_OBSERVATION_LEVEL,
    });
    const accepted = wardFlowReducer(state, raise(observationAt("general")));
    expect(accepted.movements.find((movement) => movement.referralId === referral.id)?.stage).toBe("pulled");
  });
});
