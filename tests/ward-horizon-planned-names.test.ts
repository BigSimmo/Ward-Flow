// tests/ward-horizon-planned-names.test.ts
//
// Owner, 26 Sept 2026 ("go ahead with your recommendations"): the 48-hour movement horizon shows
// demo moves spread across the window, not every bar at now, and each bar carries the patient's
// name rather than its WF journey number.
import { describe, expect, it } from "vitest";

import { deriveMovementHorizonLanes } from "@/components/ward-management/movements/movements-derivations";
import { withDemoPlannedMoveTimes } from "@/components/ward-management/ward-demo-planned-moves";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { activateScenarioNetwork, WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardMovements } from "@/components/ward-management/ward-movements";

const HORIZON_HOURS = 48;

describe("demo planned move times", () => {
  it("are computed from the anchor, so two seeds agree exactly", () => {
    expect(withDemoPlannedMoveTimes(wardMovements, NOW_ANCHOR)).toEqual(
      withDemoPlannedMoveTimes(wardMovements, NOW_ANCHOR),
    );
  });

  it("only go on open, accepted moves that are not yet travelling or holding a bed", () => {
    for (const movement of withDemoPlannedMoveTimes(wardMovements, NOW_ANCHOR)) {
      if (movement.plannedMoveAt === undefined) continue;
      expect(movement.closure).toBeUndefined();
      expect(movement.acceptedUnitId).toBeDefined();
      expect(["accepted_awaiting_bed", "handover_ready"]).toContain(movement.stage);
      expect(movement.plannedMoveAt).toBeGreaterThan(NOW_ANCHOR);
      expect(movement.plannedMoveAt).toBeLessThanOrEqual(NOW_ANCHOR + HORIZON_HOURS * 60);
    }
  });

  it("leave the source fixture untouched", () => {
    withDemoPlannedMoveTimes(wardMovements, NOW_ANCHOR);
    expect(wardMovements.some((movement) => movement.plannedMoveAt !== undefined)).toBe(false);
  });
});

describe.each(WARD_SCENARIOS)("the horizon on the %s seed", (scenario) => {
  activateScenarioNetwork(scenario);
  const state = seedWardFlowState(scenario);
  const lanes = deriveMovementHorizonLanes(state.movements, state.units, NOW_ANCHOR, {
    people: { patients: state.patients, referrals: state.referrals, movements: state.movements },
  });
  const events = lanes.flatMap((lane) => lane.events);

  it("spreads planned moves across the 48 hours and keeps some at now", () => {
    const ahead = events.filter((event) => event.startH > 0);
    expect(ahead.length).toBeGreaterThan(0);
    expect(events.some((event) => event.startH === 0)).toBe(true);
    for (const event of ahead) {
      expect(event.startH).toBeLessThanOrEqual(HORIZON_HOURS);
      expect(event.title).toMatch(/ · planned /u);
    }
    if (ahead.length > 2) expect(new Set(ahead.map((event) => event.startH)).size).toBeGreaterThan(2);
  });

  it("names every bar's patient and never falls back to the WF number", () => {
    for (const event of events) {
      expect(event.patientName).toBeDefined();
      expect(event.patientName).not.toMatch(/WF-/u);
    }
  });
});
