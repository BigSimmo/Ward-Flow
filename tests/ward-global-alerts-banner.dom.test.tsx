import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
    // Ops-23: the in-app Alerts link carries a chevron, never an external-link glyph.
    const alertsLink = within(banner).getByRole("link", { name: /^Alerts/u });
    expect(alertsLink.querySelector(".lucide-chevron-right")).not.toBeNull();
    expect(alertsLink.querySelector(".lucide-external-link")).toBeNull();

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

describe("Global alert banner on a phone (remaining-pages audit ops-10)", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  const asPhone = () =>
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 48rem)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );

  it("is one line that opens Alerts, with the answers only for the asked ward", () => {
    asPhone();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RaisePullNow movementId="WF-003" />
        <WardBroadcastBanner currentUnitId="rph-adult-secure" />
      </WardFlowProvider>,
    );
    const banner = screen.getByTestId("ward-broadcast-banner");
    expect(banner).toHaveAttribute("data-layout", "phone-line");
    const line = within(banner).getByRole("link", { name: /Pull now.*0 of 1 answered.*open Alerts/u });
    expect(line).toHaveAttribute("href", "/ward-flow/alerts");
    expect(within(banner).getByRole("group", { name: "Your answer" })).toBeInTheDocument();
    fireEvent.click(within(banner).getByRole("button", { name: "Pulling now" }));
    expect(within(banner).queryByRole("group", { name: "Your answer" })).toBeNull();
    expect(within(banner).getAllByRole("link")).toHaveLength(1);
  });
});
