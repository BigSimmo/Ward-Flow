/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/ward-flow/statistics", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { setStatisticsSamples } from "@/components/ward-management/statistics/statistics-samples";
import { WardAccessGate, WardAccessScope } from "@/components/ward-management/shell/ward-access";
import {
  markSignInLanding,
  resetWardAccessStoreForTests,
  setWardAccess,
} from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { resetWardLiveRegionForTests, WardLiveRegion } from "@/components/ward-management/shell/ward-live-region";
import { WardPanelAddress } from "@/components/ward-management/shell/ward-panel-address";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import {
  homeHrefFor,
  ROLE_SCREENS,
  screenForPath,
  type WardAccess,
} from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Synthetic desks only. */
const WARD_UNIT = "rph-adult-secure";
const wardDesk: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [WARD_UNIT] } };

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  nav.replace.mockReset();
  nav.pathname = "/ward-flow/statistics";
  setStatisticsSamples(false);
  resetWardLiveRegionForTests();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

function renderGated(pathname: string, access: WardAccess, page: ReactNode = <p>Page body</p>, signedInHere = false) {
  nav.pathname = pathname;
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(access);
    if (signedInHere) markSignInLanding(pathname);
  });
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <ToastProvider>
          <WardAccessGate>{page}</WardAccessGate>
        </ToastProvider>
      </WardAccessScope>
    </WardFlowProvider>,
  );
}

describe("WF-42 bare /statistics stays closed and the closed screen redirects", () => {
  it("sends a ward desk from bare /statistics to its own ward's Statistics, never drawing the hub", () => {
    renderGated("/ward-flow/statistics", wardDesk, <p>Statistics hub</p>);
    expect(screen.queryByText("Statistics hub")).toBeNull();
    expect(screen.queryByText("Not part of your role")).toBeNull();
    expect(screen.getByText("Opening your statistics")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-access-own-home-notice")).toBeNull();
    expect(nav.replace).toHaveBeenCalledWith(`/ward-flow/statistics/ward/${WARD_UNIT}`);
  });

  it("still shows the closed screen for a statistics section the ward desk may not open", () => {
    renderGated("/ward-flow/statistics/compare", wardDesk, <p>Compare</p>);
    expect(screen.getByText("Not part of your role")).toBeInTheDocument();
    expect(screen.queryByText("Compare")).toBeNull();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("sends a ward desk signing in on a saved bare /statistics to its own Statistics, not home (#1471 review)", () => {
    renderGated("/ward-flow/statistics", wardDesk, <p>Statistics hub</p>, true);
    expect(screen.getByText("Opening your statistics")).toBeInTheDocument();
    expect(screen.queryByText("Opening your home")).toBeNull();
    expect(nav.replace).toHaveBeenCalledWith(`/ward-flow/statistics/ward/${WARD_UNIT}`);
    expect(nav.replace).not.toHaveBeenCalledWith(`/ward-flow/ward/${WARD_UNIT}`);
  });
});

describe("#1470 review: the role notice is only for a refused deep link", () => {
  it("sends the brand address to the desk's home without saying a page was refused", () => {
    renderGated("/ward-flow", wardDesk);
    expect(screen.getByText("Opening your home")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-access-own-home-notice")).toBeNull();
    expect(nav.replace).toHaveBeenCalledWith(`/ward-flow/ward/${WARD_UNIT}`);
  });

  it("says the page is not part of the role when a sign-in lands on a page the desk cannot open", () => {
    renderGated("/ward-flow/governance", wardDesk, undefined, true);
    expect(screen.getByTestId("ward-access-own-home-notice")).toHaveTextContent("That page is not part of your role.");
    expect(nav.replace).toHaveBeenCalledWith(`/ward-flow/ward/${WARD_UNIT}`);
  });
});

describe("WF-42 /activity and /help open their panel on each desk's own home", () => {
  it("lets every role through to the Activity and Help addresses", () => {
    for (const path of ["/ward-flow/activity", "/ward-flow/help"]) {
      const address = screenForPath(path);
      expect(address).toBeDefined();
      for (const [role, table] of Object.entries(ROLE_SCREENS)) {
        expect(table[address!.screen], `${role} ${path}`).toBeDefined();
      }
    }
  });

  it("lands a ward desk on its own ward with the panel opened", () => {
    vi.useFakeTimers();
    const open = vi.fn();
    renderGated("/ward-flow/activity", wardDesk, <WardPanelAddress label="Activity" open={open} />);
    expect(screen.queryByText("Not part of your role")).toBeNull();
    expect(screen.getByText("Opening Activity")).toBeInTheDocument();
    expect(nav.replace).toHaveBeenCalledWith(`/ward-flow/ward/${WARD_UNIT}`);
    expect(window.location.pathname).toBe(`/ward-flow/ward/${WARD_UNIT}`);
    expect(open).not.toHaveBeenCalled();
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("lands an ED desk on its own ED for Help", () => {
    vi.useFakeTimers();
    const open = vi.fn();
    const edDesk: WardAccess = { role: "ed", scope: { kind: "ed", edId: "rph-ed" } };
    renderGated("/ward-flow/help", edDesk, <WardPanelAddress label="Help" open={open} />);
    expect(screen.queryByText("Not part of your role")).toBeNull();
    expect(nav.replace).toHaveBeenCalledWith(homeHrefFor(edDesk, (name) => name));
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("still opens the panel when the route change unmounts the address page first (#1471 review)", () => {
    vi.useFakeTimers();
    const open = vi.fn();
    const view = renderGated("/ward-flow/activity", wardDesk, <WardPanelAddress label="Activity" open={open} />);
    expect(nav.replace).toHaveBeenCalledWith(`/ward-flow/ward/${WARD_UNIT}`);
    // router.replace(home) commits: the address page unmounts before its zero-delay timer runs.
    nav.pathname = `/ward-flow/ward/${WARD_UNIT}`;
    view.unmount();
    expect(open).not.toHaveBeenCalled();
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(open).toHaveBeenCalledTimes(1);
  });
});

describe("WF-42 example history announcement", () => {
  it("announces when example history is turned on or off", () => {
    render(<WardLiveRegion />);
    const live = screen.getByTestId("ward-live-region");
    act(() => {
      setStatisticsSamples(true);
    });
    expect(live).toHaveTextContent(/Example history is on, and invented 30-day charts are shown below\./i);
    expect(live).toHaveTextContent(/Invented/i);
    act(() => {
      setStatisticsSamples(false);
    });
    expect(live).toHaveTextContent(/Example history is off, and the invented charts are hidden\./i);
  });
});

describe("WF-46 access admin home", () => {
  it("sends the access admin home to Governance", () => {
    expect(homeHrefFor({ role: "admin", scope: { kind: "statewide" } }, (name) => name)).toBe("/ward-flow/governance");
  });
});
