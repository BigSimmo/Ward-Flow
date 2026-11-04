import { describe, expect, it } from "vitest";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { bedMapWards } from "../src/components/ward-management/capacity/bed-map";
import { networkWardRows } from "../src/components/ward-management/capacity/capacity-derivations";
import { headlineAvailable } from "../src/components/ward-management/ward-board-derivations";
import { toHandoverWard } from "../src/components/ward-management/handover/handover-model";
import { wardReferralInboxEntries } from "../src/components/ward-management/referrals/referral-inbox";

describe("named reservation readers", () => {
  it("reconciles Capacity, its map, Handover and the ward-only board projection", () => {
    const state = seedWardFlowState();
    const original = state.units[0]!;
    const unit = {
      ...original,
      beds: 1,
      blocked: 0,
      isClosed: false,
      closedBeds: [],
      empty: { ...original.empty, value: 1 },
      allocatable: { ...original.allocatable, value: 1 },
    };
    const originalReferral = state.referrals[0]!;
    const referral = {
      ...originalReferral,
      destinations: [
        {
          ...originalReferral.destinations[0]!,
          state: "accepted" as const,
          destination: {
            kind: "psychiatric_ward" as const,
            unitId: unit.id,
            sex: "Female" as const,
            gender: "Female" as const,
            secureBedNeeded: false,
            involuntaryBedNeeded: false,
            highAcuityNursingNeeded: false,
          },
          acceptedUnitId: unit.id,
          heldBedNumber: 1,
          withdrawnAt: undefined,
        },
      ],
    };
    const referrals = [referral];
    expect(networkWardRows([unit], 0, [], [], [], referrals)[0]).toMatchObject({ ready: 0, pulled: 1 });
    expect(bedMapWards([unit], [], [], [], referrals)[0]).toMatchObject({ ready: 0, pulled: 1 });
    expect(toHandoverWard(unit, [], 0, [], referrals)).toMatchObject({ ready: 0, held: 1 });
    expect(headlineAvailable(unit, [], [], [], 0, wardReferralInboxEntries(referrals, unit.id))).toBe(0);
    expect(headlineAvailable(unit, [], [], [], 0)).toBe(1);
  });
});
