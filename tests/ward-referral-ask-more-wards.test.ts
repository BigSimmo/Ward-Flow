import { describe, expect, it } from "vitest";

import { wardReferralInboxEntries } from "@/components/ward-management/referrals/referral-inbox";
import { referralEligibility } from "@/components/ward-management/ward-eligibility";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral, ReferralAddressing } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Fix plan item 16 (D-76): the coordinator asks more wards about an open community referral. No
 * more than three wards wait at once, declined wards do not count, and each added ward records
 * when it was asked and by which desk. Synthetic data only.
 */

const BASE = seedWardFlowState();
const PROBE: Referral = {
  ...BASE.referrals[0],
  id: "RF-ASK-1",
  source: "community",
  ageBand: "Adult",
  destinations: [],
};
// The reducer checks each ward still fits, so the test asks only wards that do.
const FITTING = BASE.units
  .filter((unit) => !unit.isClosed)
  .filter((unit) => referralEligibility(PROBE, wardDestination(unit.id), unit, NOW_ANCHOR).eligible)
  .map((unit) => unit.id);
const [WARD_A, WARD_B, WARD_C, WARD_D, WARD_E] = FITTING;
const NOT_FITTING = BASE.units.find(
  (unit) => !unit.isClosed && !referralEligibility(PROBE, wardDestination(unit.id), unit, NOW_ANCHOR).eligible,
)!;

function wardDestination(unitId: string) {
  return {
    kind: "psychiatric_ward" as const,
    unitId,
    sex: "Female" as const,
    gender: "Female" as const,
    secureBedNeeded: false,
    involuntaryBedNeeded: false,
    highAcuityNursingNeeded: false,
  };
}

function wardArm(unitId: string, state: ReferralAddressing["state"] = "queued"): ReferralAddressing {
  return {
    destination: wardDestination(unitId),
    state,
    ...(state === "declined" ? { decidedAt: NOW_ANCHOR - 30, declineReason: "no_suitable_bed" as const } : {}),
  };
}

function withReferral(destinations: ReferralAddressing[], overrides: Partial<Referral> = {}): WardFlowState {
  const referral: Referral = {
    ...BASE.referrals[0],
    id: "RF-ASK-1",
    source: "community",
    ageBand: "Adult",
    sendingTeamName: "Midland",
    destinations,
    ...overrides,
  };
  return { ...BASE, referrals: [...BASE.referrals, referral] };
}

function ask(state: WardFlowState, unitIds: string[], role: "coordinator" | "ward" = "coordinator") {
  return wardFlowReducer(state, { type: "ASK_MORE_WARDS", role, now: NOW_ANCHOR, referralId: "RF-ASK-1", unitIds });
}

const asked = (state: WardFlowState) => state.referrals.find((referral) => referral.id === "RF-ASK-1")!;

describe("ASK_MORE_WARDS", () => {
  it("adds each ward as its own queued request, copying the bed questions and recording who and when", () => {
    const next = ask(withReferral([wardArm(WARD_A, "declined")]), [WARD_B, WARD_C]);
    expect(next.rejections).toEqual(BASE.rejections);
    const added = asked(next).destinations.slice(1);
    expect(added.map((arm) => arm.destination.kind === "psychiatric_ward" && arm.destination.unitId)).toEqual([
      WARD_B,
      WARD_C,
    ]);
    for (const arm of added) {
      expect(arm).toMatchObject({ state: "queued", referredAt: NOW_ANCHOR, addedBy: expect.any(String) });
      expect(arm.destination).toMatchObject({ sex: "Female", gender: "Female", secureBedNeeded: false });
    }
  });

  it("counts only wards still waiting against the cap of three", () => {
    const declinedTwice = withReferral([wardArm(WARD_A, "declined"), wardArm(WARD_B, "declined"), wardArm(WARD_C)]);
    expect(asked(ask(declinedTwice, [WARD_D, WARD_E])).destinations).toHaveLength(5);
    const twoWaiting = withReferral([wardArm(WARD_A), wardArm(WARD_B)]);
    const refused = ask(twoWaiting, [WARD_C, WARD_D]);
    expect(asked(refused).destinations).toHaveLength(2);
    expect(refused.rejections.at(-1)?.reason).toMatch(/no more than 3 wards may wait at once/u);
  });

  it("starts a newly asked ward's clock when it was asked, not when the referral was raised", () => {
    const raisedEarlier = withReferral([wardArm(WARD_A, "declined")], { raisedAt: NOW_ANCHOR - 240 });
    const referrals = ask(raisedEarlier, [WARD_B]).referrals;
    expect(wardReferralInboxEntries(referrals, WARD_B).find((entry) => entry.id === "RF-ASK-1")?.raisedAt).toBe(
      NOW_ANCHOR,
    );
    expect(wardReferralInboxEntries(referrals, WARD_A).find((entry) => entry.id === "RF-ASK-1")?.raisedAt).toBe(
      NOW_ANCHOR - 240,
    );
  });

  it("refuses a ward that does not fit the referral now", () => {
    expect(FITTING.length).toBeGreaterThanOrEqual(5);
    const next = ask(withReferral([wardArm(WARD_A, "declined")]), [NOT_FITTING.id]);
    expect(next.rejections.at(-1)?.reason).toMatch(/does not fit this referral now/u);
    expect(asked(next).destinations).toHaveLength(1);
  });

  it("refuses a ward already asked, an unknown ward, and a ward named twice", () => {
    const state = withReferral([wardArm(WARD_A, "declined")]);
    expect(ask(state, [WARD_A]).rejections.at(-1)?.reason).toMatch(/already been asked/u);
    expect(ask(state, ["no-such-ward"]).rejections.at(-1)?.reason).toMatch(/no ward no-such-ward/u);
    expect(ask(state, [WARD_B, WARD_B]).rejections.at(-1)?.reason).toMatch(/names a ward twice/u);
    expect(ask(state, []).rejections.at(-1)?.reason).toMatch(/at least one ward/u);
  });

  it("refuses an accepted referral, a non-community referral, and any desk but the coordinator", () => {
    const accepted = withReferral([wardArm(WARD_A, "accepted")]);
    expect(asked(ask(accepted, [WARD_B])).destinations).toHaveLength(1);
    const fromEd = withReferral([wardArm(WARD_A, "declined")], { source: "ed_medical" });
    expect(asked(ask(fromEd, [WARD_B])).destinations).toHaveLength(1);
    const open = withReferral([wardArm(WARD_A, "declined")]);
    expect(asked(ask(open, [WARD_B], "ward")).destinations).toHaveLength(1);
  });

  it("refuses a referral with no ward request to copy the bed questions from", () => {
    const communityOnly = withReferral([
      {
        destination: { kind: "community_team", teamName: "Midland", purpose: "follow_up" },
        state: "declined",
      } as ReferralAddressing,
    ]);
    expect(ask(communityOnly, [WARD_B]).rejections.at(-1)?.reason).toMatch(/ward request to copy/u);
  });
});
