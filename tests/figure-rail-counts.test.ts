/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  teamReferralsToAnswer,
  TEAM_REFERRAL_IDS,
} from "@/components/ward-management/community/team-2026/team-referral-count";
import { referralsAwaitingDecision } from "@/components/ward-management/figures/decision-counts";
import { wardDeskAnswerCount } from "@/components/ward-management/referrals/home-ward-offers";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { networkNamedHolds, totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { unitInScope, type WardAccessScope } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";

/**
 * R-STRUCT-24 (figures spec 3.6, D-220): a rail badge reads its page's figure, and every desk
 * adjustment lives in `wardNavCounts`, so the rail's hook forks (`use-ward-nav-counts.ts`,
 * `shell-next/next-nav-counts.ts`, the redesign preview) are thin wrappers that cannot drift.
 * Synthetic seed data only.
 */
const state = seedWardFlowState();
const input = {
  movements: state.movements,
  units: state.units,
  referrals: state.referrals,
  bedReleases: state.bedReleases,
  leaveBeds: state.leaveBeds,
  admissions: state.admissions,
  now: NOW_ANCHOR,
  sites: wardSites,
  thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
};
const holds = networkNamedHolds(state.movements, state.referrals);
const places = wardPlaceLookup(state.units);
const readyIn = (scope: WardAccessScope) =>
  totalReadyBedsNow(
    state.units.filter((unit) => unitInScope(scope, unit.id, places)),
    state.admissions,
    state.bedReleases,
    holds,
  );

describe("rail counts read their page's figure on every desk (R-STRUCT-24)", () => {
  it("Capacity: the network's Ready on a statewide desk, the desk's own wards on a site, service or ward desk", () => {
    const network = wardNavCounts(input).capacity!;
    expect(network.value).toBe(totalReadyBedsNow(state.units, state.admissions, state.bedReleases, holds));
    const siteCode = places.unitSiteCode(state.units[0]!.id)!;
    const desks: WardAccessScope[] = [
      { kind: "site", siteCode },
      { kind: "service", service: places.unitService(state.units[0]!.id)! },
      { kind: "ward", unitIds: [state.units[0]!.id] },
    ];
    let narrower = 0;
    for (const scope of desks) {
      const capacity = wardNavCounts({ ...input, scope }).capacity!;
      expect(capacity.value, scope.kind).toBe(readyIn(scope));
      // Item 5: the breakdown lists the desk's own wards only, so it still adds up to the badge.
      expect(capacity.readyWards!.reduce((sum, ward) => sum + ward.ready, 0)).toBe(capacity.value);
      for (const { unit } of capacity.readyWards!) expect(unitInScope(scope, unit.id, places), unit.id).toBe(true);
      if (capacity.value !== network.value) narrower += 1;
    }
    expect(narrower, "the seed's network has ready beds outside one site").toBeGreaterThan(0);
  });

  it("Referrals: the referral queue; a ward desk adds the beds offered straight to it (A9-30)", () => {
    const queued = referralsAwaitingDecision(state.referrals).length;
    expect(wardNavCounts(input).referrals!.value).toBe(queued);
    const scope: WardAccessScope = { kind: "ward", unitIds: [state.units[0]!.id] };
    expect(wardNavCounts({ ...input, scope }).referrals!.value).toBe(
      wardDeskAnswerCount(queued, state.movements, state.referrals),
    );
  });

  it("Referrals on a community team desk: the team page's own figure, not the shared queue", () => {
    const scope: WardAccessScope = { kind: "team", teamName: "Midland" };
    expect(teamReferralsToAnswer({})).toBe(TEAM_REFERRAL_IDS.length);
    expect(wardNavCounts({ ...input, scope, teamReferrals: teamReferralsToAnswer({}) }).referrals!.value).toBe(3);
    expect(
      wardNavCounts({ ...input, scope, teamReferrals: teamReferralsToAnswer({ r1: true }) }).referrals!.value,
    ).toBe(2);
    // Another desk never reads the team figure, even when one is passed.
    expect(wardNavCounts({ ...input, teamReferrals: 99 }).referrals!.value).toBe(
      referralsAwaitingDecision(state.referrals).length,
    );
  });

  it("remembers one answer per desk scope, not per scope object", () => {
    const site = wardNavCounts({ ...input, scope: { kind: "site", siteCode: "RPH" } });
    expect(wardNavCounts({ ...input, scope: { kind: "site", siteCode: "RPH" } })).toBe(site);
    expect(wardNavCounts({ ...input, scope: { kind: "statewide" } })).toBe(wardNavCounts(input));
  });
});
