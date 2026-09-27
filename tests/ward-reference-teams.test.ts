import { describe, expect, it } from "vitest";

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import {
  REFERENCE_TEAM_CAVEAT,
  REFERENCE_TEAM_NAMES,
  referenceTeamDetail,
} from "@/components/ward-management/reference/ward-reference-teams";

/**
 * THE REGISTER'S PUBLISHED CONTACT DETAIL, AND THE BOUNDARY IT KEEPS.
 *
 * `ward-reference-teams.ts` is generated from the research pack and holds the phone number, hours
 * and referral email a public directory prints for a real WA community mental health service.
 *
 * 🔴 **WHAT THIS FILE IS REALLY GUARDING IS THE MATCH, NOT THE DATA.** The pack forbids matching a
 * service on suburb, postcode, LGA or proximity, by name. The reason is not tidiness: a phone
 * number attached to the wrong clinic is worse than no phone number, because a coordinator would
 * ring it. So the lookup is EXACT NAME ONLY, an unmatched team returns `null`, and the count of
 * teams that do match is pinned below rather than left to drift.
 *
 * ⚠️ **AND THE COUNT IS PINNED IN BOTH DIRECTIONS.** A test asserting only "some teams match" would
 * pass if a fuzzy matcher were introduced tomorrow and matched everything. The floor catches the
 * register being emptied; the exact figure catches it being widened.
 */
describe("the register's community-team contact detail", () => {
  const matched = COMMUNITY_TEAM_PAGES.filter((team) => referenceTeamDetail(team.name) !== null);

  it("knows what it is checking against, so a pass cannot come from an empty list", () => {
    // The canary. Every assertion below passes by finding something; an empty register or an empty
    // team list would read identically to a healthy one.
    expect(REFERENCE_TEAM_NAMES.length).toBeGreaterThan(20);
    expect(COMMUNITY_TEAM_PAGES.length).toBeGreaterThan(50);
  });

  it("carries no numeric field at all, so no capacity figure can reach an operational one", () => {
    for (const name of REFERENCE_TEAM_NAMES) {
      const detail = referenceTeamDetail(name);
      expect(detail, name).not.toBeNull();
      for (const [key, value] of Object.entries(detail!)) {
        expect(typeof value, `${name}.${key}`).not.toBe("number");
      }
    }
  });

  it("resolves a real team to its published number, and an unknown name to null", () => {
    expect(referenceTeamDetail("Butler Community Mental Health Service")?.publishedPhone).toBe("08 6372 1500");
    expect(referenceTeamDetail("A team that does not exist")).toBeNull();
  });

  it("never returns an empty string where it means 'the register does not say'", () => {
    for (const name of REFERENCE_TEAM_NAMES) {
      const detail = referenceTeamDetail(name)!;
      for (const [key, value] of Object.entries(detail)) {
        if (typeof value === "string") expect(value.trim(), `${name}.${key}`).not.toBe("");
      }
    }
  });

  it("matches by exact name only — a near-miss resolves to nothing", () => {
    const [first] = REFERENCE_TEAM_NAMES;
    expect(referenceTeamDetail(first)).not.toBeNull();
    expect(referenceTeamDetail(`${first} (North)`)).toBeNull();
    expect(referenceTeamDetail(first.replace(/\s/u, ""))).toBeNull();
  });

  it("tolerates surrounding whitespace, because a name read from a record may carry it", () => {
    const [first] = REFERENCE_TEAM_NAMES;
    expect(referenceTeamDetail(`  ${first}  `)).not.toBeNull();
  });

  it("states its caveat in one sentence, and says the detail is not call-tested", () => {
    expect(REFERENCE_TEAM_CAVEAT).toMatch(/not call-tested/iu);
    expect(REFERENCE_TEAM_CAVEAT).toMatch(/not confirmed by the service/iu);
  });
});
