import { describe, expect, it } from "vitest";

import {
  edBedSearchStep,
  openWardReferralFor,
  referredToLabel,
} from "@/components/ward-management/ed/ed-bed-search-step";
import { edReferralSheetHref } from "@/components/ward-management/referrals/open-referral-sheet";
import { referralSheetRequestFromHref } from "@/components/ward-management/referrals/referral-sheet-link";
import type { Referral } from "@/components/ward-management/ward-model";

/**
 * S-7 and A2-5 (audit 13 Oct 2026): after an inpatient order the ED primary carries on the bed
 * search, and a ward referral the ED sent shows on its own row.
 */
const examined = {
  examination: { at: 0, outcome: "inpatient_order" as const },
  edOutcome: undefined,
  closure: undefined,
  acceptedUnitId: undefined,
  referredUnitIds: [] as string[],
  stage: "placement_requested" as const,
};

describe("edBedSearchStep", () => {
  it("makes Refer to a ward the next step after an inpatient order", () => {
    expect(edBedSearchStep(examined, false)).toBe("refer");
  });

  it("is underway once a ward is asked, a bed accepted or a referral is waiting", () => {
    expect(edBedSearchStep({ ...examined, referredUnitIds: ["u1"] }, false)).toBe("underway");
    expect(edBedSearchStep({ ...examined, acceptedUnitId: "u1" }, false)).toBe("underway");
    expect(edBedSearchStep(examined, true)).toBe("underway");
  });

  it("leaves every other examination outcome to the usual order", () => {
    expect(edBedSearchStep({ ...examined, examination: { at: 0, outcome: "community_order" } }, false)).toBe(undefined);
    expect(edBedSearchStep({ ...examined, examination: undefined }, false)).toBe(undefined);
  });
});

describe("openWardReferralFor", () => {
  const ward = (state: "queued" | "accepted", withdrawnAt?: number) =>
    ({
      id: "RF-X",
      patientId: "PT-1",
      destinations: [{ destination: { kind: "psychiatric_ward", unitId: "bty-older" }, state, withdrawnAt }],
    }) as unknown as Referral;

  it("finds a queued ward referral for the person", () => {
    expect(openWardReferralFor("PT-1", [ward("queued")])?.unitIds).toEqual(["bty-older"]);
  });

  it("ignores answered, withdrawn and other people's referrals", () => {
    expect(openWardReferralFor("PT-1", [ward("accepted")])).toBeUndefined();
    expect(openWardReferralFor("PT-1", [ward("queued", 5)])).toBeUndefined();
    expect(openWardReferralFor("PT-2", [ward("queued")])).toBeUndefined();
    expect(openWardReferralFor(undefined, [ward("queued")])).toBeUndefined();
  });

  it("says where it went in a few words", () => {
    expect(referredToLabel(["a"], () => "BTY Older Adult — Bentley")).toBe("Referred to BTY Older Adult");
    expect(referredToLabel(["a", "b"], () => "x")).toBe("Referred to 2 wards");
  });
});

describe("edReferralSheetHref", () => {
  it("opens the slide-out for the person, from this ED, to a ward", () => {
    const request = referralSheetRequestFromHref(edReferralSheetHref("PT-1", "peel-ed"), "http://localhost");
    expect(request).toMatchObject({ category: "ed", destination: "ward", personId: "PT-1" });
    expect(request?.originSiteCode).toBeTruthy();
  });
});
