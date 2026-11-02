// One Alerts queue (Josh picked design B and signed it off, 16 Oct 2026, D-61): for the bed
// coordinator's desk, Tasks and Alerts are one queue. The bar button and the phone dock say Alerts, the desktop drawer is a
// quick look with a way to the Alerts screen, a phone goes straight to that screen, and on the
// Alerts screen the button does not open a second copy of the list.
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef, type ComponentProps, type ReactNode } from "react";
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
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { WardPhoneMenu } from "@/components/ward-management/shell/ward-phone-menu";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WARD_ALERTS_HREF } from "@/components/ward-management/ward-nav";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { buttonClass } from "@/components/wf";
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

  it("gives each alert one action beside Open, and one way on to the Alerts screen (change 7, D-77)", () => {
    const onClose = vi.fn();
    render(
      <WardTasksDrawer
        items={items}
        acknowledgements={{}}
        completions={{}}
        role="coordinator"
        now={NOW_ANCHOR}
        dispatch={vi.fn()}
        onClose={onClose}
        onSelectMovement={vi.fn()}
        records={{ movements: seed.movements, patients: seed.patients, referrals: seed.referrals, units: seed.units }}
      />,
    );
    const drawer = screen.getByRole("complementary", { name: "Alerts" });
    // The per-row selects, the extra row buttons and the footer text links go.
    expect(within(drawer).queryByRole("combobox")).toBeNull();
    for (const gone of [/^Acknowledge$/u, /^Take$/u, /^Escalate$/u, /Snooze/u]) {
      expect(within(drawer).queryByRole("button", { name: gone })).toBeNull();
    }
    expect(within(drawer).queryByTestId("ward-tasks-quick-jumps")).toBeNull();
    expect(within(drawer).queryByText("Seen is not resolved")).toBeNull();
    expect(within(drawer).getByTestId("ward-tasks-open-alerts")).toHaveTextContent("Open Alerts");

    const transport = items.find((item) => /transport/iu.test(item.title));
    if (!transport) throw new Error("fixture drifted: the seeded inbox has no transport alert");
    const action = within(drawer).getByTestId(`ward-task-action-${transport.id}`);
    expect(action).toHaveTextContent("Chase transport");
    // H-0975: the row opens its own movement, not the general Movements list.
    expect(action).toHaveAttribute("href", movementHref(transport.movementId));
    fireEvent.click(action);
    expect(onClose).toHaveBeenCalled();
    const row = action.closest("li")!;
    expect(within(row).getAllByRole("link")).toHaveLength(1);
    expect(within(row).getByRole("button", { name: "Open patient" })).toBeInTheDocument();
  });
});

describe("the Alerts drawer redesign (pop-alerts, approved 31 Oct 2026)", () => {
  const records = { movements: seed.movements, patients: seed.patients, referrals: seed.referrals, units: seed.units };

  function renderDrawer(
    list = items,
    acknowledgements: ComponentProps<typeof WardTasksDrawer>["acknowledgements"] = {},
  ) {
    render(
      <WardTasksDrawer
        items={list}
        acknowledgements={acknowledgements}
        completions={{}}
        role="coordinator"
        now={NOW_ANCHOR}
        dispatch={vi.fn()}
        onClose={vi.fn()}
        onSelectMovement={vi.fn()}
        records={records}
      />,
    );
    return screen.getByRole("complementary", { name: "Alerts" });
  }

  it("gives only the most urgent row a filled button, and outlines Open Alerts", () => {
    const drawer = renderDrawer();
    const actions = Array.from(drawer.querySelectorAll<HTMLElement>('[data-testid^="ward-task-action-"]'));
    expect(actions.length, "the seeded inbox has several alerts").toBeGreaterThan(2);
    const [first, ...rest] = actions;
    for (const other of rest) expect(other.className).not.toBe(first!.className);
    expect(new Set(rest.map((action) => action.className)).size).toBe(1);
    expect(within(drawer).getByTestId("ward-tasks-open-alerts").className).toBe(
      buttonClass({ variant: "sec", size: "sm" }),
    );
  });

  it("shares one row between same-kind alerts, one line per person, surname first", () => {
    const drawer = renderDrawer();
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.title, (counts.get(item.title) ?? 0) + 1);
    const [title, count] = [...counts].find(([, n]) => n > 1) ?? [];
    if (!title || !count) throw new Error("fixture drifted: the seeded inbox has no two alerts of one kind");
    const list = within(drawer).getByRole("list", { name: `${title}, ${count} people` });
    expect(within(list).getAllByRole("listitem")).toHaveLength(count);
    expect(within(drawer).getAllByRole("heading", { level: 4, name: title })).toHaveLength(1);
    // Names read "Surname, Given" (D-83), never given name first.
    const member = within(list).getAllByRole("listitem")[0]!;
    expect(member.querySelector("strong")?.textContent).toMatch(/^[^,]+, [^,]+$/u);
  });

  it("keeps each grouped alert's acknowledgement status, so seen and unseen still differ", () => {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.title, (counts.get(item.title) ?? 0) + 1);
    const [title, count] = [...counts].find(([, n]) => n > 1) ?? [];
    if (!title || !count) throw new Error("fixture drifted: the seeded inbox has no two alerts of one kind");
    const [seen, unseen] = items.filter((item) => item.title === title);
    const drawer = renderDrawer(items, {
      [seen!.id]: [{ at: NOW_ANCHOR, by: "Bed coordinator" }],
    });
    const list = within(drawer).getByRole("list", { name: `${title}, ${count} people` });
    const seenMember = within(list).getByTestId(`ward-task-member-${seen!.id}`);
    expect(within(seenMember).getByTestId(`ward-task-ack-${seen!.id}`)).toHaveTextContent(
      /^Acknowledged by Bed coordinator at .+, still open$/u,
    );
    const unseenMember = within(list).getByTestId(`ward-task-member-${unseen!.id}`);
    expect(within(unseenMember).queryByTestId(`ward-task-ack-${unseen!.id}`)).toBeNull();
  });

  it("shows a long group's first 6, then Show more", () => {
    const transport = items.find((item) => /transport/iu.test(item.title));
    if (!transport) throw new Error("fixture drifted: the seeded inbox has no transport alert");
    const many = Array.from({ length: 9 }, (_, index) => ({ ...transport, id: `${transport.id}-copy-${index}` }));
    const drawer = renderDrawer(many);
    const list = within(drawer).getByRole("list", { name: `${transport.title}, 9 people` });
    expect(within(list).getAllByRole("listitem")).toHaveLength(6);
    fireEvent.click(within(drawer).getByRole("button", { name: "Show 3 more" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(9);
    expect(within(drawer).getByRole("button", { name: "Show fewer" })).toHaveAttribute("aria-expanded", "true");
  });

  it("says a bed pull is past its pull limit, not overdue", () => {
    const pull = items.find((item) => /bed pull/iu.test(item.title));
    if (!pull) throw new Error("fixture drifted: the seeded inbox has no bed pull alert");
    const drawer = renderDrawer([pull]);
    expect(drawer).toHaveTextContent("Past pull limit");
    expect(drawer).not.toHaveTextContent(/Overdue/u);
  });

  it("shows '12 of 12 alerts' only while a filter narrows the list, and greys an empty filter's zero", () => {
    const drawer = renderDrawer(items.filter((item) => item.tone === "danger"));
    const status = within(drawer).getByRole("status");
    expect(status).toHaveClass("sr-only");
    const filters = within(drawer).getByRole("group", { name: "Filter alerts by status" });
    const waiting = within(filters).getByRole("button", { name: "Waiting 0" });
    expect(waiting.querySelector("[data-zero]")).not.toBeNull();
    expect(within(filters).getByRole("button", { name: /^All / }).querySelector("[data-zero]")).toBeNull();
    fireEvent.click(waiting);
    expect(within(drawer).getByRole("status")).not.toHaveClass("sr-only");
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

  // Q177 (Josh, 1 Nov 2026): the coordinator's dock says Tasks again and opens the same queue.
  it("has a Tasks tab that links to the coordinator's queue on the Alerts screen", () => {
    renderDock();
    const tab = screen.getByTestId("ward-phone-menu-tasks");
    expect(tab).toHaveAttribute("href", WARD_ALERTS_HREF);
    expect(tab).toHaveAccessibleName("Tasks, 12 outstanding");
    expect(tab).not.toHaveAttribute("aria-current");
    expect(screen.queryByTestId("ward-phone-menu-alerts")).toBeNull();
  });

  it("marks the Tasks tab as the current page on the Alerts screen", () => {
    route.pathname = WARD_ALERTS_HREF;
    renderDock();
    expect(screen.getByTestId("ward-phone-menu-tasks")).toHaveAttribute("aria-current", "page");
  });

  // Q177: the dock slot reads Tasks, so Alerts keeps one row of its own in the phone Menu.
  it("lists Alerts once in the menu now that the dock tab reads Tasks", () => {
    renderDock();
    act(() => openWardMenu(null));
    const railHrefs = screen.getAllByTestId("ward-rail-link").map((link) => link.getAttribute("href"));
    expect(railHrefs.filter((href) => href === WARD_ALERTS_HREF)).toHaveLength(1);
  });

  // The new frame's phone dock per desk (Josh, 31 Oct 2026): the executive's Alerts list is the bed
  // coordinator's and so empty, so its slot goes to Capacity.
  it("gives a role that may not open the Alerts screen Capacity in the Alerts slot", () => {
    asExecutive();
    renderDock();
    expect(screen.queryByTestId("ward-phone-menu-alerts")).toBeNull();
    expect(screen.queryByTestId("ward-phone-menu-tasks")).toBeNull();
    const labels = screen.getAllByTestId("ward-phone-dock-link").map((link) => link.textContent ?? "");
    expect(labels.some((label) => label.includes("Capacity"))).toBe(true);
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

  // The new frame (Josh, 31 Oct 2026): one name and one icon on every desk, the bell and "Alerts".
  it("says Alerts, with no link to the Alerts screen, for a role that may not open it", async () => {
    asExecutive();
    installMatchMediaStub(true);
    const trigger = renderBar();
    expect(trigger).toHaveTextContent(/^Alerts/u);
    fireEvent.click(trigger);
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog", { name: "Alerts" })).toBeInTheDocument();
    // The list inside is still this desk's task list (`ward-tasks-drawer.tsx`).
    const drawer = await screen.findByRole("complementary", { name: "Alerts" });
    expect(within(drawer).queryByTestId("ward-tasks-open-alerts")).toBeNull();
    expect(within(drawer).queryByTestId("ward-tasks-jump-alerts")).toBeNull();
  });

  it("says Alerts for a ward desk too, opening its own panel as before", () => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [seed.units[0].id] } });
    const trigger = renderBar();
    expect(trigger).toHaveTextContent(/^Alerts/u);
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
