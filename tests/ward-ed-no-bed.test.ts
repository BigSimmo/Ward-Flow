import { describe, expect, it } from "vitest";
import { edHasNoBedYet } from "@/components/ward-management/ed/ed-no-bed";
import type { Movement } from "@/components/ward-management/ward-model";

const base = { stage: "placement_requested", referredUnitIds: [] } as unknown as Movement;

describe("edHasNoBedYet (S-19)", () => {
  it("counts a search with or without referrals out, and nothing past it", () => {
    expect(edHasNoBedYet(base)).toBe(true);
    expect(edHasNoBedYet({ ...base, stage: "destination_review", referredUnitIds: ["u1"] } as Movement)).toBe(true);
    expect(edHasNoBedYet({ ...base, stage: "accepted_awaiting_bed" } as Movement)).toBe(false);
    expect(edHasNoBedYet({ ...base, acceptedUnitId: "u1" } as Movement)).toBe(false);
    expect(edHasNoBedYet({ ...base, edOutcome: "for_discharge" } as Movement)).toBe(false);
    expect(edHasNoBedYet({ ...base, closure: { reason: "The referrer withdrew the referral" } } as Movement)).toBe(false);
  });
});
