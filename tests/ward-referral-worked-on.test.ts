import { describe, expect, it } from "vitest";

import { referralWorkedOnBy, workedOnLine } from "@/components/ward-management/referrals/referral-worked-on";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Smart features idea 3 (overall review, 20 Oct 2026): "Being worked on by <desk>" on a referral. */
const NOW = NOW_ANCHOR;

function fixture() {
  const seeded = seedWardFlowState();
  const unit = seeded.units[0]!;
  const base = seeded.referrals[0]!;
  const referral: Referral = {
    ...base,
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: unit.id,
          sex: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "queued",
        referredAt: NOW - 60,
      },
    ],
  };
  // A bed request raised from this referral, still waiting on a ward's answer.
  const template = seeded.movements.find((movement) => !movement.closure)!;
  const movement: Movement = {
    ...template,
    id: "WF-T-WORKED" as Movement["id"],
    referralId: base.id,
    stage: "destination_review",
    referredAt: NOW - 30,
    referralDecisionOpenedAt: undefined,
    closure: undefined,
  };
  const state: WardFlowState = {
    ...seeded,
    referrals: seeded.referrals.map((candidate) => (candidate.id === base.id ? referral : candidate)),
    movements: [...seeded.movements, movement],
  };
  return { state, referralId: base.id, unit, movement };
}

const desksOf = (state: WardFlowState, referralId: string) =>
  referralWorkedOnBy(
    state.referrals.find((referral) => referral.id === referralId)!,
    state,
  );

describe("referralWorkedOnBy", () => {
  it("names nobody until a desk opens or claims the referral", () => {
    const f = fixture();
    expect(desksOf(f.state, f.referralId)).toEqual([]);
    expect(workedOnLine([])).toBeUndefined();
  });

  it("names the ward that opened it, by the ward's name, until that ward answers", () => {
    const f = fixture();
    const opened = wardFlowReducer(f.state, {
      type: "MARK_REFERRAL_OPENED",
      role: "ward",
      now: NOW,
      referralId: f.referralId,
      unitId: f.unit.id,
      actingUnitId: f.unit.id,
    });
    expect(opened.rejections).toEqual([]);
    expect(desksOf(opened, f.referralId)).toEqual([f.unit.name]);
    expect(workedOnLine(desksOf(opened, f.referralId))).toBe(`Being worked on by ${f.unit.name}`);
  });

  it("names the desk that took the referral's task row, by its desk name and never a person", () => {
    const f = fixture();
    const taken = wardFlowReducer(f.state, {
      type: "TAKE_INBOX_ITEM_OWNERSHIP",
      role: "coordinator",
      now: NOW,
      inboxItemId: `target-pending-referral-decision-${f.movement.id}`,
    });
    expect(taken.rejections).toEqual([]);
    expect(desksOf(taken, f.referralId)).toEqual(["Bed coordinator"]);

    const opened = wardFlowReducer(taken, {
      type: "MARK_REFERRAL_OPENED",
      role: "ward",
      now: NOW + 1,
      referralId: f.referralId,
      unitId: f.unit.id,
      actingUnitId: f.unit.id,
    });
    expect(workedOnLine(desksOf(opened, f.referralId))).toBe(`Being worked on by Bed coordinator and ${f.unit.name}`);
  });

  it("says nothing once the referral is no longer waiting for answers", () => {
    const f = fixture();
    const opened = wardFlowReducer(f.state, {
      type: "MARK_REFERRAL_OPENED",
      role: "ward",
      now: NOW,
      referralId: f.referralId,
      unitId: f.unit.id,
      actingUnitId: f.unit.id,
    });
    const referral = opened.referrals.find((candidate) => candidate.id === f.referralId)!;
    const answered: Referral = {
      ...referral,
      destinations: referral.destinations.map((arm) => ({ ...arm, state: "declined" as const, decidedAt: NOW + 5 })),
    };
    expect(referralWorkedOnBy(answered, opened)).toEqual([]);
  });
});
