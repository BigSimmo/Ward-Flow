import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

/** Set per case to stand in for a desk's access table; undefined keeps the real check. */
const access = vi.hoisted(() => ({ canOpen: undefined as ((href: string) => boolean) | undefined }));
vi.mock("@/components/ward-management/shell/ward-access", async (load) => {
  const real = await load<typeof import("@/components/ward-management/shell/ward-access")>();
  return {
    ...real,
    useCanOpenHref: () => {
      const check = real.useCanOpenHref();
      return (href: string) => (access.canOpen ? access.canOpen(href) : check(href));
    },
  };
});

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { networkTotals, networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { WardAccess } from "@/components/ward-management/ward-role-access";

/**
 * Capacity, built from the October 2026 redesign (Josh, 31 Oct 2026): one screen for every desk.
 * The coordinator sees the modelled network; a site bed manager (D-80) sees its own site's wards
 * and every other site as counts only; the executive sees counts only, with no bed meeting, no
 * asking a ward and no list of people.
 */

afterEach(() => {
  access.canOpen = undefined;
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

function asDesk(access: WardAccess) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(access);
  });
}

function renderCapacity() {
  return render(
    <WardFlowProvider>
      <CapacityScreen />
    </WardFlowProvider>,
  );
}

describe("Capacity for the bed coordinator", () => {
  it("leads with the network's ready beds and draws the mismatch, forecast and bed map", () => {
    const seed = seedWardFlowState();
    const rows = networkWardRows(seed.units, NOW_ANCHOR, seed.bedReleases, seed.admissions, seed.leaveBeds);
    const totals = networkTotals(rows);
    renderCapacity();
    const hero = screen.getByRole("heading", { level: 1 });
    expect(hero).toHaveTextContent(`${totals.ready} beds ready of ${totals.beds}`);
    expect(screen.getByRole("heading", { name: "Mismatch" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bed forecast" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bed map" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bed meeting/ })).toBeInTheDocument();
    expect(screen.getByTestId("ward-capacity-governance")).toBeInTheDocument();
  });

  it("opens a ward's drawer from the bed map", () => {
    renderCapacity();
    const map = screen.getByRole("region", { name: "Bed map" });
    const first = within(map)
      .getAllByRole("button")
      .find((button) => button.getAttribute("aria-haspopup") === "dialog" && /occupied/.test(button.textContent ?? ""));
    expect(first).toBeDefined();
    fireEvent.click(first!);
    expect(screen.getByTestId("ward-capacity-ward-drawer")).toBeInTheDocument();
  });
});

describe("Capacity for the executive", () => {
  it("shows counts only: no bed meeting, no planned list of people", () => {
    asDesk({ role: "executive", scope: { kind: "statewide" } });
    renderCapacity();
    expect(screen.queryByRole("button", { name: /Bed meeting/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open on TV/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("as-executive-planned-counts")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-planned-book")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Ask / })).not.toBeInTheDocument();
    // The executive desk may not open the wards list, so the bed map offers no link to it.
    expect(screen.queryByRole("link", { name: "Every ward as a table" })).not.toBeInTheDocument();
  });
});

describe("Capacity for a site bed manager", () => {
  it("names its own site in the hero and lists other sites as bed counts only", () => {
    const seed = seedWardFlowState();
    const siteCode = seed.units[0].siteCode;
    asDesk({ role: "bed_manager", scope: { kind: "site", siteCode } });
    renderCapacity();
    const own = seed.units.filter((unit) => unit.siteCode === siteCode);
    const rows = networkWardRows(own, NOW_ANCHOR, seed.bedReleases, seed.admissions, seed.leaveBeds);
    const totals = networkTotals(rows);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(`${totals.ready} beds ready of ${totals.beds}`);
    expect(screen.getByRole("heading", { name: "Other sites" })).toBeInTheDocument();
    expect(screen.getByText(/Other sites show beds, never the people in them\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Ask / })).not.toBeInTheDocument();
  });

  it("offers only its own site's wards in Try a scenario", () => {
    const seed = seedWardFlowState();
    const siteCode = seed.units[0].siteCode;
    asDesk({ role: "bed_manager", scope: { kind: "site", siteCode } });
    renderCapacity();
    fireEvent.click(screen.getByRole("button", { name: "Try a scenario" }));
    const dialog = within(screen.getByRole("dialog"));
    const offered = dialog
      .getAllByRole("option")
      .map((option) => option.getAttribute("value"))
      .filter((value) => value);
    const own = seed.units.filter((unit) => unit.siteCode === siteCode && !unit.isClosed).map((unit) => unit.id);
    expect(offered.length).toBeGreaterThan(0);
    expect([...offered].sort()).toEqual([...own].sort());
  });
});

describe("Capacity offers only pages the desk may open", () => {
  it("leaves out the meeting agenda and the TV view when the desk may not open them", () => {
    access.canOpen = (href) => !href.startsWith("/ward-flow/bed-meeting");
    renderCapacity();
    fireEvent.click(screen.getByRole("button", { name: /Bed meeting/ }));
    expect(screen.getByRole("menuitem", { name: "Print the meeting sheet" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Open the meeting agenda" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open on TV/ })).not.toBeInTheDocument();
  });
});
