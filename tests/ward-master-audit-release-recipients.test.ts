import { describe, expect, it } from "vitest";

import { communityTeamById, communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { GENERAL_OBSERVATION } from "@/components/ward-management/ward-observation";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

// WF-029: protect existing ED/community recipients before the separately held ward-routing fix.
// These are baseline contracts, not a claim that the return-journey finding is resolved.
const now = NOW_ANCHOR;
const releaseTypes = ["RELEASE_PULL", "RELEASE_AND_REOPEN_SEARCH"] as const;

function apply(state: WardFlowState, event: WardFlowEvent) {
  const next = wardFlowReducer(state, event);
  expect(next.rejections, next.rejections.at(-1)?.reason).toHaveLength(state.rejections.length);
  return next;
}

function pulledFromEd() {
  const movementId = "WF-009";
  const unitId = "rph-adult-secure";
  let state = seedWardFlowState();
  state = apply(state, { type: "REFER_TO_UNITS", role: "coordinator", now, movementId, unitIds: [unitId] });
  state = apply(state, { type: "ACCEPT_IN_PRINCIPLE", role: "ward", now, movementId, unitId });
  state = apply(state, { type: "PULL_PATIENT", role: "ward", now, movementId, unitId });
  const movement = state.movements.find((entry) => entry.id === movementId)!;
  expect(movement.originCommunity).toBeUndefined();
  expect(movement.sourceAdmissionId).toBeUndefined();
  expect(movement.originEdId).toBeDefined();
  return { state, movement, unitId, recipient: { role: "ed", placeId: movement.originEdId } };
}

function pulledFromCommunity() {
  const unitId = "scgh-adult-open";
  const teamName = communityTeamById("midland")!.name;
  let state = seedWardFlowState();
  state = apply(state, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now,
    ageBand: "Adult",
    source: "community",
    sendingTeamName: teamName,
    originSiteCode: "RPH",
    urgency: 2,
    transportNeeded: true,
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "unknown", reason: "not_known" },
    destinations: [
      {
        kind: "psychiatric_ward",
        unitId,
        sex: "Female",
        gender: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
    ],
    ...FIXTURE_HISTORY,
  });
  const referralId = state.referrals.at(-1)!.id;
  state = apply(state, {
    type: "ACCEPT_REFERRAL",
    role: "ward",
    now,
    referralId,
    destinationKind: "psychiatric_ward",
    unitId,
    actingUnitId: unitId,
  });
  state = apply(state, {
    type: "RAISE_REFERRAL",
    role: "ward",
    now: now + 1,
    referralId,
    acceptedUnitId: unitId,
    actingUnitId: unitId,
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
  });
  const movementId = state.movements.at(-1)!.id;
  state = apply(state, {
    type: "PULL_PATIENT",
    role: "ward",
    now: now + 2,
    movementId,
    unitId,
    actingUnitId: unitId,
  });
  const movement = state.movements.find((entry) => entry.id === movementId)!;
  expect(movement.originEdId).toBeUndefined();
  expect(movement.originCommunity?.teamName).toBe(teamName);
  return { state, movement, unitId, recipient: { role: "community", placeId: communityTeamSlug(teamName) } };
}

describe.each([
  { origin: "ED", fixture: pulledFromEd },
  { origin: "community without an ED", fixture: pulledFromCommunity },
])("bed-release recipients: $origin", ({ fixture }) => {
  it.each(releaseTypes)("%s tells only the recorded sender and releases the destination pull", (type) => {
    const { state, movement, unitId, recipient } = fixture();
    const beforeCapacity = state.units.find((unit) => unit.id === unitId)!.allocatable.value;
    expect(movement.admissionId).toBeDefined();
    const after = apply(state, {
      type,
      role: "ward",
      now: now + 3,
      movementId: movement.id,
      actingUnitId: unitId,
      reason: "ward_withdrew_the_bed",
    });
    const notices = after.notices.slice(state.notices.length);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      kind: "bed_pull_released",
      to: recipient,
      about: { movementId: movement.id, unitId },
    });
    expect(after.admissions.some((admission) => admission.id === movement.admissionId)).toBe(false);
    expect(after.units.find((unit) => unit.id === unitId)!.allocatable.value).toBe(beforeCapacity + 1);
    expect(after.movements.find((entry) => entry.id === movement.id)?.stage).toBe(
      type === "RELEASE_PULL" ? "accepted_awaiting_bed" : "placement_requested",
    );
  });
});
