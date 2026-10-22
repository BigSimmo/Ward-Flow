/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { handoverSnapshot, searchPatients } from "@/components/ward-management/ward-derivations";
import { decidedReferrals } from "@/components/ward-management/ward-referrals";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { GENERAL_OBSERVATION } from "../src/components/ward-management/ward-observation";
/**
 * THE TWO FIGURES THAT COUNT A WITHDRAWN REFERRAL AS STILL OPEN.
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
    sites: wardSites,
    thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
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

describe("the nav count drops when a referral is withdrawn", () => {
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

describe("the patient-search referral figure drops when a referral is withdrawn", () => {
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

describe("A3-8 / A3-9: Referral Withdrawal vs Multi-Ward Decline", () => {
  it("all addressings withdrawn surfaces in decidedReferrals and not declined_by_all in placementGoneWrong", () => {
    const seed = seedWardFlowState();
    expect(decidedReferrals(seed.referrals).some((r) => r.id === REFERRAL_ID)).toBe(false);

    const after = withdraw(seed, REFERRAL_ID);
    expect(decidedReferrals(after.referrals).some((r) => r.id === REFERRAL_ID)).toBe(true);

    const snapshot = handoverSnapshot(after.movements, after.units, NOW_ANCHOR);
    expect(
      snapshot.placementGoneWrong.some(
        (entry) => entry.movement.referralId === REFERRAL_ID && entry.kind === "declined_by_all",
      ),
    ).toBe(false);
  });

  it("Ward A declined + Ward B withdrawn does not classify as declined_by_all in placementGoneWrong", () => {
    const seed = seedWardFlowState();
    const raised = wardFlowReducer(seed, {
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
    expect(raised.rejections).toHaveLength(0);
    const movementId = raised.movements[raised.movements.length - 1].id;

    // Refer to Ward A and Ward B
    let state = wardFlowReducer(raised, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR + 1,
      movementId,
      unitIds: ["rph-adult-secure", "fsh-adult-secure"],
    });
    expect(state.rejections).toHaveLength(0);

    // Ward A declines
    state = wardFlowReducer(state, {
      type: "DECLINE",
      role: "ward",
      now: NOW_ANCHOR + 2,
      movementId,
      unitId: "rph-adult-secure",
      reason: "belongs_to_another_service",
    });
    expect(state.rejections).toHaveLength(0);

    // Ward B is withdrawn by the coordinator
    state = wardFlowReducer(state, {
      type: "WITHDRAW_WARD_REQUEST",
      role: "coordinator",
      now: NOW_ANCHOR + 3,
      movementId,
      unitId: "fsh-adult-secure",
      reason: "another_reason",
    });
    expect(state.rejections).toHaveLength(0);

    const movement = state.movements.find((m) => m.id === movementId)!;
    expect(movement.referredUnitIds).toHaveLength(0);
    expect(movement.declines).toHaveLength(1);
    expect(movement.withdrawnReferrals).toHaveLength(1);

    const snapshot = handoverSnapshot(state.movements, state.units, NOW_ANCHOR + 4);
    const goneWrongEntry = snapshot.placementGoneWrong.find((entry) => entry.movement.id === movementId);
    expect(goneWrongEntry?.kind).not.toBe("declined_by_all");
    expect(
      snapshot.placementGoneWrong.filter(
        (entry) => entry.movement.id === movementId && entry.kind === "declined_by_all",
      ),
    ).toHaveLength(0);
  });
});
