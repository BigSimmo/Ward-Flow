// One Alerts queue (Josh picked design B and signed it off, 16 Oct 2026, D-61): for the bed
// coordinator's desk, Tasks and Alerts are one queue. The bar button and the phone dock say Alerts, the desktop drawer is a
// quick look with a way to the Alerts screen, a phone goes straight to that screen, and on the
// Alerts screen the button does not open a second copy of the list.
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const route = { pathname: "/ward-flow" };
const mockRouterPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: mockRouterPush, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { openWardMenu } from "@/components/ward-management/shell/ward-drawer-bus";
import { WardPhoneMenu } from "@/components/ward-management/shell/ward-phone-menu";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WARD_ALERTS_HREF } from "@/components/ward-management/ward-nav";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf/toast-provider";

import { installMatchMediaStub } from "./setup/jsdom.setup";

const seed = seedWardFlowState();
const items = buildActionInbox(seed.movements.filter(isOpen), NOW_ANCHOR, seed.units);

beforeEach(() => {
  route.pathname = "/ward-flow";
  mockRouterPush.mockClear();
  if (typeof window.requestAnimationFrame !== "function") {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame;
  }
});

afterEach(() => {
  installMatchMediaStub(false);
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

/** An executive desk: the role access table gives it no Alerts screen. */
function asExecutive() {
  setWardFeatureFlagOnDevice("role-access", true);
  setWardAccess({ role: "executive", scope: { kind: "statewide" } });
}

describe("the drawer with one Alerts queue", () => {
  it("uses the Alerts name and groups, and links to the Alerts screen", () => {
    render(
      <WardTasksDrawer
        items={items}
        acknowledgements={{}}
        completions={{}}
        role="coordinator"
        now={NOW_ANCHOR}
        dispatch={vi.fn()}
        onClose={vi.fn()}
        onSelectMovement={vi.fn()}
      />,
    );
    const drawer = screen.getByRole("complementary", { name: "Alerts" });
    expect(within(drawer).getByRole("heading", { level: 2, name: "Alerts" })).toBeInTheDocument();

    const filters = within(drawer).getByRole("group", { name: "Filter alerts by status" });
    const red = items.filter((item) => item.tone === "danger").length;
    expect(within(filters).getByRole("button", { name: `Act now ${red}` })).toBeInTheDocument();
    expect(within(filters).getByRole("button", { name: `Waiting ${items.length - red}` })).toBeInTheDocument();
    expect(within(filters).queryByRole("button", { name: /Critical|Review/u })).toBeNull();

    expect(within(drawer).getByTestId("ward-tasks-open-alerts")).toHaveAttribute("href", WARD_ALERTS_HREF);
    // The old text link to the same screen goes, so the quick look offers one way there.
    expect(within(drawer).queryByTestId("ward-tasks-jump-alerts")).toBeNull();
  });
});

describe("the phone dock with one Alerts queue", () => {
  function renderDock() {
    installMatchMediaStub(true);
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <WardPhoneMenu
            returnFocusRef={createRef<HTMLButtonElement>()}
            tasksCount={12}
            activityUnread={0}
            onOpenDrawer={() => {}}
            onNewReferral={() => {}}
          />
        </WardFlowProvider>
      </ToastProvider>,
    );
  }

  it("has an Alerts tab that links to the Alerts screen, not a Tasks drawer button", () => {
    renderDock();
    const tab = screen.getByTestId("ward-phone-menu-alerts");
    expect(tab).toHaveAttribute("href", WARD_ALERTS_HREF);
    expect(tab).toHaveAccessibleName("Alerts, 12 outstanding");
    expect(tab).not.toHaveAttribute("aria-current");
    expect(screen.queryByTestId("ward-phone-menu-tasks")).toBeNull();
  });

  it("marks the Alerts tab as the current page on the Alerts screen", () => {
    route.pathname = WARD_ALERTS_HREF;
    renderDock();
    expect(screen.getByTestId("ward-phone-menu-alerts")).toHaveAttribute("aria-current", "page");
  });

  it("lists Alerts once in the menu, as the dock tab, not again in its group", () => {
    renderDock();
    act(() => openWardMenu(null));
    const railHrefs = screen.getAllByTestId("ward-rail-link").map((link) => link.getAttribute("href"));
    expect(railHrefs).not.toContain(WARD_ALERTS_HREF);
  });

  it("keeps the Tasks drawer button for a role that may not open the Alerts screen", () => {
    asExecutive();
    renderDock();
    expect(screen.queryByTestId("ward-phone-menu-alerts")).toBeNull();
    expect(screen.getByTestId("ward-phone-menu-tasks")).toBeInTheDocument();
  });
});

describe("the bar's Alerts button", () => {
  function renderBar() {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBar />
      </WardFlowProvider>,
    );
    return screen.getByTestId("ward-bar-tasks-trigger");
  }

  it("says Alerts and opens the quick look named Alerts on another page", async () => {
    const trigger = renderBar();
    expect(trigger).toHaveTextContent(/^Alerts/u);
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Alerts" })).toBeInTheDocument();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it("does not open a second copy of the list on the Alerts screen", () => {
    route.pathname = WARD_ALERTS_HREF;
    const trigger = renderBar();
    expect(trigger).toHaveAttribute("aria-current", "page");
    expect(trigger).not.toHaveAttribute("aria-haspopup");
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog", { name: "Alerts" })).toBeNull();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it("opens the Alerts screen on a phone instead of a drawer", () => {
    installMatchMediaStub(true);
    const trigger = renderBar();
    fireEvent.click(trigger);
    expect(mockRouterPush).toHaveBeenCalledWith(WARD_ALERTS_HREF);
    expect(screen.queryByRole("dialog", { name: "Alerts" })).toBeNull();
  });

  it("stays Tasks, with no link to Alerts, for a role that may not open the Alerts screen", async () => {
    asExecutive();
    installMatchMediaStub(true);
    const trigger = renderBar();
    expect(trigger).toHaveTextContent(/^Tasks/u);
    fireEvent.click(trigger);
    expect(mockRouterPush).not.toHaveBeenCalled();
    const drawer = await screen.findByRole("complementary", { name: "Tasks" });
    expect(within(drawer).queryByTestId("ward-tasks-open-alerts")).toBeNull();
    expect(within(drawer).queryByTestId("ward-tasks-jump-alerts")).toBeNull();
  });

  it("stays Tasks for a ward desk, whose task list is the bed coordinator's and so empty", () => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [seed.units[0].id] } });
    const trigger = renderBar();
    expect(trigger).toHaveTextContent(/^Tasks/u);
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("chooses the Now tab before focusing the queue when another Alerts view is showing", async () => {
    route.pathname = WARD_ALERTS_HREF;
    const trigger = renderBar();
    // A stand-in for the Alerts screen's tabs, with History showing and no queue rows drawn.
    const tabs = document.createElement("div");
    tabs.innerHTML =
      '<section aria-label="Alerts"><button id="alerts-tab-now" role="tab" aria-selected="false">Now</button></section>';
    document.body.append(tabs);
    const nowTab = document.getElementById("alerts-tab-now")!;
    const row = document.createElement("div");
    row.dataset.alertId = "a1";
    row.innerHTML = '<button data-testid="ward-alerts-open">Open</button>';
    nowTab.addEventListener("click", () => {
      nowTab.setAttribute("aria-selected", "true");
      tabs.append(row);
    });
    fireEvent.click(trigger);
    expect(nowTab).toHaveAttribute("aria-selected", "true");
    await act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));
    expect(document.activeElement).toBe(within(row).getByTestId("ward-alerts-open"));
    tabs.remove();
  });
});
