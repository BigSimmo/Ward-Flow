import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const guard = vi.hoisted(() => ({
  path: "/ward-flow/statistics",
  phone: false,
  connection: null as unknown,
  raw: vi.fn(),
  seed: vi.fn(),
  poll: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () =>
    new Headers({
      "user-agent": guard.phone ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile" : "desktop",
      "sec-ch-ua-mobile": guard.phone ? "?1" : "?0",
    }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => guard.path,
  useRouter: () => ({ push: guard.push, replace: guard.replace }),
}));
vi.mock("../src/components/ward-management/ward-flow-reducer", async (original) => {
  const actual = await original<typeof import("../src/components/ward-management/ward-flow-reducer")>();
  return {
    ...actual,
    seedWardFlowStateAt: () => {
      guard.seed();
      throw new Error("Actual executive constructed a seeded World");
    },
  };
});
vi.mock("../src/components/ward-management/ward-flow-provider", async (original) => {
  const actual = await original<typeof import("../src/components/ward-management/ward-flow-provider")>();
  const deny = () => {
    guard.raw();
    throw new Error("Actual executive called an operational hook");
  };
  return { ...actual, useWardFlow: deny, useWardFlowSelect: deny, useWardFlowClock: deny, useWardNetwork: deny };
});
vi.mock("../src/components/ward-management/ward-shared-access", async (original) => ({
  ...(await original<typeof import("../src/components/ward-management/ward-shared-access")>()),
  useWardShared: () => {
    guard.poll();
    return guard.connection;
  },
}));
import Layout from "../src/app/ward-flow/layout";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { projectExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-projector";
import { useExecutiveStatistics } from "../src/components/ward-management/statistics/executive-statistics-context";
import { resetWardAccessStoreForTests } from "../src/components/ward-management/shell/ward-access-store";
import { resetServiceScopeForTests } from "../src/components/ward-management/shell/ward-service-store";
import type { WardSharedConnection } from "../src/components/ward-management/ward-shared-access";
import type { ExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-contract";
import { setForceDynamicLoading } from "./setup/jsdom.setup";
import { ExecutiveStatisticsLivePreviewProvider } from "../src/components/ward-management/statistics/executive-statistics-context";
import { WardExecutiveChromeMount } from "../src/components/ward-management/shell/ward-workspace-host";
import { TOUR_SEEN_STORAGE_KEY } from "../src/components/ward-management/help/ward-help-store";

/** Below two panes a tool opens as its own page (Josh, 6 Nov 2026): go back to the list, then open the row. */
function openToolRow(tools: HTMLElement, id: string) {
  const back = within(tools).queryByRole("button", { name: "All tools" });
  if (back) fireEvent.click(back);
  fireEvent.click(within(tools).getByTestId(`ward-tools-toggle-${id}`));
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
function connection(): WardSharedConnection {
  const now = Date.now();
  return {
    enabled: true,
    signedIn: true,
    status: "ready",
    error: null,
    snapshot: null,
    executiveSnapshot: {
      kind: "executive-aggregate",
      dataMode: "prototype",
      actorId: "synthetic-layout-actor",
      revision: 1,
      accessContext: "a".repeat(64),
      accessUntil: now + 600_000,
      now: 642,
      report,
      demoControls: false,
    },
    receivedAt: now - 1,
    viewEpoch: 1,
    actorId: "synthetic-layout-actor",
    workingAs: "synthetic-layout-executive",
    access: { role: "executive", scope: { kind: "statewide" } },
    accessUntil: now + 600_000,
    sessionEndsAt: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    switchRole: vi.fn(),
    retry: vi.fn(),
    dispatch: vi.fn(),
    pushApi: {
      pushKey: async () => ({ enabled: false }),
      pushStatus: async () => false,
      pushSubscribe: async () => "role",
      pushUnsubscribe: async () => false,
    },
  };
}
function Probe() {
  return (
    <main id="main-content" data-testid="public-report">
      {useExecutiveStatistics()?.kind}
    </main>
  );
}
async function openLayout() {
  const tree = await Layout({ children: <Probe /> });
  return render(tree);
}
beforeEach(() => {
  guard.path = "/ward-flow/statistics";
  guard.phone = false;
  guard.raw.mockClear();
  guard.seed.mockClear();
  guard.poll.mockClear();
  guard.push.mockClear();
  guard.replace.mockClear();
  resetWardAccessStoreForTests();
  resetServiceScopeForTests();
  window.localStorage.clear();
  guard.connection = connection();
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: guard.phone && query === "(max-width: 46.4375rem)",
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
  setForceDynamicLoading(false);
  vi.restoreAllMocks();
});
describe("the real layout's authenticated executive branch", () => {
  it("says the executive view is loading, not unavailable, while the public chrome chunk or preview projection is pending", async () => {
    setForceDynamicLoading(true);
    const view = await openLayout();
    expect(screen.getByTestId("ward-statistics-loading")).toHaveTextContent("Loading the executive view…");
    expect(screen.queryByTestId("ward-statistics-unavailable")).toBeNull();
    expect(screen.queryByTestId("public-report")).toBeNull();
    setForceDynamicLoading(false);
    await act(async () => {
      view.rerender(await Layout({ children: <Probe /> }));
    });
    expect(screen.getByTestId("public-report")).toBeInTheDocument();
    cleanup();
    render(
      <ExecutiveStatisticsLivePreviewProvider
        enabled
        identity={{ source: "synthetic-pending-preview" }}
        projection={null}
      >
        <WardExecutiveChromeMount>
          <Probe />
        </WardExecutiveChromeMount>
      </ExecutiveStatisticsLivePreviewProvider>,
    );
    expect(screen.getByTestId("ward-statistics-loading")).toHaveTextContent("Loading the executive view…");
    expect(screen.queryByTestId("ward-statistics-unavailable")).toBeNull();
    expect(screen.queryByTestId("public-report")).toBeNull();
    expect(guard.raw).not.toHaveBeenCalled();
  });
  it("mounts one existing header/rail and only the aggregate, with one connection and no World hooks", async () => {
    await openLayout();
    expect(screen.getAllByTestId("ward-bar")).toHaveLength(1);
    expect(screen.getAllByTestId("ward-rail")).toHaveLength(1);
    expect(screen.getByTestId("public-report")).toHaveTextContent("executive-reporting");
    expect(screen.getByTestId("ward-print-footer")).toHaveTextContent("Executive, Statewide");
    expect(guard.poll).toHaveBeenCalledTimes(1);
    expect(guard.raw).not.toHaveBeenCalled();
    expect(guard.seed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("ward-bar-activity-trigger"));
    expect(screen.getByRole("heading", { name: "Individual activity unavailable" })).toBeInTheDocument();
    expect(screen.getByTestId("ward-bar-activity-sheet")).toHaveTextContent(
      "Individual activity, unread counts and record changes are unavailable for this desk.",
    );
    expect(screen.getByTestId("ward-bar-activity-sheet")).not.toHaveTextContent("0 events");
    expect(guard.raw).not.toHaveBeenCalled();
  });
  it("retains the signed-in account actions and role availability without World hooks", async () => {
    guard.connection = {
      ...(guard.connection as WardSharedConnection),
      accountEmail: "synthetic-executive@example.invalid",
      canSwitch: true,
    };
    const view = await openLayout();
    const rail = screen.getByTestId("ward-rail");
    // DK1 (3 Nov 2026): Switch desk and Sign out live in the person's account menu, not rows of their own.
    expect(within(rail).queryByTestId("ward-account-sign-out")).toBeNull();
    expect(within(rail).queryByTestId("ward-account-switch-role")).toBeNull();
    const person = within(rail).getByTestId("ward-rail-persona-trigger");
    expect(person).toHaveAttribute("aria-haspopup", "menu");
    expect(person.getAttribute("aria-label")).toMatch(/^Executive, Statewide\. Account menu$/u);
    const openAccount = () => {
      fireEvent.click(within(rail).getByTestId("ward-rail-persona-trigger"));
      return within(rail).getByRole("menu", { name: "Account" });
    };
    let account = openAccount();
    expect(account).toHaveTextContent("synthetic-executive@example.invalid");
    expect(within(account).queryByRole("menuitem", { name: /Go to a desk|Try another desk/u })).toBeNull();
    fireEvent.click(within(account).getByRole("menuitem", { name: "Switch desk" }));
    expect((guard.connection as WardSharedConnection).switchRole).toHaveBeenCalledTimes(1);
    fireEvent.click(within(openAccount()).getByRole("menuitem", { name: "Sign out" }));
    expect((guard.connection as WardSharedConnection).signOut).toHaveBeenCalledTimes(1);
    guard.connection = { ...(guard.connection as WardSharedConnection), canSwitch: false };
    await act(async () => {
      view.rerender(await Layout({ children: <Probe /> }));
    });
    account = openAccount();
    expect(within(account).queryByRole("menuitem", { name: "Switch desk" })).toBeNull();
    expect(within(account).getByRole("menuitem", { name: "Sign out" })).toBeInTheDocument();
    expect(guard.raw).not.toHaveBeenCalled();
    expect(guard.seed).not.toHaveBeenCalled();
  });
  it("opens every permitted existing Tools group and public leaf without operational hooks", async () => {
    await openLayout();
    fireEvent.click(screen.getByTestId("ward-bar-tools-trigger"));
    const tools = screen.getByTestId("ward-bar-tools-sheet");
    fireEvent.click(within(tools).getByRole("button", { name: /^Change view$/ }));
    expect((guard.connection as WardSharedConnection).switchRole).toHaveBeenCalledOnce();
    // Tools overhaul (2 Nov 2026): the executive desk's rows are Key figures, Find a bed, On-call,
    // Suburb lookup, Form times and Messages (link rows follow the desk's page access). Suggested chips repeat some
    // names, so each row is opened by its own toggle.
    openToolRow(tools, "bed-finder");
    const finder = screen.getByTestId("ward-tools-bed-finder");
    fireEvent.click(
      within(within(finder).getByRole("radiogroup", { name: "Legal status" })).getByRole("radio", {
        name: "Voluntary",
      }),
    );
    expect(within(finder).getByRole("list", { name: "Ready beds by ward" })).toBeInTheDocument();
    openToolRow(tools, "figures");
    expect(screen.getByTestId("ward-stats-drawer-content")).toBeInTheDocument();
    openToolRow(tools, "contacts");
    expect(within(tools).getByRole("button", { name: "Contact list: Key lines" })).toBeInTheDocument();
    openToolRow(tools, "messages");
    expect(screen.getByTestId("ward-tools-messages")).toHaveTextContent("synthetic prototype");
    openToolRow(tools, "catchment");
    expect(await within(tools).findByTestId("suburb-lookup-card")).toBeInTheDocument();
    openToolRow(tools, "form-times");
    expect(within(tools).getByTestId("ward-tools-page")).toHaveAttribute("aria-label", "Form times");
    // Remind me, Due back and the demo row read the live World, so the executive desktop has none.
    expect(within(tools).queryByTestId("ward-tools-toggle-remind")).toBeNull();
    expect(within(tools).queryByTestId("ward-tools-toggle-leave-due")).toBeNull();
    expect(within(tools).queryByTestId("ward-tools-toggle-demo")).toBeNull();
    // The Hospital feed holds individual records, so the executive desk is not offered it at all.
    expect(within(tools).queryByTestId("ward-tools-toggle-feed")).toBeNull();
    expect(within(tools).queryByRole("button", { name: /Hospital feed/ })).toBeNull();
    expect(within(tools).queryByRole("button", { name: "New referral" })).toBeNull();
    expect(guard.raw).not.toHaveBeenCalled();
    expect(guard.seed).not.toHaveBeenCalled();
  });
  it("keeps service selection, exact bed alerts, appearance and the existing Help sheet usable", async () => {
    // Help opens the desk's tour until it has been seen (as the shared rail's does), so mark it seen.
    window.localStorage.setItem(TOUR_SEEN_STORAGE_KEY, "coordinator,executive");
    await openLayout();
    fireEvent.click(screen.getByTestId("ward-bar-service-trigger"));
    fireEvent.click(
      within(screen.getByTestId("ward-bar-service-panel")).getByRole("button", {
        name: new RegExp(`^${report.services[0].service}:`),
      }),
    );
    expect(screen.getByTestId("ward-bar-service-trigger")).toHaveTextContent(report.services[0].service);
    fireEvent.click(screen.getByTestId("ward-rail-capacity-alerts-trigger"));
    expect(screen.getAllByTestId("ward-rail-bed-alert-row")).toHaveLength(report.services.length);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("ward-rail-appearance-toggle"));
    fireEvent.click(within(screen.getByTestId("ward-executive-appearance")).getByRole("radio", { name: "Dark" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("ward-rail-help"));
    await waitFor(() => expect(screen.getByTestId("ward-help-sheet")).toBeInTheDocument());
    expect(guard.raw).not.toHaveBeenCalled();
  });
  it("makes Appearance the rail's radio group: opens on the current choice, arrows move, Enter picks, Escape returns", async () => {
    // Review E-11 (F-140): the same kit part and focus rule as the live rail's Appearance pop-up.
    const user = userEvent.setup();
    await openLayout();
    const toggle = screen.getByTestId("ward-rail-appearance-toggle");
    await user.click(toggle);
    const sheet = screen.getByTestId("ward-executive-appearance");
    const group = within(sheet).getByRole("radiogroup", { name: "Theme" });
    expect(within(sheet).queryAllByRole("button", { pressed: true })).toHaveLength(0);
    const current = group.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
    expect(current).not.toBeNull();
    await waitFor(() => expect(current).toHaveFocus());

    // Earlier cases may leave a theme chosen, so aim two choices on from whichever is current.
    const radios = within(group).getAllByRole("radio");
    const target = radios[(radios.indexOf(current!) + 2) % radios.length]!;
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(target).toHaveFocus();
    expect(target).toHaveAttribute("aria-checked", "false");
    expect(current).toHaveAttribute("aria-checked", "true");
    expect(radios.filter((radio) => radio.tabIndex === 0)).toEqual([target]);
    await user.keyboard("{Enter}");
    expect(target).toHaveAttribute("aria-checked", "true");
    expect(current).toHaveAttribute("aria-checked", "false");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("radiogroup", { name: "Theme" })).toBeNull());
    await waitFor(() => expect(toggle).toHaveFocus());
  });
  it("retains the real phone entry, protected Activity, Settings and server role switch", async () => {
    guard.phone = true;
    guard.connection = {
      ...(guard.connection as WardSharedConnection),
      accountEmail: "synthetic-executive@example.invalid",
      canSwitch: true,
    };
    await openLayout();
    expect(screen.queryByTestId("ward-rail")).toBeNull();
    expect(screen.getByTestId("ward-phone-dock")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ward-phone-menu-activity"));
    expect(screen.getByRole("heading", { name: "Individual activity unavailable" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("ward-bar-phone-menu"));
    const menu = screen.getByTestId("ward-phone-menu");
    expect(within(menu).getByRole("link", { name: /Settings/ })).toHaveAttribute("href", "/ward-flow/settings");
    expect(within(menu).getByRole("link", { name: "Statistics" })).toBeInTheDocument();
    fireEvent.click(within(menu).getByTestId("ward-phone-menu-switch-workstation"));
    expect((guard.connection as WardSharedConnection).switchRole).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("ward-bar-phone-menu"));
    const signOut = within(screen.getByTestId("ward-phone-menu")).getByTestId("ward-phone-menu-sign-out");
    expect(signOut).toHaveTextContent("synthetic-executive@example.invalid");
    fireEvent.click(signOut);
    expect((guard.connection as WardSharedConnection).signOut).toHaveBeenCalledTimes(1);
    expect(guard.raw).not.toHaveBeenCalled();
    expect(guard.seed).not.toHaveBeenCalled();
  });
  it("drops the public shell and its open panel as soon as authenticated access ends", async () => {
    const view = await openLayout();
    fireEvent.click(screen.getByTestId("ward-bar-activity-trigger"));
    guard.connection = {
      ...(guard.connection as WardSharedConnection),
      signedIn: false,
      access: undefined,
      executiveSnapshot: null,
      snapshot: null,
    };
    await act(async () => {
      view.rerender(await Layout({ children: <Probe /> }));
    });
    expect(screen.queryByTestId("ward-bar")).toBeNull();
    expect(screen.queryByTestId("ward-bar-activity-sheet")).toBeNull();
    expect(screen.queryByTestId("public-report")).toBeNull();
    expect(guard.raw).not.toHaveBeenCalled();
  });
});
