import { describe, expect, it } from "vitest";
import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { commandScopeRefusal } from "@/components/ward-management/ward-access-state";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { isValidSharedWardFlowState } from "@/components/ward-management/ward-shared-state-validation";
import { isEdOriginJourney } from "@/components/ward-management/ward-ed-presence";
import { movementOriginLabel } from "@/components/ward-management/ward-movement-origin";
import { NOW_ANCHOR, allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { GENERAL_OBSERVATION } from "@/components/ward-management/ward-observation";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";
import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { matchesSetting } from "@/components/ward-management/search/search-filters";
import { buildCensus } from "@/components/ward-management/search/patient-census";
import { demoDayZero, dueSoonThresholdsOf } from "@/components/ward-management/ward-clock";
import { searchPatients } from "@/components/ward-management/ward-derivations";

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

  it("tells the referring team, not an ED, when the pulled bed is released", () => {
    const { state, event } = acceptedCommunityReferral();
    const started = apply(state, event);
    const movement = started.movements.at(-1)!;
    const pulled = apply(started, {
      type: "PULL_PATIENT",
      role: "ward",
      now: now + 2,
      movementId: movement.id,
      unitId: UNIT_ID,
      actingUnitId: UNIT_ID,
    });
    const released = apply(pulled, {
      type: "RELEASE_PULL",
      role: "ward",
      now: now + 3,
      movementId: movement.id,
      reason: "ward_withdrew_the_bed",
      actingUnitId: UNIT_ID,
    });
    expect(released.notices.at(-1)).toMatchObject({
      kind: "bed_pull_released",
      to: { role: "community", placeId: communityTeamSlug(TEAM_NAME) },
    });
  });

  it("finds the journey under the Community setting in patient search", () => {
    const { state, event } = acceptedCommunityReferral();
    const movement = apply(state, event).movements.at(-1)!;
    expect(matchesSetting({ kind: "movement", movement }, "community")).toBe(true);
    expect(matchesSetting({ kind: "movement", movement }, "ed")).toBe(false);
  });

  it("refuses a start when the referral names no sending team", () => {
    const { state, event, referral } = acceptedCommunityReferral();
    const unnamed = {
      ...state,
      referrals: state.referrals.map((r) => (r.id === referral.id ? { ...r, sendingTeamName: undefined } : r)),
    };
    const refused = wardFlowReducer(unnamed, event);
    expect(refused.rejections.length).toBe(unnamed.rejections.length + 1);
    expect(refused.movements).toEqual(unnamed.movements);
  });

  // Form rule (FORM-REF, Josh, 5 Nov 2026): a referral may be sent without its referring service or
  // location. Starting its journey needs them, so they are recorded there, from the offered lists.
  it("starts a community journey sent with no service or location once both are recorded", () => {
    const { state, event, referral } = acceptedCommunityReferral();
    const sparse = {
      ...state,
      referrals: state.referrals.map((r) =>
        r.id === referral.id ? { ...r, sendingTeamName: undefined, originSiteCode: undefined } : r,
      ),
    };
    const teamId = communityTeamSlug(TEAM_NAME);
    expect(wardFlowReducer(sparse, event).rejections.at(-1)?.reason).toBe(
      "Record the referring community service to start this journey",
    );
    expect(wardFlowReducer(sparse, { ...event, teamId }).rejections.at(-1)?.reason).toBe(
      "Record the referring service location to start this journey",
    );
    expect(wardFlowReducer(sparse, { ...event, teamId: "no-such-team", siteCode: ORIGIN_SITE }).movements).toEqual(
      sparse.movements,
    );
    expect(wardFlowReducer(sparse, { ...event, teamId, siteCode: "NOWHERE" }).movements).toEqual(sparse.movements);
    // A detail the referral already holds is never replaced.
    expect(wardFlowReducer(state, { ...event, siteCode: "SCGH" }).movements).toEqual(state.movements);

    const started = apply(sparse, { ...event, teamId, siteCode: ORIGIN_SITE });
    expect(started.movements.at(-1)!.originCommunity).toEqual({ siteCode: ORIGIN_SITE, teamName: TEAM_NAME });
    expect(validOnTheWire(started)).toBe(true);
  });

  it("starts an ED referral sent with no location at the ED the coordinator names", () => {
    const { state, event, referral } = acceptedCommunityReferral("ed_medical");
    const sparse = {
      ...state,
      referrals: state.referrals.map((r) => (r.id === referral.id ? { ...r, originSiteCode: undefined } : r)),
    };
    const ed = allEmergencyDepartments().find((place) => place.siteCode === "SCGH")!;
    const started = apply(sparse, { ...event, role: "coordinator", actingUnitId: undefined, edId: ed.id });
    expect(started.movements.at(-1)!.originEdId).toBe(ed.id);
    expect(validOnTheWire(started)).toBe(true);
    // A referral that records its ED still starts only there.
    const elsewhere = wardFlowReducer(state, { ...event, role: "coordinator", actingUnitId: undefined, edId: ed.id });
    expect(elsewhere.movements).toEqual(state.movements);
  });

  it("names a missing location in Patients and never matches a search for undefined", () => {
    let state = seedWardFlowState();
    state = apply(state, {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now,
      ageBand: "Adult",
      source: "community",
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
      suburb: { kind: "unknown", reason: "not_known" },
      urgency: 2,
      transportNeeded: true,
      ...FIXTURE_HISTORY,
    });
    const sent = state.referrals.at(-1)!;
    const census = buildCensus({
      ...state,
      now,
      thresholds: dueSoonThresholdsOf(state.configuration),
      dayZero: demoDayZero(new Date("2026-10-19T00:00:00Z")),
    });
    expect(JSON.stringify(census)).not.toContain("undefined");
    const query = { text: "undef" } as Parameters<typeof searchPatients>[3];
    expect(searchPatients(state.movements, [sent], state.units, query)).toEqual([]);
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
