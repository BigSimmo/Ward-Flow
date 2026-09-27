// tests/ward-referral-ed-medical-source.test.ts
//
// Owner ruling, 2026-09-06: "ED medical staff will refer a patient and ED psychiatry staff will
// add it to the referral board. The patient were officially referred from ED in the referral
// location." That is TWO facts about one referral — who sent it, and where from — and the model
// already held two fields for them. This file guards the one thing that could then go wrong:
// nothing compared them.
//
// ⚠️ THE DEFECT THIS EXISTS FOR RENDERS PERFECTLY. `{ source: "ed_medical", originSiteCode: "FRE" }`
// passes both membership checks independently and describes a referral from the emergency
// department of a hospital that has no emergency department. Every screen shows a real source and
// a real hospital; only the COMBINATION is impossible, so there is no blank, no missing value and
// no implausible number for anything downstream to notice.
import { describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { REFERRAL_SOURCES, type ReferralSource } from "../src/components/ward-management/ward-model";
import type { WardFlowRole } from "../src/components/ward-management/ward-flow-roles";
import { NOW_ANCHOR, wardSites } from "../src/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

/**
 * ⚠️ THE POPULATION IS WALKED FROM `wardSites`, NEVER HAND-LISTED.
 *
 * A hand-written list of "hospitals with an emergency department" in this file would be a second
 * home for a fact `wardSites` already owns — the exact duplication the guard under test refuses to
 * make in the reducer. It would also go stale silently: a site gaining or losing an ED would leave
 * this file testing the old network while passing.
 */
const sitesWithEd = wardSites.filter((site) => site.emergencyDepartment !== undefined);
const sitesWithoutEd = wardSites.filter((site) => site.emergencyDepartment === undefined);

/** Shared by both describe blocks below — derived from `REFERRAL_SOURCES`, never typed out; see
 * the "THE CONTROL" comment further down for why a hand-written list would be the wrong shape. */
const otherSources: ReferralSource[] = REFERRAL_SOURCES.filter((source) => source !== "ed_medical");

/** The reducer's own words, so a reworded refusal fails here rather than silently matching nothing. */
const ED_REFUSAL = "requires an origin site with an emergency department";

function receive(source: ReferralSource, originSiteCode: string, state: WardFlowState = seedWardFlowState()) {
  return receiveAs("community", source, originSiteCode, state);
}

/** Same shape as `receive`, with the raising role exposed for the R9 pairing tests below. */
function receiveAs(
  role: WardFlowRole,
  source: ReferralSource,
  originSiteCode: string,
  state: WardFlowState = seedWardFlowState(),
) {
  return wardFlowReducer(state, {
    type: "RECEIVE_REFERRAL",
    role,
    now: NOW_ANCHOR,
    ageBand: "Adult",
    destinations: [
      {
        kind: "psychiatric_ward",
        sex: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source,
    urgency: 2,
    originSiteCode,
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  });
}

/** Whether THIS refusal fired — the role/source pairing check, never any other guard. */
function refusedForRolePairing(before: WardFlowState, after: WardFlowState): boolean {
  return after.rejections
    .slice(before.rejections.length)
    .some((rejection) => rejection.reason.includes("must carry source ed_medical"));
}

/** Whether THIS refusal fired — never merely "was it rejected", which any unrelated guard satisfies. */
function refusedForNoEd(before: WardFlowState, after: WardFlowState): boolean {
  return after.rejections.slice(before.rejections.length).some((rejection) => rejection.reason.includes(ED_REFUSAL));
}

describe("a referral from ED medical staff must come from a hospital that has an ED", () => {
  /*
   * 🔴 THE ANTI-VACUITY FLOOR, AND IT IS ON THE DENOMINATOR RATHER THAN THE RESULT.
   *
   * Both loops below are `it.each` over a derived array. If either array were empty the loop would
   * register no cases and the file would pass having tested nothing — the failure mode that looks
   * identical to success. These two assertions are what makes the emptiness fail instead.
   *
   * They are deliberately `toBeGreaterThan(0)` and not a pinned count: the network is synthetic and
   * expected to change, and a pinned 8/9 would turn every legitimate site edit into a red here.
   */
  it("has both kinds of site to test, so neither loop below is vacuous", () => {
    expect(sitesWithEd.length, "no site in wardSites has an emergency department").toBeGreaterThan(0);
    expect(sitesWithoutEd.length, "every site in wardSites has an emergency department").toBeGreaterThan(0);
  });

  it.each(sitesWithoutEd.map((site) => [site.code] as const))(
    "refuses an ed_medical referral from %s, which has no emergency department",
    (code) => {
      const before = seedWardFlowState();
      expect(refusedForNoEd(before, receive("ed_medical", code, before))).toBe(true);
    },
  );

  it.each(sitesWithEd.map((site) => [site.code] as const))(
    "accepts an ed_medical referral from %s, which has one",
    (code) => {
      const before = seedWardFlowState();
      expect(refusedForNoEd(before, receive("ed_medical", code, before))).toBe(false);
    },
  );

  /*
   * ⚠️ THE CONTROL, AND WITHOUT IT THE TWO LOOPS ABOVE DO NOT DISCRIMINATE.
   *
   * A guard that refused EVERY referral from an ED-less site — not only `ed_medical` ones — would
   * pass both loops above and be badly wrong: it would block the community, police and ambulance
   * referrals those nine hospitals legitimately raise. The property is about the PAIR, so a source
   * that says nothing about an emergency department must sail through the same door.
   *
   * ⚠️ **DERIVED FROM `REFERRAL_SOURCES`, NEVER TYPED OUT.** The first draft of this file listed
   * the five other sources by hand, which is the same second-home mistake the guard under test
   * refuses to make — and worse here, because a SIXTH source added later would silently escape the
   * control while every case still passed. Sampling one source would also be a weaker claim than
   * the one being made.
   */
  it.each(otherSources.flatMap((source) => sitesWithoutEd.map((site) => [source, site.code] as const)))(
    "still accepts a %s referral from %s, because this rule is about the pair and not about the site",
    (source, code) => {
      const before = seedWardFlowState();
      expect(refusedForNoEd(before, receive(source, code, before))).toBe(false);
    },
  );
});

/**
 * R9 (owner item 23, 2026-09-17, verbatim): "Police, ambulance and crisis stay 'community'. …
 * only `ed_medical` is raised as `ed`, and `ed` with any other source is refused. Everything
 * else, including GP, stays `community`."
 *
 * ⚠️ **THIS IS A PAIR, NOT TWO SEPARATE MEMBERSHIP CHECKS.** `EVENT_ROLE.RECEIVE_REFERRAL`
 * widened to `["community", "ed"]` says only that role `ed` is SOMETIMES valid for this event —
 * it cannot say "only when the source is ed_medical". That coupling lives in the reducer's own
 * `case "RECEIVE_REFERRAL"`, and this file is what would catch a reducer that dropped it while
 * leaving the widened table in place (which would silently let ANY source through as `ed`).
 *
 * ⚠️ **`gp` IS DELIBERATELY IN `otherSources`, NOT CARVED OUT.** The owner's own sentence names
 * it — "Everything else, including GP, stays community" — so a GP referral raised as `ed` must be
 * refused exactly like a police or ambulance one.
 */
describe("R9 — the raising role must follow the source", () => {
  const edSite = sitesWithEd[0]?.code;

  it("has an ED site to raise the ed_medical/ed pairing from, so the acceptance case below is not vacuous", () => {
    expect(edSite, "no site in wardSites has an emergency department").not.toBeUndefined();
  });

  it("accepts an ed_medical referral raised as role ed", () => {
    const before = seedWardFlowState();
    const after = receiveAs("ed", "ed_medical", edSite!, before);
    expect(
      refusedForRolePairing(before, after),
      "role ed paired with source ed_medical was refused for the pairing, but the owner requires it to work",
    ).toBe(false);
  });

  it.each(otherSources.map((source) => [source] as const))(
    "refuses a %s referral raised as role ed, naming ed_medical",
    (source) => {
      const before = seedWardFlowState();
      // Any site does: this is a role/source pairing refusal, not a site-network one — the ED
      // origin-site guard tested above is a separate, later check this dispatch never reaches for
      // a non-ed_medical source, since it names an ED-having site regardless.
      const after = receiveAs("ed", source, edSite!, before);
      expect(
        refusedForRolePairing(before, after),
        `role ed paired with source ${source} was not refused for the pairing`,
      ).toBe(true);
    },
  );

  it("still accepts an ed_medical referral raised as role community", () => {
    // The reverse pairing is left open on purpose — a referral raised directly at the front door
    // (rather than through the ED's own screen) with source ed_medical is exactly what
    // `tests/ward-ed-to-community-referral.test.ts` already depends on.
    const before = seedWardFlowState();
    const after = receiveAs("community", "ed_medical", edSite!, before);
    expect(refusedForRolePairing(before, after)).toBe(false);
  });

  it.each(otherSources.map((source) => [source] as const))(
    "accepts a %s referral raised as role community",
    (source) => {
      const before = seedWardFlowState();
      const site = sitesWithoutEd[0]?.code ?? edSite!;
      const after = receiveAs("community", source, site, before);
      expect(refusedForRolePairing(before, after)).toBe(false);
    },
  );
});
