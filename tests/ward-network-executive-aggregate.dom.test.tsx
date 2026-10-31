import { fireEvent, render, screen, within, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ward-management/ward-flow-provider", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/ward-flow-provider")>()),
  useWardFlow: () => {
    throw new Error("Executive view read operational rows");
  },
  useWardFlowClock: () => {
    throw new Error("Executive view read operational clock");
  },
  useWardFlowSelect: () => {
    throw new Error("Executive view selected operational rows");
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/ward-flow/statistics",
}));

import { ExecutiveStatisticsProvider } from "@/components/ward-management/statistics/executive-statistics-context";
import { projectExecutiveReportingFoundation } from "@/components/ward-management/statistics/executive-statistics-projector";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { StatisticsHero } from "@/components/ward-management/statistics/statistics-hero";
import { StatisticsJourneyView } from "@/components/ward-management/statistics/statistics-journey-view";
import { StatisticsMapView } from "@/components/ward-management/statistics/statistics-map-view";
import { StatisticsSummaryPhone } from "@/components/ward-management/statistics/statistics-summary-phone";
import {
  releasedCountText,
  sumStatisticsCounts,
  type StatisticsCount,
} from "@/components/ward-management/statistics/statistics-small-numbers";
import { csvCell, statisticsExportLines } from "@/components/ward-management/statistics/statistics-csv";
import { installMatchMediaStub } from "./setup/jsdom.setup";
import { edStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { STATEWIDE_COORDINATOR } from "@/components/ward-management/ward-role-access";

const state = seedWardFlowState();
const report = projectExecutiveReportingFoundation(
  state,
  { role: "executive", scope: { kind: "statewide" } },
  {
    now: NOW_ANCHOR,
    dayZero: "2026-10-24T00:00:00.000Z",
    startedAt: "2026-10-24T00:00:00.000Z",
    places: wardPlaceLookup(state.units),
  },
);
const binding = { actorId: "synthetic-executive", accessContext: "a".repeat(64), epoch: 1, revision: 7 };
const snapshot = { binding, receivedAt: 100, expiresAt: 200, data: report };
const pause = vi.fn();
const wrap = (children: ReactNode, ready = true, now = 150) => (
  <ExecutiveStatisticsProvider
    binding={binding}
    snapshot={ready ? snapshot : null}
    now={now}
    controls={{ executive: true, paused: false, togglePause: pause }}
  >
    {children}
  </ExecutiveStatisticsProvider>
);

afterEach(() => {
  cleanup();
  setWardAccess(STATEWIDE_COORDINATOR);
  vi.clearAllMocks();
});

describe("Network views consume only the released executive report", () => {
  it.each<{ counts: StatisticsCount[]; expected: StatisticsCount }>([
    { counts: [1, 2], expected: 3 },
    {
      counts: [
        { kind: "exact", value: 0 },
        { kind: "exact", value: 5 },
      ],
      expected: { kind: "exact", value: 5 },
    },
    { counts: [{ kind: "exact", value: 0 }, 1], expected: { kind: "withheld" } },
    { counts: [{ kind: "exact", value: 5 }, 3], expected: { kind: "withheld" } },
    { counts: [{ kind: "exact", value: 5 }, 0], expected: { kind: "exact", value: 5 } },
    { counts: [{ kind: "small" }, { kind: "exact", value: 5 }], expected: { kind: "withheld" } },
    { counts: [{ kind: "exact", value: 1 }], expected: { kind: "withheld" } },
  ])("does not create release authority while adding $counts", ({ counts, expected }) => {
    expect(sumStatisticsCounts(counts)).toEqual(expected);
  });
  it("draws the hero and its export without reading any operational state hook", () => {
    installMatchMediaStub(false);
    render(
      wrap(
        <StatisticsHero
          section="hub"
          eyebrow="Statistics"
          title="Network"
          paused={false}
          onTogglePause={vi.fn()}
          exportFigures={{
            stem: "network",
            scope: "Whole network",
            figures: () => [["Open ED journeys", report.network.people.waitingInEd]],
          }}
        />,
      ),
    );
    expect(screen.getByTestId("ward-statistics-export")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /pause demo updates/ }));
    expect(pause).toHaveBeenCalledOnce();
    const lines = statisticsExportLines(
      {
        stem: "network",
        scope: "Whole network",
        figures: () => [["Open ED journeys", report.network.people.waitingInEd]],
      },
      "Synthetic as-at",
    );
    expect(lines.at(-1)).toEqual(["Open ED journeys", releasedCountText(report.network.people.waitingInEd)]);
    expect(csvCell({ kind: "withheld" })).toBe('"not shown"');
    expect(csvCell({ kind: "small" })).toBe('"fewer than 5"');
  });

  it("fails closed before hooks when an executive report is missing or expired", () => {
    const view = render(
      wrap(
        <>
          <StatisticsHero section="hub" eyebrow="Statistics" title="Network" paused={false} />
          <StatisticsMapView />
          <StatisticsJourneyView onShowBoard={vi.fn()} />
        </>,
        false,
      ),
    );
    expect(screen.getAllByTestId("ward-statistics-unavailable")).toHaveLength(3);
    view.rerender(wrap(<StatisticsMapView />, true, 201));
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
  });

  it("cannot fall back to operational hooks when the actual executive desk has no aggregate provider", () => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "executive", scope: { kind: "statewide" } });
    render(
      <>
        <StatisticsHero section="hub" eyebrow="Statistics" title="Network" paused={false} />
        <StatisticsMapView />
        <StatisticsJourneyView onShowBoard={vi.fn()} />
      </>,
    );
    expect(screen.getAllByTestId("ward-statistics-unavailable")).toHaveLength(3);
  });

  it("keeps all map lenses, selection and public links without individual journey marks", () => {
    installMatchMediaStub(false);
    render(wrap(<StatisticsMapView />));
    expect(screen.getByTestId("ward-statistics-wa-map")).toBeInTheDocument();
    for (const lens of ["Open ED journeys", "Discharge", "Stay", "Beds"]) {
      fireEvent.click(screen.getByRole("radio", { name: new RegExp(`^${lens}`) }));
      expect(screen.getByTestId("ward-statistics-map-below")).toBeInTheDocument();
    }
    const node = screen.getAllByRole("button", { name: /ready beds/ })[0];
    expect(node).toBeInTheDocument();
    fireEvent.click(node);
    expect(screen.getByTestId("ward-statistics-map-site")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /^Open ED journeys/ }));
    expect(screen.queryByTestId("ward-statistics-map-ed-swarm")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("ward-statistics-map-below")).getAllByRole("link").length).toBeGreaterThan(0);
  });

  it("keeps stage selection, bed-board navigation and exact bed geometry in Journey", () => {
    const onShowBoard = vi.fn();
    render(wrap(<StatisticsJourneyView onShowBoard={onShowBoard} />));
    const stage = report.journey.find((candidate) => candidate.figure.kind === "count")!;
    const button = screen.getByTestId(`ward-statistics-journey-node-${stage.id}`);
    const figure = stage.figure.kind === "count" ? releasedCountText(stage.figure.count) : "";
    expect(button).toHaveAccessibleName(new RegExp(String(figure)));
    fireEvent.click(button);
    expect(screen.getByTestId(`ward-statistics-journey-stage-${stage.id}`)).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByTestId("ward-statistics-journey-open-board"));
    expect(onShowBoard).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("ward-statistics-journey-swarm")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("ward-statistics-journey-waiting")).getAllByRole("link").length).toBeGreaterThan(
      0,
    );
  });

  it("shows authorised foreign-origin ED aggregates while linking only the service's permitted ED details", () => {
    const scoped = projectExecutiveReportingFoundation(
      state,
      { role: "executive", scope: { kind: "service", service: report.wards[0].service } },
      {
        now: NOW_ANCHOR,
        dayZero: report.network.asAt.dayZero,
        startedAt: report.network.asAt.startedAt,
        places: wardPlaceLookup(state.units),
      },
    );
    const own = scoped.emergencyDepartments.find((ed) => scoped.openableEmergencyDepartmentIds.includes(ed.id));
    const foreign = scoped.emergencyDepartments.find((ed) => !scoped.openableEmergencyDepartmentIds.includes(ed.id));
    if (!own || !foreign) throw new Error("Synthetic own/foreign public ED fixture is missing");
    const content = (children: ReactNode) => (
      <ExecutiveStatisticsProvider
        binding={binding}
        snapshot={{ ...snapshot, data: scoped }}
        now={150}
        controls={{ executive: true, paused: false, togglePause: null }}
      >
        {children}
      </ExecutiveStatisticsProvider>
    );
    installMatchMediaStub(false);
    const view = render(content(<StatisticsMapView />));
    fireEvent.click(screen.getByRole("radio", { name: /^Open ED journeys/ }));
    const map = screen.getByTestId("ward-statistics-map-below");
    expect(map).toHaveTextContent(foreign.name);
    expect(map.querySelector(`a[href="${edStatisticsHref(foreign.id)}"]`)).toBeNull();
    expect(map.querySelector(`a[href="${edStatisticsHref(own.id)}"]`)).not.toBeNull();
    view.rerender(content(<StatisticsJourneyView onShowBoard={vi.fn()} />));
    const journey = screen.getByTestId("ward-statistics-journey-waiting");
    expect(journey).toHaveTextContent(foreign.name);
    expect(journey.querySelector(`a[href="${edStatisticsHref(foreign.id)}"]`)).toBeNull();
    expect(journey.querySelector(`a[href="${edStatisticsHref(own.id)}"]`)).not.toBeNull();
  });

  it("keeps phone grouping, sheets and protected headline/referral values", () => {
    installMatchMediaStub(true);
    const beds = report.network.beds;
    render(
      wrap(
        <StatisticsSummaryPhone
          ready={beds.ready}
          beingMadeReady={beds.beingMadeReady}
          occupied={beds.inUse}
          occupiedPct={beds.total ? (beds.inUse / beds.total) * 100 : 0}
          waitingInEd={report.network.people.waitingInEd}
          endedToday={report.network.people.admissionsEndedToday}
          wards={report.wards.map((ward) => ({
            id: ward.id,
            name: ward.name,
            hospital: ward.siteCode,
            service: ward.service,
            beds: ward.beds.total,
            ready: ward.beds.ready,
            percent: ward.beds.total ? Math.round((ward.beds.inUse / ward.beds.total) * 100) : 0,
          }))}
          eds={report.emergencyDepartments.map((ed) => ({
            id: ed.id,
            name: ed.name,
            site: ed.siteCode,
            waiting: ed.onTheList,
            longest: ed.longestWaitMinutes,
          }))}
          referrals={report.networkDetails.todayBedReferrals}
          moreFigures={{
            blocked: {
              total: report.networkDetails.blocked.total,
              admissions: report.networkDetails.blocked.admissionsExamined,
              tallies: report.networkDetails.blocked.byReason.map((row) => ({
                id: row.reason,
                label: row.reason,
                count: row.count,
              })),
            },
            declines: { total: report.networkDetails.declines.total, tallies: [] },
            arrivals: {
              measured: report.networkDetails.arrivals.measuredCount,
              average: report.networkDetails.arrivals.averageMinutes,
              shortest: report.networkDetails.arrivals.shortestMinutes,
              longest: report.networkDetails.arrivals.longestMinutes,
            },
          }}
          wardCount={report.wards.length}
          paused={false}
        />,
      ),
    );
    // The phone switch reads "By hospital / By ward", without counts (31 Oct 2026 build).
    fireEvent.click(screen.getByRole("radio", { name: "By ward" }));
    expect(screen.getByRole("list", { name: "Wards by beds ready" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ward-statistics-more-figures"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Discharges held up");
    expect(screen.getByRole("dialog")).toHaveTextContent(
      String(releasedCountText(report.networkDetails.blocked.total)),
    );
  });
});
