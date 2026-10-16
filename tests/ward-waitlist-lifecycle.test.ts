import { expect, it } from "vitest";
import { wardTvSheet } from "@/components/ward-management/bed-meeting/tv-derivations";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

it("asks for a fresh answer after same-minute waitlisting, withdrawal and re-referral, retaining history", () => {
  let state = wardFlowReducer(seedWardFlowState(), {
    type: "RAISE_REFERRAL",
    role: "ed",
    now: NOW_ANCHOR,
    edId: "jhc-ed",
    draft: {
      cohort: "Adult",
      security: "Secure",
      sex: "Male",
      gender: "Male",
      specialling: false,
      highAcuity: false,
      legalStatus: "Voluntary",
      urgency: 2,
      legalFormCode: null,
    },
  });
  expect(state.rejections).toEqual([]);
  const movementId = state.movements.at(-1)!.id;
  const unitId = "rph-adult-secure";
  const unit = state.units.find((row) => row.id === unitId)!;
  const refer = () => {
    state = wardFlowReducer(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId,
      unitIds: [unitId],
    });
    expect(state.rejections).toEqual([]);
  };
  const waitlist = () => {
    state = wardFlowReducer(state, {
      type: "DECLINE",
      role: "ward",
      now: NOW_ANCHOR,
      movementId,
      unitId,
      reason: "no_bed",
    });
    expect(state.rejections).toEqual([]);
  };
  const asked = () =>
    wardTvSheet({
      ...state,
      movements: state.movements.filter((row) => row.id === movementId),
      unit,
      now: NOW_ANCHOR,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
      nameOf: () => "Synthetic person",
    }).askedCount;
  refer();
  expect(asked()).toBe(1);
  waitlist();
  expect(asked()).toBe(0);
  state = wardFlowReducer(state, {
    type: "WITHDRAW_WARD_REQUEST",
    role: "coordinator",
    now: NOW_ANCHOR,
    movementId,
    unitId,
    reason: "another_reason",
  });
  expect(state.rejections).toEqual([]);
  expect(asked()).toBe(0);
  refer();
  expect(asked()).toBe(1);
  waitlist();
  expect(asked()).toBe(0);
  const movement = state.movements.find((row) => row.id === movementId)!;
  expect(movement.declines).toHaveLength(2);
  expect(movement.withdrawnReferrals).toHaveLength(1);
  expect(movement.referralAnswerHistory).toEqual([
    { unitId, at: NOW_ANCHOR, answer: "waitlisted" },
    { unitId, at: NOW_ANCHOR, answer: "withdrawn" },
    { unitId, at: NOW_ANCHOR, answer: "waitlisted" },
  ]);
});
