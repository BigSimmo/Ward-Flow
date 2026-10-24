import { afterEach, expect, it } from "vitest";
import { activateScenarioNetwork, scenarioNetwork } from "@/components/ward-management/ward-scenarios";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { matchesService, matchesSetting } from "@/components/ward-management/search/search-filters";
import { wardSites } from "@/components/ward-management/ward-sites";

afterEach(() => activateScenarioNetwork("standard"));

it("refreshes search service and ED-origin maps when switching both ways", () => {
  for (const scenario of ["standard", "wa-synthetic", "standard"] as const) {
    activateScenarioNetwork(scenario);
    const state = seedWardFlowState(scenario);
    const sites = scenarioNetwork(scenario)?.sites ?? wardSites;
    const movement = state.movements.find((entry) => entry.originEdId)!;
    const origin = sites.find((site) => site.emergencyDepartment?.id === movement.originEdId)!;
    const service = origin.service;
    expect(matchesService({ kind: "movement", movement }, service)).toBe(true);
    // Exercise the ED-medical filter contract without changing authored seed source stories.
    const referral = { ...state.referrals[0]!, source: "ed_medical" as const, originSiteCode: origin.code };
    expect(matchesSetting({ kind: "referral", referral }, "ed")).toBe(true);
    expect(
      matchesService(
        { kind: "referral", referral },
        sites.find((site) => site.code === referral.originSiteCode)!.service,
      ),
    ).toBe(true);
  }
});
