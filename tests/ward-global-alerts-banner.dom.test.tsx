import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { WardBroadcastBanner } from "@/components/ward-management/shell/ward-broadcast-banner";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function RaisePullNow({ movementId }: { movementId: string }) {
  const { dispatch } = useWardFlow();
  useEffect(() => {
    dispatch({ type: "RAISE_PULL_NOW", role: "coordinator", now: NOW_ANCHOR, movementId });
  }, [dispatch, movementId]);
  return null;
}

describe("Global alert banner, Pull now on the asked ward's desk", () => {
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
  });

  it("shows a red Pull now to the accepting ward and records its answer", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RaisePullNow movementId="WF-003" />
        <WardBroadcastBanner currentUnitId="rph-adult-secure" />
      </WardFlowProvider>,
    );
    const banner = screen.getByTestId("ward-broadcast-banner");
    expect(banner).toHaveAttribute("data-tone", "act_now");
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveTextContent("Pull now");

    fireEvent.click(within(banner).getByRole("button", { name: "Can't" }));
    fireEvent.click(within(banner).getByRole("button", { name: "No suitable bed" }));

    expect(banner).toHaveAttribute("data-tone", "waiting");
    expect(banner).toHaveTextContent("You said: Can't, no suitable bed");
  });

  it("shows nothing to a ward that was not asked", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RaisePullNow movementId="WF-003" />
        <WardBroadcastBanner currentUnitId="fsh-older-adult" />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-broadcast-banner")).not.toBeInTheDocument();
  });
});
