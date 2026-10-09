import { describe, expect, it } from "vitest";

import {
  REFERRAL_SHEET_PATH,
  referralSheetRequestFromHref,
  referralSheetRequestFromSearch,
} from "@/components/ward-management/referrals/referral-sheet-link";
import { raiseReferralHref } from "@/components/ward-management/shell/ward-facade";
import { REFERRAL_SOURCES } from "@/components/ward-management/ward-model";
import { WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

/**
 * THE REFERRAL SLIDE-OUT READS THE QUERY CONTRACT.
 *
 * The full-page intake form was retired on 8 Oct 2026: the referral slide-out is the one place a
 * referral is written, and any link to `/mockups/ward-flow/referrals/new` opens it in place. The
 * contract is still `RaiseReferralTarget` in `shell/ward-facade.ts`, built by `raiseReferralHref`
 * and by nothing else; `referrals/referral-sheet-link.ts` reads it.
 *
 *     patientId    → `personId`, the person the slide-out opens with (checked against the record there)
 *     source       → where it comes from, as the slide-out groups it (community / ED / ward)
 *     refer        → where it goes, the slide-out's first choice
 *     originEdId   → resolves through the ED's own `siteCode` to the referring site
 *     teamId       → NOWHERE: the model holds a team's name, not an id
 *
 * Unknown or blank values are dropped, never guessed.
 */
const BASE = "https://ward-flow.test";
const search = (query: string) => referralSheetRequestFromSearch(new URLSearchParams(query));

describe("the slide-out route is one fact", () => {
  it("reads the same path the rail and the facade use", () => {
    expect(REFERRAL_SHEET_PATH).toBe(WARD_REFERRAL_INTAKE_HREF);
    expect(raiseReferralHref({}).split("?")[0]).toBe(REFERRAL_SHEET_PATH);
  });
});

describe("source → where the referral comes from", () => {
  it("groups every model source into community, ED or ward", () => {
    // Non-vacuity: the loop below must have something to iterate.
    expect(REFERRAL_SOURCES.length).toBeGreaterThan(0);
    for (const source of REFERRAL_SOURCES) {
      const { category } = search(`source=${source}`);
      expect(["community", "ed", "ward"]).toContain(category);
    }
    expect(search("source=ed_medical").category).toBe("ed");
    expect(search("source=inter_hospital").category).toBe("ward");
    expect(search("source=psychiatric_ward").category).toBe("ward");
    expect(search("source=community").category).toBe("community");
  });

  it("drops a source the model cannot hold, rather than guessing one", () => {
    expect(search("source=gp-surgery")).toEqual(search(""));
    expect(search("source=")).toEqual(search(""));
  });
});

describe("refer → where the referral goes", () => {
  it.each(["ward", "community", "ed"] as const)("reads refer=%s", (destination) => {
    expect(search(`refer=${destination}`).destination).toBe(destination);
  });

  it("drops an unknown or blank destination", () => {
    expect(search("refer=hospital")).not.toHaveProperty("destination");
    expect(search("refer=")).not.toHaveProperty("destination");
    expect(search("refer=ED")).not.toHaveProperty("destination");
  });
});

describe("patientId → the person the slide-out opens with", () => {
  it("carries the id through, trimmed", () => {
    expect(search("patientId=PT-001").personId).toBe("PT-001");
    expect(search("patientId=%20PT-001%20").personId).toBe("PT-001");
  });

  it("drops a blank id rather than sending an empty one", () => {
    expect(search("patientId=")).not.toHaveProperty("personId");
    expect(search("patientId=%20%20")).not.toHaveProperty("personId");
  });
});

describe("originEdId → the referring site", () => {
  it("resolves a real department to its own site code", () => {
    const departments = allEmergencyDepartments();
    expect(departments.length).toBeGreaterThan(0);
    for (const department of departments) {
      expect(search(`originEdId=${department.id}`).originSiteCode).toBe(department.siteCode);
    }
  });

  it("drops a department the network does not have", () => {
    expect(search("originEdId=nowhere-ed")).not.toHaveProperty("originSiteCode");
    expect(search("originEdId=")).not.toHaveProperty("originSiteCode");
  });
});

describe("teamId is not read", () => {
  it("adds nothing for a team id, because the model holds a team's name, not an id", () => {
    expect(search("teamId=armadale-cmht")).toEqual(search(""));
  });
});

describe("a link → the request it carries", () => {
  it("round-trips every field raiseReferralHref writes", () => {
    const department = allEmergencyDepartments()[0];
    const href = raiseReferralHref({
      patientId: "PT-001",
      source: "ed_medical",
      refer: "community",
      originEdId: department.id,
    });
    expect(referralSheetRequestFromHref(href, BASE)).toEqual({
      category: "ed",
      destination: "community",
      personId: "PT-001",
      originSiteCode: department.siteCode,
    });
  });

  it("reads the bare route, with or without a trailing slash", () => {
    expect(referralSheetRequestFromHref(REFERRAL_SHEET_PATH, BASE)).toEqual(search(""));
    expect(referralSheetRequestFromHref(`${REFERRAL_SHEET_PATH}/`, BASE)).toEqual(search(""));
    expect(referralSheetRequestFromHref(`${BASE}${REFERRAL_SHEET_PATH}?patientId=PT-001`, BASE)?.personId).toBe(
      "PT-001",
    );
  });

  it("returns null for every other path, so ordinary links still navigate", () => {
    expect(referralSheetRequestFromHref("/mockups/ward-flow/referrals", BASE)).toBeNull();
    expect(referralSheetRequestFromHref("/mockups/ward-flow/referrals/new-thing", BASE)).toBeNull();
    expect(referralSheetRequestFromHref("/mockups/ward-flow/people/new", BASE)).toBeNull();
    expect(referralSheetRequestFromHref("/mockups/ward-flow", BASE)).toBeNull();
  });

  it("returns null for another origin, even on the same path", () => {
    expect(referralSheetRequestFromHref(`https://elsewhere.test${REFERRAL_SHEET_PATH}`, BASE)).toBeNull();
  });
});
