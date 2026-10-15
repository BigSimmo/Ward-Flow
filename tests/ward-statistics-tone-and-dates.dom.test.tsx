import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
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
import { StatisticsCommunityScreen } from "@/components/ward-management/statistics/statistics-community-screen";
import { isPastDate } from "@/components/ward-management/statistics/statistics-dates";
import { StatisticsEdsIndexScreen } from "@/components/ward-management/statistics/statistics-eds-index";
import { StatisticsOverviewScreen } from "@/components/ward-management/statistics/statistics-overview-screen";
import { StatisticsServicesIndexScreen } from "@/components/ward-management/statistics/statistics-services-index";
import { StatisticsTeamsIndexScreen } from "@/components/ward-management/statistics/statistics-teams-index";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";

/**
 * Remaining-pages audit, 13 Oct 2026, Should items on Statistics.
 *
 * stats-9: one tone rule for a long ED wait (red at the long-wait line, amber before) on Weekly as
 * on the ED page, and the week's figure says when it stops counting.
 * stats-10 (Josh, 13 Oct 2026): no service colour dot on Statistics phone rows.
 * stats-12: a planned discharge date already passed is marked, and counted beside "Due out within 7 days".
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

describe("Weekly ED waits (stats-9)", () => {
  it("tones a wait of two days or more red, as the ED page does, and says when the figure stops", () => {
    asPhone();
    renderInProvider(<WeeklyReportScreen />);
    // The seeded last full week has long waits, one still open (the audit's own example).
    const list = screen.getByRole("list", { name: /^ED waits over/u });
    const rows = within(list).getAllByRole("listitem");
    // D-39: never a WF- journey id; an AD- number or "Not yet admitted".
    expect(list.textContent).not.toMatch(/WF-/u);
    for (const row of rows) expect(row.textContent).toMatch(/^(AD-|Not yet admitted)/u);
    for (const row of rows) {
      expect(row.textContent).toMatch(/by \w{3} \d{1,2} \w{3}/u);
      const days = /(\d+)d \d+h/u.exec(row.textContent ?? "");
      const red = row.querySelector('svg[class*="danger"]');
      if (days && Number(days[1]) >= 2) expect(red, row.textContent ?? "").not.toBeNull();
      else expect(red, row.textContent ?? "").toBeNull();
    }
  });
});

describe("No service colour dot on Statistics phone rows (stats-10)", () => {
  it.each([
    ["EDs", <StatisticsEdsIndexScreen key="eds" />],
    ["Overview", <StatisticsOverviewScreen key="overview" />],
    ["Services", <StatisticsServicesIndexScreen key="services" />],
    ["Teams", <StatisticsTeamsIndexScreen key="teams" />],
  ])("%s", (_name, node) => {
    asPhone();
    renderInProvider(node);
    const rows = screen.getAllByRole("listitem");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.querySelector('[class*="svcDot"]')).toBeNull();
  });
});

describe("Planned dates already passed (stats-12)", () => {
  it("marks a date only when its day is before today", () => {
    const today = NOW_ANCHOR;
    expect(isPastDate(today - MINUTES_PER_DAY, today)).toBe(true);
    expect(isPastDate(today - 60, today)).toBe(false);
    expect(isPastDate(today + MINUTES_PER_DAY, today)).toBe(false);
  });

  it("counts past dates beside Due out on the community team phone page", () => {
    asPhone();
    renderInProvider(<StatisticsCommunityScreen teamId="midland" />);
    const past = screen.getByTestId("ward-statistics-community-past-date");
    const marked = within(screen.getByRole("list", { name: "Referred to this team, in a bed now" }))
      .getAllByRole("listitem")
      .filter((row) => row.textContent?.includes("past date")).length;
    expect(marked).toBeGreaterThan(0);
    expect(Number(past.textContent)).toBe(marked);
  });
});
