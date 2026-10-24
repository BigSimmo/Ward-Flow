import { afterEach, describe, expect, it, vi } from "vitest";

import { tryReadDemoState } from "@/components/ward-management/ward-flow-demo-restore";
import {
  TYPED_TEXT_NOT_KEPT,
  WARD_FLOW_STORED_STATE_VERSION,
} from "@/components/ward-management/ward-flow-demo-storage-constants";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { buildScenarioFile, readScenarioFile } from "@/components/ward-management/ward-flow-scenario-file";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { patientRegistrationScope } from "@/components/ward-management/ward-patient-registration";
import {
  activateScenarioNetwork,
  scenarioWardNetwork,
  type WardScenario,
} from "@/components/ward-management/ward-scenarios";
import { allEmergencyDepartments, NOW_ANCHOR, siteDirectory, wardSites } from "@/components/ward-management/ward-sites";
import { COMMUNITY_TEAMS } from "@/components/ward-management/ward-teams";

const directions = [
  ["wa-synthetic", "standard"],
  ["standard", "wa-synthetic"],
] as const satisfies readonly (readonly [WardScenario, WardScenario])[];

const jsonState = (scenario: WardScenario): WardFlowState => JSON.parse(JSON.stringify(seedWardFlowState(scenario)));
const activeIdentities = () => [wardSites, siteDirectory, allEmergencyDepartments()];
const firstPlace = (scenario: WardScenario) => {
  const site = scenarioWardNetwork(scenario).sites.find((candidate) => candidate.emergencyDepartment)!;
  return { code: site.code, edId: site.emergencyDepartment!.id };
};

afterEach(() => {
  activateScenarioNetwork("standard");
  vi.unstubAllGlobals();
});

describe.each(directions)("stored %s while %s is active", (storedScenario, activeScenario) => {
  it("validates the JSON world without changing active identity objects", () => {
    const state = jsonState(storedScenario);
    activateScenarioNetwork(activeScenario);
    const before = activeIdentities();
    expect(isValidStoredWardFlowState(state)).toBe(true);
    activeIdentities().forEach((identity, index) => expect(identity).toBe(before[index]));
  });

  it("imports its exported file and restores a same-day session from another initial network", () => {
    const state = jsonState(storedScenario);
    state.patients[0].registrationScope = patientRegistrationScope({
      kind: "ed",
      edId: firstPlace(storedScenario).edId,
    });
    activateScenarioNetwork(storedScenario);
    const savedAt = new Date("2026-10-24T02:00:00Z");
    const file = buildScenarioFile(state, NOW_ANCHOR, WARD_FLOW_STORED_STATE_VERSION, savedAt);
    expect(file.ok).toBe(true);
    if (!file.ok) throw new Error(file.reason);

    activateScenarioNetwork(activeScenario);
    const before = activeIdentities();
    const imported = readScenarioFile(file.json, WARD_FLOW_STORED_STATE_VERSION);
    expect(imported.ok).toBe(true);
    if (imported.ok) expect(imported.state).toEqual(state);

    const dayZero = new Date("2026-10-23T16:00:00Z");
    const savedAtAbsolute = savedAt.getTime() / 60_000;
    const raw = JSON.stringify({
      version: WARD_FLOW_STORED_STATE_VERSION,
      dayZero: dayZero.getTime(),
      worldGeneration: state.worldGeneration,
      now: NOW_ANCHOR,
      savedAtAbsolute,
      state,
    });
    // Only the existence of window is needed: the real guarded reader receives the raw save.
    vi.stubGlobal("window", {});
    const restored = tryReadDemoState(dayZero, savedAtAbsolute + 1, raw);
    expect(restored.saved?.state).toEqual(state);
    expect(restored.recoveryNotice).toMatch(/^Restored the last successful save from/);
    activeIdentities().forEach((identity, index) => expect(identity).toBe(before[index]));
  });

  const positions = [
    "ward site",
    "movement ED",
    "movement community",
    "referral ED",
    "repatriation site",
    "patient ED registration",
    "patient site registration",
  ] as const;
  type Position = (typeof positions)[number];
  function withPlace(position: Position, place: ReturnType<typeof firstPlace>): WardFlowState {
    const state = jsonState(storedScenario);
    switch (position) {
      case "ward site":
        state.units[0].siteCode = place.code;
        break;
      case "movement ED":
        delete state.movements[0].originCommunity;
        state.movements[0].originEdId = place.edId;
        break;
      case "movement community":
        delete state.movements[0].originEdId;
        state.movements[0].originCommunity = { siteCode: place.code };
        break;
      case "referral ED":
        state.referrals[0].destinations[0].destination = {
          kind: "emergency_department",
          edId: place.edId,
          purpose: "medical_assessment",
        };
        break;
      case "repatriation site":
        state.repatriations = [
          {
            admissionId: state.admissions[0].id,
            at: NOW_ANCHOR,
            estimatedAt: NOW_ANCHOR + 60,
            by: "coordinator",
            homeHospital: place.code,
            cadNumber: TYPED_TEXT_NOT_KEPT,
            receivingWardAgreed: false,
            mode: "road",
            provider: "Ambulance service",
            transportLegalStatus: "voluntary",
          },
        ];
        break;
      case "patient ED registration":
        state.patients[0].registrationScope = patientRegistrationScope({ kind: "ed", edId: place.edId });
        break;
      case "patient site registration":
        state.patients[0].registrationScope = patientRegistrationScope({ kind: "site", siteCode: place.code });
        break;
    }
    return state;
  }

  it.each(positions)("keeps %s tied to the stored scenario and rejects unknown or foreign identities", (position) => {
    activateScenarioNetwork(activeScenario);
    const before = activeIdentities();
    expect(isValidStoredWardFlowState(withPlace(position, firstPlace(storedScenario)))).toBe(true);
    expect(isValidStoredWardFlowState(withPlace(position, firstPlace(activeScenario)))).toBe(false);
    expect(isValidStoredWardFlowState(withPlace(position, { code: "UNKNOWN-SITE", edId: "unknown-ed" }))).toBe(false);
    activeIdentities().forEach((identity, index) => expect(identity).toBe(before[index]));
  });

  it("retains ward, team and service registration checks and the strict registration shape", () => {
    activateScenarioNetwork(activeScenario);
    const state = jsonState(storedScenario);
    const scopes: Parameters<typeof patientRegistrationScope>[0][] = [
      { kind: "ward", unitIds: [state.units[0].id] },
      { kind: "team", teamName: Object.values(COMMUNITY_TEAMS)[0] },
      { kind: "service", service: "East Metro" },
    ];
    for (const desk of scopes) {
      const registered = structuredClone(state);
      registered.patients[0].registrationScope = patientRegistrationScope(desk);
      expect(isValidStoredWardFlowState(registered)).toBe(true);
      const unknown = structuredClone(registered);
      unknown.patients[0].registrationScope!.placeId = "UNKNOWN";
      expect(isValidStoredWardFlowState(unknown)).toBe(false);
      Object.assign(registered.patients[0].registrationScope!, { extra: "typed" });
      expect(isValidStoredWardFlowState(registered)).toBe(false);
    }
  });
});
