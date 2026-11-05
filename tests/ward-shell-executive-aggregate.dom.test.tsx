import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
vi.mock("../src/components/ward-management/ward-flow-provider", () => ({
  useWardFlowClock: () => {
    throw new Error("Public chrome called the operational clock");
  },
}));
import { WardBarFrame, WardRailFrame } from "../src/components/ward-management/shell/ward-chrome-frame";
import { WardShellPublicProvider } from "../src/components/ward-management/shell/ward-shell-public-context";
import { WardDemoClockPopover } from "../src/components/ward-management/ward-demo-controls";
import type { PlaceLookup } from "../src/components/ward-management/ward-role-access";
import { publishLiveRefresh } from "../src/components/wf/live";
const places: PlaceLookup = {
  unitSiteCode: () => undefined,
  unitService: () => undefined,
  edSiteCode: () => undefined,
  edService: () => undefined,
  teamSlug: (name) => name,
};
afterEach(cleanup);
describe("public chrome mechanical reuse", () => {
  it("retains header/rail DOM attributes, refs and controls", () => {
    const header = createRef<HTMLElement>();
    const clicked = vi.fn();
    render(
      <>
        <WardBarFrame
          ref={header}
          className="existing-bar"
          aria-label="Header"
          data-testid="ward-bar"
          data-wf-bar=""
          data-band="ink"
        >
          <button onClick={clicked}>Tools</button>
        </WardBarFrame>
        <WardRailFrame
          className="existing-rail"
          aria-label="Ward Flow sections"
          data-testid="ward-rail"
          data-rail="open"
        >
          <a href="/ward-flow/statistics">Statistics</a>
        </WardRailFrame>
      </>,
    );
    expect(header.current).toBe(screen.getByTestId("ward-bar"));
    expect(header.current?.tagName).toBe("HEADER");
    // P084: the rail's outer landmark is an aside (complementary), never a nav around the views nav.
    expect(screen.getByRole("complementary", { name: "Ward Flow sections" })).toHaveAttribute("data-rail", "open");
    fireEvent.click(screen.getByText("Tools"));
    expect(clicked).toHaveBeenCalledTimes(1);
  });
  it("uses the same Board time control and callback with the public report clock", () => {
    const open = vi.fn();
    render(
      <WardShellPublicProvider value={{ places, placeLabel: "Statewide", now: 642, authenticated: true }}>
        <WardDemoClockPopover onOpen={open} />
      </WardShellPublicProvider>,
    );
    const button = screen.getByRole("button", { name: "Board time 10:42 AWST. Open demo controls" });
    expect(button).toHaveTextContent("Board time 10:42 AWST");
    fireEvent.click(button);
    expect(open).toHaveBeenCalledWith(button);
  });
  // M8 (Josh, 3 Nov 2026): "One clock in the top bar. Stale is said in words."
  it("says Offline and Not updating since in words, with a name that starts with them", () => {
    const shell = { places, placeLabel: "Statewide", now: 642, authenticated: true };
    const onLine = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    try {
      const { unmount } = render(
        <WardShellPublicProvider value={shell}>
          <WardDemoClockPopover testId="clock" />
        </WardShellPublicProvider>,
      );
      const offline = screen.getByTestId("clock");
      expect(offline).toHaveTextContent(/^Offline$/);
      expect(offline).toHaveAccessibleName("Offline. Board time 10:42 AWST. Open demo controls");
      unmount();
    } finally {
      onLine.mockRestore();
    }
    try {
      act(() => publishLiveRefresh({ unavailable: true, receivedAt: new Date("2026-10-07T10:26:00+08:00").getTime() }));
      render(
        <WardShellPublicProvider value={shell}>
          <WardDemoClockPopover testId="clock" />
        </WardShellPublicProvider>,
      );
      const stale = screen.getByTestId("clock");
      expect(stale).toHaveTextContent(/^Not updating since 10:26$/);
      expect(stale).toHaveAccessibleName("Not updating since 10:26. Board time 10:42 AWST. Open demo controls");
    } finally {
      act(() => publishLiveRefresh(undefined));
    }
  });
});
