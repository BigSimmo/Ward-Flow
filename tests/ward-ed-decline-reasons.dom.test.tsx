import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { edDepartmentTimelineEvents } from "../src/components/ward-management/ed/ed-screen-timeline";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { scopeWardFlowState } from "../src/components/ward-management/ward-access-state";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Movement, Referral } from "../src/components/ward-management/ward-model";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";
import { GENERAL_OBSERVATION } from "../src/components/ward-management/ward-observation";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/** D-80: other wards' decline reasons stay with the coordinator; an ED sees only that a ward declined. */
const state = seedWardFlowState();
const places = wardPlaceLookup(state.units);
const options = { now: NOW_ANCHOR, places };
const journey = state.movements.find((movement) => movement.originEdId !== undefined)!;
const edId = journey.originEdId!;
const ed: WardAccess = { role: "ed", scope: { kind: "ed", edId } };
const coordinator: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };
const [declined, waitlisted] = state.units;

function withAnswers(): WardFlowState {
  const movement: Movement = {
    ...journey,
    declines: [
      { unitId: declined.id, at: NOW_ANCHOR - 20, reason: "acuity_mix" },
      { unitId: waitlisted.id, at: NOW_ANCHOR - 10, reason: "no_suitable_bed" },
    ],
  };
  const referral = state.referrals.find((candidate) =>
    candidate.destinations.some((line) => line.destination.kind === "psychiatric_ward"),
  )!;
  const answered: Referral = {
    ...referral,
    destinations: referral.destinations.map((line) =>
      line.destination.kind === "psychiatric_ward"
        ? { ...line, state: "declined", decidedAt: NOW_ANCHOR - 5, declineReason: "secure_bed_unavailable" }
        : line,
    ),
  };
  return {
    ...state,
    movements: state.movements.map((candidate) =>
      candidate.id === journey.id ? { ...movement, referralId: referral.id } : candidate,
    ),
    referrals: state.referrals.map((candidate) => (candidate.id === referral.id ? answered : candidate)),
  };
}

describe("ED decline reasons kept to the coordinator (D-80)", () => {
  it("drops a ward's reason from an ED's copy and keeps a waitlist answer", () => {
    const world = withAnswers();
    const copy = scopeWardFlowState(world, ed, options).state;
    const movement = copy.movements.find((candidate) => candidate.id === journey.id)!;
    expect(movement.declines).toEqual([
      { unitId: declined.id, at: NOW_ANCHOR - 20 },
      { unitId: waitlisted.id, at: NOW_ANCHOR - 10, reason: "no_suitable_bed" },
    ]);
    const referral = copy.referrals.find((candidate) => candidate.id === movement.referralId)!;
    const wardLines = referral.destinations.filter((line) => line.destination.kind === "psychiatric_ward");
    expect(wardLines.length).toBeGreaterThan(0);
    expect(wardLines.every((line) => line.state === "declined" && line.declineReason === undefined)).toBe(true);
    // The browser scopes the server's copy again without change.
    expect(scopeWardFlowState(copy, ed, options).state.movements).toEqual(copy.movements);
    // The coordinator keeps every reason, and the stored record is untouched.
    const whole = scopeWardFlowState(world, coordinator, options).state;
    expect(whole.movements.find((candidate) => candidate.id === journey.id)!.declines[0].reason).toBe("acuity_mix");
    expect(world.movements.find((candidate) => candidate.id === journey.id)!.declines[0].reason).toBe("acuity_mix");
  });

  it("shows the ED's timeline a decline without a reason", () => {
    const copy = scopeWardFlowState(withAnswers(), ed, options).state;
    const events = edDepartmentTimelineEvents({
      movements: copy.movements,
      units: copy.units,
      referrals: copy.referrals,
      registryPatients: copy.patients,
      thisEdId: edId,
      now: NOW_ANCHOR,
    });
    const text = events
      .filter((event) => (event.id ?? "").startsWith(`decline-${journey.id}-`))
      .map((event) => renderToStaticMarkup(<>{event.what}</>));
    expect(text).toHaveLength(2);
    expect(text.find((line) => line.includes(declined.name))).toMatch(/declined$/);
    expect(text.join(" ")).not.toMatch(/acuity/i);
  });

  it("keeps the reason out of the stage change and notice a reducer decline writes", () => {
    const raised = wardFlowReducer(seedWardFlowState(), {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW_ANCHOR,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Secure",
        sex: "Male",
        gender: "Male",
        observation: GENERAL_OBSERVATION,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
    });
    const movementId = raised.movements[raised.movements.length - 1].id;
    const referred = wardFlowReducer(raised, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId,
      unitIds: ["rph-adult-secure"],
    });
    const world = wardFlowReducer(referred, {
      type: "DECLINE",
      role: "ward",
      now: NOW_ANCHOR + 1,
      movementId,
      unitId: "rph-adult-secure",
      reason: "belongs_to_another_service",
    });
    expect(world.rejections).toHaveLength(0);
    const edAccess: WardAccess = { role: "ed", scope: { kind: "ed", edId: "jhc-ed" } };
    const copy = scopeWardFlowState(world, edAccess, {
      now: NOW_ANCHOR + 1,
      places: wardPlaceLookup(world.units),
    }).state;
    const movement = copy.movements.find((candidate) => candidate.id === movementId)!;
    expect(movement.declines.every((decline) => decline.reason === undefined)).toBe(true);
    expect(movement.stageChanges.some((change) => change.reason === "belongs_to_another_service")).toBe(false);
    const declinedNotices = copy.notices.filter((notice) => notice.kind === "referral_declined");
    expect(declinedNotices.length).toBeGreaterThan(0);
    expect(JSON.stringify(copy)).not.toMatch(/belongs.to.another.service/i);
    // The coordinator's whole view still carries the reason.
    expect(JSON.stringify(world)).toMatch(/belongs_to_another_service/);
  });
});
