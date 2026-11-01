import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ward-management/ward-flow-provider", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/ward-flow-provider")>()),
  useWardFlow: () => {
    throw new Error("Executive Compare read operational rows");
  },
  useWardFlowClock: () => {
    throw new Error("Executive Compare read operational clock");
  },
  useWardFlowSelect: () => {
    throw new Error("Executive Compare selected operational rows");
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/ward-flow/statistics/compare",
}));
vi.mock("@/components/ward-management/statistics/statistics-csv", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/statistics/statistics-csv")>()),
  downloadCsv: vi.fn(),
}));

import { StatisticsCompareScreen } from "@/components/ward-management/statistics/statistics-compare-screen";
import { ExecutiveStatisticsProvider } from "@/components/ward-management/statistics/executive-statistics-context";
import { projectExecutiveReportingFoundation } from "@/components/ward-management/statistics/executive-statistics-projector";
import type { ExecutiveReportingFoundation } from "@/components/ward-management/statistics/executive-statistics-contract";
import { downloadCsv } from "@/components/ward-management/statistics/statistics-csv";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { STATEWIDE_COORDINATOR } from "@/components/ward-management/ward-role-access";
import { setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { edStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { installMatchMediaStub } from "./setup/jsdom.setup";

const state = seedWardFlowState();
const options = {
  now: NOW_ANCHOR,
  dayZero: "2026-10-24T00:00:00.000Z",
  startedAt: "2026-10-24T00:00:00.000Z",
  places: wardPlaceLookup(state.units),
};
const report = projectExecutiveReportingFoundation(state, { role: "executive", scope: { kind: "statewide" } }, options);
const binding = { actorId: "synthetic-compare", accessContext: "a".repeat(64), epoch: 0, revision: 7 };
const wrap = (children: ReactNode, data: ExecutiveReportingFoundation | null = report) => (
  <ExecutiveStatisticsProvider
    binding={binding}
    snapshot={data ? { binding, receivedAt: 100, expiresAt: 200, data } : null}
    now={150}
    controls={{ executive: true, paused: false, togglePause: null }}
  >
    {children}
  </ExecutiveStatisticsProvider>
);

/** Trusted released-value presentation fixture; transport validation is tested at its own seam. */
function protectedReport() {
  const data = structuredClone(report);
  for (const ward of data.wards) {
    ward.statistics.readyToLeaveCannot = { kind: "withheld" };
    ward.statistics.longStays = { kind: "withheld" };
    ward.awaitingAnswer = { kind: "withheld" };
    ward.statistics.dischargeDateOutcomes.met = { kind: "withheld" };
    ward.statistics.dischargeDateOutcomes.consideredCount = { kind: "withheld" };
  }
  for (const ed of data.emergencyDepartments) {
    ed.onTheList = { kind: "withheld" };
    ed.urgent = { kind: "withheld" };
    ed.unplaced = { kind: "withheld" };
  }
  return data;
}

afterEach(() => {
  cleanup();
  setWardAccess(STATEWIDE_COORDINATOR);
  vi.clearAllMocks();
});
const wardCard = () => screen.getByTestId("statistics-compare-ward-chart");
const edCard = () => screen.getByTestId("statistics-compare-ed-chart");
const chart = (label: string) => screen.getByText(label).closest("figure")!;

describe("Compare uses its released aggregate model", () => {
  it("fails closed with missing data and with no provider on the actual executive desk", () => {
    installMatchMediaStub(false);
    const view = render(wrap(<StatisticsCompareScreen />, null));
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "executive", scope: { kind: "statewide" } });
    view.rerender(<StatisticsCompareScreen />);
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
  });

  it("keeps chart, group and search controls while protecting bars, order and the complete reference", () => {
    installMatchMediaStub(false);
    const data = protectedReport();
    render(wrap(<StatisticsCompareScreen />, data));
    fireEvent.click(within(wardCard()).getByRole("radio", { name: "Held up" }));
    // The chart opens on its first eight wards; Show all lists every one.
    fireEvent.click(within(wardCard()).getByRole("button", { name: /^Show all/ }));
    const figure = chart("Ward discharges held up bar chart");
    const spoken = within(figure)
      .getAllByRole("listitem", { hidden: true })
      .map((item) => item.textContent);
    expect(spoken).toEqual(
      [...data.wards].sort((a, b) => a.name.localeCompare(b.name)).map((ward) => `${ward.name}: not shown`),
    );
    expect(figure.querySelectorAll('span[style*="width"]')).toHaveLength(0);
    expect(figure).not.toHaveTextContent("Mean of wards:");
    // the redesign (Josh, 1 Nov 2026) draws highest first with no sort switch; the group chips stay.
    expect(within(wardCard()).queryByRole("radio", { name: "Lowest" })).not.toBeInTheDocument();
    fireEvent.click(within(wardCard()).getByRole("button", { name: /^Secure/ }));
    expect(within(wardCard()).getByRole("button", { name: /^Secure/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(within(wardCard()).getByRole("searchbox"), { target: { value: data.wards[0].name } });
    expect(wardCard()).toHaveTextContent("network reference are not shown");
    fireEvent.change(within(wardCard()).getByRole("searchbox"), { target: { value: "" } });
    fireEvent.click(within(wardCard()).getByRole("button", { name: /^All/ }));
    fireEvent.click(within(edCard()).getByRole("radio", { name: "No ward" }));
    const edFigure = chart("Emergency department placements with no ward bar chart");
    expect(edFigure).not.toHaveTextContent("Mean of EDs:");
    expect(edFigure).toHaveTextContent("not shown");
  });

  it("keeps both Data tables and exports exactly their protected cells", () => {
    installMatchMediaStub(false);
    render(wrap(<StatisticsCompareScreen />, protectedReport()));
    fireEvent.click(within(wardCard()).getByRole("radio", { name: "Data" }));
    fireEvent.click(within(edCard()).getByRole("radio", { name: "Data" }));
    expect(screen.getByTestId("ward-statistics-compare-wards")).toHaveTextContent("not shown of not shown met");
    expect(screen.getByTestId("ward-statistics-compare-eds")).toHaveTextContent("not shown");
    fireEvent.click(within(wardCard()).getByRole("button", { name: "CSV" }));
    const wardLines = vi.mocked(downloadCsv).mock.calls.at(-1)![1];
    expect(wardLines[1].slice(2)).toContain("not shown");
    expect(wardLines[1]).toContain("not shown of not shown met");
    fireEvent.click(within(edCard()).getByRole("button", { name: "CSV" }));
    expect(vi.mocked(downloadCsv).mock.calls.at(-1)![1][1].slice(2, 5)).toEqual([
      "not shown",
      "not shown",
      "not shown",
    ]);
  });

  it("preserves an unknown duration in charts and CSV without making it zero or a partial ED mean", () => {
    installMatchMediaStub(false);
    const data = protectedReport();
    data.wards[0].statistics.averageLengthOfStayDays = null;
    data.emergencyDepartments[0].longestWaitMinutes = null;
    render(wrap(<StatisticsCompareScreen />, data));
    // The ward chart opens on Occupancy; the unrecorded line belongs to Average stay.
    fireEvent.click(within(wardCard()).getByRole("radio", { name: "Stay" }));
    expect(screen.getByTestId("ward-statistics-compare-ward-chart-unrecorded")).toHaveTextContent(data.wards[0].name);
    fireEvent.click(within(edCard()).getByRole("radio", { name: "Longest" }));
    const figure = chart("Emergency department longest wait bar chart, in hours");
    expect(figure).toHaveTextContent(`${data.emergencyDepartments[0].name}: Not recorded`);
    expect(figure).not.toHaveTextContent("Mean of EDs:");
    fireEvent.click(within(edCard()).getByRole("button", { name: "CSV" }));
    expect(vi.mocked(downloadCsv).mock.calls.at(-1)![1][1].at(-1)).toBe("Not recorded");
  });

  it("uses the released bed-state ready figure rather than the separate capacity-feed available figure", () => {
    installMatchMediaStub(true);
    const data = protectedReport();
    data.capacity.ready = data.network.beds.ready + 1;
    render(wrap(<StatisticsCompareScreen />, data));
    const main = screen.getByTestId("ward-statistics-compare-screen");
    const ready = within(main).getByText("Ready").parentElement!;
    expect(ready).toHaveTextContent(String(data.network.beds.ready));
    expect(ready).not.toHaveTextContent(String(data.capacity.ready));
  });

  it("keeps pin, clear and unpin controls and withholds a reference whenever any ward count is protected", () => {
    installMatchMediaStub(false);
    const data = protectedReport();
    data.wards[0].statistics.readyToLeaveCannot = { kind: "exact", value: 10 };
    render(wrap(<StatisticsCompareScreen />, data));
    const pinned = screen.getByTestId("ward-statistics-compare-pinned");
    const pin = () => {
      fireEvent.click(within(pinned).getByRole("button", { name: "Pin a ward" }));
      fireEvent.click(screen.getByRole("menuitem", { name: new RegExp(`^${data.wards[0].name}`) }));
    };
    pin();
    const blocker = within(pinned)
      .getAllByRole("row")
      .find((row) => row.textContent?.startsWith("Discharges held up"));
    expect(blocker).toHaveTextContent("10not shown");
    fireEvent.click(within(pinned).getByRole("button", { name: `Unpin ${data.wards[0].name}` }));
    expect(pinned).toHaveTextContent("Pin up to three wards");
    pin();
    fireEvent.click(within(pinned).getByRole("button", { name: "Clear" }));
    expect(pinned).toHaveTextContent("Pin up to three wards");
  });

  it("keeps the scoped eyebrow and sends Open a unit to the one finder rather than its own chooser", () => {
    installMatchMediaStub(false);
    const scoped = projectExecutiveReportingFoundation(
      state,
      { role: "executive", scope: { kind: "service", service: report.wards[0].service } },
      options,
    );
    render(wrap(<StatisticsCompareScreen />, scoped));
    expect(screen.getByTestId("ward-statistics-section-eyebrow").parentElement).toHaveTextContent(
      report.wards[0].service,
    );
    // D-91 (Josh, 31 Oct 2026): the per-unit links, foreign-origin EDs as plain labels included,
    // live in the one finder on the statistics home page; Compare draws no unit links of its own.
    expect(screen.queryByTestId("ward-statistics-compare-chooser")).toBeNull();
    expect(screen.getByTestId("ward-statistics-compare-tool-open-unit")).toHaveAttribute(
      "href",
      "/ward-flow/statistics#choose-a-unit",
    );
    for (const ed of scoped.emergencyDepartments) {
      expect(document.querySelector(`a[href="${edStatisticsHref(ed.id)}"]`)).toBeNull();
    }
  });

  it("keeps phone measures and two-ward sheet pickers with protected counts and references", () => {
    installMatchMediaStub(true);
    const data = protectedReport();
    render(wrap(<StatisticsCompareScreen />, data));
    const phone = screen.getByTestId("ward-statistics-compare-phone");
    fireEvent.click(within(phone).getByRole("button", { name: "Held up" }));
    expect(chart("Ward discharges held up bar chart")).toHaveTextContent("not shown");
    fireEvent.click(within(phone).getByRole("radio", { name: "EDs" }));
    fireEvent.click(within(phone).getByRole("button", { name: "Urgent" }));
    expect(chart("Emergency department urgent placements bar chart")).toHaveTextContent("not shown");
    fireEvent.click(screen.getByTestId("ward-statistics-compare-phone-pinned"));
    fireEvent.change(screen.getByTestId("ward-statistics-compare-pair-a"), { target: { value: data.wards[0].id } });
    fireEvent.change(screen.getByTestId("ward-statistics-compare-pair-b"), { target: { value: data.wards[1].id } });
    expect(screen.getByTestId("ward-statistics-compare-pair-blocked")).toHaveTextContent("not shown");
    expect(screen.getByTestId("ward-statistics-compare-pair-blocked")).not.toHaveTextContent("above network");
  });
});
