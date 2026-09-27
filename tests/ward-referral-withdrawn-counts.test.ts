/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { searchPatients } from "@/components/ward-management/ward-derivations";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * WF-13 T11 — THE TWO FIGURES THAT COUNT A WITHDRAWN REFERRAL AS STILL OPEN.
 *
 * Both `wardNavCounts`'s "referrals" chip and `searchPatients`'s referral half filter on
 * `referralState(referral) === "queued"` alone. `referralState` never reads `withdrawnAt` — it
 * only asks whether some destination accepted or every destination declined — so a referral whose
 * one destination has been withdrawn (and therefore stayed `state: "queued"`, per O-17.11) keeps
 * being counted as awaiting a decision on both surfaces, forever.
 *
 * `RF-014` is the fixture used throughout `tests/ward-referral-awaiting-answer.test.ts`: a single
 * queued destination at `rph-ed`, addressed nowhere else — so withdrawing it removes the referral
 * from BOTH figures' populations entirely, and each count must drop by exactly one.
 */

const REFERRAL_ID = "RF-014";

function withdraw(state: WardFlowState, referralId: string): WardFlowState {
  return wardFlowReducer(state, {
    type: "RECORD_REFERRER_WITHDRAWAL",
    role: "coordinator",
    now: NOW_ANCHOR,
    referralId,
  });
}

function referralCount(state: WardFlowState): number {
  const counts = wardNavCounts({
    movements: state.movements,
    units: state.units,
    referrals: state.referrals,
    bedReleases: state.bedReleases,
    leaveBeds: state.leaveBeds,
    now: NOW_ANCHOR,
  });
  const referralsCount = counts.referrals;
  expect(referralsCount, "wardNavCounts stopped reporting a referrals figure").toBeDefined();
  return referralsCount!.value;
}

function searchReferralCount(state: WardFlowState): number {
  return searchPatients(state.movements, state.referrals, state.units, { text: "" }).filter(
    (result) => result.kind === "referral",
  ).length;
}

describe("WF-13 T11 — the nav count drops when a referral is withdrawn", () => {
  it("counts RF-014 before withdrawal, or the drop below would be vacuous", () => {
    const seed = seedWardFlowState();
    expect(seed.referrals.some((referral) => referral.id === REFERRAL_ID)).toBe(true);
  });

  it("the sidebar's referrals figure drops by exactly one", () => {
    const seed = seedWardFlowState();
    const before = referralCount(seed);

    const after = withdraw(seed, REFERRAL_ID);
    expect(after.rejections.length, "the withdrawal itself was rejected").toBe(seed.rejections.length);

    expect(referralCount(after)).toBe(before - 1);
  });
});

describe("WF-13 T11 — the patient-search referral figure drops when a referral is withdrawn", () => {
  it("counts RF-014 in searchPatients before withdrawal, or the drop below would be vacuous", () => {
    const seed = seedWardFlowState();
    const ids = searchPatients(seed.movements, seed.referrals, seed.units, { text: "" })
      .filter((result) => result.kind === "referral")
      .map((result) => (result.kind === "referral" ? result.referral.id : ""));
    expect(ids).toContain(REFERRAL_ID);
  });

  it("the referral half of searchPatients drops by exactly one", () => {
    const seed = seedWardFlowState();
    const before = searchReferralCount(seed);

    const after = withdraw(seed, REFERRAL_ID);
    expect(after.rejections.length, "the withdrawal itself was rejected").toBe(seed.rejections.length);

    expect(searchReferralCount(after)).toBe(before - 1);
  });
});
