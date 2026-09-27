// tests/ward-decline-reason-by-destination.test.ts
//
// STEP 2 of the community-decline engine fix (2026-09-17): `DECLINE_REFERRAL`'s reason must be
// validated against the vocabulary for the DESTINATION KIND that is answering, never against one
// shared list. Owner ruling O-16.6 already established `COMMUNITY_DECLINE_REASONS` and
// `REFERRAL_DECLINE_REASONS` have ZERO overlap in meaning; before this fix the reducer's own
// membership check (`REFERRAL_DECLINE_REASONS.includes(event.reason)`) checked every decline
// against the WARD vocabulary regardless of which destination answered, so a community decline
// could never be recorded honestly — it would either be refused outright (a real community reason
// is not in `REFERRAL_DECLINE_REASONS`) or, if a caller reused a ward reason to dodge that, record
// a bed-placement reason against a community refusal, which is the exact wrong-reason-is-worse-
// than-no-reason failure O-16.6 exists to prevent.
import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  COMMUNITY_DECLINE_REASONS,
  ED_DECLINE_REASONS,
  REFERRAL_DECLINE_REASONS,
  type Referral,
  type ReferralDestination,
} from "@/components/ward-management/ward-model";
import { referralState } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

const NOW = NOW_ANCHOR;

const WARD: ReferralDestination = {
  kind: "psychiatric_ward",
  sex: "Female",
  secureBedNeeded: false,
  involuntaryBedNeeded: false,
  highAcuityNursingNeeded: false,
};
const ED: ReferralDestination = { kind: "emergency_department", edId: "peel-ed", purpose: "psychiatric_review" };
const COMMUNITY: ReferralDestination = { kind: "community_team", teamName: "Inner City Clinic" };

function receiveMulti(state: WardFlowState, destinations: ReferralDestination[]): WardFlowState {
  const after = wardFlowReducer(state, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW,
    ageBand: "Adult",
    destinations,
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: "SCGH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  });
  expect(after.rejections, "the fixture referral itself must be accepted, or this test proves nothing").toEqual([]);
  return after;
}

function created(state: WardFlowState): Referral {
  return state.referrals.at(-1)!;
}

function referralById(state: WardFlowState, id: string): Referral {
  const found = state.referrals.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing referral ${id}`);
  return found;
}

describe("DECLINE_REFERRAL reason is scoped to the destination kind that is answering", () => {
  it("accepts a community decline given a community reason, and records it honestly", () => {
    const seeded = receiveMulti(seedWardFlowState(), [COMMUNITY]);
    const referral = created(seeded);
    const after = wardFlowReducer(seeded, {
      type: "DECLINE_REFERRAL",
      role: "community",
      now: NOW,
      referralId: referral.id,
      destinationKind: "community_team",
      reason: "outside_the_teams_catchment",
    });
    expect(after.rejections).toEqual([]);
    const decided = referralById(after, referral.id);
    expect(referralState(decided)).toBe("declined");
    expect(decided.destinations[0].declineReason).toBe("outside_the_teams_catchment");
    expect(decided.destinations[0].decidedAt).toBe(NOW);
  });

  it("refuses a community decline given a ward (bed-placement) reason, naming the destination kind", () => {
    const seeded = receiveMulti(seedWardFlowState(), [COMMUNITY]);
    const referral = created(seeded);
    const after = wardFlowReducer(seeded, {
      type: "DECLINE_REFERRAL",
      role: "community",
      now: NOW,
      referralId: referral.id,
      destinationKind: "community_team",
      // A bed-placement reason — O-16.6's own measurement is that this has zero overlap in
      // meaning with the community vocabulary, so a truthy value here must still be refused.
      reason: "no_suitable_bed" as unknown as (typeof COMMUNITY_DECLINE_REASONS)[number],
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toMatch(/community/i);
    const decided = referralById(after, referral.id);
    expect(referralState(decided)).toBe("queued");
    expect(decided.destinations[0].declineReason, "a refused decline must not record a reason").toBeUndefined();
  });

  it("refuses a ward decline given a community reason, naming the destination kind", () => {
    const seeded = receiveMulti(seedWardFlowState(), [WARD]);
    const referral = created(seeded);
    const after = wardFlowReducer(seeded, {
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      destinationKind: "psychiatric_ward",
      reason: "outside_the_teams_catchment" as unknown as (typeof REFERRAL_DECLINE_REASONS)[number],
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toMatch(/psychiatric ward/i);
    const decided = referralById(after, referral.id);
    expect(referralState(decided)).toBe("queued");
    expect(decided.destinations[0].declineReason).toBeUndefined();
  });

  it("refuses an ED decline given a bed-shaped reason, naming the destination kind", () => {
    const seeded = receiveMulti(seedWardFlowState(), [ED]);
    const referral = created(seeded);
    const after = wardFlowReducer(seeded, {
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      destinationKind: "emergency_department",
      reason: "no_suitable_bed",
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0].reason).toMatch(/emergency department/i);
    const decided = referralById(after, referral.id);
    expect(referralState(decided)).toBe("queued");
    expect(decided.destinations[0].declineReason).toBeUndefined();
  });

  it("still accepts every existing reason in REFERRAL_DECLINE_REASONS for a ward destination — the existing ward path is unchanged", () => {
    let state = seedWardFlowState();
    for (const reason of REFERRAL_DECLINE_REASONS) {
      state = receiveMulti(state, [WARD]);
      const referral = created(state);
      const before = state.rejections.length;
      state = wardFlowReducer(state, {
        type: "DECLINE_REFERRAL",
        role: "coordinator",
        now: NOW,
        referralId: referral.id,
        destinationKind: "psychiatric_ward",
        reason,
      });
      expect(state.rejections.length, `ward reason ${reason} was wrongly refused`).toBe(before);
      expect(referralById(state, referral.id).destinations[0].declineReason).toBe(reason);
    }
  });

  it("still accepts every existing reason in ED_DECLINE_REASONS for an ED destination — the existing ED path is unchanged", () => {
    let state = seedWardFlowState();
    for (const reason of ED_DECLINE_REASONS) {
      state = receiveMulti(state, [ED]);
      const referral = created(state);
      const before = state.rejections.length;
      state = wardFlowReducer(state, {
        type: "DECLINE_REFERRAL",
        role: "coordinator",
        now: NOW,
        referralId: referral.id,
        destinationKind: "emergency_department",
        reason,
      });
      expect(state.rejections.length, `ED reason ${reason} was wrongly refused`).toBe(before);
      expect(referralById(state, referral.id).destinations[0].declineReason).toBe(reason);
    }
  });

  it("accepts every reason in COMMUNITY_DECLINE_REASONS for a community destination, not just the first", () => {
    let state = seedWardFlowState();
    for (const reason of COMMUNITY_DECLINE_REASONS) {
      state = receiveMulti(state, [COMMUNITY]);
      const referral = created(state);
      const before = state.rejections.length;
      state = wardFlowReducer(state, {
        type: "DECLINE_REFERRAL",
        role: "community",
        now: NOW,
        referralId: referral.id,
        destinationKind: "community_team",
        reason,
      });
      expect(state.rejections.length, `community reason ${reason} was wrongly refused`).toBe(before);
      expect(referralById(state, referral.id).destinations[0].declineReason).toBe(reason);
    }
  });
});
