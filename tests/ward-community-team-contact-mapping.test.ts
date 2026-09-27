import { describe, expect, it } from "vitest";

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { RATIFIED_SERVICE_ALIASES } from "@/components/ward-management/community/community-ratified-aliases";
import {
  COMMUNITY_TEAM_CONTACT_MAPPINGS,
  contactDecisionFor,
  contactForTeam,
  mappedTeamNames,
} from "@/components/ward-management/community/community-team-contact-mapping";
import { REFERENCE_TEAM_NAMES } from "@/components/ward-management/reference/ward-reference-teams";

/**
 * THE TABLE PAIRING A PROTOTYPE TEAM NAME WITH A REAL SERVICE'S PUBLISHED PHONE NUMBER.
 *
 * 🔴 **WHAT MAKES THIS WORTH GUARDING IS THE CONSEQUENCE, NOT THE CODE.** A coordinator rings this
 * number. A row pointing at the wrong service produces a real call to a real service about a patient
 * who is not theirs — and it is the failure nobody notices until somebody has already rung, because
 * a wrong number that connects looks exactly like a right one.
 *
 * ⚠️ **`Osborne` and `Osborne Park` are two real services whose published numbers differ by one
 * digit.** That is the distance between correct and wrong here.
 */
describe("community team contact mapping", () => {
  it("knows what it is checking against, so no assertion below can pass by measuring nothing", () => {
    expect(COMMUNITY_TEAM_CONTACT_MAPPINGS.length).toBeGreaterThanOrEqual(10);
    expect(COMMUNITY_TEAM_PAGES.length).toBeGreaterThan(50);
    expect(REFERENCE_TEAM_NAMES.length).toBeGreaterThan(20);
    expect(RATIFIED_SERVICE_ALIASES.length).toBeGreaterThanOrEqual(1);
  });

  it("names a team the app actually offers on every row", () => {
    const offered = new Set(COMMUNITY_TEAM_PAGES.map((team) => team.name));
    for (const mapping of COMMUNITY_TEAM_CONTACT_MAPPINGS) {
      expect(offered.has(mapping.teamName), `${mapping.teamName} is mapped but no screen offers it`).toBe(true);
    }
  });

  it("names a service the register actually holds on every row", () => {
    const known = new Set(REFERENCE_TEAM_NAMES);
    for (const mapping of COMMUNITY_TEAM_CONTACT_MAPPINGS) {
      expect(known.has(mapping.serviceName), `${mapping.teamName} points at an unknown service`).toBe(true);
    }
  });

  it("resolves every mapped row to a real published phone number", () => {
    for (const mapping of COMMUNITY_TEAM_CONTACT_MAPPINGS) {
      const detail = contactForTeam(mapping.teamName);
      expect(detail, mapping.teamName).not.toBeNull();
      expect(detail!.publishedPhone, `${mapping.teamName} resolved to a service with no phone`).toBeTruthy();
    }
  });

  it("carries who decided each row and when, because a pairing is a decision and not a lookup", () => {
    for (const mapping of COMMUNITY_TEAM_CONTACT_MAPPINGS) {
      expect(mapping.decidedBy.trim(), mapping.teamName).not.toBe("");
      expect(mapping.decidedOn, mapping.teamName).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(mapping.reason.trim().length, `${mapping.teamName} has no reason beside it`).toBeGreaterThan(20);
    }
  });

  it("reaches every member of a ratified alias group from a row naming only one", () => {
    // The owner ruled on 2026-09-05 that the four Inner City spellings are one service. The mapping
    // names one member; the other three must resolve through the ratified table rather than through
    // a repeated row that could drift away from it.
    for (const name of ["Inner City", "ICC", "Inner City Clinic", "Inner City (central)"]) {
      expect(contactForTeam(name), `${name} did not reach City East`).not.toBeNull();
      expect(contactForTeam(name)!.publishedPhone).toBe("08 9224 1720");
    }
    expect(COMMUNITY_TEAM_CONTACT_MAPPINGS.filter((m) => m.teamName.startsWith("Inner City")).length).toBe(1);
  });

  it("refuses a team nobody has paired, and says nothing about it", () => {
    expect(contactForTeam("Joondalup")).toBeNull();
    expect(contactDecisionFor("Joondalup")).toBeNull();
  });

  it("maps Osborne Park to the ADULT service, and records that the address said otherwise", () => {
    /*
     * 🔴 THIS TEST ASSERTED THE OPPOSITE UNTIL THE OWNER RULED ON IT, 2026-09-18, AND THE
     * REASONING IS KEPT RATHER THAN REPLACED.
     *
     * Two register services answer to this name and their published numbers differ by ONE DIGIT:
     * Osborne CMHS on 08 6457 8350, Osborne Park Older Adult MHS on 08 6457 8300. The adult rule
     * points at the first. The ADDRESS points at the second — Osborne CMHS sits at Osborne Place,
     * Stirling, while "Osborne Park" is the older-adult service's own hospital.
     *
     * ⚠️ **So one real signal was overridden to get here, and that is why this is pinned to
     * the exact number rather than to "not null".** It was left unmapped deliberately until a person
     * chose, because a wrong number here CONNECTS to a real service — the failure nobody notices
     * until somebody has already rung. The owner was asked in exactly those terms and said use the
     * adult one.
     *
     * Anyone changing this line is reversing an owner ruling, not correcting a fixture.
     */
    expect(contactForTeam("Osborne Park")?.publishedPhone).toBe("08 6457 8350");
    expect(contactForTeam("Osborne")?.publishedPhone).toBe("08 6457 8350");
    expect(contactForTeam("Osborne Park")?.publishedPhone).not.toBe("08 6457 8300");
  });

  it("maps no team to a service whose number belongs to a different cohort's clinic", () => {
    // The adult rule, asserted rather than trusted: no mapped row may resolve to a phone number that
    // another register entry also publishes, unless a person wrote a reason naming the collision.
    const phones = new Map<string, string[]>();
    for (const mapping of COMMUNITY_TEAM_CONTACT_MAPPINGS) {
      const phone = contactForTeam(mapping.teamName)?.publishedPhone;
      if (!phone) continue;
      phones.set(phone, [...(phones.get(phone) ?? []), mapping.teamName]);
    }
    for (const [phone, teams] of phones) {
      if (teams.length === 1) continue;
      for (const team of teams) {
        const reason = COMMUNITY_TEAM_CONTACT_MAPPINGS.find((m) => m.teamName === team)!.reason;
        expect(
          /same service|same clinic|combined/iu.test(reason),
          `${team} shares ${phone} with ${teams.filter((t) => t !== team).join(", ")} and its reason does not say why`,
        ).toBe(true);
      }
    }
  });

  it("reports every name it reaches, aliases included", () => {
    const names = mappedTeamNames();
    expect(names).toContain("Inner City Clinic");
    expect(names).toContain("Bentley");
    expect(names).toContain("Osborne Park");
    expect(new Set(names).size, "mappedTeamNames returned a duplicate").toBe(names.length);
  });
});
