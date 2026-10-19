import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_BROADCAST_EXTENSION_MINUTES } from "@/components/ward-management/alerts/ward-broadcast-model";
import { WardBroadcastBanner } from "@/components/ward-management/shell/ward-broadcast-banner";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Top 25 item 25: a broadcast alert can be extended or stood down from the real banner. */
const NOW = NOW_ANCHOR;
const DISPATCH = {
  type: "DISPATCH_BROADCAST_ALERT",
  role: "coordinator",
  now: NOW,
  title: "Synthetic capacity alert",
  message: "Synthetic message for the extend test.",
  severity: "warning",
  category: "capacity_gridlock",
  targetScope: "all",
  targetScopeLabel: "All units",
  durationMinutes: 60,
  dispatchedByName: "Synthetic desk",
} satisfies WardFlowEvent;

describe("EXTEND_BROADCAST_ALERT", () => {
  const withAlert = wardFlowReducer(seedWardFlowState(), DISPATCH);
  const alert = withAlert.broadcastAlerts.at(-1)!;

  it("adds the fixed extension to an active alert", () => {
    const next = wardFlowReducer(withAlert, {
      type: "EXTEND_BROADCAST_ALERT",
      role: "coordinator",
      now: NOW,
      alertId: alert.id,
    });
    const extended = next.broadcastAlerts.find((entry) => entry.id === alert.id)!;
    expect(extended.expiresAt).toBe(alert.expiresAt + DEFAULT_BROADCAST_EXTENSION_MINUTES);
  });

  it("refuses an alert that has ended or does not exist", () => {
    const lapsed = wardFlowReducer(withAlert, {
      type: "EXTEND_BROADCAST_ALERT",
      role: "coordinator",
      now: alert.expiresAt,
      alertId: alert.id,
    });
    expect(lapsed.broadcastAlerts.find((entry) => entry.id === alert.id)!.expiresAt).toBe(alert.expiresAt);
    const missing = wardFlowReducer(withAlert, {
      type: "EXTEND_BROADCAST_ALERT",
      role: "coordinator",
      now: NOW,
      alertId: "BCAST-NOT-REAL",
    });
    expect(missing.broadcastAlerts).toEqual(withAlert.broadcastAlerts);
  });

  it("refuses a ward", () => {
    const refused = wardFlowReducer(withAlert, {
      type: "EXTEND_BROADCAST_ALERT",
      role: "ward",
      now: NOW,
      alertId: alert.id,
    });
    expect(refused.broadcastAlerts.find((entry) => entry.id === alert.id)!.expiresAt).toBe(alert.expiresAt);
  });
});

let flow: ReturnType<typeof useWardFlow> | undefined;
function Grab() {
  const value = useWardFlow();
  useEffect(() => {
    flow = value;
  });
  return null;
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  flow = undefined;
});

function setUp() {
  render(
    <WardFlowProvider initialNow={NOW}>
      <Grab />
      <WardBroadcastBanner />
    </WardFlowProvider>,
  );
  act(() => {
    flow!.dispatch(DISPATCH);
  });
  return flow!.broadcastAlerts.find((entry) => entry.title === DISPATCH.title)!;
}

describe("the coordinator banner", () => {
  it("extends and then stands down the live alert", () => {
    const alert = setUp();
    fireEvent.click(screen.getByTestId("ward-broadcast-extend"));
    const current = () => flow!.broadcastAlerts.find((entry) => entry.id === alert.id)!;
    expect(current().expiresAt).toBe(alert.expiresAt + DEFAULT_BROADCAST_EXTENSION_MINUTES);
    fireEvent.click(screen.getByTestId("ward-broadcast-stand-down"));
    expect(current().status).toBe("stood_down");
  });
});
