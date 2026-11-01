import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Access audit (31 Oct 2026), three dead ends. Each part proves a desk that may not open a page is
 * not offered it, and a desk that may open it still is. All data here is synthetic.
 *
 * 1. The New referral slide-out (Shift+R, a link click, arriving on its route) is referral intake.
 * 2. Find a bed's ward rows and All figures' Open statistics link to pages some desks cannot open.
 * 3. The broadcast banner speaks for the desk's own role, not the coordinator's desk a page implies.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const route = { pathname: "/ward-flow" };
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { WardBroadcastBanner } from "@/components/ward-management/shell/ward-broadcast-banner";
import { openWardDrawer } from "@/components/ward-management/shell/ward-drawer-bus";
import { openDrawerForShortcut } from "@/components/ward-management/shell/ward-rail-preferences";
import {
  readWardAccessSnapshot,
  resetWardAccessStoreForTests,
  setWardAccess,
} from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { resetServiceScopeForTests } from "@/components/ward-management/shell/ward-service-store";
import { WardBedFinder } from "@/components/ward-management/tools/ward-bed-finder";
import { NetworkFigures } from "@/components/ward-management/tools/ward-network-figures";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const coordinator: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };
const bedManager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: "FSH" } };
const officer: WardAccess = { role: "officer", scope: { kind: "jobs" } };
const admin: WardAccess = { role: "admin", scope: { kind: "statewide" } };
const edDesk: WardAccess = { role: "ed", scope: { kind: "ed", edId: "rph-ed" } };

function useDesk(access: WardAccess) {
  setWardFeatureFlagOnDevice("role-access", true);
  setWardAccess(access);
  // The store refuses a scope the role may not hold, so prove the desk was taken.
  expect(readWardAccessSnapshot().access).toEqual(access);
}

/** Two animation frames: long enough for the route effect's one-frame open to have run. */
async function settleFrames() {
  await act(async () => {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  });
}

afterEach(() => {
  cleanup();
  discardReferralDraft();
  route.pathname = "/ward-flow";
  window.history.replaceState(null, "", "/");
  window.sessionStorage.clear();
  resetServiceScopeForTests();
  setWardFeatureFlagOnDevice("role-access", null);
  resetWardAccessStoreForTests();
});

describe("1. the New referral slide-out opens only for a desk that may open referral intake", () => {
  function renderBar(children?: ReactNode) {
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBar primaryAction={{ kind: "none" }} />
        {children}
      </WardFlowProvider>,
    );
  }

  function pressShiftR() {
    act(() => {
      openDrawerForShortcut(new KeyboardEvent("keydown", { key: "R", shiftKey: true, cancelable: true }));
    });
  }

  it.each([
    ["bed manager", bedManager],
    ["officer", officer],
    ["admin", admin],
  ])("gives the %s no slide-out from Shift+R or a drawer request", async (_name, access) => {
    useDesk(access);
    renderBar();
    pressShiftR();
    act(() => openWardDrawer("referral"));
    await settleFrames();
    expect(screen.queryByTestId("ward-bar-referral-sheet")).toBeNull();
  });

  it.each([
    ["bed manager", bedManager],
    ["officer", officer],
  ])("leaves a referral link alone for the %s, with no slide-out", async (_name, access) => {
    useDesk(access);
    renderBar(<a href="/ward-flow/referrals/new?refer=ward">Refer</a>);
    const notPrevented = fireEvent.click(screen.getByRole("link", { name: "Refer" }));
    expect(notPrevented, "the bar must not take the click over").toBe(true);
    await settleFrames();
    expect(screen.queryByTestId("ward-bar-referral-sheet")).toBeNull();
  });

  it("opens no slide-out over the refused page when a bed manager arrives on the intake route", async () => {
    useDesk(bedManager);
    route.pathname = "/ward-flow/referrals/new";
    window.history.replaceState(null, "", "/ward-flow/referrals/new?refer=ed");
    renderBar();
    await settleFrames();
    expect(screen.queryByTestId("ward-bar-referral-sheet")).toBeNull();
  });

  it("leaves Shift+R untaken for a desk without the intake, and takes it for one with it", () => {
    const refused = new KeyboardEvent("keydown", { key: "R", shiftKey: true, cancelable: true });
    expect(openDrawerForShortcut(refused, false)).toBe(false);
    expect(refused.defaultPrevented, "the key press stays the page's own").toBe(false);
    const allowed = new KeyboardEvent("keydown", { key: "R", shiftKey: true, cancelable: true });
    expect(openDrawerForShortcut(allowed, true)).toBe(true);
    expect(allowed.defaultPrevented).toBe(true);
    // Shift+T and Shift+A are not referral drawers, so a desk without the intake keeps them.
    const tasks = new KeyboardEvent("keydown", { key: "T", shiftKey: true, cancelable: true });
    expect(openDrawerForShortcut(tasks, false)).toBe(true);
  });

  it("still opens the slide-out from Shift+R for an ED desk, which may open the intake", async () => {
    useDesk(edDesk);
    renderBar();
    pressShiftR();
    expect(await screen.findByTestId("ward-bar-referral-sheet")).toBeInTheDocument();
  });

  it("still opens the slide-out in place from a referral link for an ED desk", async () => {
    useDesk(edDesk);
    renderBar(<a href="/ward-flow/referrals/new?refer=ward">Refer</a>);
    const notPrevented = fireEvent.click(screen.getByRole("link", { name: "Refer" }));
    expect(notPrevented, "the click still navigates").toBe(false);
    expect(await screen.findByTestId("ward-bar-referral-sheet")).toBeInTheDocument();
  });

  it("still opens the slide-out when an ED desk arrives on the intake route", async () => {
    useDesk(edDesk);
    route.pathname = "/ward-flow/referrals/new";
    window.history.replaceState(null, "", "/ward-flow/referrals/new?refer=ed");
    renderBar();
    expect(await screen.findByTestId("ward-bar-referral-sheet")).toBeInTheDocument();
  });

  it("keeps the prototype default: with the role-access flag off, Shift+R opens it", async () => {
    renderBar();
    pressShiftR();
    expect(await screen.findByTestId("ward-bar-referral-sheet")).toBeInTheDocument();
  });
});

describe("2. Find a bed and All figures link only to pages the desk may open", () => {
  /** Synthetic wards, so the list is the same whatever the seed holds. */
  const WARDS = ["Acacia ward", "Banksia ward", "Karri ward"] as const;

  function renderFinder() {
    function Wards() {
      const flow = useWardFlow();
      const template = flow.units.find((unit) => !unit.isClosed && unit.cohort === "Adult" && unit.authorised);
      if (!template) throw new Error("the fixture needs one open authorised adult ward");
      const units: Unit[] = WARDS.map((name, index) => ({
        ...template,
        id: `finder-${index + 1}`,
        name,
        allocatable: { ...template.allocatable, value: 2 },
        empty: { ...template.empty, value: 2 },
      }));
      return (
        <WardFlowOverride value={{ ...flow, units, bedReleases: [] }}>
          <WardBedFinder onNavigate={vi.fn()} />
        </WardFlowOverride>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Wards />
      </WardFlowProvider>,
    );
    const finder = screen.getByTestId("ward-tools-bed-finder");
    fireEvent.click(
      within(within(finder).getByRole("group", { name: "Legal status" })).getByRole("button", { name: "Voluntary" }),
    );
    return within(finder).getByRole("list", { name: "Ready beds by ward" });
  }

  it("lists every ward to an ED desk as plain text, with no link to a ward page it cannot open", () => {
    useDesk(edDesk);
    const list = renderFinder();
    expect(within(list).queryAllByRole("link")).toHaveLength(0);
    expect(within(list).getAllByTestId("ward-bed-finder-row-plain")).toHaveLength(WARDS.length);
    for (const name of WARDS) expect(within(list).getByText(name)).toBeInTheDocument();
  });

  it("links a ward desk to its own ward only, and shows the others as plain text", () => {
    useDesk({ role: "ward", scope: { kind: "ward", unitIds: ["finder-3"] } });
    const list = renderFinder();
    const links = within(list).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/ward-flow/ward/finder-3");
    expect(links[0]).toHaveTextContent("Karri ward");
    expect(within(list).getAllByTestId("ward-bed-finder-row-plain")).toHaveLength(WARDS.length - 1);
  });

  it("still links every ward for the coordinator", () => {
    useDesk(coordinator);
    const list = renderFinder();
    expect(
      within(list)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(WARDS.map((_name, index) => `/ward-flow/ward/finder-${index + 1}`));
    expect(within(list).queryByTestId("ward-bed-finder-row-plain")).toBeNull();
  });

  function renderFigures() {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <NetworkFigures onNavigate={vi.fn()} />
      </WardFlowProvider>,
    );
    return screen.getByTestId("ward-stats-drawer-content");
  }

  it.each([
    ["ED desk", edDesk],
    ["ward desk", { role: "ward", scope: { kind: "ward", unitIds: ["finder-1"] } } as WardAccess],
    ["officer", officer],
  ])("offers the %s no Open statistics link, as it cannot open the statistics hub", (_name, access) => {
    useDesk(access);
    const figures = renderFigures();
    expect(within(figures).queryByRole("link", { name: /Open statistics/u })).toBeNull();
  });

  it.each([
    ["bed manager", bedManager],
    ["coordinator", coordinator],
  ])("still offers the %s Open statistics", (_name, access) => {
    useDesk(access);
    const figures = renderFigures();
    expect(within(figures).getByRole("link", { name: /Open statistics/u })).toHaveAttribute(
      "href",
      "/ward-flow/statistics",
    );
  });
});

describe("3. the broadcast banner speaks for the desk's own role", () => {
  /** A Pull now asks one ward (`rph-adult-secure`) about synthetic movement WF-003. */
  function RaisePullNow() {
    const { dispatch } = useWardFlow();
    useEffect(() => {
      dispatch({ type: "RAISE_PULL_NOW", role: "coordinator", now: NOW_ANCHOR, movementId: "WF-003" });
    }, [dispatch]);
    return null;
  }

  function renderBanner() {
    route.pathname = "/ward-flow/alerts";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RaisePullNow />
        <WardBroadcastBanner />
      </WardFlowProvider>,
    );
  }

  it("keeps the coordinator's view of a Pull now on a page with no place, as before", () => {
    useDesk(coordinator);
    renderBanner();
    const banner = screen.getByTestId("ward-broadcast-banner");
    expect(banner).toHaveTextContent("Pull now");
    expect(within(banner).queryByRole("group", { name: "Your answer" })).toBeNull();
    expect(within(banner).queryByRole("link", { name: "Open patient" })).toBeNull();
  });

  it("gives an officer, who is never asked, no coordinator's Pull now", () => {
    useDesk(officer);
    renderBanner();
    expect(screen.queryByTestId("ward-broadcast-banner")).toBeNull();
  });

  it("gives a bed manager away from a ward page no coordinator's Pull now", () => {
    useDesk({ role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } });
    renderBanner();
    expect(screen.queryByTestId("ward-broadcast-banner")).toBeNull();
  });

  it("still asks a bed manager on its own site's ward page for that ward (D-80)", () => {
    useDesk({ role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } });
    route.pathname = "/ward-flow/ward/rph-adult-secure";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <RaisePullNow />
        <WardBroadcastBanner />
      </WardFlowProvider>,
    );
    const banner = screen.getByTestId("ward-broadcast-banner");
    expect(banner).toHaveAttribute("data-tone", "act_now");
    expect(within(banner).getByRole("group", { name: "Your answer" })).toBeInTheDocument();
  });

  it("asks the ward desk the Pull now names, in its own name, on the same page", () => {
    useDesk({ role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } });
    renderBanner();
    const banner = screen.getByTestId("ward-broadcast-banner");
    expect(banner).toHaveAttribute("data-tone", "act_now");
    expect(within(banner).getByRole("group", { name: "Your answer" })).toBeInTheDocument();
  });
});
