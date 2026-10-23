import { describe, expect, it } from "vitest";

import { readyUnitCount } from "@/components/ward-management/referrals/referral-board-parts";
import { referralEligibility } from "@/components/ward-management/ward-eligibility";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral, ReferralAddressing } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Follow-up to Ask more wards (D-76, #578): the referral board's Fit figure counts every ward still
 * waiting, not only the first one asked. Synthetic data only.
 */

const BASE = seedWardFlowState();
const destination = (unitId: string) => ({
  kind: "psychiatric_ward" as const,
  unitId,
  sex: "Female" as const,
  gender: "Female" as const,
  secureBedNeeded: false,
  involuntaryBedNeeded: false,
  highAcuityNursingNeeded: false,
});
const referral = (destinations: ReferralAddressing[]): Referral => ({
  ...BASE.referrals[0],
  source: "community",
  ageBand: "Adult",
  destinations,
});
const fits = (unitId: string) =>
  referralEligibility(
    referral([]),
    destination(unitId),
    BASE.units.find((unit) => unit.id === unitId)!,
    NOW_ANCHOR,
  ).eligible;
const open = BASE.units.filter((unit) => !unit.isClosed).map((unit) => unit.id);
const [FIT_A, FIT_B] = open.filter(fits);
const NO_FIT = open.find((unitId) => !fits(unitId))!;
const arm = (unitId: string, state: ReferralAddressing["state"] = "queued"): ReferralAddressing => ({
  destination: destination(unitId),
  state,
});

describe("readyUnitCount with several wards asked", () => {
  it("counts a later ward that fits when the first ward asked does not", () => {
    expect(readyUnitCount(referral([arm(NO_FIT), arm(FIT_A)]), BASE.units, NOW_ANCHOR)).toBe(1);
  });

  it("counts each waiting ward that fits once, and ignores wards that answered", () => {
    expect(readyUnitCount(referral([arm(FIT_A), arm(FIT_B)]), BASE.units, NOW_ANCHOR)).toBe(2);
    expect(readyUnitCount(referral([arm(FIT_A, "declined"), arm(FIT_B)]), BASE.units, NOW_ANCHOR)).toBe(1);
  });

  it("has no figure once no ward bed is still asked for", () => {
    expect(readyUnitCount(referral([arm(FIT_A, "declined")]), BASE.units, NOW_ANCHOR)).toBeUndefined();
  });
});
