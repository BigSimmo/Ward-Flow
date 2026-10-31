import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { edStatisticsHref, wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { StatisticsNav } from "@/components/ward-management/statistics/statistics-nav";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { wardFinderEntry } from "@/components/ward-management/statistics/statistics-screen-parts";
import { STATISTICS_UNIT_CHOOSER_ID } from "@/components/ward-management/statistics/statistics-sections";
import { StatisticsUnitFinder } from "@/components/ward-management/statistics/statistics-unit-finder";
import { STATISTICS_UNIT_FINDER_HREF } from "@/components/ward-management/statistics/statistics-view-switch";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, allEmergencyDepartments, allUnits, siteByCode } from "@/components/ward-management/ward-sites";

/**
 * The Statistics summary as built on 31 Oct 2026 (Josh, "Yes to all"): Bed board, Journey and Map as
 * one switch, the one unit finder behind "Open a unit" (D-91), and the site bed manager's branch.
 * Synthetic data only.
 */

function summary() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsScreen />
    </WardFlowProvider>,
  );
}

afterEach(() => {
  cleanup();
  act(() => resetWardAccessStoreForTests());
  window.history.replaceState(null, "", "/");
});

describe("the one unit finder (D-91)", () => {
  it("stays shut until Open a unit, then links every ward and every emergency department", () => {
    summary();
    expect(screen.queryByTestId("ward-statistics-unit-finder")).toBeNull();
    const tool = screen.getByTestId("ward-statistics-tool-open-unit");
    expect(tool).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(tool);
    expect(tool).toHaveAttribute("aria-expanded", "true");

    const finder = screen.getByTestId("ward-statistics-unit-finder");
    expect(finder.closest(`#${STATISTICS_UNIT_CHOOSER_ID}`)).not.toBeNull();
    const hrefs = () =>
      within(finder)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"))
        .filter((href) => href !== null && /\/statistics\/(ward|ed)\//.test(href));
    // Whole sets, so a ward missing or listed twice fails, where a per-unit check would pass.
    expect(hrefs().toSorted()).toEqual(
      allUnits()
        .map((unit) => wardStatisticsHref(unit.id))
        .toSorted(),
    );
    fireEvent.click(within(finder).getByRole("radio", { name: /^EDs/ }));
    expect(hrefs().toSorted()).toEqual(
      allEmergencyDepartments()
        .map((department) => edStatisticsHref(department.id))
        .toSorted(),
    );
  });

  it("opens on arrival at its anchor", () => {
    expect(STATISTICS_UNIT_FINDER_HREF).toBe(`/ward-flow/statistics#${STATISTICS_UNIT_CHOOSER_ID}`);
    window.history.replaceState(null, "", `/ward-flow/statistics#${STATISTICS_UNIT_CHOOSER_ID}`);
    summary();
    expect(screen.getByTestId("ward-statistics-unit-finder")).toBeInTheDocument();
  });

  it("still lists a ward whose site code resolves to nothing, and says so", () => {
    expect(siteByCode("NO-SUCH-SITE")).toBeUndefined();
    const entry = wardFinderEntry({ id: "unplaceable-ward", name: "Unplaceable Ward", site: "NO-SUCH-SITE", ready: 0 });
    render(<StatisticsUnitFinder lists={{ ward: [entry], ed: [], service: [], team: [] }} />);
    const link = screen.getByRole("link", { name: /Unplaceable Ward/ });
    expect(link).toHaveAttribute("href", wardStatisticsHref("unplaceable-ward"));
    expect(link).toHaveTextContent("site code matches no site");
  });

  it("says so rather than drawing an empty list when there is nothing to choose", () => {
    render(<StatisticsUnitFinder lists={{ ward: [], ed: [], service: [], team: [] }} />);
    expect(screen.getByText("No matching wards")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "wards" })).toBeNull();
  });
});

describe("the summary view switch", () => {
  it("is one radio group, Bed board first and chosen", () => {
    summary();
    const bar = screen.getByTestId("ward-statistics-view-bar");
    const radios = within(bar).getAllByRole("radio");
    expect(radios.map((radio) => radio.textContent)).toEqual(["Bed board", "Journey", "Map"]);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
  });

  it("puts the summary cards first and lists every ward with no typed filter", () => {
    summary();
    expect(screen.queryByRole("searchbox", { name: "Filter wards or hospitals" })).toBeNull();
    expect(screen.queryByRole("searchbox", { name: "Filter emergency departments" })).toBeNull();
    const board = document.getElementById("board")!;
    const cards = board.querySelector('[data-testid="ward-statistics-network-cards"]');
    const pressure = screen.getByTestId("ward-statistics-pressure");
    expect(cards!.compareDocumentPosition(pressure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("as a site bed manager (D-80)", () => {
  const unit = allUnits()[0]!;
  const site = siteByCode(unit.siteCode)!;

  function asBedManager() {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: unit.siteCode } });
    });
  }

  it("shows only the sections the desk may open, the first named Site", () => {
    asBedManager();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsNav withSamples={false} variant="chips" />
      </WardFlowProvider>,
    );
    const nav = screen.getByTestId("ward-statistics-nav");
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Site", "Wards", "Weekly"]);
  });

  it("leads with its own site's wards and offers no Open a unit", () => {
    asBedManager();
    summary();
    expect(screen.queryByTestId("ward-statistics-tool-open-unit")).toBeNull();
    const pressure = screen.getByTestId("ward-statistics-pressure");
    expect(within(pressure).getByRole("heading", { name: `${site.name} wards` })).toBeInTheDocument();
    const rows = pressure.querySelectorAll("tbody tr");
    const own = allUnits().filter((candidate) => candidate.siteCode === unit.siteCode);
    expect(rows).toHaveLength(Math.min(own.length, 10));
    expect(within(pressure).queryByRole("link", { name: "Compare wards" })).toBeNull();
  });
});
