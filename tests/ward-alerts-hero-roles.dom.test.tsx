import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import { alertsBroadcastItem, alertsMoreButton } from "./helpers/alerts-broadcast";

// Alerts redesign role views (Josh, 31 Oct 2026, "Yes to all"): a desk that can never broadcast
// is not shown a greyed Broadcast, and the transport officer, who never takes an alert, has no "Yours".
afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

function renderAs(access: Parameters<typeof setWardAccess>[0]) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(access);
  });
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <AlertsScreen />
    </WardFlowProvider>,
  );
}

describe("Alerts hero role branches", () => {
  it("keeps Broadcast and Yours for the coordinator", () => {
    renderAs({ role: "coordinator", scope: { kind: "statewide" } });
    expect(alertsBroadcastItem()).toBeInTheDocument();
    expect(screen.getByTestId("ward-alerts-hero")).toHaveTextContent(/\d+ yours/);
  });

  it("leaves Broadcast out for a ward desk", () => {
    renderAs({ role: "ward", scope: { kind: "ward", unitIds: [allUnits()[0].id] } });
    fireEvent.click(alertsMoreButton());
    expect(screen.queryByRole("menuitem", { name: /Broadcast alert/ })).not.toBeInTheDocument();
  });

  it("leaves Broadcast and Yours out for the transport officer", () => {
    renderAs({ role: "officer", scope: { kind: "jobs" } });
    expect(screen.getByTestId("ward-alerts-hero")).not.toHaveTextContent(/yours/i);
    fireEvent.click(alertsMoreButton());
    expect(screen.queryByRole("menuitem", { name: /Broadcast alert/ })).not.toBeInTheDocument();
  });
});
