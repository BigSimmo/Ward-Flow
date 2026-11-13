import { describe, expect, it } from "vitest";
import {
  currentDeskId,
  OFFICER_DESK_ID,
  COORDINATOR_DESK_ID,
} from "@/components/ward-management/settings/workstation-desks";
import { createIsolatedState } from "../helpers/test-harness";
import { wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { BroadcastAlert } from "@/components/ward-management/alerts/ward-broadcast-model";

describe("Tier 1 - Feature 09: Broadcast Alert Stand-Down Modal & Desk Identity Derivation", () => {
  const now = NOW_ANCHOR;

  it("derives correct ED desk identity from ED routes", () => {
    expect(currentDeskId("/ward-flow/ed/jhc-ed")).toBe("jhc-ed");
    expect(currentDeskId("/ward-flow/ed/fsh-ed")).toBe("fsh-ed");
  });

  it("derives correct ward desk identity from ward and board routes", () => {
    expect(currentDeskId("/ward-flow/ward/rph-adult-secure")).toBe("rph-adult-secure");
    expect(currentDeskId("/ward-flow/board/scgh-adult-open")).toBe("scgh-adult-open");
  });

  it("derives correct officer desk identity from transport routes", () => {
    expect(currentDeskId("/ward-flow/transport/officer")).toBe(OFFICER_DESK_ID);
  });

  it("falls back to coordinator desk identity on statewide network and alert routes", () => {
    expect(currentDeskId("/ward-flow/alerts")).toBe(COORDINATOR_DESK_ID);
    expect(currentDeskId("/ward-flow/discharges")).toBe(COORDINATOR_DESK_ID);
    expect(currentDeskId("/ward-flow/referrals")).toBe(COORDINATOR_DESK_ID);
  });

  it("records stand-down timestamp and clinician role when STAND_DOWN_BROADCAST_ALERT is dispatched, rejecting redundant stand-down", () => {
    let state = createIsolatedState();
    const alertId = "AL-TEST-001";
    const testAlert: BroadcastAlert = {
      id: alertId,
      raisedAt: now - 60,
      expiresAt: now + 240,
      authorRole: "coordinator",
      category: "surge",
      severity: "severe",
      targetScope: "all_wards",
      acknowledgedUnits: [],
      headline: "Hospital Surge Escalation Level 3",
      detail: "Statewide high occupancy alert across adult acute wards.",
      status: "active",
    };

    state = {
      ...state,
      broadcastAlerts: [testAlert],
    };

    // Dispatch stand-down
    state = wardFlowReducer(state, {
      type: "STAND_DOWN_BROADCAST_ALERT",
      role: "coordinator",
      alertId,
      now,
    });

    const alertAfter = (state.broadcastAlerts as BroadcastAlert[]).find((a) => a.id === alertId);
    expect(alertAfter?.status).toBe("stood_down");
    expect(alertAfter?.stoodDownAt).toBe(now);
    expect(alertAfter?.stoodDownBy).toBe("coordinator");

    // Redundant stand-down must be rejected rather than silently overwriting audit timestamp
    state = wardFlowReducer(state, {
      type: "STAND_DOWN_BROADCAST_ALERT",
      role: "coordinator",
      alertId,
      now: now + 10,
    });

    expect(state.rejections.at(-1)?.attempted).toBe("STAND_DOWN_BROADCAST_ALERT");
    expect(state.rejections.at(-1)?.reason).toContain("is already stood down");
  });
});
