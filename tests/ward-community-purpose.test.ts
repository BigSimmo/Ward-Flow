import { describe, expect, it } from "vitest";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "../src/components/ward-management/ward-flow-storage-validation";
import {
  communityPurposeOf,
  communityReferralPurposeLabel,
  referralDestinationLabel,
} from "../src/components/ward-management/ward-referrals";
import { communityTeamOptions } from "../src/components/ward-management/referrals/referral-destination-options";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import type { CommunityReferralPurpose } from "../src/components/ward-management/ward-model-referral-parts";

/*
 * D-74 (Josh, 21 Oct 2026): a new community referral says whether it is for community follow-up or
 * to assess for admission. Records saved before D-74 carry no purpose and read as follow-up.
 */

const team = communityTeamOptions()[0]!;

function referToTeam(state: WardFlowState, purpose?: CommunityReferralPurpose | "nonsense") {
  const candidates = state.movements.filter((movement) => !movement.closure && movement.originEdId);
  for (const movement of candidates) {
    const next = wardFlowReducer(state, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW_ANCHOR + 1,
      movementId: movement.id,
      team,
      ...(purpose === undefined ? {} : { purpose: purpose as CommunityReferralPurpose }),
    });
    if (next.rejections.length === state.rejections.length || purpose === "nonsense") return next;
  }
  throw new Error("no seeded movement can be referred to a community team");
}

function communityArms(state: WardFlowState) {
  return state.referrals.flatMap((referral) =>
    referral.destinations.flatMap((arm) =>
      arm.destination.kind === "community_team" && arm.destination.teamName === team ? [arm.destination] : [],
    ),
  );
}

describe("community referral purpose (D-74)", () => {
  it("records the purpose chosen and names it on the destination", () => {
    const state = referToTeam(seedWardFlowState(), "assess_for_admission");
    const arm = communityArms(state).find((destination) => destination.purpose === "assess_for_admission");
    expect(arm).toBeDefined();
    expect(referralDestinationLabel(arm!)).toBe("Community team (Assess for admission)");
  });

  it("keeps the purpose on the closed ED record and in the team's notice", () => {
    const before = seedWardFlowState();
    const state = referToTeam(before, "assess_for_admission");
    const closed = state.movements.filter((movement) => movement.communityPurpose !== undefined);
    expect(closed.map((movement) => movement.communityPurpose)).toEqual(["assess_for_admission"]);
    const notice = state.notices
      .slice(before.notices.length)
      .find((item) => item.kind === "community_referral_received");
    expect(notice?.sentence).toContain("referred a patient for assessment for admission.");
  });

  it("refuses a purpose that is not on the list", () => {
    const before = seedWardFlowState();
    const after = referToTeam(before, "nonsense");
    expect(after.rejections.length).toBe(before.rejections.length + 1);
    expect(after.rejections.at(-1)?.reason).toContain("COMMUNITY_REFERRAL_PURPOSES");
  });

  it("reads a record with no purpose as community follow-up", () => {
    expect(communityPurposeOf({})).toBe("follow_up");
    expect(communityReferralPurposeLabel(communityPurposeOf({}))).toBe("Community follow-up");
    expect(referralDestinationLabel({ kind: "community_team", teamName: team })).toBe(
      "Community team (Community follow-up)",
    );
  });

  it("keeps a valid stored purpose and refuses an invented one on reload", () => {
    const state = JSON.parse(JSON.stringify(referToTeam(seedWardFlowState(), "follow_up"))) as WardFlowState;
    expect(isValidStoredWardFlowState(state)).toBe(true);
    const arm = state.referrals
      .flatMap((referral) => referral.destinations)
      .find((candidate) => candidate.destination.kind === "community_team" && candidate.destination.purpose);
    expect(arm).toBeDefined();
    (arm!.destination as { purpose: string }).purpose = "nonsense";
    expect(isValidStoredWardFlowState(state)).toBe(false);
  });

  it("refuses an invented purpose on a closed ED record on reload", () => {
    const state = JSON.parse(JSON.stringify(referToTeam(seedWardFlowState(), "follow_up"))) as WardFlowState;
    const closed = state.movements.find((movement) => movement.communityPurpose !== undefined);
    expect(closed).toBeDefined();
    expect(isValidStoredWardFlowState(state)).toBe(true);
    (closed as { communityPurpose: string }).communityPurpose = "nonsense";
    expect(isValidStoredWardFlowState(state)).toBe(false);
  });
});

describe("a reused community arm takes the purpose chosen now (D-74)", () => {
  it("writes the new purpose onto the queued arm, so the arm, the notice and the record agree", () => {
    const seeded = seedWardFlowState();
    const baseMovement = seeded.movements.find((m) => m.id === "WF-002")!;
    const baseReferral = seeded.referrals.find((r) => r.id === "RF-012")!;
    const linked = {
      ...baseReferral,
      id: "RF-TEST-PURPOSE",
      destinations: [
        {
          destination: { kind: "community_team" as const, teamName: team, purpose: "follow_up" as const },
          state: "queued" as const,
        },
      ],
    };
    const state: WardFlowState = {
      ...seeded,
      referrals: [...seeded.referrals, linked],
      movements: [...seeded.movements, { ...baseMovement, id: "WF-TEST-PURPOSE", referralId: linked.id }],
    };
    const after = wardFlowReducer(state, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW_ANCHOR + 10,
      movementId: "WF-TEST-PURPOSE",
      team,
      purpose: "assess_for_admission",
    });
    expect(after.rejections.slice(state.rejections.length)).toEqual([]);
    const arms = after.referrals.find((r) => r.id === linked.id)!.destinations;
    expect(arms).toHaveLength(1);
    expect(arms[0]!.destination).toMatchObject({ kind: "community_team", purpose: "assess_for_admission" });
    expect(after.movements.find((m) => m.id === "WF-TEST-PURPOSE")!.communityPurpose).toBe("assess_for_admission");
    const notice = after.notices.slice(state.notices.length).find((n) => n.kind === "community_referral_received");
    expect(notice?.sentence).toContain("for assessment for admission");
  });
});
