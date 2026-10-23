import { describe, expect, it } from "vitest";
import {
  clearanceItems,
  clearanceNeeded,
  communityReferralError,
  communityTeamsMatching,
  communityUrgency,
} from "../src/components/ward-management/referrals/community-short-form";
import { EMPTY_DOCUMENTATION } from "../src/components/ward-management/referrals/referral-flow-panels";
import { parseFollowUpClinicSet, S2015_CATCHMENT_ROWS } from "../src/components/ward-management/ward-catchment";
import { communityTeamOptions } from "../src/components/ward-management/referrals/referral-destination-options";

// D-77 short community form. Josh, 23 Oct 2026: first contact sets the urgency tier.
describe("community short form", () => {
  it("maps first contact to the urgency tier, and leaves it unset until chosen", () => {
    expect(communityUrgency("24 hours")).toBe("1");
    expect(communityUrgency("72 hours")).toBe("2");
    expect(communityUrgency("7 days")).toBe("3");
    expect(communityUrgency(undefined)).toBe("");
  });

  it("asks the purpose, then one clearance question with its follow-up details when not cleared", () => {
    expect(communityReferralError("", EMPTY_DOCUMENTATION)).toBe("Choose what the community referral is for.");
    expect(communityReferralError("follow_up", EMPTY_DOCUMENTATION)).toBe(
      "Answer whether medical clearance is complete.",
    );
    expect(communityReferralError("follow_up", { ...EMPTY_DOCUMENTATION, medical: "yes" })).toBeNull();
    const pending = { ...EMPTY_DOCUMENTATION, medical: "no" as const };
    expect(communityReferralError("assess_for_admission", pending)).toBe(
      "Add expected medical clearance, a clarification contact and phone number.",
    );
    expect([clearanceNeeded(EMPTY_DOCUMENTATION), clearanceItems(EMPTY_DOCUMENTATION)]).toEqual([1, 1]);
    expect([clearanceNeeded(pending), clearanceItems(pending)]).toEqual([3, 4]);
    expect(clearanceNeeded({ ...pending, expectedAt: "2026-10-23T12:00", contactName: "A", contactPhone: "1" })).toBe(
      0,
    );
  });

  it("finds teams by name or by a suburb they follow up", () => {
    const teams = communityTeamOptions();
    expect(communityTeamsMatching(teams, "  ")).toBe(teams);
    expect(communityTeamsMatching(teams, "albany")).toContain("Albany");
    // A suburb finds its team even when no team's name contains it.
    const row = S2015_CATCHMENT_ROWS.find(
      (entry) => !teams.some((team) => team.toLowerCase().includes(entry.suburb.toLowerCase())),
    )!;
    const team = parseFollowUpClinicSet(row.followUpClinicVerbatim)[0]!;
    expect(communityTeamsMatching(teams, row.suburb).map((name) => name.toLowerCase())).toContain(team.toLowerCase());
    expect(communityTeamsMatching(teams, "zzzz")).toEqual([]);
  });
});
