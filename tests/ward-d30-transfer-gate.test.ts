import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardTransferNeedsCoordinator } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const ORIGIN_UNIT_ID = "bty-adult-secure";

function referFrom(state: WardFlowState, destinationUnitId: string) {
  const destination = state.units.find((unit) => unit.id === destinationUnitId)!;
  const next = wardFlowReducer(state, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW_ANCHOR,
    ageBand: "Adult",
    source: "psychiatric_ward",
    originUnitId: ORIGIN_UNIT_ID,
    originSiteCode: "BTY",
    urgency: 2,
    destinations: [
      {
        kind: "psychiatric_ward",
        unitId: destination.id,
        sex: "Female",
        gender: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Bentley" },
    transportNeeded: true,
    history: "Synthetic stepdown transfer request.",
  });
  expect(next.rejections.map((rejection) => rejection.reason)).toEqual([]);
  return { state: next, referralId: next.referrals.at(-1)!.id };
}

describe("D-30: transfers from a ward at another hospital", () => {
  const seed = seedWardFlowState("standard");
  const origin = seed.units.find((unit) => unit.id === ORIGIN_UNIT_ID)!;
  const elsewhere = seed.units.find((unit) => unit.siteCode !== origin.siteCode && unit.cohort === "Adult")!;
  const sameSite = seed.units.find((unit) => unit.siteCode === origin.siteCode && unit.id !== origin.id);

  it("needs the coordinator only when the two wards are on different sites", () => {
    const fromWard = { source: "psychiatric_ward" as const, originUnitId: ORIGIN_UNIT_ID };
    expect(wardTransferNeedsCoordinator(fromWard, elsewhere.id, seed.units)).toBe(true);
    if (sameSite) expect(wardTransferNeedsCoordinator(fromWard, sameSite.id, seed.units)).toBe(false);
    expect(wardTransferNeedsCoordinator({ source: "psychiatric_ward" }, elsewhere.id, seed.units)).toBe(true);
    expect(wardTransferNeedsCoordinator({ source: "community" }, elsewhere.id, seed.units)).toBe(false);
  });

  it("refuses the receiving ward's acceptance and leaves the referral queued", () => {
    const { state, referralId } = referFrom(seed, elsewhere.id);
    const after = wardFlowReducer(state, {
      type: "ACCEPT_REFERRAL",
      role: "ward",
      now: NOW_ANCHOR + 5,
      referralId,
      destinationKind: "psychiatric_ward",
      unitId: elsewhere.id,
    });
    expect(after.rejections.at(-1)?.reason).toMatch(/^D-30:/);
    const arm = after.referrals.find((referral) => referral.id === referralId)!.destinations[0];
    expect(arm.state).toBe("queued");
  });

  it("does not stop the coordinator for D-30", () => {
    const { state, referralId } = referFrom(seed, elsewhere.id);
    const after = wardFlowReducer(state, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW_ANCHOR + 5,
      referralId,
      destinationKind: "psychiatric_ward",
      unitId: elsewhere.id,
    });
    expect(after.rejections.some((rejection) => rejection.reason.startsWith("D-30:"))).toBe(false);
  });
});
