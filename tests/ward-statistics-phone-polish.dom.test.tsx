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

import { WeeklyReportScreen } from "@/components/ward-management/reports/weekly-report-screen";
import { edStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { StatisticsCompareScreen } from "@/components/ward-management/statistics/statistics-compare-screen";
import { StatisticsEdScreen } from "@/components/ward-management/statistics/statistics-ed-screen";
import { StatisticsEdsIndexScreen } from "@/components/ward-management/statistics/statistics-eds-index";
import { StatisticsOverviewScreen } from "@/components/ward-management/statistics/statistics-overview-screen";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { StatisticsServicesIndexScreen } from "@/components/ward-management/statistics/statistics-services-index";
import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { LONG_WAIT_HOURS } from "@/components/ward-management/statistics/statistics-ed-waits";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, allEmergencyDepartments, allUnits } from "@/components/ward-management/ward-sites";
import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";

/**
 * Remaining-pages audit, 13 Oct 2026, Statistics phone polish (batch 3).
 *
 * stats-4: the hub's "Open ED journeys" sheet rows open each department's statistics page.
 * stats-5: no time range pill on a phone hero while only Now is live.
 * stats-8: a long ED wait row carries no stripe or tinted fill; the red triangle carries the tone.
 * stats-13: Compare's phone chart labels wards by site code and cohort, never a clipped name.
 * stats-18: "Where the pressure is" opens the one fullest-first list, in a sheet (Overview folded into
 * Network on 21 Oct 2026, D-77 change 9).
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
    fireEvent.click(screen.getByRole("button", { name: /^Open ED journeys/u }));
    const dialog = screen.getByRole("dialog");
    for (const department of allEmergencyDepartments()) {
      const link = within(dialog)
        .getAllByRole("link")
        .find((anchor) => anchor.getAttribute("href") === edStatisticsHref(department.id));
      expect(link, department.id).toBeDefined();
    }
  });

  it("opens the fullest-first list from Where the pressure is (stats-18)", () => {
    asPhone();
    renderInProvider(<StatisticsScreen />);
    fireEvent.click(screen.getByTestId("ward-statistics-pressure-link"));
    const dialog = screen.getByRole("dialog");
    const percents = within(dialog)
      .getAllByRole("listitem")
      .map((row) => Number(/(\d+)% in use/u.exec(row.textContent ?? "")?.[1]));
    expect(percents.length).toBeGreaterThan(0);
    for (const percent of percents) expect(percent).toBeGreaterThanOrEqual(BED_ALERT_THRESHOLD_PERCENT);
    expect(percents).toEqual([...percents].sort((a, b) => b - a));
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

describe("Compare chart ward labels (UX audit 21 Oct 2026)", () => {
  it("names every ward on the phone chart by its recorded name, as the desktop does", () => {
    asPhone();
    renderInProvider(<StatisticsCompareScreen />);
    const chart = screen.getByTestId("ward-statistics-compare-phone");
    for (const unit of allUnits().slice(0, 5)) expect(chart).toHaveTextContent(unit.name);
  });
});

describe("Amber dot keys on the phone lists (phone review F-25)", () => {
  it("states what the dot means from the existing alert line, not a typed number", () => {
    asPhone();
    const { unmount } = renderInProvider(<StatisticsOverviewScreen />);
    expect(screen.getByTestId("ward-statistics-overview-dot-key")).toHaveTextContent(
      `Amber dot: ${BED_ALERT_THRESHOLD_PERCENT}% or more of beds in use`,
    );
    unmount();
    renderInProvider(<StatisticsServicesIndexScreen />);
    expect(screen.getByTestId("ward-statistics-services-dot-key")).toHaveTextContent(`past ${LONG_WAIT_HOURS} hours`);
  });
});

/*
 * Batch 4 polish (audit 13 Oct 2026): stats-14 short Weekly copy, stats-15 ward hero label,
 * stats-19 no EDs sparkline on phone, stats-20 one precision for the network figure, stats-21 one
 * form for a nought.
 */
describe("Statistics phone polish (batch 4)", () => {
  it("keeps Weekly's out-of-area aside and ED names short (stats-14)", () => {
    asPhone();
    renderInProvider(<WeeklyReportScreen />);
    const body = screen.getByTestId("ward-weekly-phone");
    expect(body).toHaveTextContent("Far from home, or by air");
    expect(body.textContent).not.toMatch(/Emergency Department/u);
  });

  it("labels the ward hero figure In use and moves the % to the sub line (stats-15)", () => {
    asPhone();
    renderInProvider(<StatisticsWardScreen unitId="rph-adult-secure" />);
    expect(screen.getAllByText("In use").length).toBeGreaterThan(0);
    expect(screen.getByText(/\d+% of \d+ beds in use/u)).toBeInTheDocument();
  });

  it("draws no trend line on the EDs phone rows (stats-19)", () => {
    asPhone();
    renderInProvider(<StatisticsEdsIndexScreen />);
    expect(screen.queryAllByTestId("ward-statistics-eds-phone-spark")).toHaveLength(0);
  });

  it("prints the network figure to one decimal place on the hub (stats-20)", () => {
    asPhone();
    renderInProvider(<StatisticsScreen />);
    // Phone review F-26: the figure's label names it ("Beds in use, 85.2%").
    expect(screen.getByText(/^Beds in use, \d+\.\d%$/u)).toBeInTheDocument();
  });

  it("writes a nought as 0, never none, on the Services phone list (stats-21)", () => {
    asPhone();
    renderInProvider(<StatisticsServicesIndexScreen />);
    expect(screen.getByTestId("ward-statistics-services-phone").textContent).not.toMatch(/\bnone\b/iu);
  });
});

/*
 * stats-7 (batch 5): Compare on a phone compares two chosen wards, with every measure's full label
 * and the network mean of wards, and keeps the choice after the sheet closes.
 */
describe("Compare two wards on a phone (stats-7)", () => {
  it("keeps two chosen wards across close and reopen, and lists every measure in full", () => {
    asPhone();
    renderInProvider(<StatisticsCompareScreen />);
    const [first, second] = allUnits();

    fireEvent.click(screen.getByTestId("ward-statistics-compare-phone-pinned"));
    fireEvent.change(screen.getByTestId("ward-statistics-compare-pair-a"), { target: { value: first!.id } });
    fireEvent.change(screen.getByTestId("ward-statistics-compare-pair-b"), { target: { value: second!.id } });
    const pair = screen.getByTestId("ward-statistics-compare-pair");
    for (const label of ["Average stay", "Blockers", "Over 3 months", "Occupancy", "Ready now", "Awaiting answer"]) {
      expect(pair).toHaveTextContent(label);
    }
    expect(within(pair).queryByRole("heading", { name: "Pinned wards" })).toBeNull();

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(screen.getByTestId("ward-statistics-compare-phone-pinned")).toHaveTextContent(
      `${first!.name} and ${second!.name} against the network`,
    );

    fireEvent.click(screen.getByTestId("ward-statistics-compare-phone-pinned"));
    expect(screen.getByTestId("ward-statistics-compare-pair-a")).toHaveValue(first!.id);
    expect(screen.getByTestId("ward-statistics-compare-pair-b")).toHaveValue(second!.id);
  });
});
