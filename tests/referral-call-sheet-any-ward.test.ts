import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { callSheetGroups, openCommitmentItems } from "@/components/ward-management/referrals/referral-commitments-model";
import { isAwaitingAnswer } from "@/components/ward-management/ward-referrals";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Audit P031: one waiting referral sent to "Any suitable ward" (a ward copy naming no unit). */
function anyWardFixture() {
  const seeded = seedWardFlowState();
  const units = seeded.units.slice(0, 2);
  const base = seeded.referrals.find((referral) => referral.id === "RF-005")!;
  const referral: Referral = {
    ...base,
    contactLog: undefined,
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          sex: "Male",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "queued",
        referredAt: NOW_ANCHOR - 60,
      },
    ],
  };
  return { referral, units };
}

describe("call sheet counts 'Any suitable ward' referrals (P031)", () => {
  it("lists a waiting unnamed-ward referral once under each ward, as the shared waiting rule reports it", () => {
    const { referral, units } = anyWardFixture();
    expect(referral.destinations.filter(isAwaitingAnswer)).toHaveLength(1);

    const groups = callSheetGroups([referral], units);
    expect(groups.map((group) => group.unitId)).toEqual(units.map((unit) => unit.id));
    for (const group of groups) {
      expect(group.items.map((item) => item.referral.id)).toEqual([referral.id]);
    }
  });

  it("drops the referral from the sheet once the copy is no longer waiting", () => {
    const { referral, units } = anyWardFixture();
    const withdrawn: Referral = {
      ...referral,
      destinations: referral.destinations.map((arm) => ({ ...arm, withdrawnAt: NOW_ANCHOR })),
    };
    expect(callSheetGroups([withdrawn], units)).toEqual([]);
  });

  it("leaves the unit-free item list unchanged for callers that pass no wards", () => {
    const { referral } = anyWardFixture();
    expect(openCommitmentItems([referral])).toEqual([]);
  });
});
