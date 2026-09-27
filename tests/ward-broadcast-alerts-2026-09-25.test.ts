import { describe, expect, it } from "vitest";

import { COORDINATOR_DESK_ACKNOWLEDGER_ID } from "../src/components/ward-management/alerts/ward-broadcast-model";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function dispatchAlert(state: ReturnType<typeof seedWardFlowState>, overrides: Partial<WardFlowEvent & { type: "DISPATCH_BROADCAST_ALERT" }> = {}) {
  const event: WardFlowEvent = {
    type: "DISPATCH_BROADCAST_ALERT",
    role: "coordinator",
    now: NOW,
    title: "Statewide capacity alert",
    message: "All units please review discharge candidates.",
    severity: "critical",
    category: "capacity_gridlock",
    targetScope: "all",
    targetScopeLabel: "All units",
    durationMinutes: 240,
    dispatchedByName: "State Bed Desk",
    ...overrides,
  };
  return wardFlowReducer(state, event);
}

describe("DISPATCH_BROADCAST_ALERT validates its allowed-value fields (audit follow-up 2026-09-25)", () => {
  it("refuses an unrecognised severity", () => {
    const state = seedWardFlowState();
    const next = dispatchAlert(state, { severity: "urgent" as never });
    expect(next.broadcastAlerts ?? []).toHaveLength(0);
  });

  it("refuses an unrecognised category", () => {
    const state = seedWardFlowState();
    const next = dispatchAlert(state, { category: "made_up_category" as never });
    expect(next.broadcastAlerts ?? []).toHaveLength(0);
  });

  it("refuses an unrecognised target scope", () => {
    const state = seedWardFlowState();
    const next = dispatchAlert(state, { targetScope: "everywhere" as never });
    expect(next.broadcastAlerts ?? []).toHaveLength(0);
  });

  it("refuses a non-positive duration instead of silently defaulting to 240 minutes", () => {
    const state = seedWardFlowState();
    const next = dispatchAlert(state, { durationMinutes: 0 });
    expect(next.broadcastAlerts ?? []).toHaveLength(0);

    const negative = dispatchAlert(state, { durationMinutes: -30 });
    expect(negative.broadcastAlerts ?? []).toHaveLength(0);
  });

  it("refuses a non-finite duration (owner ruling 2026-09-25)", () => {
    const state = seedWardFlowState();
    const infinite = dispatchAlert(state, { durationMinutes: Number.POSITIVE_INFINITY });
    expect(infinite.broadcastAlerts ?? []).toHaveLength(0);

    const notANumber = dispatchAlert(state, { durationMinutes: Number.NaN });
    expect(notANumber.broadcastAlerts ?? []).toHaveLength(0);
  });

  it("still accepts a valid dispatch", () => {
    const state = seedWardFlowState();
    const next = dispatchAlert(state);
    expect(next.broadcastAlerts).toHaveLength(1);
    expect(next.broadcastAlerts[0].durationMinutes).toBe(240);
  });
});

describe("ACKNOWLEDGE_BROADCAST_ALERT refuses invalid acknowledgements (audit follow-up 2026-09-25)", () => {
  function withActiveAlert() {
    const state = seedWardFlowState();
    return dispatchAlert(state);
  }

  it("refuses acknowledgement from a unit id that does not exist", () => {
    const state = withActiveAlert();
    const alertId = state.broadcastAlerts[0].id;
    const next = wardFlowReducer(state, {
      type: "ACKNOWLEDGE_BROADCAST_ALERT",
      role: "ward",
      now: NOW,
      alertId,
      unitId: "not-a-real-unit",
    });
    expect(next.broadcastAlerts[0].acknowledgedUnits).toEqual([]);
  });

  it("owner ruling 2026-09-25: accepts COORDINATOR_DESK_ACKNOWLEDGER_ID, the one non-unit sender -- WardBroadcastBanner's only real mount sends exactly this when given no currentUnitId", () => {
    const state = withActiveAlert();
    const alertId = state.broadcastAlerts[0].id;
    const next = wardFlowReducer(state, {
      type: "ACKNOWLEDGE_BROADCAST_ALERT",
      role: "coordinator",
      now: NOW,
      alertId,
      unitId: COORDINATOR_DESK_ACKNOWLEDGER_ID,
    });
    expect(next.broadcastAlerts[0].acknowledgedUnits).toEqual([COORDINATOR_DESK_ACKNOWLEDGER_ID]);
  });

  it("owner ruling 2026-09-25: still refuses every OTHER unrecognised unitId -- the exemption is exactly one sender, not a loosened check", () => {
    const state = withActiveAlert();
    const alertId = state.broadcastAlerts[0].id;
    // Confidence-checks the exemption is narrow: a string that merely resembles the sentinel
    // (wrong case) is still refused rather than matched loosely.
    const next = wardFlowReducer(state, {
      type: "ACKNOWLEDGE_BROADCAST_ALERT",
      role: "ward",
      now: NOW,
      alertId,
      unitId: COORDINATOR_DESK_ACKNOWLEDGER_ID.toUpperCase(),
    });
    expect(next.broadcastAlerts[0].acknowledgedUnits).toEqual([]);
  });

  it("refuses a repeat acknowledgement from the same unit", () => {
    const state = withActiveAlert();
    const alertId = state.broadcastAlerts[0].id;
    const once = wardFlowReducer(state, {
      type: "ACKNOWLEDGE_BROADCAST_ALERT",
      role: "ward",
      now: NOW,
      alertId,
      unitId: "rph-adult-secure",
    });
    expect(once.broadcastAlerts[0].acknowledgedUnits).toEqual(["rph-adult-secure"]);

    const twice = wardFlowReducer(once, {
      type: "ACKNOWLEDGE_BROADCAST_ALERT",
      role: "ward",
      now: NOW,
      alertId,
      unitId: "rph-adult-secure",
    });
    // Refused, not silently no-op'd: state is unchanged and the event was rejected.
    expect(twice.broadcastAlerts[0].acknowledgedUnits).toEqual(["rph-adult-secure"]);
  });

  it("refuses acknowledgement of an alert that is no longer active (stood down)", () => {
    const state = withActiveAlert();
    const alertId = state.broadcastAlerts[0].id;
    const stoodDown = wardFlowReducer(state, {
      type: "STAND_DOWN_BROADCAST_ALERT",
      role: "coordinator",
      now: NOW,
      alertId,
    });
    const next = wardFlowReducer(stoodDown, {
      type: "ACKNOWLEDGE_BROADCAST_ALERT",
      role: "ward",
      now: NOW,
      alertId,
      unitId: "rph-adult-secure",
    });
    expect(next.broadcastAlerts[0].acknowledgedUnits).toEqual([]);
  });
});

describe("STAND_DOWN_BROADCAST_ALERT refuses an alert already stood down (audit follow-up 2026-09-25)", () => {
  it("refuses a second stand-down", () => {
    const state = seedWardFlowState();
    const dispatched = dispatchAlert(state);
    const alertId = dispatched.broadcastAlerts[0].id;
    const stoodDown = wardFlowReducer(dispatched, {
      type: "STAND_DOWN_BROADCAST_ALERT",
      role: "coordinator",
      now: NOW,
      alertId,
    });
    expect(stoodDown.broadcastAlerts[0].status).toBe("stood_down");

    const secondAttempt = wardFlowReducer(stoodDown, {
      type: "STAND_DOWN_BROADCAST_ALERT",
      role: "coordinator",
      now: NOW + 5,
      alertId,
    });
    expect(secondAttempt.broadcastAlerts[0].stoodDownAt).toBe(stoodDown.broadcastAlerts[0].stoodDownAt);
  });
});
