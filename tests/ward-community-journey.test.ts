import { describe, expect, it } from "vitest";
import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { commandScopeRefusal } from "@/components/ward-management/ward-access-state";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { isValidSharedWardFlowState } from "@/components/ward-management/ward-shared-state-validation";
import { isEdOriginJourney } from "@/components/ward-management/ward-ed-presence";
import { movementOriginLabel } from "@/components/ward-management/ward-movement-origin";
import { defaultPickupSiteCode } from "@/components/ward-management/patients/transport-pickup";
import { NOW_ANCHOR, allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { GENERAL_OBSERVATION } from "@/components/ward-management/ward-observation";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * D-76 item 1 (fix plan item 15): an accepted community referral starts a full journey at the
 * referring team, with no ED. It can be pulled, moved and arrived like any other journey.
 */

const now = NOW_ANCHOR;
const UNIT_ID = "scgh-adult-open";
const TEAM_NAME = communityTeamById("midland")!.name;
const ORIGIN_SITE = "RPH";

/** As the shared store reads it: through JSON, so an absent field is absent, not `undefined`. */
const validOnTheWire = (value: WardFlowState) => isValidSharedWardFlowState(JSON.parse(JSON.stringify(value)));

function apply(state: WardFlowState, event: WardFlowEvent) {
  const next = wardFlowReducer(state, event);
  expect(next.rejections.at(-1) === state.rejections.at(-1), next.rejections.at(-1)?.reason).toBe(true);
  return next;
}

function acceptedCommunityReferral(source: "community" | "ed_medical" = "community", transportNeeded = true) {
  let state = seedWardFlowState();
  state = apply(state, {
    type: "RECEIVE_REFERRAL",
    role: source === "community" ? "community" : "ed",
    now,
    ageBand: "Adult",
    source,
    ...(source === "community" ? { sendingTeamName: TEAM_NAME } : {}),
    originSiteCode: ORIGIN_SITE,
    destinations: [
      {
        kind: "psychiatric_ward",
        unitId: UNIT_ID,
        sex: "Female",
        gender: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "unknown", reason: "not_known" },
    urgency: 2,
    transportNeeded,
    ...FIXTURE_HISTORY,
  });
  const referral = state.referrals.at(-1)!;
  state = apply(state, {
    type: "ACCEPT_REFERRAL",
    role: "ward",
    now,
    referralId: referral.id,
    destinationKind: "psychiatric_ward",
    unitId: UNIT_ID,
    actingUnitId: UNIT_ID,
  });
  const event: Extract<WardFlowEvent, { type: "RAISE_REFERRAL" }> = {
    type: "RAISE_REFERRAL",
    role: "ward",
    now: now + 1,
    referralId: referral.id,
    acceptedUnitId: UNIT_ID,
    actingUnitId: UNIT_ID,
    draft: {
      cohort: "Adult",
      sex: "Female",
      gender: "Female",
      security: "Open",
      observation: GENERAL_OBSERVATION,
      highAcuity: false,
      legalStatus: "Voluntary",
      urgency: 2,
      legalFormCode: null,
    },
  };
  return { state, event, referral };
}

describe("a journey from an accepted community referral (D-76)", () => {
  it("starts at the referring team with no ED, then is pulled and arrives", () => {
    const { state, event, referral } = acceptedCommunityReferral();
    const started = apply(state, event);
    const movement = started.movements.at(-1)!;
    expect(movement).toMatchObject({
      referralId: referral.id,
      acceptedUnitId: UNIT_ID,
      stage: "accepted_awaiting_bed",
      originCommunity: { siteCode: ORIGIN_SITE, teamName: TEAM_NAME },
    });
    expect(movement.originEdId).toBeUndefined();
    expect(movement.transportNeed, "a needed vehicle is booked on the journey, never assumed").toBeUndefined();
    expect(validOnTheWire(started)).toBe(true);
    // ED-only views and waits leave it out. Every reader names the team instead of an ED.
    expect(isEdOriginJourney(movement)).toBe(false);
    expect(movementOriginLabel(movement, undefined)).toBe(`${TEAM_NAME} (community)`);
    // Pick-up defaults to the referral's own site.
    expect(defaultPickupSiteCode(movement, started.referrals)).toBe(ORIGIN_SITE);

    let journey = apply(started, {
      type: "PULL_PATIENT",
      role: "ward",
      now: now + 2,
      movementId: movement.id,
      unitId: UNIT_ID,
      actingUnitId: UNIT_ID,
    });
    journey = apply(journey, {
      type: "RECORD_TRANSPORT_NEED",
      role: "coordinator",
      now: now + 3,
      movementId: movement.id,
      needed: false,
    });
    journey = apply(journey, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: now + 4,
      movementId: movement.id,
      actingUnitId: UNIT_ID,
    });
    expect(journey.movements.find((m) => m.id === movement.id)).toMatchObject({
      stage: "arrived",
      closure: { outcome: "arrived" },
    });
    expect(validOnTheWire(journey)).toBe(true);
  });

  it("carries the team's no-transport answer, so a carer-brought patient arrives once the bed is pulled", () => {
    const { state, event } = acceptedCommunityReferral("community", false);
    const started = apply(state, event);
    const movement = started.movements.at(-1)!;
    expect(movement.transportNeed).toEqual({ needed: false, at: now + 1 });
    const pulled = apply(started, {
      type: "PULL_PATIENT",
      role: "ward",
      now: now + 2,
      movementId: movement.id,
      unitId: UNIT_ID,
      actingUnitId: UNIT_ID,
    });
    const arrived = apply(pulled, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: now + 3,
      movementId: movement.id,
      actingUnitId: UNIT_ID,
    });
    expect(arrived.movements.find((m) => m.id === movement.id)?.stage).toBe("arrived");
  });

  it("lets the accepting ward start it from its own desk, since no ED is named", () => {
    const { state, event } = acceptedCommunityReferral();
    const options = { now, places: wardPlaceLookup(state.units) };
    const ward = { role: "ward" as const, scope: { kind: "ward" as const, unitIds: [UNIT_ID] } };
    expect(commandScopeRefusal(state, ward, event as unknown as Record<string, unknown>, options)).toBeNull();
  });

  it("refuses a start with no ED for an ED referral, or with no accepted ward", () => {
    const fromEd = acceptedCommunityReferral("ed_medical");
    const refusedEd = wardFlowReducer(fromEd.state, fromEd.event);
    expect(refusedEd.rejections.length).toBe(fromEd.state.rejections.length + 1);
    expect(refusedEd.movements).toEqual(fromEd.state.movements);

    const { state, event } = acceptedCommunityReferral();
    const noWard = wardFlowReducer(state, { ...event, acceptedUnitId: undefined });
    expect(noWard.rejections.at(-1)?.reason).toContain("needs an emergency department");
    expect(noWard.movements).toEqual(state.movements);
  });

  it("refuses an ED on a community referral's start", () => {
    const { state, event } = acceptedCommunityReferral();
    const withEd = wardFlowReducer(state, { ...event, edId: allEmergencyDepartments()[0].id });
    expect(withEd.rejections.length).toBe(state.rejections.length + 1);
    expect(withEd.movements).toEqual(state.movements);
  });

  it("refuses a stored journey that names both an ED and a community team, or neither", () => {
    const { state, event } = acceptedCommunityReferral();
    const started = apply(state, event);
    const movement = started.movements.at(-1)!;
    const swap = (patch: object) => ({
      ...started,
      movements: started.movements.map((m) => (m.id === movement.id ? { ...m, ...patch } : m)),
    });
    expect(validOnTheWire(swap({ originEdId: allEmergencyDepartments()[0].id }))).toBe(false);
    expect(validOnTheWire(swap({ originCommunity: undefined }))).toBe(false);
  });
});
