// R-HOME-18: when more than one notice is live the banner says how many more wait and lists them.
// Synthetic data only.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { WardBroadcastBanner } from "@/components/ward-management/shell/ward-broadcast-banner";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const base = {
  type: "DISPATCH_BROADCAST_ALERT",
  role: "coordinator",
  now: NOW_ANCHOR,
  message: "Synthetic message.",
  severity: "warning",
  category: "capacity_gridlock",
  targetScope: "all",
  targetScopeLabel: "All units",
  durationMinutes: 60,
  dispatchedByName: "Synthetic desk",
} satisfies Partial<WardFlowEvent>;

function Dispatch() {
  const { dispatch } = useWardFlow();
  useEffect(() => {
    dispatch({ ...base, title: "Synthetic first notice" } as WardFlowEvent);
    dispatch({ ...base, title: "Synthetic second notice" } as WardFlowEvent);
  }, [dispatch]);
  return null;
}

afterEach(() => {
  cleanup();
  act(() => resetWardAccessStoreForTests());
});

describe("Banner, more notices waiting", () => {
  it("shows a button with the count and lists the others when pressed", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardAccessScope>
          <Dispatch />
          <WardBroadcastBanner />
        </WardAccessScope>
      </WardFlowProvider>,
    );
    const toggle = screen.getByTestId("ward-broadcast-more-toggle");
    expect(toggle).toHaveTextContent("1 more waiting");
    fireEvent.click(toggle);
    expect(screen.getByTestId("ward-broadcast-more").querySelectorAll("li")).toHaveLength(1);
  });
});
