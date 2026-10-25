/**
 * Faults the 25 October 2026 stress test found (report: audits/2026-10-25-stress-test). Synthetic only.
 *
 * CS2-20: the engine checked an ED referral's department against the module-wide active network,
 * which only a browser provider switches. The shared server never switches it, so a wa-synthetic
 * world there accepted a department from another network and then failed its own save check.
 */
import { describe, expect, it, vi } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { observationAt } from "@/components/ward-management/ward-observation";
import { scenarioEmergencyDepartments, WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import { activeWardNetwork, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const raise = (edId: string): WardFlowEvent =>
  ({
    type: "RAISE_REFERRAL",
    role: "ed",
    now: NOW_ANCHOR + 5,
    edId,
    draft: {
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      gender: "Female",
      observation: observationAt("general"),
      highAcuity: false,
      legalStatus: "Voluntary",
      urgency: 2,
      legalFormCode: null,
    },
  }) as WardFlowEvent;

describe("stress test 25 Oct: an ED referral names a department in the world's own network", () => {
  it("refuses a department from another network even while the active network is the standard one", () => {
    // As on the shared server: nothing has switched the module-wide network to wa-synthetic.
    expect(activeWardNetwork().sites.some((site) => site.emergencyDepartment?.id === "jhc-ed")).toBe(true);
    const state = seedWardFlowState("wa-synthetic");
    const next = wardFlowReducer(state, raise("jhc-ed"));
    expect(next.rejections).toHaveLength(state.rejections.length + 1);
    expect(next.movements).toHaveLength(state.movements.length);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify({ ...next, rejections: [] })))).toBe(true);
  });

  it("accepts the world's own department and the world still saves", () => {
    const state = seedWardFlowState("wa-synthetic");
    const own = scenarioEmergencyDepartments("wa-synthetic")[0]!.id;
    const next = wardFlowReducer(state, raise(own));
    expect(next.rejections).toHaveLength(state.rejections.length);
    expect(next.movements).toHaveLength(state.movements.length + 1);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify({ ...next, rejections: [] })))).toBe(true);
  });

  it("still accepts a standard department in a standard world", () => {
    const state = seedWardFlowState("standard");
    const next = wardFlowReducer(state, raise("jhc-ed"));
    expect(next.rejections).toHaveLength(state.rejections.length);
    expect(next.movements).toHaveLength(state.movements.length + 1);
  });
});

describe("stress test 25 Oct: a patient record opens under every scenario's network", () => {
  it("loads the patient record fixtures while another network is active", async () => {
    for (const scenario of WARD_SCENARIOS) {
      // A fresh module registry, so the record fixtures first load after this network is active.
      vi.resetModules();
      const { activateScenarioNetwork } = await import("@/components/ward-management/ward-scenarios");
      activateScenarioNetwork(scenario);
      await expect(
        import("@/components/ward-management/patients/patient-now-records"),
        scenario,
      ).resolves.toBeDefined();
    }
    vi.resetModules();
  });
});
