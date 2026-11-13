import { describe, expect, it } from "vitest";

import { meetingTvExtras, tvSiteScope } from "@/components/ward-management/bed-meeting/tv-derivations";
import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import {
  bedKindGaps,
  networkWardRows,
  networkTotals,
} from "@/components/ward-management/capacity/capacity-derivations";
import { homeActNowAnswer } from "@/components/ward-management/coordinator/home-act-now-words";
import { edAccessRisk } from "@/components/ward-management/forecast/ed-access-risk";
import { forecastBrief } from "@/components/ward-management/forecast/forecast-brief";
import { forecastByKind } from "@/components/ward-management/forecast/forecast-by-kind";
import { forecastLevers } from "@/components/ward-management/forecast/forecast-levers";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { DEFAULT_DUE_SOON_THRESHOLDS, dueSoonThresholdsOf } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { DISCHARGES_HELD_UP_NAV_NOUN, wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { WARD_SCENARIOS, scenarioWardNetwork } from "@/components/ward-management/ward-scenarios";
import { NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";
import type { WardAccess } from "@/components/ward-management/ward-role-access";

/**
 * Fix package J3 (Audit 9, approved by Josh 13 Nov 2026). Synthetic seed only. Guards the words
 * and scopes of the held-up, act-now and site bed meeting figures.
 */
const NOW = NOW_ANCHOR;
const seed = seedWardFlowState();
const sheetOf = (
  state: typeof seed,
  units = state.units,
  service: Parameters<typeof bedMeetingSheet>[0]["service"] = null,
) =>
  bedMeetingSheet({
    ...state,
    units,
    now: NOW,
    thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
    service,
    nameOf: (movement) => movement.id,
    referrals: state.referrals,
    referralLimitMinutes: state.configuration.referralDecisionTargetMinutes,
  });

describe("A9-04 (a): held-up discharges say 'discharges' and their span", () => {
  it("the brief says held-up discharges due by tomorrow, never releases", () => {
    const levers = forecastLevers(seed.units, seed.bedReleases, seed.admissions, NOW);
    const held = levers.find((lever) => lever.kind === "clear_held_up");
    expect(held, "the seed has a held-up discharge, so the guard is not empty").toBeDefined();
    const brief = forecastBrief(
      forecastByKind(seed.units, seed.bedReleases, seed.admissions, seed.movements, NOW, 1),
      levers,
      edAccessRisk([], [], [], [], NOW, 24 * 60, []),
      (id) => id,
    );
    const blocker = brief.find((line) => line.label === "Biggest blocker")!.text;
    expect(blocker).toMatch(/^\d+ held-up discharges? due by tomorrow, /u);
    expect(brief.map((line) => line.text).join(" ")).not.toMatch(/\breleases?\b/u);
    const none = forecastBrief(
      forecastByKind(seed.units, seed.bedReleases, seed.admissions, seed.movements, NOW, 1),
      [],
      edAccessRisk([], [], [], [], NOW, 24 * 60, []),
      (id) => id,
    );
    expect(none.find((line) => line.label === "Biggest blocker")!.text).toBe(
      "No discharge due by tomorrow is held up.",
    );
  });

  it("the menu's Discharges line is the TV's count, in the TV's words", () => {
    const scenario = WARD_SCENARIOS[0]!;
    const state = seedWardFlowState(scenario);
    const nav = wardNavCounts({
      movements: state.movements,
      units: state.units,
      sites: scenarioWardNetwork(scenario).sites,
      referrals: state.referrals,
      bedReleases: state.bedReleases,
      leaveBeds: state.leaveBeds,
      admissions: state.admissions,
      now: NOW,
      thresholds: dueSoonThresholdsOf(state.configuration),
    });
    expect(nav.discharges?.noun).toBe(DISCHARGES_HELD_UP_NAV_NOUN);
    expect(DISCHARGES_HELD_UP_NAV_NOUN).not.toMatch(/release|,/u);
    expect(nav.discharges?.value).toBe(sheetOf(state).discharges.heldUp);
  });
});

describe("A9-04 (b): Home's act now names what Handover's leaves out", () => {
  it("names the accepted referrals with no bed pulled beside the alerts", () => {
    expect(homeActNowAnswer(4, 1)).toBe("4 need a person now: 3 alerts, 1 accepted with no bed pulled");
    expect(homeActNowAnswer(2, 1, " in East Metro")).toBe(
      "2 need a person now in East Metro: 1 alert, 1 accepted with no bed pulled",
    );
    expect(homeActNowAnswer(1, 1)).toBe("1 needs a person now: 1 accepted with no bed pulled");
    // Nothing accepted waiting: the same words as before, so the alerts alone match Handover's.
    expect(homeActNowAnswer(3, 0)).toBe("3 need a person now");
  });
});

describe("A9-16 (Q12): a site bed manager's bed meeting is its own site", () => {
  const places = wardPlaceLookup(seed.units);
  const desk: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } };
  const site = siteByCode("RPH")!;

  it("names the site and keeps only its wards; other desks get no site scope", () => {
    const scope = tvSiteScope(desk, seed.units)!;
    expect(scope.name).toBe(site.name);
    expect(scope.service).toBe(site.service);
    expect(scope.units.length).toBeGreaterThan(0);
    expect(scope.units.every((unit) => unit.siteCode === "RPH")).toBe(true);
    expect(tvSiteScope({ role: "coordinator", scope: { kind: "statewide" } }, seed.units)).toBeUndefined();
    expect(tvSiteScope({ role: "bed_manager", scope: { kind: "site", siteCode: "NOPE" } }, seed.units)).toBeUndefined();
  });

  it("counts the site's beds against the site's people, as that desk's Capacity does", () => {
    const scoped = scopeWardFlowState(seed, desk, { now: NOW, places }).state;
    const scope = tvSiteScope(desk, scoped.units)!;
    const sheet = sheetOf(scoped, scope.units, scope.service);
    const capacityRows = networkWardRows(scope.units, NOW, scoped.bedReleases, scoped.admissions, scoped.leaveBeds, [
      ...scoped.movements,
      ...scoped.referrals,
    ]);
    expect(sheet.capacity.ready).toBe(networkTotals(capacityRows).ready);
    // The whole network's ready beds are more than the site's, so the old screen overstated them.
    expect(sheetOf(scoped).capacity.ready).toBeGreaterThan(sheet.capacity.ready);
    const extras = meetingTvExtras({
      ...scoped,
      units: scope.units,
      now: NOW,
      nameOf: (movement) => movement.id,
      namedHolds: [...scoped.movements, ...scoped.referrals],
      service: scope.service,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
    });
    const capacityGaps = bedKindGaps(scoped.movements, scope.units, NOW, scoped.admissions, scoped.referrals);
    expect(extras.gaps.map((gap) => [gap.id, gap.waiting, gap.bedsThatFit])).toEqual(
      capacityGaps.map((gap) => [gap.id, gap.waiting, gap.bedsThatFit]),
    );
    expect(extras.wards.map((ward) => ward.id).sort()).toEqual(scope.units.map((unit) => unit.id).sort());
    expect(extras.services).toEqual([]);
  });
});
