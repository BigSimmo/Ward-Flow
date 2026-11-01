// Alerts redesign (Q149, 1 Nov 2026): Add units asks more desks on a live directive or bed call.
import { describe, expect, it } from "vitest";

import { askedDesks } from "@/components/ward-management/alerts/global-alert-view";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
const seed = seedWardFlowState();
const [first, second, third] = seed.units.map((unit) => unit.id);
const edId = allEmergencyDepartments()[0].id;

const dispatch = (fields: Partial<WardFlowEvent & { type: "DISPATCH_BROADCAST_ALERT" }>) =>
  wardFlowReducer(seed, {
    type: "DISPATCH_BROADCAST_ALERT",
    role: "coordinator",
    now: NOW,
    title: "Synthetic alert",
    message: "Synthetic message for the add units test.",
    severity: "warning",
    category: "capacity_gridlock",
    targetScope: "all",
    targetScopeLabel: "Chosen units",
    durationMinutes: 60,
    dispatchedByName: "Synthetic desk",
    targetUnitIds: [first],
    ...fields,
  } as WardFlowEvent);

const add = (state: ReturnType<typeof dispatch>, unitIds: string[], role: "coordinator" | "ward" = "coordinator") =>
  wardFlowReducer(state, {
    type: "ADD_BROADCAST_ALERT_UNITS",
    role,
    now: NOW,
    alertId: state.broadcastAlerts.at(-1)!.id,
    unitIds,
  });

describe("ADD_BROADCAST_ALERT_UNITS", () => {
  it("adds new desks to a directive, after the ones it already asks, and renames the audience", () => {
    const next = add(dispatch({}), [second, edId, first]);
    const alert = next.broadcastAlerts.at(-1)!;
    expect(alert.targetUnitIds).toEqual([first, second, edId]);
    expect(alert.targetScopeLabel).toBe("3 units");
    expect(askedDesks(alert, next.units)).toEqual([first, second, edId]);
  });

  it("asks only wards on a bed call", () => {
    const sent = dispatch({ kind: "bed_call" });
    expect(add(sent, [edId]).broadcastAlerts.at(-1)!.targetUnitIds).toEqual([first]);
    const next = add(sent, [second, third]);
    expect(next.broadcastAlerts.at(-1)!.targetUnitIds).toEqual([first, second, third]);
    expect(next.broadcastAlerts.at(-1)!.targetScopeLabel).toBe("3 wards");
  });

  it("refuses a desk already asked, a made-up desk, an ended alert and a ward desk", () => {
    const sent = dispatch({});
    const before = sent.broadcastAlerts.at(-1);
    expect(add(sent, [first]).broadcastAlerts.at(-1)).toEqual(before);
    expect(add(sent, ["NOT-A-UNIT"]).broadcastAlerts.at(-1)).toEqual(before);
    expect(add(sent, []).broadcastAlerts.at(-1)).toEqual(before);
    expect(add(sent, [second], "ward").broadcastAlerts.at(-1)).toEqual(before);
    const ended = wardFlowReducer(sent, {
      type: "ADD_BROADCAST_ALERT_UNITS",
      role: "coordinator",
      now: (NOW + 61) as typeof NOW,
      alertId: before!.id,
      unitIds: [second],
    });
    expect(ended.broadcastAlerts.at(-1)).toEqual(before);
  });
});
