import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import {
  setRailOpenPreference,
  TABLET_LANDSCAPE_RAIL_QUERY,
  useRailOpenStore,
  WardRail,
} from "@/components/ward-management/shell/ward-rail";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/ward-flow/community/test-team",
  useSearchParams: () => new URLSearchParams(),
}));

function RailPreference() {
  return <output data-testid="rail-preference">{useRailOpenStore() ? "open" : "closed"}</output>;
}

let tabletLandscape = false;
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: tabletLandscape && query === TABLET_LANDSCAPE_RAIL_QUERY,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  act(() => setRailOpenPreference(true));
});
afterEach(() => {
  tabletLandscape = false;
  document.documentElement.removeAttribute("data-rail");
});

function openCommunity() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardRail />
      <RailPreference />
      <CommunityScreen teamId={COMMUNITY_TEAM_PAGES[0]!.id} />
    </WardFlowProvider>,
  );
}

describe("community navigation shortcuts use the shared rail", () => {
  it("keeps tablet rail preference and document shape unchanged when bracket opens the navigation menu", () => {
    tabletLandscape = true;
    openCommunity();
    expect(document.documentElement).toHaveAttribute("data-rail", "open");
    fireEvent.keyDown(document.body, { key: "[" });
    expect(screen.getByTestId("rail-preference")).toHaveTextContent("open");
    expect(document.documentElement).toHaveAttribute("data-rail", "open");
  });

  it("toggles the desktop preference exactly once through the rail owner", () => {
    openCommunity();
    fireEvent.keyDown(document.body, { key: "[" });
    expect(screen.getByTestId("rail-preference")).toHaveTextContent("closed");
    expect(document.documentElement).toHaveAttribute("data-rail", "closed");
    fireEvent.keyDown(document.body, { key: "[" });
    expect(screen.getByTestId("rail-preference")).toHaveTextContent("open");
    expect(document.documentElement).toHaveAttribute("data-rail", "open");
  });

  it("leaves bracket typing in an input alone", () => {
    const { container } = openCommunity();
    const input = document.createElement("input");
    container.append(input);
    input.focus();
    fireEvent.keyDown(input, { key: "[" });
    expect(screen.getByTestId("rail-preference")).toHaveTextContent("open");
    expect(document.documentElement).toHaveAttribute("data-rail", "open");
  });
});
