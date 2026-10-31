import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
const guard = vi.hoisted(() => ({ forbidRecords: false, push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/statistics",
  useRouter: () => ({ push: guard.push }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/ward-management/ward-flow-provider", async (original) => {
  const actual = await original<typeof import("@/components/ward-management/ward-flow-provider")>();
  return {
    ...actual,
    useOptionalWardFlow: () => {
      if (guard.forbidRecords) throw Error("Public search read an operational context");
      return actual.useOptionalWardFlow();
    },
  };
});
import {
  WardGlobalSearch,
  WardPublicSearch,
  clearGlobalSearchRecents,
} from "@/components/ward-management/ward-global-search";
import { screenDecision, screenForPath } from "@/components/ward-management/ward-role-access";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { allUnits } from "@/components/ward-management/ward-sites";
import { installMatchMediaStub } from "./setup/jsdom.setup";
import type { ExecutiveSearchCatalogue } from "@/components/ward-management/search/ward-smart-search";
import { MenuSearchResults } from "@/components/ward-management/shell/ward-phone-menu-results";
import { WardSearchCommands } from "@/components/ward-management/ward-global-search-commands";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardShellPublicProvider } from "@/components/ward-management/shell/ward-shell-public-context";
import { setWardAccess, resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
const catalogue: ExecutiveSearchCatalogue = {
  wards: [{ id: "SYN-WARD", name: "Synthetic North ward", siteCode: "SYN-NORTH", service: "North Metro" }],
  emergencyDepartments: [
    { id: "syn-north-ed", name: "Synthetic North ED", siteCode: "SYN-NORTH", service: "North Metro" },
    { id: "syn-south-ed", name: "Synthetic South ED", siteCode: "SYN-SOUTH", service: "South Metro" },
  ],
  teams: [
    { id: "syn-north-team", name: "Synthetic North team", code: "SYN-N", service: "North Metro" },
    { id: "syn-south-team", name: "Synthetic South team", code: "SYN-S", service: "South Metro" },
  ],
  services: [{ service: "North Metro" }, { service: "South Metro" }],
  catalogue: {
    sites: [
      { code: "SYN-NORTH", name: "Synthetic North site", service: "North Metro" },
      { code: "SYN-SOUTH", name: "Synthetic South site", service: "South Metro" },
    ],
  },
  openableEmergencyDepartmentIds: ["syn-north-ed"],
  openableCommunityTeamIds: ["syn-north-team"],
  openableServiceIds: ["North Metro"],
};
const units = allUnits();
const places = wardPlaceLookup(units);
const roleCanOpenHref = (href: string) =>
  screenDecision({ role: "executive", scope: { kind: "statewide" } }, screenForPath(href), places).open;
// Exercise a caller's narrower permission set without pinning a changeable role rule.
const canOpenHref = (href: string) => href !== "/ward-flow/capacity" && roleCanOpenHref(href);
afterEach(() => {
  cleanup();
  guard.forbidRecords = false;
  guard.push.mockClear();
  clearGlobalSearchRecents();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
  delete (window as typeof window & { __wardFlowConfirmNavigation?: () => boolean }).__wardFlowConfirmNavigation;
});
const input = () => screen.getByTestId("ward-global-search-input");
describe("search choices follow caller-owned permissions", () => {
  it("keeps an unavailable demo-clock explanation focusable without running the command", () => {
    const advance = vi.fn();
    const commands = (demoOff: boolean, resultsCurrent = true) => (
      <WardSearchCommands
        demoOff={demoOff}
        demoOffId="synthetic-clock-reason"
        demoOffText="Demo clock unavailable"
        resultsCurrent={resultsCurrent}
        canRunAction={() => true}
        canOpenHref={() => false}
        onAdvanceClock={advance}
        onSwitchDesk={() => {}}
        onHandover={() => {}}
        shortcutsExpanded={false}
        onToggleShortcuts={() => {}}
      />
    );
    const view = render(commands(true));
    const button = screen.getByTestId("ward-global-search-cmd-advance-clock");
    button.focus();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("Demo clock unavailable");
    fireEvent.click(button);
    expect(advance).not.toHaveBeenCalled();
    view.rerender(commands(false, false));
    fireEvent.click(button);
    expect(advance).not.toHaveBeenCalled();
    view.rerender(commands(false));
    fireEvent.click(button);
    expect(advance).toHaveBeenCalledOnce();
  });
  it("filters ordinary starting and typed navigation and quick commands without removing public places", () => {
    installMatchMediaStub(false);
    render(
      <WardGlobalSearch
        movements={[]}
        patients={[]}
        units={units}
        canOpenHref={canOpenHref}
        canRunAction={() => false}
      />,
    );
    fireEvent.focus(input());
    expect(screen.getByTestId("ward-global-search-result-view-statistics")).toBeInTheDocument();
    expect(screen.getByTestId("ward-global-search-result-view-settings")).toBeInTheDocument();
    for (const key of ["capacity", "delays", "referrals", "handover"])
      expect(screen.queryByTestId(`ward-global-search-result-view-${key}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-global-search-result-action-new-referral")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-global-search-result-action-add-patient")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-global-search-cmd-handover")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-global-search-cmd-advance-clock")).not.toBeInTheDocument();
    fireEvent.change(input(), { target: { value: "capacity" } });
    expect(screen.queryByTestId("ward-global-search-result-view-capacity")).not.toBeInTheDocument();
    fireEvent.change(input(), { target: { value: units[0]!.name } });
    expect(screen.getByTestId(`ward-global-search-result-ward-${units[0]!.id}`)).toHaveAttribute(
      "href",
      `/ward-flow/statistics/ward/${units[0]!.id}`,
    );
    fireEvent.mouseEnter(screen.getByTestId(`ward-global-search-result-ward-${units[0]!.id}`));
    const wardPreview = within(screen.getByTestId("ward-global-search-preview"));
    expect(wardPreview.getByTestId("ward-global-search-preview-open")).toHaveAttribute(
      "href",
      `/ward-flow/statistics/ward/${units[0]!.id}`,
    );
    expect(wardPreview.queryByRole("link", { name: "Open board" })).not.toBeInTheDocument();
    fireEvent.change(input(), { target: { value: "emergency" } });
    const edRow = screen.getAllByTestId(/^ward-global-search-result-ed-/)[0]!;
    fireEvent.mouseEnter(edRow);
    expect(edRow.getAttribute("href")).toMatch(/^\/ward-flow\/statistics\/ed\//);
    expect(screen.getByTestId("ward-global-search-preview-open")).toHaveAttribute("href", edRow.getAttribute("href"));
  });
  it("public search needs no operational hooks or record arrays and keeps records explicitly unavailable", () => {
    installMatchMediaStub(false);
    guard.forbidRecords = true;
    const navigate = vi.fn();
    render(
      <WardPublicSearch
        catalogue={catalogue}
        accessLifetime="synthetic-first-binding"
        canOpenHref={canOpenHref}
        onNavigate={navigate}
      />,
    );
    fireEvent.keyDown(window, { key: "/" });
    expect(input()).toHaveFocus();
    expect(screen.getByText("Individual records are unavailable for executive reporting.")).toBeInTheDocument();
    expect(screen.getByTestId("ward-global-search-result-view-statistics")).toBeInTheDocument();
    expect(screen.getByTestId("ward-global-search-result-view-settings")).toBeInTheDocument();
    fireEvent.change(input(), { target: { value: "capacity" } });
    expect(screen.queryByTestId("ward-global-search-result-view-capacity")).not.toBeInTheDocument();
    expect(screen.getByText("No permitted pages match this search.")).toBeInTheDocument();
    expect(screen.queryByText(/No matches found|Nobody on the Patients/)).not.toBeInTheDocument();
    fireEvent.change(input(), { target: { value: "stats" } });
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    const confirm = vi.fn(() => false);
    (window as typeof window & { __wardFlowConfirmNavigation?: () => boolean }).__wardFlowConfirmNavigation = confirm;
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByTestId("ward-global-search-popup")).toBeInTheDocument();
    confirm.mockReturnValue(true);
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/ward-flow/statistics");
    expect(screen.queryByTestId("ward-global-search-popup")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(input()).toHaveValue("");
    expect(screen.queryByTestId("ward-global-search-popup")).not.toBeInTheDocument();
  });
  it("matches only permitted report ward, ED, team, site and service metadata and resets on access binding change", () => {
    installMatchMediaStub(false);
    guard.forbidRecords = true;
    const view = render(
      <WardPublicSearch catalogue={catalogue} accessLifetime="synthetic-first-binding" canOpenHref={canOpenHref} />,
    );
    fireEvent.focus(input());
    for (const [query, kind, key, href] of [
      ["ward", "ward", "SYN-WARD", "/ward-flow/statistics/ward/SYN-WARD"],
      ["ed", "ed", "syn-north-ed", "/ward-flow/statistics/ed/syn-north-ed"],
      ["team", "team", "syn-north-team", "/ward-flow/statistics/community/syn-north-team"],
      ["site", "site", "SYN-NORTH", "/ward-flow/statistics/service/North%20Metro"],
      ["service", "service", "North Metro", "/ward-flow/statistics/service/North%20Metro"],
    ]) {
      fireEvent.change(input(), { target: { value: query } });
      expect(screen.getByTestId(`ward-global-search-result-${kind}-${key}`)).toHaveAttribute("href", href);
      expect(screen.queryByText(/Synthetic South/)).not.toBeInTheDocument();
    }
    view.rerender(
      <WardPublicSearch
        catalogue={{ ...catalogue, wards: [] }}
        accessLifetime="synthetic-next-binding"
        canOpenHref={canOpenHref}
      />,
    );
    expect(input()).toHaveValue("");
    expect(screen.queryByTestId("ward-global-search-popup")).not.toBeInTheDocument();
    fireEvent.change(input(), { target: { value: "ward" } });
    expect(screen.queryByTestId("ward-global-search-result-ward-SYN-WARD")).not.toBeInTheDocument();
  });
  it("filters phone typed pages and retains public wards through a permitted Statistics link", async () => {
    installMatchMediaStub(true);
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "executive", scope: { kind: "statewide" } });
    });
    const menu = (query: string) => (
      <WardFlowProvider initialNow={100}>
        <WardShellPublicProvider value={{ places, placeLabel: "Statewide", now: 100 }}>
          <MenuSearchResults query={query} entries={[]} pageRow={() => null} onGo={() => {}} />
        </WardShellPublicProvider>
      </WardFlowProvider>
    );
    const view = render(menu("capacity"));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Searching" })).not.toBeInTheDocument());
    // The Capacity page row itself; a Help "How do I" answer may also link there (Phase 2), and it
    // passes the same permission filter, so it is checked with the other rows below.
    expect(screen.queryAllByRole("link", { name: /^Capacity/ })).toHaveLength(
      Number(roleCanOpenHref("/ward-flow/capacity")),
    );
    expect(
      screen.queryAllByRole("link", { name: /Capacity/ }).every((link) => roleCanOpenHref(link.getAttribute("href")!)),
    ).toBe(true);
    view.rerender(menu(units[0]!.name));
    await waitFor(() =>
      expect(
        screen
          .getAllByTestId("ward-phone-menu-result")
          .some((link) => link.getAttribute("href") === `/ward-flow/statistics/ward/${units[0]!.id}`),
      ).toBe(true),
    );
    expect(
      screen.getAllByTestId("ward-phone-menu-result").every((link) => canOpenHref(link.getAttribute("href")!)),
    ).toBe(true);
  });
});
