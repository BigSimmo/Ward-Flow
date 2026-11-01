import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const guard = vi.hoisted(() => ({
  operational: vi.fn(() => {
    throw new Error("Executive report read operational rows");
  }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/statistics/weekly",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("../src/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => ({ role: "executive", scope: { kind: "statewide" } }),
}));
vi.mock("@/components/ward-management/reports/use-own-units", () => ({ useOwnUnits: guard.operational }));
// Exercise the genuine shared hero and refuse every route to operational records.
vi.mock("@/components/ward-management/ward-flow-provider", async (original) => ({
  ...(await original<typeof import("../src/components/ward-management/ward-flow-provider")>()),
  useWardFlow: guard.operational,
  useWardFlowSelect: guard.operational,
  useWardFlowClock: guard.operational,
}));
vi.mock("@/components/ward-management/statistics/statistics-hero", async (original) => {
  const actual = await original<typeof import("../src/components/ward-management/statistics/statistics-hero")>();
  return {
    ...actual,
    useStatisticsLive: guard.operational,
  };
});

import { WeeklyReportScreen } from "../src/components/ward-management/reports/weekly-report-screen";
import { ExecutiveStatisticsProvider } from "../src/components/ward-management/statistics/executive-statistics-context";
import { projectExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-projector";
import type { ExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-contract";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { installMatchMediaStub } from "./setup/jsdom.setup";

const state = seedWardFlowState();
const base = projectExecutiveReportingFoundation(
  state,
  { role: "executive", scope: { kind: "statewide" } },
  {
    now: NOW_ANCHOR,
    dayZero: "2026-09-22T16:00:00.000Z",
    startedAt: "2026-10-23T02:42:00.000Z",
    places: wardPlaceLookup(state.units),
  },
);
const binding = { actorId: "synthetic-report-reader", accessContext: "a".repeat(64), epoch: 1, revision: 1 };
function report(
  data: ExecutiveReportingFoundation | null = structuredClone(base),
  {
    paused = false,
    togglePause = vi.fn(),
    clock = 150,
  }: { paused?: boolean; togglePause?: (() => void) | null; clock?: number } = {},
) {
  return render(
    <ExecutiveStatisticsProvider
      binding={binding}
      snapshot={data ? { binding, receivedAt: 100, expiresAt: 200, data } : null}
      now={clock}
      controls={{ executive: true, paused, togglePause }}
    >
      <WeeklyReportScreen />
    </ExecutiveStatisticsProvider>,
  );
}

afterEach(() => {
  cleanup();
  installMatchMediaStub(false);
  vi.clearAllMocks();
});

describe("Weekly executive aggregate adoption", () => {
  it("fails closed when the report is absent or its accepted lifetime has ended", () => {
    const first = report(null);
    expect(screen.getByTestId("ward-weekly-unavailable")).toHaveTextContent("Statistics are unavailable for this desk");
    expect(screen.queryByTestId("ward-weekly-ed-count")).not.toBeInTheDocument();
    first.unmount();
    report(structuredClone(base), { clock: 200 });
    expect(screen.getByTestId("ward-weekly-unavailable")).toBeInTheDocument();
    expect(guard.operational).not.toHaveBeenCalled();
  });

  it("keeps all nine periods, the counted-to boundary and safe ED detail replacement", () => {
    report();
    expect(screen.getByTestId("ward-weekly-week").querySelectorAll("option")).toHaveLength(9);
    fireEvent.change(screen.getByTestId("ward-weekly-week"), { target: { value: "-1" } });
    expect(screen.getByTestId("ward-weekly-period")).toHaveTextContent("Counted to");
    fireEvent.change(screen.getByTestId("ward-weekly-week"), { target: { value: "7" } });
    expect(screen.getByTestId("ward-weekly-range")).toHaveTextContent("Generated");
    expect(screen.getByText("Counts only on this desk, so people are not listed.")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-weekly-ed-table")).not.toBeInTheDocument();
    expect(guard.operational).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "renders released tokens across every Weekly and pilot section without losing controls (phone=%s)",
    (phone) => {
      installMatchMediaStub(phone);
      const data = structuredClone(base);
      const selected = data.weeks.find((entry) => entry.week.offset === 0)!;
      selected.report.edWaits.count = { kind: "small" };
      selected.report.edWaits.longestMinutes = 240;
      selected.report.declines.placement = { kind: "withheld" };
      selected.report.declines.byReason = [{ reason: "Other / unknown reason", count: { kind: "withheld" } }];
      selected.pilot.requestToArrival = {
        median: 120,
        p90: 240,
        sampleSize: { kind: "exact", value: 8 },
        population: { kind: "withheld" },
      };
      selected.pilot.requests.noWardAsked = { kind: "small" };
      selected.pilot.requests.duplicates = { kind: "withheld" };
      selected.pilot.holds.ranOut = { kind: "withheld" };
      selected.pilot.transport.lateCollections = { kind: "small" };
      selected.pilot.completeness = { complete: { kind: "small" }, arrivals: { kind: "exact", value: 8 } };
      selected.pilot.bedFigures = { wards: 22, confirmedToday: 18, onTime: 16, deadlineMinutes: 570 };
      const print = vi.spyOn(window, "print").mockImplementation(() => {});
      report(data);
      expect(screen.getByTestId("ward-weekly-ed-count")).toHaveTextContent("fewer than 5");
      expect(screen.getByTestId("ward-pilot-arrival-typical")).toHaveTextContent("2h");
      expect(screen.getByText(/typical time from 8 of not shown arrivals/)).toBeInTheDocument();
      expect(screen.getByTestId("ward-pilot-bed-figures-on-time")).toHaveTextContent("16");
      expect(screen.getByText("of 22 wards")).toBeInTheDocument();
      expect(screen.getByTestId("ward-pilot-missed")).toHaveTextContent("fewer than 5");
      expect(screen.getByTestId("ward-pilot-duplicates")).toHaveTextContent("not shown");
      expect(screen.getByTestId("ward-pilot-holds-ran-out")).toHaveTextContent("not shown");
      expect(screen.getByTestId("ward-pilot-transport-late")).toHaveTextContent("fewer than 5");
      expect(screen.getByTestId("ward-pilot-complete-percent")).toHaveTextContent("—");
      for (const title of [
        "Pilot measures",
        "Where the time goes",
        "Supporting figures",
        "Pressure this week",
        "Request to bed pulled",
        "Same person raised twice",
        "Bed pulls ran out",
        "Records complete",
      ])
        expect(screen.getByText(title, { exact: true })).toBeInTheDocument();
      expect(screen.getAllByText("Recorded occupied bed time").length).toBeGreaterThan(0);
      fireEvent.click(screen.getByTestId("ward-weekly-print"));
      expect(print).toHaveBeenCalledOnce();
      expect(guard.operational).not.toHaveBeenCalled();
      print.mockRestore();
    },
  );

  it("delegates pause to the host and preserves its accepted service scope and report stamp", () => {
    const data = projectExecutiveReportingFoundation(
      state,
      { role: "executive", scope: { kind: "service", service: "North Metro" } },
      {
        ...base.network.asAt,
        places: wardPlaceLookup(state.units),
      },
    );
    const togglePause = vi.fn();
    report(data, { paused: true, togglePause });
    expect(screen.getByText(/Weekly report · synthetic demo data · North Metro/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Paused, pause demo updates/ }));
    expect(togglePause).toHaveBeenCalledOnce();
    expect(screen.getByTestId("ward-weekly-range")).toHaveTextContent("Wed, 23 Sept 2026, 10:42 AWST");
    expect(guard.operational).not.toHaveBeenCalled();
  });

  it("offers no inert pause when the host has not supplied that control", () => {
    report(structuredClone(base), { togglePause: null });
    expect(screen.queryByRole("button", { name: /pause demo updates/ })).not.toBeInTheDocument();
    expect(guard.operational).not.toHaveBeenCalled();
  });

  it("retains a true zero count and a dash for an empty longest wait", () => {
    const data = structuredClone(base);
    const selected = data.weeks.find((entry) => entry.week.offset === 0)!;
    selected.report.edWaits.count = { kind: "exact", value: 0 };
    selected.report.edWaits.longestMinutes = 0;
    report(data);
    expect(screen.getByTestId("ward-weekly-ed-count")).toHaveTextContent("0");
    const card = screen.getByRole("region", { name: "Pressure this week" });
    expect(within(card).getByText("—", { exact: true })).toBeInTheDocument();
    expect(guard.operational).not.toHaveBeenCalled();
  });

  it("draws no occupancy meter, so no 0%, when there is no recorded occupied time", () => {
    const data = structuredClone(base);
    data.weeks.find((entry) => entry.week.offset === 0)!.report.occupancy.averagePercent = null;
    report(data);
    expect(screen.getByTestId("ward-weekly-occupancy")).toHaveTextContent("—");
    expect(screen.queryByRole("meter", { name: "Recorded occupied bed time" })).not.toBeInTheDocument();
  });

  it("draws both declines and overrides so a printed report carries both", () => {
    installMatchMediaStub(false);
    report(structuredClone(base));
    const declines = screen.getByTestId("ward-weekly-declines");
    const overrides = screen.getByTestId("ward-weekly-overrides");
    // on screen the switch shows one; the other is kept for print only.
    expect(declines.parentElement?.className ?? "").not.toMatch(/printOnly/u);
    expect(overrides.parentElement?.className).toMatch(/printOnly/u);
    fireEvent.click(screen.getByRole("radio", { name: /^Overrides/u }));
    expect(declines.parentElement?.className).toMatch(/printOnly/u);
    expect(overrides.parentElement?.className ?? "").not.toMatch(/printOnly/u);
  });
});
