import { afterEach, describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  activateScenarioNetwork,
  DEMO_RESET_SCENARIOS,
  scenarioDescriptions,
  scenarioLabels,
  WARD_SCENARIOS,
  type WardScenario,
} from "@/components/ward-management/ward-scenarios";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The one-tap demo resets (Josh, 15 Oct 2026): Quiet day, Winter surge and ED crisis. Each loads
 * through the reducer's own SET_SCENARIO event and is built by the demo network generator, so
 * every figure checked here is read off the generated records.
 */
const DAY = 24 * 60;

function load(scenario: WardScenario): WardFlowState {
  const state = wardFlowReducer(seedWardFlowState(), {
    type: "SET_SCENARIO",
    role: "demo",
    now: NOW_ANCHOR,
    scenario,
  });
  activateScenarioNetwork(state.scenario);
  return state;
}

function readyBeds(state: WardFlowState): number {
  return state.units.reduce((sum, unit) => sum + unit.allocatable.value, 0);
}

/** Minutes each person still waiting in an emergency department has waited, longest first. */
function edWaits(state: WardFlowState): number[] {
  return state.movements
    .filter((movement) => !movement.closure && movement.stage !== "moving")
    .map((movement) => NOW_ANCHOR - movement.openedAt)
    .sort((a, b) => b - a);
}

afterEach(() => activateScenarioNetwork("standard"));

describe("the one-tap demo reset scenarios", () => {
  it("are on the scenario list with a label and a plain description", () => {
    expect(DEMO_RESET_SCENARIOS).toEqual(["quiet-day", "winter-surge", "ed-crisis"]);
    for (const scenario of DEMO_RESET_SCENARIOS) {
      expect(WARD_SCENARIOS).toContain(scenario);
      expect(scenarioLabels[scenario]).toBeTruthy();
      expect(scenarioDescriptions[scenario]).not.toMatch(/[—;]/);
    }
    expect(DEMO_RESET_SCENARIOS.map((scenario) => scenarioLabels[scenario])).toEqual([
      "Quiet day",
      "Winter surge",
      "ED crisis",
    ]);
  });

  describe.each(DEMO_RESET_SCENARIOS)("%s", (scenario) => {
    it("loads through SET_SCENARIO from a seeded state", () => {
      const state = load(scenario);
      expect(state.rejections).toEqual([]);
      expect(state.scenario).toBe(scenario);
      expect(state.units.every((unit) => unit.id.startsWith("dn-"))).toBe(true);
    });

    it("never shows a negative empty or ready bed figure", () => {
      const state = load(scenario);
      for (const unit of state.units) {
        expect(unit.empty.value, unit.id).toBeGreaterThanOrEqual(0);
        expect(unit.allocatable.value, unit.id).toBeGreaterThanOrEqual(0);
        expect(unit.allocatable.value, unit.id).toBeLessThanOrEqual(unit.empty.value);
      }
    });

    it("never books more people into a ward than it has beds", () => {
      const state = load(scenario);
      for (const unit of state.units) {
        const inBeds = state.admissions.filter(
          (admission) =>
            admission.unitId === unit.id && (admission.state === "occupied" || admission.state === "pulled"),
        );
        expect(inBeds.length, unit.id).toBeLessThanOrEqual(unit.beds);
        expect(unit.empty.value, unit.id).toBe(
          unit.beds - inBeds.filter((admission) => admission.state === "occupied").length,
        );
      }
    });
  });

  it("gives the quiet day more ready beds and fewer ED waits than the winter surge", () => {
    const quiet = load("quiet-day");
    const winter = load("winter-surge");
    expect(readyBeds(quiet)).toBeGreaterThan(readyBeds(winter));
    expect(edWaits(quiet).length).toBeLessThan(edWaits(winter).length);
    expect(edWaits(quiet)[0]).toBeLessThanOrEqual(8 * 60);
  });

  it("gives the ED crisis the most ED waits, with waits past a day and past two days", () => {
    const crisis = edWaits(load("ed-crisis"));
    for (const other of ["quiet-day", "winter-surge"] as const) {
      expect(crisis.length).toBeGreaterThan(edWaits(load(other)).length);
    }
    expect(crisis.filter((waited) => waited > DAY).length).toBeGreaterThanOrEqual(1);
    expect(crisis.filter((waited) => waited > 2 * DAY).length).toBeGreaterThanOrEqual(1);
  });
});
