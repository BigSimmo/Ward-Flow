// Access audit (31 Oct 2026): the broadcast banner's Alerts link shows only to a desk that may open
// Alerts. The admin desk cannot, so it sees a network-wide alert with no link to a dead end. (The
// executive's state carries no broadcasts at all, so it never sees the banner.)
// Synthetic data only.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { WardBroadcastBanner } from "@/components/ward-management/shell/ward-broadcast-banner";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const DISPATCH = {
  type: "DISPATCH_BROADCAST_ALERT",
  role: "coordinator",
  now: NOW_ANCHOR,
  title: "Synthetic capacity alert",
  message: "Synthetic message for the access test.",
  severity: "warning",
  category: "capacity_gridlock",
  targetScope: "all",
  targetScopeLabel: "All units",
  durationMinutes: 60,
  dispatchedByName: "Synthetic desk",
} satisfies WardFlowEvent;

function Dispatch() {
  const { dispatch } = useWardFlow();
  useEffect(() => {
    dispatch(DISPATCH);
  }, [dispatch]);
  return null;
}

function renderBanner(access?: Parameters<typeof setWardAccess>[0]) {
  if (access) {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess(access);
    });
  }
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <Dispatch />
        <WardBroadcastBanner />
      </WardAccessScope>
    </WardFlowProvider>,
  );
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("broadcast banner Alerts link", () => {
  it("links the coordinator to Alerts", () => {
    renderBanner();
    const banner = screen.getByTestId("ward-broadcast-banner");
    expect(within(banner).getByRole("link", { name: /^Alerts/u })).toHaveAttribute("href", "/ward-flow/alerts");
  });

  it("shows the admin desk the alert with no link to Alerts", () => {
    renderBanner({ role: "admin", scope: { kind: "statewide" } });
    const banner = screen.queryByTestId("ward-broadcast-banner");
    expect(banner, "the admin desk sees the network-wide broadcast").not.toBeNull();
    expect(within(banner!).queryByRole("link", { name: /Alerts/u })).toBeNull();
  });
});
