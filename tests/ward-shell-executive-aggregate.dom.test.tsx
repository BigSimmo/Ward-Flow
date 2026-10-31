import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
});
