import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import StatisticsServicePage from "@/app/ward-flow/statistics/service/[serviceId]/page";
import { DowntimePackScreen } from "@/components/ward-management/reports/downtime-pack-screen";
import { StatisticsCommunityScreen } from "@/components/ward-management/statistics/statistics-community-screen";
import { StatisticsCapacityChart } from "@/components/ward-management/statistics/statistics-capacity-chart";
import { StatisticsCompareScreen } from "@/components/ward-management/statistics/statistics-compare-screen";
import { StatisticsTeamsIndexScreen } from "@/components/ward-management/statistics/statistics-teams-index";
import { StatisticsWardsIndexScreen } from "@/components/ward-management/statistics/statistics-wards-index";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

/**
 * UX simplification audit, 21 Oct 2026, Statistics and outage area: small trims that keep each
 * screen's layout. Each test pins one finding.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderInProvider(node: ReactNode) {
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>
    </ToastProvider>,
  );
}

describe("Statistics and outage trims (UX audit 21 Oct 2026)", () => {
  it("opens Compare with no ward pinned and says how to pin one", () => {
    renderInProvider(<StatisticsCompareScreen />);
    const pinned = screen.getByTestId("ward-statistics-compare-pinned");
    expect(within(pinned).queryByRole("table")).toBeNull();
    expect(pinned).toHaveTextContent("Pick up to three wards to set beside the network.");
  });

  it("words the All wards chips as counts of wards, not beds", () => {
    renderInProvider(<StatisticsWardsIndexScreen />);
    expect(screen.getAllByText("With a pulled bed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("With a blocked discharge").length).toBeGreaterThan(0);
  });

  it("folds teams with nobody in a bed until asked for", () => {
    renderInProvider(<StatisticsTeamsIndexScreen />);
    const all = screen.getByTestId("ward-statistics-teams-all");
    const before = within(all).getAllByRole("link").length;
    const toggle = within(all).getByTestId("ward-statistics-teams-show-empty");
    expect(toggle).toHaveTextContent(/^Show \d+ with nobody in a bed$/u);
    fireEvent.click(toggle);
    expect(within(all).getAllByRole("link").length).toBeGreaterThan(before);
  });

  it("keeps the team comparison's toggle after Show all, so the list folds back", () => {
    renderInProvider(<StatisticsCommunityScreen teamId="midland" />);
    const card = screen.getByTestId("ward-statistics-community-comparison");
    fireEvent.click(within(card).getByRole("button", { name: /^Show all \d+$/u }));
    fireEvent.click(within(card).getByRole("button", { name: "Show fewer" }));
    expect(within(card).getByRole("button", { name: /^Show all \d+$/u })).toBeInTheDocument();
  });

  it("names the downtime pack's tables in the jump row without repeating the hero totals", () => {
    renderInProvider(<DowntimePackScreen />);
    const jump = screen.getByRole("navigation", { name: "Jump to a table" });
    expect(
      within(jump)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Beds", "ED queue", "Pending moves", "Legal forms"]);
  });

  it("opens a hospital's details under its own row, not beside the chart", () => {
    const units = allUnits().slice(0, 4);
    render(<StatisticsCapacityChart units={units} bedReleases={[]} />);
    const rows = screen.getAllByRole("button", { name: /Show details\.$/u });
    fireEvent.click(rows[0]!);
    const details = screen.getByTestId("capacity-details");
    expect(rows[0]!.nextElementSibling).toBe(details);
  });

  it("sends a lowercase service slug to the service's one address", async () => {
    await expect(StatisticsServicePage({ params: Promise.resolve({ serviceId: "east-metro" }) })).rejects.toThrow(
      /NEXT_REDIRECT/u,
    );
    await expect(StatisticsServicePage({ params: Promise.resolve({ serviceId: "east-nowhere" }) })).rejects.toThrow(
      /NEXT_HTTP_ERROR_FALLBACK;404/u,
    );
  });
});
