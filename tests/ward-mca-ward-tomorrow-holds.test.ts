import { describe, expect, it } from "vitest";

import { readyBedsNow } from "@/components/ward-management/ward-bed-states";
import { wardReferralInboxEntries } from "@/components/ward-management/referrals/referral-inbox";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardTomorrowOutlook } from "@/components/ward-management/ward/ward-home-outlook";

/**
 * M8 (mechanics and clock audit, 14 Nov 2026): the ward page's Tomorrow figure ignored a bed already
 * named for an accepted referral, so it counted that bed as free while Ready on the same page held
 * it (D-115 item 3). Synthetic seed data only: RF-005 accepted into bty-older-adult bed 1, as in
 * tests/ward-d115-named-holds-everywhere.test.ts.
 */
const seed = seedWardFlowState();
const state = wardFlowReducer(seed, {
  type: "ACCEPT_REFERRAL",
  role: "ward",
  now: NOW_ANCHOR,
  referralId: "RF-005",
  destinationKind: "psychiatric_ward",
  unitId: "bty-older-adult",
  actingUnitId: "bty-older-adult",
  bedNumber: 1,
} as Parameters<typeof wardFlowReducer>[1]);
const unit = state.units.find((candidate) => candidate.id === "bty-older-adult")!;
const accepted = state.movements.filter((movement) => movement.acceptedUnitId === unit.id && !movement.closure);

describe("M8: Tomorrow on the ward page holds a bed named for an accepted referral", () => {
  it("reaches the case: the named bed is off Ready", () => {
    expect(state.rejections).toHaveLength(seed.rejections.length);
    const holds = [...state.movements, ...state.referrals];
    expect(readyBedsNow(unit, state.admissions, state.bedReleases, holds)).toBe(
      readyBedsNow(unit, state.admissions, state.bedReleases, state.movements) - 1,
    );
  });

  it("Tomorrow is one lower with the referral's named bed than without it", () => {
    const args = [unit, state.bedReleases, state.admissions, accepted, state.plannedAdmissions, NOW_ANCHOR] as const;
    const without = wardTomorrowOutlook(...args, [])!;
    // The ward page passes its own inbox (`wardReferralInbox(unit.id)`), never the full referrals
    // (FD-23 screen boundary), so the hold must survive that projection.
    const withHold = wardTomorrowOutlook(...args, wardReferralInboxEntries(state.referrals, unit.id))!;
    expect(withHold.likely).toBe(without.likely - 1);
  });
});
