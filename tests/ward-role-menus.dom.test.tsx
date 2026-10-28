// B1 (Josh, 19 Oct 2026): each desk sees its own short menu, with every other page it may open
// under More. DA-09: on a ward or ED desk the brand, Policy, Capacity and handover links never lead
// to "Not part of your role". C2: the phone bar per role (a ward nurse gets My ward, Referrals, +,
// Alerts, Handover), with Alerts and Activity kept apart.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import postcss from "postcss";
import { createRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/ward-flow" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
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
import { EdOverview } from "@/components/ward-management/ed/ed-overview";
import { OperatorSwitcherModal } from "@/components/ward-management/settings/operator-switcher-modal";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";
import { WardPhoneMenu } from "@/components/ward-management/shell/ward-phone-menu";
import { WardRail } from "@/components/ward-management/shell/ward-rail";
import { ROLE_MENUS, railEntries, roleMenu } from "@/components/ward-management/shell/ward-rail-entries";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { installMatchMediaStub } from "./setup/jsdom.setup";

const WARD_DESK: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } };
const ED_DESK: WardAccess = { role: "ed", scope: { kind: "ed", edId: "peel-ed" } };
const OFFICER_DESK: WardAccess = { role: "officer", scope: { kind: "jobs" } };

function atDesk(access: WardAccess | null) {
  act(() => setWardFeatureFlagOnDevice("role-access", access ? true : null));
  if (access) act(() => setWardAccess(access));
}

function wrap(children: ReactNode) {
  return (
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>{children}</WardFlowProvider>
    </ToastProvider>
  );
}

/** The rail's handover countdown card, which opens the handover board. */
function handoverCard() {
  return screen.getByRole("link", { name: /^Handover (?:in |due now).*Open shift handover board\.$/u });
}

/**
 * The role menu as the open desktop rail shows it. Each item's accessible name starts with its
 * label; a count may follow it ("Referrals, 7 ..."). A5: an item marked as the countdown card's twin
 * is hidden by CSS on the open rail (jsdom does not apply it), so it is left out here.
 */
function railMenu() {
  const menu = screen.getByTestId("ward-rail-role-menu");
  return Array.from(menu.querySelectorAll<HTMLElement>("a, button"))
    .filter((item) => !item.closest("[data-countdown-twin]"))
    .map((item) => item.getAttribute("aria-label") ?? "");
}

afterEach(() => {
  cleanup();
  nav.pathname = "/ward-flow";
  installMatchMediaStub(false);
  act(() => setWardFeatureFlagOnDevice("role-access", null));
  resetWardAccessStoreForTests();
});

describe("role menus split every page into the menu or More, never both or neither (B1)", () => {
  it("keeps every page for every role, one place each (the coordinator's Alerts in the header bell)", () => {
    const entries = railEntries();
    for (const role of Object.keys(ROLE_MENUS) as (keyof typeof ROLE_MENUS)[]) {
      const { main, more } = roleMenu(entries, role);
      const ids = [
        ...main.map((item) => item.id).filter((id) => id !== "bed-finder"),
        ...more.flatMap((g) => g.entries.map((e) => e.id)),
      ];
      expect(new Set(ids).size, role).toBe(ids.length);
      // P116 (Josh, 27 Oct 2026): on the coordinator desk Alerts lives in the header bell only.
      const expected = entries.map((entry) => entry.id).filter((id) => role !== "coordinator" || id !== "alerts");
      expect(ids.toSorted(), role).toEqual(expected.toSorted());
    }
  });
});

describe("the rail shows the desk's own menu (B1)", () => {
  it("gives the ward desk My ward, Coming and going, Referrals to answer and Handover", () => {
    expect(roleMenu(railEntries(), "ward").main.map((item) => item.label)).toEqual([
      "My ward",
      "Coming and going",
      "Referrals to answer",
      "Handover",
    ]);
    atDesk(WARD_DESK);
    render(wrap(<WardRail />));
    // A5: on the open rail the countdown card above the menu is the desk's Handover.
    expect(railMenu()).toEqual([
      "My ward",
      expect.stringMatching(/^Coming and going/u),
      expect.stringMatching(/^Referrals to answer/u),
    ]);
    expect(handoverCard()).toHaveAttribute("href", "/ward-flow/handover");
    expect(screen.getByTestId("ward-rail-role-menu")).toHaveAccessibleName("Nurse in charge menu");
  });

  it("gives the bed coordinator Home, Capacity, Movements, Waiting, All EDs, Referrals and Handover (27 Oct)", () => {
    const { main, more } = roleMenu(railEntries(), "coordinator");
    expect(main.map((item) => [item.id, item.label])).toEqual([
      ["command", "Home"],
      ["capacity", "Capacity"],
      ["movements", "Movements"],
      ["delays", "Waiting"],
      ["ed", "All EDs"],
      ["referrals", "Referrals"],
      ["handover", "Handover"],
    ]);
    // Josh, 27 Oct 2026: Waiting and All EDs are in the menu, so More no longer lists them.
    const moreLabels = more.flatMap((group) => group.entries.map((entry) => entry.label));
    expect(moreLabels).not.toContain("Waiting");
    expect(moreLabels).not.toContain("All EDs");
    render(wrap(<WardRail />));
    expect(railMenu()).toEqual([
      "Home",
      expect.stringMatching(/^Capacity, /u),
      expect.stringMatching(/^Movements, /u),
      expect.stringMatching(/^Waiting\b/u),
      expect.stringMatching(/^All EDs\b/u),
      expect.stringMatching(/^Referrals, /u),
    ]);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/ward-flow");
    expect(screen.getByRole("link", { name: /^Capacity, /u })).toHaveAttribute("href", "/ward-flow/capacity");
    expect(handoverCard()).toHaveAttribute("href", "/ward-flow/handover");
    expect(screen.getByRole("link", { name: /^Waiting\b/u })).toHaveAttribute("href", "/ward-flow/waiting");
    expect(screen.getByRole("link", { name: /^All EDs\b/u })).toHaveAttribute("href", "/ward-flow/ed");
  });

  it("gives the executive Statistics and Capacity (Josh, 27 Oct 2026)", () => {
    expect(roleMenu(railEntries(), "executive").main.map((item) => [item.id, item.label])).toEqual([
      ["statistics", "Statistics"],
      ["capacity", "Capacity"],
    ]);
  });

  it("gives the ED desk its board, its referrals, New referral and Find a bed", () => {
    atDesk(ED_DESK);
    render(wrap(<WardRail />));
    expect(railMenu()).toEqual([
      expect.stringMatching(/^My ED board/u),
      expect.stringMatching(/^My referrals/u),
      expect.stringMatching(/^New referral/u),
      "Find a bed",
    ]);
    expect(screen.getByTestId("ward-rail-bed-finder")).toHaveAttribute("type", "button");
    // The narrow strip keeps the first three items; Find a bed, the fourth, waits in its Menu.
    expect(screen.getByTestId("ward-rail-bed-finder").closest("li")?.className).toMatch(/compactExtra/u);
    expect(screen.getByRole("link", { name: /^My ED board/u }).closest("li")?.className ?? "").not.toMatch(
      /compactExtra/u,
    );
  });

  it("gives the transport officer My jobs and Alerts", () => {
    atDesk(OFFICER_DESK);
    render(wrap(<WardRail />));
    expect(railMenu()).toEqual([expect.stringMatching(/^My jobs/u), expect.stringMatching(/^Alerts/u)]);
  });

  it("keeps everything else one tap away under More", () => {
    atDesk(WARD_DESK);
    render(wrap(<WardRail />));
    fireEvent.click(screen.getByTestId("ward-rail-more"));
    const sheet = screen.getByRole("dialog", { name: "More pages" });
    expect(within(sheet).queryByRole("link", { name: /^My ward/u })).toBeNull();
    expect(within(sheet).getAllByRole("link").length).toBeGreaterThan(0);
  });
});

describe("Handover shows once where the countdown card links to it (A5)", () => {
  it("hides the menu's Handover only on the open rail over 1200px, where the card shows", () => {
    render(wrap(<WardRail />));
    const twin = screen.getAllByRole("link", { name: "Handover" }).map((link) => link.closest("li"));
    expect(twin).toHaveLength(1);
    expect(twin[0]).toHaveAttribute("data-countdown-twin", "true");
    // The icon rail (closed, or tablet landscape) hides the card, so it keeps its Handover icon.
    const css = readFileSync("src/components/ward-management/shell/ward-rail.module.css", "utf8");
    const rules: string[] = [];
    postcss.parse(css).walkRules((rule) => {
      if (rule.selector.includes(".countdownTwin")) {
        const media = rule.parent?.type === "atrule" ? (rule.parent as postcss.AtRule).params : "";
        rules.push(`${media} ${rule.selector} ${rule.nodes.map(String).join(";")}`);
      }
    });
    expect(rules).toEqual([
      '(min-width: 1201px) .rail[data-rail="open"]:not([data-tablet]) .countdownTwin display: none',
    ]);
  });

  it("keeps the menu's Handover, with its active state, while you are on the handover board", () => {
    nav.pathname = "/ward-flow/handover";
    render(wrap(<WardRail />));
    const item = screen.getAllByRole("link", { name: "Handover" }).map((link) => link.closest("li"));
    expect(item).toHaveLength(1);
    expect(item[0]).not.toHaveAttribute("data-countdown-twin");
  });

  it("does not repeat Handover in More's groups under the sheet's countdown (ED desk)", () => {
    atDesk(ED_DESK);
    render(wrap(<WardRail />));
    fireEvent.click(screen.getByTestId("ward-rail-more"));
    const sheet = screen.getByRole("dialog", { name: "More pages" });
    const toHandover = within(sheet)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/ward-flow/handover");
    expect(toHandover).toHaveLength(1);
  });

  it("does not repeat Handover under the Menu sheet's countdown", () => {
    render(wrap(<WardRail />));
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const sheet = screen.getByRole("dialog", { name: "Menu" });
    const toHandover = within(sheet)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/ward-flow/handover");
    expect(toHandover).toHaveLength(1);
    expect(toHandover[0]).toHaveTextContent(/^Handover(in .+|due now)$/u);
    expect(
      within(within(sheet).getByRole("region", { name: "Bed coordinator" })).getAllByRole("link")[0],
    ).toHaveAccessibleName("Home");
  });
});

describe("a ward or ED desk is not offered pages outside its role (DA-09)", () => {
  it("points the brand at the desk's own home", () => {
    atDesk(WARD_DESK);
    render(wrap(<WardRail />));
    expect(screen.getByRole("link", { name: "Ward Flow WA — home" })).toHaveAttribute(
      "href",
      "/ward-flow/ward/rph-adult-secure",
    );
  });

  it("keeps the brand on Ward Flow's home for the coordinator", () => {
    render(wrap(<WardRail />));
    expect(screen.getByRole("link", { name: "Ward Flow WA — home" })).toHaveAttribute("href", "/ward-flow");
  });

  it("offers an ED desk no Governance link from the rail's More sheet", () => {
    // A7 moved the policy version (once a Governance link here) to Settings, Data and about.
    atDesk(ED_DESK);
    render(wrap(<WardRail />));
    fireEvent.click(screen.getByTestId("ward-rail-more"));
    const sheet = screen.getByRole("dialog", { name: "More pages" });
    expect(within(sheet).queryByText(/Policy 2026\.3/u)).toBeNull();
    expect(
      within(sheet)
        .queryAllByRole("link")
        .filter((link) => link.getAttribute("href") === "/ward-flow/governance"),
    ).toHaveLength(0);
    expect(within(sheet).getByText("Synthetic prototype")).toBeInTheDocument();
  });

  it("asks the same role filter as the menu for Capacity, Governance and the TV", () => {
    const canOpen = (access: WardAccess | null) => {
      atDesk(access);
      const { result, unmount } = renderHook(() => useCanOpenHref(), { wrapper: ({ children }) => wrap(children) });
      const answer = result.current;
      unmount();
      return answer;
    };
    const coordinator = canOpen(null);
    expect(coordinator("/ward-flow/capacity")).toBe(true);
    expect(coordinator("/ward-flow/governance")).toBe(true);

    const ward = canOpen(WARD_DESK);
    expect(ward("/ward-flow/capacity")).toBe(false);
    expect(ward("/ward-flow/governance")).toBe(false);
    expect(ward("/ward-flow/ward/rph-adult-secure")).toBe(true);
    // Josh (19 Oct 2026): ward desks may open the TV, ED desks may not.
    expect(ward("/ward-flow/bed-meeting")).toBe(true);

    const ed = canOpen(ED_DESK);
    expect(ed("/ward-flow/capacity")).toBe(false);
    expect(ed("/ward-flow/bed-meeting")).toBe(false);
    expect(ed("/ward-flow/ed/peel-ed")).toBe(true);
  });

  it("offers an ED desk no TV link and no links to other departments, but keeps their figures", () => {
    const department = (id: string, code: string) => ({
      id,
      name: `${code} Emergency Department`,
      code,
      service: "East Metro",
      waiting: 2,
      longest: "3h",
      breaches: 0,
    });
    const overview = (
      <EdOverview
        departmentId="peel-ed"
        departments={[department("peel-ed", "PEEL"), department("rph-ed", "RPH")]}
        onBoard={2}
        chips={[]}
        highlight={null}
        onHighlight={() => {}}
        checks={[]}
        onRaiseReferral={() => {}}
      />
    );
    act(() => setWardFeatureFlagOnDevice("bed-meeting-tv", true));
    try {
      atDesk(ED_DESK);
      const { unmount } = render(wrap(overview));
      const strip = screen.getByRole("navigation", { name: "Emergency departments" });
      expect(
        within(strip)
          .getAllByRole("link")
          .map((link) => link.getAttribute("href")),
      ).toEqual(["/ward-flow/ed/peel-ed"]);
      expect(within(strip).getByText("RPH")).toBeInTheDocument();
      expect(screen.queryByTestId("ward-ed-open-tv")).toBeNull();
      unmount();

      atDesk(null);
      render(wrap(overview));
      const coordinatorStrip = screen.getByRole("navigation", { name: "Emergency departments" });
      expect(within(coordinatorStrip).getAllByRole("link")).toHaveLength(2);
      expect(screen.getByTestId("ward-ed-open-tv")).toBeInTheDocument();
    } finally {
      act(() => setWardFeatureFlagOnDevice("bed-meeting-tv", null));
    }
  });
});

function renderDock() {
  installMatchMediaStub(true);
  render(
    wrap(
      <WardPhoneMenu
        returnFocusRef={createRef<HTMLButtonElement>()}
        tasksCount={4}
        activityUnread={2}
        onOpenDrawer={() => {}}
        onNewReferral={() => {}}
      />,
    ),
  );
  const dock = screen.getByTestId("ward-phone-dock");
  return Array.from(dock.children).map((child) =>
    child.querySelector("[data-testid='ward-phone-create']")
      ? "+"
      : (child.getAttribute("aria-label") ?? child.textContent ?? "").replace(/,.*$/u, "").trim(),
  );
}

describe("the phone bar follows the desk (C2)", () => {
  it("gives the ward nurse My ward, Referrals, +, Alerts and Handover", () => {
    atDesk(WARD_DESK);
    expect(renderDock().map((name) => name.replace(/^\d+\s*/u, ""))).toEqual([
      expect.stringMatching(/^My ward/u),
      expect.stringMatching(/Referrals/u),
      "+",
      "Alerts",
      expect.stringMatching(/Handover/u),
    ]);
  });

  it("gives the ED desk Find a bed beside Alerts", () => {
    atDesk(ED_DESK);
    renderDock();
    expect(screen.getByTestId("ward-phone-dock-bed-finder")).toHaveTextContent("Find a bed");
    expect(screen.getByTestId("ward-phone-menu-alerts")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-phone-menu-activity")).toBeNull();
  });

  it("keeps the coordinator's Alerts and Activity as two separate controls", () => {
    renderDock();
    expect(screen.getByTestId("ward-phone-menu-alerts")).toBeInTheDocument();
    expect(screen.getByTestId("ward-phone-menu-activity")).toBeInTheDocument();
    expect(screen.getByTestId("ward-phone-menu-alerts")).not.toBe(screen.getByTestId("ward-phone-menu-activity"));
  });
});

describe("going to a desk says it worked (B6)", () => {
  it("shows which desk is open and who the shell is working as", () => {
    render(wrap(<OperatorSwitcherModal isOpen onClose={() => {}} />));
    fireEvent.click(screen.getAllByTestId("workstation-open-officer")[0]!);
    const toast = screen.getByTestId("toast");
    expect(toast).toHaveTextContent(/^Now at /u);
    expect(toast).toHaveTextContent(/Working as /u);
  });

  it("names the signed-in role, not the desk's, in the shared workspace", () => {
    atDesk({ role: "coordinator", scope: { kind: "statewide" } });
    render(
      wrap(
        <SharedAccessContext.Provider value={{ api: {} as SharedAccessApi, actorId: null }}>
          <OperatorSwitcherModal isOpen onClose={() => {}} />
        </SharedAccessContext.Provider>,
      ),
    );
    fireEvent.click(screen.getAllByTestId("workstation-open-officer")[0]!);
    const toast = screen.getByTestId("toast");
    expect(toast).toHaveTextContent("Still working as Bed coordinator.");
    expect(toast).not.toHaveTextContent(/Transport officer/u);
  });
});
