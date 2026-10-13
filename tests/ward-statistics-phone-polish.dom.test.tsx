import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { edStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { shortWardLabels } from "@/components/ward-management/statistics/statistics-compare-screen";
import { StatisticsEdScreen } from "@/components/ward-management/statistics/statistics-ed-screen";
import { StatisticsOverviewScreen } from "@/components/ward-management/statistics/statistics-overview-screen";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { STATISTICS_OVERVIEW_HREF } from "@/components/ward-management/statistics/statistics-sections";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, allEmergencyDepartments, allUnits } from "@/components/ward-management/ward-sites";
import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";

/**
 * Remaining-pages audit, 13 Oct 2026, Statistics phone polish (batch 3).
 *
 * stats-4: the hub's "ED waits for a bed" sheet rows open each department's statistics page.
 * stats-5: no time range pill on a phone hero while only Now is live.
 * stats-8: a long ED wait row carries no stripe or tinted fill; the red triangle carries the tone.
 * stats-13: Compare's phone chart labels wards by site code and cohort, never a clipped name.
 * stats-18: "Where the pressure is" opens the one fullest-first list, on Overview.
 */

function asPhone() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === WF_PHONE_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderInProvider(node: ReactNode) {
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>
    </ToastProvider>,
  );
}

describe("Statistics hub on a phone", () => {
  it("links each ED in the waits sheet to its statistics page (stats-4)", () => {
    asPhone();
    renderInProvider(<StatisticsScreen />);
    fireEvent.click(screen.getByRole("button", { name: /ED waits for a bed/u }));
    const dialog = screen.getByRole("dialog");
    for (const department of allEmergencyDepartments()) {
      const link = within(dialog)
        .getAllByRole("link")
        .find((anchor) => anchor.getAttribute("href") === edStatisticsHref(department.id));
      expect(link, department.id).toBeDefined();
    }
  });

  it("opens Overview's fullest-first list from Where the pressure is (stats-18)", () => {
    asPhone();
    renderInProvider(<StatisticsScreen />);
    expect(screen.getByTestId("ward-statistics-pressure-link")).toHaveAttribute("href", STATISTICS_OVERVIEW_HREF);
  });

  it.each([
    ["hub", <StatisticsScreen key="hub" />],
    ["overview", <StatisticsOverviewScreen key="overview" />],
  ])("shows no time range pill on the %s hero (stats-5)", (_name, node) => {
    asPhone();
    renderInProvider(node);
    expect(screen.queryByTestId("ward-statistics-range")).toBeNull();
  });
});

describe("Statistics ED page on a phone (stats-8)", () => {
  it("never paints a waiting row as act-now", () => {
    asPhone();
    renderInProvider(<StatisticsEdScreen edId="arm-ed" />);
    const body = screen.getByTestId("ward-statistics-ed-phone");
    expect(body.querySelector("[data-act-now]")).toBeNull();
  });
});

describe("Compare chart ward labels (stats-13)", () => {
  it("gives every ward a short, unique label of site code and cohort, or its name on a clash", () => {
    const units = allUnits();
    const labels = shortWardLabels(units);
    const values = units.map((unit) => labels.get(unit.id)!);
    expect(new Set(values).size).toBe(values.length);
    for (const unit of units) {
      const label = labels.get(unit.id)!;
      if (label !== unit.name) expect(label).toMatch(new RegExp(`^${unit.siteCode} (Adult|Secure|Older|Youth)$`, "u"));
    }
    expect(values.filter((value, index) => value === units[index]!.name).length).toBeLessThan(units.length / 2);
  });
});
