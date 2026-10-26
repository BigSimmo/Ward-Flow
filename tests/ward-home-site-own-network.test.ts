/**
 * Audit CS3-21 (the same kind of fix as CS2-20): a home service return and a repatriation checked
 * the home hospital against the module-wide active network, which only a browser provider
 * switches. On the shared server a wa-synthetic world accepted a site from the standard network
 * and then failed its own save check. Synthetic seed data only.
 */
import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  seedWardFlowStateAt,
  wardFlowReducer,
} from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { scrubTypedTextFields } from "@/components/ward-management/ward-flow-typed-text-scrub";
import { scenarioHasSite, WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import { activeWardNetwork, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const ADMISSION = "AD-WS-0005";

const homeReturn = (homeHospital: string): WardFlowEvent => ({
  type: "RECORD_HOME_SERVICE_RETURN",
  role: "coordinator",
  now: NOW_ANCHOR,
  admissionId: ADMISSION,
  step: "requested",
  homeHospital,
});

const repatriation = (homeHospital: string): WardFlowEvent => ({
  type: "RECORD_REPATRIATION",
  role: "coordinator",
  now: NOW_ANCHOR,
  admissionId: ADMISSION,
  homeHospital,
  receivingWardAgreed: false,
  mode: "road",
  provider: "Ambulance service",
  cadNumber: "CAD-4410",
  transportLegalStatus: "voluntary",
  estimatedAt: NOW_ANCHOR + 120,
});

// The device copy, with typed text (the CAD number) replaced as a save replaces it.
const worlds = (offsetMinutes = 0) => WARD_SCENARIOS.map((scenario) => seedWardFlowStateAt(offsetMinutes, scenario));
const saveable = (state: ReturnType<typeof seedWardFlowState>) =>
  isValidStoredWardFlowState(JSON.parse(JSON.stringify({ ...scrubTypedTextFields(state, worlds), rejections: [] })));

describe("a home hospital names a site in the world's own network (audit CS3-21)", () => {
  it("refuses a standard-network site in a wa-synthetic world while the standard network is active", () => {
    // As on the shared server: nothing has switched the module-wide network to wa-synthetic.
    expect(activeWardNetwork().sites.some((site) => site.code === "RPH")).toBe(true);
    expect(scenarioHasSite("wa-synthetic", "RPH")).toBe(false);
    const state = seedWardFlowState("wa-synthetic");
    for (const event of [homeReturn("RPH"), repatriation("RPH")]) {
      const next = wardFlowReducer(state, event);
      expect(next.rejections).toHaveLength(state.rejections.length + 1);
      expect(next.homeServiceReturns ?? []).toEqual(state.homeServiceReturns ?? []);
      expect(next.repatriations ?? []).toEqual(state.repatriations ?? []);
    }
  });

  it("accepts the world's own site, and the world still saves", () => {
    const state = seedWardFlowState("wa-synthetic");
    for (const event of [homeReturn("SYN-JASPER"), repatriation("SYN-JASPER")]) {
      const next = wardFlowReducer(state, event);
      expect(next.rejections).toEqual(state.rejections);
      expect(saveable(next)).toBe(true);
    }
  });
});
