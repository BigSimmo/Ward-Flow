import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The executive desk's own chrome in the new frame (Josh, 31 Oct 2026, 09:54 and 10:34): no
 * "Synthetic prototype" pill and no "?" beside the title, "Search Ward Flow", the Alerts bell with
 * its count, no shift card, the capacity card in the rail and at the top of the phone Menu, and a
 * phone dock of Statistics, Capacity and Activity. The access admin's menu leads with Governance.
 * Synthetic report only; the chrome must never reach an operational hook.
 */
const guard = vi.hoisted(() => ({
  path: "/ward-flow/statistics",
  phone: false,
  /** The authenticated executive: any operational hook is a failure. */
  strict: true,
  raw: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => guard.path,
  useRouter: () => ({ push: guard.push, replace: guard.push }),
}));
vi.mock("../src/components/ward-management/ward-flow-provider", async (original) => {
  const actual = await original<typeof import("../src/components/ward-management/ward-flow-provider")>();
  const deny =
    <T extends (...args: never[]) => unknown>(hook: T) =>
    (...args: Parameters<T>) => {
      if (!guard.strict) return hook(...args);
      guard.raw();
      throw new Error("The executive chrome called an operational hook");
    };
  return {
    ...actual,
    useWardFlow: deny(actual.useWardFlow),
    useWardFlowSelect: deny(actual.useWardFlowSelect),
    useWardFlowClock: deny(actual.useWardFlowClock),
    useWardNetwork: deny(actual.useWardNetwork),
  };
});

import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "../src/components/ward-management/ward-flow-provider";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { projectExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-projector";
import { ExecutiveStatisticsLivePreviewProvider } from "../src/components/ward-management/statistics/executive-statistics-context";
import type { ExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-contract";
import { WardExecutiveChrome } from "../src/components/ward-management/shell/ward-executive-chrome";
import {
  WardShellAuthorityProvider,
  WardShellPublicProvider,
  executiveShellPlaces,
} from "../src/components/ward-management/shell/ward-shell-public-context";
import { resetWardAccessStoreForTests, setWardAccess } from "../src/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "../src/components/ward-management/shell/ward-feature-flag-store";
import { resetServiceScopeForTests } from "../src/components/ward-management/shell/ward-service-store";
import { TOUR_SEEN_STORAGE_KEY } from "../src/components/ward-management/help/ward-help-store";

/** The views Help was asked to open, read from the shell's open-help event. */
function helpViews() {
  const views: string[] = [];
  const listener = (event: Event) => views.push((event as CustomEvent<{ view?: string }>).detail?.view ?? "");
  window.addEventListener("ward-flow-open-help", listener);
  return { views, stop: () => window.removeEventListener("ward-flow-open-help", listener) };
}

let report: ExecutiveReportingFoundation;
beforeAll(() => {
  const source = seedWardFlowState();
  report = projectExecutiveReportingFoundation(
    source,
    { role: "executive", scope: { kind: "statewide" } },
    {
      now: 642,
      dayZero: "2026-10-26T16:00:00.000Z",
      startedAt: "2026-10-27T02:42:00.000Z",
      places: wardPlaceLookup(source.units),
    },
  );
}, 20_000);

const identity = { source: "synthetic-executive-frame" };

function openChrome() {
  const chrome = (
    <WardShellPublicProvider
      value={{ places: executiveShellPlaces(report), placeLabel: "Statewide", now: 642, switchRole: vi.fn() }}
    >
      <ExecutiveStatisticsLivePreviewProvider enabled identity={identity} projection={{ identity, data: report }}>
        <WardExecutiveChrome>
          <main id="main-content">Synthetic report</main>
        </WardExecutiveChrome>
      </ExecutiveStatisticsLivePreviewProvider>
    </WardShellPublicProvider>
  );
  // The authenticated executive's own authority, as the workspace host gives it. The access admin
  // case reads its desk from the local store, inside the demo provider, as the local preview does.
  return render(
    guard.strict ? (
      <WardShellAuthorityProvider access={{ role: "executive", scope: { kind: "statewide" } }}>
        {chrome}
      </WardShellAuthorityProvider>
    ) : (
      <WardFlowProvider>{chrome}</WardFlowProvider>
    ),
  );
}

beforeEach(() => {
  guard.path = "/ward-flow/statistics";
  guard.phone = false;
  guard.strict = true;
  guard.raw.mockClear();
  resetWardAccessStoreForTests();
  resetServiceScopeForTests();
  window.localStorage.clear();
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: guard.phone && query === "(max-width: 48rem)",
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  }));
});
afterEach(() => {
  cleanup();
  act(() => setWardFeatureFlagOnDevice("role-access", null));
  resetWardAccessStoreForTests();
  vi.restoreAllMocks();
});

describe("the executive chrome in the new frame", () => {
  it("drops the pill, the title's help and the shift card, and names the search and the Alerts bell", () => {
    openChrome();
    const header = screen.getByTestId("ward-bar");
    expect(within(header).queryByRole("button", { name: /Synthetic prototype/ })).toBeNull();
    expect(within(header).queryByRole("button", { name: /^Help for/ })).toBeNull();
    // The visually hidden synthetic mark stays, word for word.
    expect(within(header).getByTitle(/^Patient and flow data are synthetic;/)).toHaveTextContent("Synthetic prototype");
    expect(within(header).getByPlaceholderText("Search Ward Flow")).toBeInTheDocument();
    const alerts = screen.getByTestId("ward-bar-tasks-trigger");
    expect(alerts).toHaveTextContent(/^Alerts0$/);
    expect(within(header).queryByText("Tasks")).toBeNull();
    fireEvent.click(alerts);
    expect(screen.getByRole("dialog", { name: "Alerts" })).toHaveTextContent(
      "Individual alerts are unavailable for this desk.",
    );
    const rail = screen.getByTestId("ward-rail");
    expect(within(rail).queryByTestId("ward-rail-handover-countdown")).toBeNull();
    expect(rail).not.toHaveTextContent("Executive · Demo desk");
    expect(guard.raw).not.toHaveBeenCalled();
  });

  it("shows the rail's capacity card with occupancy rows, the count over the line and the ready beds", () => {
    openChrome();
    const card = screen.getByTestId("ward-rail-capacity-alerts-trigger");
    expect(card).toHaveTextContent("Bed alerts");
    expect(card).toHaveTextContent(/over 85%/);
    expect(card).toHaveTextContent(`${report.network.beds.ready} beds ready now`);
    expect(card).toHaveTextContent("Metro");
    expect(card.getAttribute("aria-label")).toMatch(/^Bed alerts: (None|\d+) over 85%\. Metro /);
    fireEvent.click(card);
    expect(screen.getAllByTestId("ward-rail-bed-alert-row")).toHaveLength(report.services.length);
  });

  it("gives the phone a dock of Statistics, Capacity and Activity and opens the Menu on the capacity card", () => {
    guard.phone = true;
    openChrome();
    const dock = screen.getByTestId("ward-phone-dock");
    expect(
      within(dock)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Statistics", "Capacity"]);
    expect(within(dock).getByTestId("ward-phone-menu-activity")).toHaveTextContent("Activity");
    expect(within(dock).queryByText("Tasks")).toBeNull();
    fireEvent.click(screen.getByTestId("ward-bar-phone-menu"));
    const top = within(screen.getByTestId("ward-phone-menu")).getByTestId("ward-phone-menu-top");
    expect(top).toHaveTextContent("Bed alerts");
    expect(top).toHaveTextContent(`${report.network.beds.ready} beds ready now, across the whole network`);
    expect(within(top).getByRole("link")).toHaveAttribute("href", "/ward-flow/capacity");
    expect(guard.raw).not.toHaveBeenCalled();
  });

  it("leads the access admin's rail and phone Menu with Governance", () => {
    guard.strict = false;
    act(() => setWardFeatureFlagOnDevice("role-access", true));
    act(() => setWardAccess({ role: "admin", scope: { kind: "statewide" } }));
    const view = openChrome();
    const railMenu = screen.getByTestId("ward-rail-role-menu");
    expect(within(railMenu).getAllByRole("link")[0]).toHaveTextContent("Governance");
    view.unmount();
    guard.phone = true;
    openChrome();
    fireEvent.click(screen.getByTestId("ward-bar-phone-menu"));
    const menu = screen.getByTestId("ward-phone-menu");
    const own = within(menu).getByRole("heading", { name: "Executive" }).nextElementSibling as HTMLElement;
    expect(within(own).getAllByRole("link")[0]).toHaveTextContent("Governance");
  });

  // Josh, 31 Oct 2026 (Help, question 11): Help opens on How do I… and never starts the tour by itself.
  it("opens Help on How do I… from the rail and the phone Menu, as the shared chrome does", () => {
    const opened = helpViews();
    const view = openChrome();
    const help = screen.getByTestId("ward-rail-help");
    expect(help).toHaveAccessibleName("Help, new");
    fireEvent.click(help);
    view.unmount();
    window.localStorage.setItem(
      TOUR_SEEN_STORAGE_KEY,
      "coordinator,ward,ed,officer,community,bed_manager,executive,admin",
    );
    guard.phone = true;
    openChrome();
    fireEvent.click(screen.getByTestId("ward-bar-phone-menu"));
    const menuHelp = within(screen.getByTestId("ward-phone-menu")).getByTestId("ward-rail-help");
    expect(menuHelp).toHaveAccessibleName("Help");
    fireEvent.click(menuHelp);
    opened.stop();
    expect(opened.views).toEqual(["tasks", "tasks"]);
  });
});
