import { describe, it, expect } from "vitest";
import { createIsolatedState } from "../helpers/test-harness";
import { wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { reducePlacementEvent } from "@/components/ward-management/ward-flow-placement-events";
import { reduceTransportEvent } from "@/components/ward-management/ward-flow-transport-events";
import { BLOCKERS_MEANING_NOTHING_IS_BLOCKING } from "@/components/ward-management/ward-model-vocabulary";
import { WARD_SCENARIOS, type WardScenario } from "@/components/ward-management/ward-scenarios";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";

describe("Feature 12: Reducer Fallbacks, Blocker Refusals & Scenario Idempotency", () => {
  it("refuses exact match of BLOCKERS_MEANING_NOTHING_IS_BLOCKING on RECORD_MOVEMENT_BLOCKER", () => {
    const state = createIsolatedState();
    const movement = state.movements[0];
    expect(movement).toBeDefined();

    const sentinel = BLOCKERS_MEANING_NOTHING_IS_BLOCKING[0]; // e.g. "None"
    const event: WardFlowEvent = {
      type: "RECORD_MOVEMENT_BLOCKER",
      role: "coordinator",
      now: state.now,
      movementId: movement.id,
      blocker: sentinel,
    };

    const next = wardFlowReducer(state, event);
    expect(next.rejections.length).toBeGreaterThan(0);
    const lastRejection = next.rejections[next.rejections.length - 1];
    expect(lastRejection.reason).toContain("sentinel, not an active blocker — use CLEAR_MOVEMENT_BLOCKER");
    // Movement blocker was not updated to sentinel
    const updated = next.movements.find((m) => m.id === movement.id);
    expect(updated?.blocker).not.toBe(sentinel);
  });

  it("refuses case-insensitive near-miss of BLOCKERS_MEANING_NOTHING_IS_BLOCKING", () => {
    const state = createIsolatedState();
    const movement = state.movements[0];
    const sentinelUpper = BLOCKERS_MEANING_NOTHING_IS_BLOCKING[0].toUpperCase();

    const event: WardFlowEvent = {
      type: "RECORD_MOVEMENT_BLOCKER",
      role: "coordinator",
      now: state.now,
      movementId: movement.id,
      blocker: sentinelUpper,
    };

    const next = wardFlowReducer(state, event);
    expect(next.rejections.length).toBeGreaterThan(0);
    const lastRejection = next.rejections[next.rejections.length - 1];
    expect(lastRejection.reason).toContain("differs from");
    expect(lastRejection.reason).toContain("only in case");
    expect(lastRejection.reason).toContain("CLEAR_MOVEMENT_BLOCKER");
  });

  it("accepts genuine clinical and logistical blockers on RECORD_MOVEMENT_BLOCKER", () => {
    const state = createIsolatedState();
    const movement = state.movements[0];
    const realBlocker = "Awaiting orthopaedic registrar review post mechanical fall";

    const event: WardFlowEvent = {
      type: "RECORD_MOVEMENT_BLOCKER",
      role: "coordinator",
      now: state.now,
      movementId: movement.id,
      blocker: realBlocker,
    };

    const next = wardFlowReducer(state, event);
    const updated = next.movements.find((m) => m.id === movement.id);
    expect(updated?.blocker).toBe(realBlocker);
  });

  it("is idempotent when SET_SCENARIO matches existing state.scenario without inflating worldGeneration", () => {
    const state = createIsolatedState();
    const currentScenario = state.scenario;
    const initialGeneration = state.worldGeneration;

    const event: WardFlowEvent = {
      type: "SET_SCENARIO",
      role: "demo",
      now: state.now,
      scenario: currentScenario,
    };

    const next = wardFlowReducer(state, event);
    expect(next).toBe(state); // Strict identity
    expect(next.worldGeneration).toBe(initialGeneration);
  });

  it("advances worldGeneration and unit allocatable revisions when switching scenarios", () => {
    const state = createIsolatedState();
    const alternativeScenario: WardScenario =
      WARD_SCENARIOS.find((s) => s !== state.scenario) ?? "surge";
    const initialGeneration = state.worldGeneration;

    const event: WardFlowEvent = {
      type: "SET_SCENARIO",
      role: "demo",
      now: state.now,
      scenario: alternativeScenario,
    };

    const next = wardFlowReducer(state, event);
    expect(next.scenario).toBe(alternativeScenario);
    expect(next.worldGeneration).toBe(initialGeneration + 1);

    // Each unit should have an advanced or reset revision
    expect(next.units.length).toBeGreaterThan(0);
    for (const unit of next.units) {
      expect(typeof unit.allocatable.revision).toBe("number");
    }
  });

  it("reducer slices fallback cleanly and return state unchanged on unknown/unhandled events", () => {
    const state = createIsolatedState();
    // Pass an unhandled event type cast as any to check fallback
    const foreignEvent = {
      type: "UNKNOWN_FOREIGN_EVENT" as any,
      role: "coordinator" as any,
      now: state.now,
    };

    const decision = { outcome: "denied" as const, reasonCode: "transition" };
    const helpers: any = {};

    const placementNext = reducePlacementEvent(state, foreignEvent as any, decision, helpers);
    expect(placementNext).toBe(state);

    const transportNext = reduceTransportEvent(state, foreignEvent as any, decision, helpers);
    expect(transportNext).toBe(state);
  });
});
