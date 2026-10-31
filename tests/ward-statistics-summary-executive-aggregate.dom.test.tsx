import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const guard = vi.hoisted(() => ({
  operational: vi.fn(() => {
    throw new Error("Executive Summary read operational state");
  }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/statistics",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("../src/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => ({ role: "executive", scope: { kind: "statewide" } }),
}));
vi.mock("@/components/ward-management/ward-flow-provider", async (original) => ({
  ...(await original<typeof import("../src/components/ward-management/ward-flow-provider")>()),
  useWardFlow: guard.operational,
  useWardFlowSelect: guard.operational,
  useWardFlowClock: guard.operational,
}));
vi.mock("@/components/ward-management/statistics/statistics-hero", async (original) => ({
  ...(await original<typeof import("../src/components/ward-management/statistics/statistics-hero")>()),
  useStatisticsLive: guard.operational,
}));
vi.mock("@/components/ward-management/statistics/statistics-csv", async (original) => ({
  ...(await original<typeof import("../src/components/ward-management/statistics/statistics-csv")>()),
  downloadCsv: vi.fn(),
}));

import { StatisticsScreen } from "../src/components/ward-management/statistics/statistics-screen";
import { ExecutiveStatisticsProvider } from "../src/components/ward-management/statistics/executive-statistics-context";
import { projectExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-projector";
import type { ExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-contract";
import { downloadCsv } from "../src/components/ward-management/statistics/statistics-csv";
import { exactStatisticsCount } from "../src/components/ward-management/statistics/statistics-small-numbers";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { installMatchMediaStub } from "./setup/jsdom.setup";

const state = seedWardFlowState();
const options = {
  now: NOW_ANCHOR,
  dayZero: "2026-09-22T16:00:00.000Z",
  startedAt: "2026-09-23T02:42:00.000Z",
  places: wardPlaceLookup(state.units),
};
const base = projectExecutiveReportingFoundation(state, { role: "executive", scope: { kind: "statewide" } }, options);
const binding = { actorId: "synthetic-summary-reader", accessContext: "a".repeat(64), epoch: 1, revision: 1 };
function summary(
  data: ExecutiveReportingFoundation | null = structuredClone(base),
  paused = false,
  togglePause = vi.fn(),
) {
  return render(
    <ExecutiveStatisticsProvider
      binding={binding}
      snapshot={data ? { binding, receivedAt: 100, expiresAt: 200, data } : null}
      now={150}
      controls={{ executive: true, paused, togglePause }}
    >
      <StatisticsScreen />
    </ExecutiveStatisticsProvider>,
  );
}
afterEach(() => {
  cleanup();
  installMatchMediaStub(false);
  window.history.replaceState(null, "", "/ward-flow/statistics");
  vi.clearAllMocks();
});

describe("Summary's executive aggregate view", () => {
  it("fails closed without a current aggregate and never reads an operational context", () => {
    summary(null);
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-statistics-capacity-chart")).not.toBeInTheDocument();
    expect(guard.operational).not.toHaveBeenCalled();
  });

  it("retains every permitted board section, ward search/show-all, ED search and admission Chart/Data", () => {
    summary();
    for (const id of [
      "capacity-chart",
      "referrals-for-bed",
      "network-cards",
      "pressure",
      "emergency-departments",
      "blocked-discharges-by-reason",
      "declines-by-reason",
      "pull-to-arrival",
      "session-trends",
    ])
      expect(screen.getByTestId(`ward-statistics-${id}`)).toBeInTheDocument();
    const pressure = screen.getByTestId("ward-statistics-pressure");
    fireEvent.click(within(pressure).getByRole("button", { name: /^Show all/ }));
    expect(pressure.querySelectorAll("tbody tr")).toHaveLength(base.wards.length);
    // D-91 (Josh, 30 Oct 2026): the two tables' typed filters went; the header search finds a unit.
    expect(screen.queryByRole("searchbox", { name: "Filter wards or hospitals" })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "Filter emergency departments" })).not.toBeInTheDocument();
    const stages = screen.getByTestId("statistics-overview-stages-chart");
    // Every stage held back under the small number rule: the card is one line, with no Chart/Data.
    const stagesHeld = Object.values(base.network.admissionStages).every(
      (count) => exactStatisticsCount(count) === null,
    );
    if (stagesHeld) {
      expect(within(stages).getByTestId("ward-statistics-overview-stages-held")).toHaveTextContent(
        "not shown under the small number rule",
      );
      expect(within(stages).queryByRole("radio", { name: "Data" })).not.toBeInTheDocument();
    } else {
      fireEvent.click(within(stages).getByRole("radio", { name: "Data" }));
      expect(screen.getByTestId("ward-statistics-overview-stage-table")).toBeInTheDocument();
    }
    expect(screen.queryByRole("link", { name: "Open referrals" })).not.toBeInTheDocument();
    expect(guard.operational).not.toHaveBeenCalled();
  });

  it("uses tags for visible counts, accessible text, charts and the figures CSV", () => {
    const data = structuredClone(base);
    data.network.people.admissionsEndedToday = { kind: "small" };
    data.network.people.refused = { kind: "withheld" };
    data.networkDetails.todayBedReferrals = {
      raised: { kind: "withheld" },
      accepted: { kind: "small" },
      declined: { kind: "exact", value: 0 },
      open: { kind: "withheld" },
    };
    const first = data.networkDetails.blocked.byReason[0];
    first.count = { kind: "small" };
    data.networkDetails.blocked.total = { kind: "withheld" };
    summary(data);
    expect(screen.getByTestId("ward-statistics-discharges-today-count")).toHaveTextContent("fewer than 5");
    expect(screen.getByTestId("ward-statistics-refused-so-far-value")).toHaveTextContent("not shown");
    const count = screen.getByTestId(`ward-statistics-blocked-discharge-${first.reason}-count`);
    expect(count).toHaveTextContent("fewer than 5");
    expect(count.parentElement!.parentElement!.querySelector('[style*="width:"]')).toBeNull();
    expect(screen.queryByRole("img", { name: /^Referrals raised today:/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Export the figures" }));
    expect(downloadCsv).toHaveBeenCalledWith(
      "ward-flow-synthetic-network-figures.csv",
      expect.arrayContaining([expect.arrayContaining(["fewer than 5"])]),
    );
    expect(document.body.textContent).not.toContain("[object Object]");
    expect(guard.operational).not.toHaveBeenCalled();
  });

  it("retains capacity grouping, selection, feed-ready inspector evidence and scoped CSV", () => {
    summary();
    const chart = screen.getByTestId("ward-statistics-capacity-chart");
    fireEvent.click(within(chart).getByRole("radio", { name: /^Wards$/ }));
    const ward = base.wards[0];
    // The chart lists its first seven rows; Show all brings the rest (the typed search went, D-91).
    const showAll = within(chart).queryByRole("button", { name: /^Show all/ });
    if (showAll) fireEvent.click(showAll);
    const row = within(chart).getByRole("button", { name: new RegExp(`^${ward.name}:`) });
    fireEvent.click(row);
    const details = screen.getByTestId("capacity-details");
    expect(within(details).getByRole("link", { name: new RegExp(ward.name) })).toHaveTextContent(
      `${ward.capacityReady} ready`,
    );
    fireEvent.click(within(chart).getByRole("button", { name: "Chart CSV" }));
    expect(downloadCsv).toHaveBeenCalledWith(
      "ward-flow-synthetic-capacity.csv",
      expect.any(Array),
      expect.objectContaining({ scope: expect.stringContaining("Capacity whole network") }),
    );
    expect(guard.operational).not.toHaveBeenCalled();
  });

  it("keeps phone pressure, ED, referral and More figures sheets without a rowful provider", () => {
    installMatchMediaStub(true);
    summary();
    fireEvent.click(screen.getByRole("button", { name: /More figures/ }));
    const sheet = screen.getByRole("dialog", { name: "More figures" });
    expect(within(sheet).getByText("Discharges held up", { exact: true })).toBeInTheDocument();
    expect(within(sheet).getByText("Declines by reason", { exact: true })).toBeInTheDocument();
    expect(within(sheet).getByText("Pull to arrival", { exact: true })).toBeInTheDocument();
    expect(guard.operational).not.toHaveBeenCalled();
  });

  it("shows session unavailability honestly and can display released session aggregates", () => {
    const data = structuredClone(base);
    data.sessionTrends = {
      state: "available",
      windows: ([3, 4] as const).map((hourCount) => ({
        hourCount,
        hours: Array.from({ length: hourCount }, (_, index) => NOW_ANCHOR - (hourCount - index - 1) * 60),
        rows: (["referrals", "accepted", "declined", "arrivals", "departures"] as const).map((id) => ({
          id,
          label: id,
          counts: Array.from({ length: hourCount }, () => ({ kind: "small" as const })),
          total: { kind: "withheld" as const },
        })),
        counted: { kind: "withheld" },
      })),
    };
    const first = summary();
    expect(
      within(screen.getByTestId("ward-statistics-session-trends")).getByTestId("ward-statistics-unavailable"),
    ).toBeInTheDocument();
    first.unmount();
    summary(data);
    expect(
      within(screen.getByTestId("ward-statistics-session-trends")).getAllByText("fewer than 5").length,
    ).toBeGreaterThan(0);
    expect(guard.operational).not.toHaveBeenCalled();
  });

  it("limits the unit finder to the service's openable EDs while keeping public origin counts as plain rows", () => {
    const data = projectExecutiveReportingFoundation(
      state,
      { role: "executive", scope: { kind: "service", service: "North Metro" } },
      options,
    );
    summary(data);
    expect(screen.getByText(/Statistics · North Metro · as at/)).toBeInTheDocument();
    // D-91: the one unit finder opens from "Open a unit" on the statistics tab row.
    fireEvent.click(screen.getByTestId("ward-statistics-tool-open-unit"));
    const finder = screen.getByTestId("ward-statistics-unit-finder");
    fireEvent.click(within(finder).getByRole("radio", { name: /^EDs/ }));
    const links = within(finder)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")!.includes("/statistics/ed/"));
    expect(links.length).toBe(data.openableEmergencyDepartmentIds.length);
    for (const link of links)
      expect(data.openableEmergencyDepartmentIds).toContain(
        decodeURIComponent(link.getAttribute("href")!.split("/").at(-1)!),
      );
    expect(screen.getByTestId("ward-statistics-emergency-departments").querySelectorAll("tbody tr")).toHaveLength(
      data.emergencyDepartments.length,
    );
    expect(guard.operational).not.toHaveBeenCalled();
  });

  it("delegates pause to the current report host", () => {
    const togglePause = vi.fn();
    summary(structuredClone(base), true, togglePause);
    fireEvent.click(screen.getByRole("button", { name: /Paused, pause demo updates/ }));
    expect(togglePause).toHaveBeenCalledOnce();
    expect(guard.operational).not.toHaveBeenCalled();
  });
});
