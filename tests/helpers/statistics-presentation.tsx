import { render, within } from "@testing-library/react";
import { expect } from "vitest";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { StatisticsOverviewScreen } from "@/components/ward-management/statistics/statistics-overview-screen";
import { StatisticsCompareScreen } from "@/components/ward-management/statistics/statistics-compare-screen";
import { StatisticsServiceScreen } from "@/components/ward-management/statistics/statistics-service-screen";
import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { StatisticsEdScreen } from "@/components/ward-management/statistics/statistics-ed-screen";
import { StatisticsCommunityScreen } from "@/components/ward-management/statistics/statistics-community-screen";

type Mode = "hub" | "overview" | "compare" | "service" | "ward" | "ed" | "community";

/** The owner replaced explanatory disclosures with visible operational panels. Legacy prose
 * checks now guard that presentation contract; calculation fixtures remain in their own tests. */
export function assertStatisticsPresentation(mode: Mode, retiredId?: string) {
  const screens = {
    hub: <StatisticsScreen />,
    overview: <StatisticsOverviewScreen />,
    compare: <StatisticsCompareScreen />,
    service: <StatisticsServiceScreen serviceId="North Metro" />,
    ward: <StatisticsWardScreen unitId="rph-adult-secure" />,
    ed: <StatisticsEdScreen edId="rph-ed" />,
    community: <StatisticsCommunityScreen teamId="midland" />,
  };
  const { container } = render(<WardFlowProvider initialNow={NOW_ANCHOR}>{screens[mode]}</WardFlowProvider>);
  const page = within(container);
  expect(page.getByRole("main")).toBeVisible();
  expect(page.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(container.querySelectorAll("details")).toHaveLength(0);
  expect(container.querySelectorAll('[data-ward-primitive="panel"]')).not.toHaveLength(0);
  expect(container.textContent).not.toMatch(/NaN|Infinity/);
  expect(page.queryByRole("heading", { name: /^(Data provenance|Scope and attribution limits)$/i })).toBeNull();
  expect(container.textContent).not.toMatch(
    /If the model could compute|This prototype keeps no history|nothing in this prototype writes|This measure cannot be formed|Three comparison measures are unavailable|So far.{0,10}is the limit of the record|Nought means checked/i,
  );
  expect(page.queryByRole("columnheader", { name: "What it counts" })).toBeNull();
  expect(page.getByLabelText("Prototype disclosure")).toHaveTextContent(/synthetic/i);
  if (retiredId) expect(page.queryByTestId(retiredId)).toBeNull();
}
