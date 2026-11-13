import { describe, expect, it } from "vitest";

import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { homeActNowAnswer } from "@/components/ward-management/coordinator/home-act-now-words";
import { edAccessRisk } from "@/components/ward-management/forecast/ed-access-risk";
import { forecastBrief } from "@/components/ward-management/forecast/forecast-brief";
import { forecastByKind } from "@/components/ward-management/forecast/forecast-by-kind";
import { forecastLevers } from "@/components/ward-management/forecast/forecast-levers";
import { DEFAULT_DUE_SOON_THRESHOLDS, dueSoonThresholdsOf } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { DISCHARGES_HELD_UP_NAV_NOUN, wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { WARD_SCENARIOS, scenarioWardNetwork } from "@/components/ward-management/ward-scenarios";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

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
