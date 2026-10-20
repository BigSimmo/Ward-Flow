import { describe, expect, it } from "vitest";

import { defaultPickupSiteCode } from "@/components/ward-management/patients/transport-pickup";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { edById, wardSites } from "@/components/ward-management/ward-sites";

/** Smart features idea 9: the pickup site a booking opens with comes from the referral. */
describe("defaultPickupSiteCode", () => {
  const state = seedWardFlowState();
  const movement = state.movements.find((candidate) => edById(candidate.originEdId) !== undefined)!;
  const second = wardSites.map((site) => site.code)[1];

  it("takes the referral's origin site first", () => {
    const referral = { id: "RF-PICKUP", originSiteCode: second! };
    expect(defaultPickupSiteCode({ ...movement, referralId: referral.id }, [referral])).toBe(second);
  });

  it("falls back to the bed request's origin ED, and never guesses past a known site", () => {
    expect(defaultPickupSiteCode({ ...movement, referralId: undefined }, [])).toBe(
      edById(movement.originEdId)!.siteCode,
    );
    expect(
      defaultPickupSiteCode({ referralId: "RF-X", originEdId: "no-such-ed" }, [{ id: "RF-X", originSiteCode: "ZZZ" }]),
    ).toBeUndefined();
  });
});
