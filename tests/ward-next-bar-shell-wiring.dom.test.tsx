import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The master design's top bar (`shell-next/next-bar.tsx`) is the app's header since 2 Nov 2026, so it
 * keeps the wiring the old bar had. All data here is synthetic.
 *
 * 1. Home's "changes since review" button opens the one shared Activity panel on its Changes tab.
 * 2. The New referral slide-out is referral intake: a desk that may not open the intake never gets it,
 *    by a drawer request, a referral link or arriving on its route.
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

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { useActivityPanelOpen } from "@/components/ward-management/shell/ward-activity-panel-store";
import { openWardDrawer } from "@/components/ward-management/shell/ward-drawer-bus";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import {
  readWardAccessSnapshot,
  resetWardAccessStoreForTests,
  setWardAccess,
} from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { resetServiceScopeForTests } from "@/components/ward-management/shell/ward-service-store";
import { NextBarMount } from "@/components/ward-management/shell-next/next-bar";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const bedManager: WardAccess = { role: "bed_manager", scope: { kind: "site", siteCode: "FSH" } };
const officer: WardAccess = { role: "officer", scope: { kind: "jobs" } };
const edDesk: WardAccess = { role: "ed", scope: { kind: "ed", edId: "rph-ed" } };

function useDesk(access: WardAccess) {
  setWardFeatureFlagOnDevice("role-access", true);
  setWardAccess(access);
  expect(readWardAccessSnapshot().access).toEqual(access);
}

async function settleFrames() {
  await act(async () => {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  });
}

/** Home reads this to keep its changes button's state in step with the shared panel. */
function PanelOpenProbe() {
  return <span data-testid="panel-open">{useActivityPanelOpen() ? "open" : "closed"}</span>;
}

function renderBar(children?: ReactNode) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardLiveRegion />
      <NextBarMount />
      {children}
    </WardFlowProvider>,
  );
}

afterEach(() => {
  cleanup();
  discardReferralDraft();
  resetWardLiveRegionForTests();
  route.pathname = "/ward-flow";
  window.history.replaceState(null, "", "/");
  window.sessionStorage.clear();
  resetServiceScopeForTests();
  setWardFeatureFlagOnDevice("role-access", null);
  resetWardAccessStoreForTests();
});

// Sticky header redesign (Josh, 9 Nov 2026): Home's hero changes chip is gone, so on Home the bar's own
// Activity button opens the one shared panel.
describe("1. Home opens the shared Activity panel from the master design's bar", () => {
  it("opens one panel on Changes, publishes it open, and returns focus to the button", async () => {
    renderBar(
      <>
        <CoordinatorScreen />
        <PanelOpenProbe />
      </>,
    );
    expect(screen.getByTestId("panel-open")).toHaveTextContent("closed");
    expect(screen.queryByRole("button", { name: /· (Review|Activity)$/u })).toBeNull();
    const trigger = screen.getByTestId("ward-bar-activity-trigger");
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Activity · Statewide" });
    expect(dialog).toHaveAttribute("id", "ward-bar-activity-drawer");
    expect(within(dialog).getByRole("tab", { name: /^Changes/u })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("dialog", { name: "Activity · Statewide" })).toHaveLength(1);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("panel-open")).toHaveTextContent("open");

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Activity · Statewide" })).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.getByTestId("panel-open")).toHaveTextContent("closed");
  });

  it("opens the same shared panel from the bar's own Activity button", async () => {
    route.pathname = "/ward-flow/movements";
    renderBar();
    fireEvent.click(screen.getByTestId("ward-bar-activity-trigger"));
    const dialog = await screen.findByRole("dialog", { name: "Activity · Statewide" });
    for (const tab of [/^Changes/u, /^Recent activity/u, /^Notices/u])
      expect(within(dialog).getByRole("tab", { name: tab })).toBeInTheDocument();
  });
});

describe("2. the master design's bar opens the referral slide-out only for a desk with referral intake", () => {
  it.each([
    ["bed manager", bedManager],
    ["officer", officer],
  ])("gives the %s no slide-out from a drawer request, a link or the intake route", async (_name, access) => {
    useDesk(access);
    renderBar(<a href="/ward-flow/referrals/new?refer=ward">Refer</a>);
    act(() => openWardDrawer("referral"));
    const notPrevented = fireEvent.click(screen.getByRole("link", { name: "Refer" }));
    expect(notPrevented, "the bar must not take the click over").toBe(true);
    await settleFrames();
    expect(screen.queryByTestId("ward-bar-referral-sheet")).toBeNull();
    cleanup();

    route.pathname = "/ward-flow/referrals/new";
    window.history.replaceState(null, "", "/ward-flow/referrals/new?refer=ed");
    renderBar();
    await settleFrames();
    expect(screen.queryByTestId("ward-bar-referral-sheet")).toBeNull();
  });

  it("still opens it for an ED desk from a drawer request", async () => {
    useDesk(edDesk);
    renderBar();
    act(() => openWardDrawer("referral"));
    expect(await screen.findByTestId("ward-bar-referral-sheet")).toBeInTheDocument();
    // BA-12 (front-end audit, 5 Nov 2026): the sheet is named for its heading, not "Referrals".
    expect(screen.getByRole("dialog", { name: "New referral" })).toBeInTheDocument();
  });

  it("still opens it in place from a referral link for an ED desk", async () => {
    useDesk(edDesk);
    renderBar(<a href="/ward-flow/referrals/new?refer=ward">Refer</a>);
    const notPrevented = fireEvent.click(screen.getByRole("link", { name: "Refer" }));
    expect(notPrevented, "the bar takes the click over").toBe(false);
    expect(await screen.findByTestId("ward-bar-referral-sheet")).toBeInTheDocument();
  });

  it("still opens it when an ED desk arrives on the intake route", async () => {
    useDesk(edDesk);
    route.pathname = "/ward-flow/referrals/new";
    window.history.replaceState(null, "", "/ward-flow/referrals/new?refer=ed");
    renderBar();
    expect(await screen.findByTestId("ward-bar-referral-sheet")).toBeInTheDocument();
  });
});
