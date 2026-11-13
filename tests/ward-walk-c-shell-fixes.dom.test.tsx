import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: "/ward-flow" }));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { NextBar } from "@/components/ward-management/shell-next/next-bar";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { resetServiceScopeForTests } from "@/components/ward-management/shell/ward-service-store";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Walk C (13 Nov 2026), synthetic records only.
 * Item 5 (F-54/F-65): the Tools header read "Nurse in charge · whole network" on a ward page while
 * the desk was the Bed coordinator, because it followed the page's route role. It names the desk and
 * its real scope: the statewide coordinator's whole network, or a nurse in charge's own ward.
 * Item 6 (F-107): opening a row in the slipped-dates list opened the record but flipped the page
 * underneath from Now to Recorded. The page stays on its tab.
 */

afterEach(() => {
  cleanup();
  route.pathname = "/ward-flow";
  setWardFeatureFlagOnDevice("role-access", null);
  resetWardAccessStoreForTests();
  resetServiceScopeForTests();
});

function openToolsOnWardPage(unitId: string) {
  route.pathname = `/ward-flow/ward/${unitId}`;
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <NextBar primaryAction={{ kind: "none" }} />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByTestId("ward-bar-tools-trigger"));
  return screen.findByRole("dialog", { name: /Tools/u });
}

describe("the Tools header names the desk and its real scope", () => {
  it("reads Bed coordinator · whole network on a ward page for the statewide coordinator", async () => {
    const unit = seedWardFlowState().units[0]!;
    const dialog = await openToolsOnWardPage(unit.id);
    expect(dialog).toHaveAccessibleDescription("Bed coordinator · whole network");
    expect(dialog).not.toHaveAccessibleDescription(/Nurse in charge/u);
  });

  it("reads Nurse in charge with the desk's own ward, never the whole network", async () => {
    const unit = seedWardFlowState().units[0]!;
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [unit.id] } });
    const dialog = await openToolsOnWardPage(unit.id);
    expect(dialog).toHaveAccessibleDescription(`Nurse in charge · ${unit.name}`);
    expect(dialog).not.toHaveAccessibleDescription(/whole network/u);
  });
});

describe("a slipped-dates row opens its record and keeps the page on Now", () => {
  it("leaves Now selected while the record (or its on-behalf reason) shows in the drawer", () => {
    route.pathname = "/ward-flow/discharges";
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard />
      </WardFlowProvider>,
    );
    const nowTab = () => screen.getByRole("tab", { name: /^Now/u });
    expect(nowTab()).toHaveAttribute("aria-selected", "true");
    const card = screen.getByTestId("ward-discharge-slipping");
    const showAll = within(card).queryByRole("button", { name: /^Show all/u });
    if (showAll) fireEvent.click(showAll);
    const rows = within(card)
      .getAllByRole("button")
      .filter((button) => button.closest("li") !== null);
    // Anti-vacuity: the seed has slipped stays.
    expect(rows.length).toBeGreaterThan(0);
    let recordsOpened = 0;
    for (const row of rows) {
      act(() => fireEvent.click(row));
      const drawer = screen.getByTestId("ward-discharge-detail");
      expect(drawer.textContent).not.toContain("could not be opened");
      expect(nowTab()).toHaveAttribute("aria-selected", "true");
      if (/on the ward's behalf/u.test(drawer.textContent ?? "")) recordsOpened += 1;
      act(() => fireEvent.keyDown(window, { key: "Escape" }));
    }
    // At least one row takes the record path (no release on Now), the path that used to flip the tab.
    expect(recordsOpened).toBeGreaterThan(0);
  });
});
