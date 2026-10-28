import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
const guard = vi.hoisted(() => ({
  operational: vi.fn(() => {
    throw new Error("Executive place view read operational rows");
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

import { StatisticsWardsIndexScreen } from "../src/components/ward-management/statistics/statistics-wards-index";
import { StatisticsEdsIndexScreen } from "../src/components/ward-management/statistics/statistics-eds-index";
import { StatisticsServicesIndexScreen } from "../src/components/ward-management/statistics/statistics-services-index";
import { StatisticsTeamsIndexScreen } from "../src/components/ward-management/statistics/statistics-teams-index";
import { StatisticsWardScreen } from "../src/components/ward-management/statistics/statistics-ward-screen";
import { StatisticsServiceScreen } from "../src/components/ward-management/statistics/statistics-service-screen";
import { StatisticsBedMap, type BedMap } from "../src/components/ward-management/statistics/statistics-bed-map";
import { ExecutiveStatisticsProvider } from "../src/components/ward-management/statistics/executive-statistics-context";
import { projectExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-projector";
import type { ExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-contract";
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
const binding = { actorId: "synthetic-place-reader", accessContext: "a".repeat(64), epoch: 1, revision: 1 };
function place(children: ReactNode, data: ExecutiveReportingFoundation | null = structuredClone(base), clock = 150) {
  return render(
    <ExecutiveStatisticsProvider
      binding={binding}
      snapshot={data ? { binding, receivedAt: 100, expiresAt: 200, data } : null}
      now={clock}
      controls={{ executive: true, paused: false, togglePause: vi.fn() }}
    >
      {children}
    </ExecutiveStatisticsProvider>,
  );
}
afterEach(() => {
  cleanup();
  installMatchMediaStub(false);
  vi.clearAllMocks();
});

describe("public place aggregate views", () => {
  it.each([
    StatisticsWardsIndexScreen,
    StatisticsEdsIndexScreen,
    StatisticsServicesIndexScreen,
    StatisticsTeamsIndexScreen,
  ])("fails closed without a current aggregate (%s)", (Screen) => {
    place(<Screen />, null);
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
    expect(guard.operational).not.toHaveBeenCalled();
  });
  it("keeps the ward index's grouping, sorting and protected blocked figures", () => {
    const data = structuredClone(base);
    data.wards[0].blocked = { kind: "small" };
    data.networkDetails.blockedTotal = { kind: "withheld" };
    place(<StatisticsWardsIndexScreen />, data);
    expect(screen.getByTestId("ward-statistics-wards-table")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Blocked$/ }));
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Group wards" })).getByRole("radio", { name: "One list" }),
    );
    expect(screen.getAllByText("fewer than 5").length).toBeGreaterThan(0);
    expect(screen.getByTestId("ward-statistics-wards-blocked")).toHaveTextContent("not shown in all");
    expect(document.body.textContent).not.toContain("[object Object]");
    expect(guard.operational).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "keeps aggregate ED summaries and bands without individual swarm marks (phone=%s)",
    (phone) => {
      installMatchMediaStub(phone);
      place(<StatisticsEdsIndexScreen />);
      expect(screen.getByTestId("ward-statistics-eds-index")).toBeInTheDocument();
      expect(screen.queryByTestId("ward-statistics-eds-swarm")).not.toBeInTheDocument();
      expect(screen.getByText("Counts only on this desk, so people are not listed.")).toBeInTheDocument();
      if (!phone) expect(screen.getByTestId("ward-statistics-eds-table")).toBeInTheDocument();
      expect(document.body.textContent).not.toContain("[object Object]");
      expect(guard.operational).not.toHaveBeenCalled();
    },
  );
  it.each([false, true])(
    "preserves service and team public summaries and permitted detail links (phone=%s)",
    (phone) => {
      installMatchMediaStub(phone);
      const data = structuredClone(base);
      data.openableServiceIds = ["North Metro"];
      data.openableCommunityTeamIds = [data.teams[0].id];
      const first = place(<StatisticsServicesIndexScreen />, data);
      expect(screen.getByTestId("ward-statistics-services-index")).toBeInTheDocument();
      expect(document.body.textContent).not.toContain("[object Object]");
      expect(document.querySelector('a[href*="South%20Metro"]')).toBeNull();
      first.unmount();
      place(<StatisticsTeamsIndexScreen />, data);
      expect(screen.getByTestId("ward-statistics-teams-index")).toBeInTheDocument();
      if (phone) {
        fireEvent.click(screen.getByRole("radio", { name: /All teams/ }));
        fireEvent.change(screen.getByRole("searchbox", { name: "Find a team" }), {
          target: { value: data.teams[0].name },
        });
      } else {
        const showEmpty = screen.queryByTestId("ward-statistics-teams-show-empty");
        if (showEmpty) fireEvent.click(showEmpty);
      }
      const teamLink = screen.getByTestId("ward-statistics-teams-link-" + data.teams[0].id);
      expect(teamLink.tagName === "A" ? teamLink : teamLink.querySelector("a")).toHaveAttribute("href");
      expect(document.body.textContent).not.toContain("[object Object]");
      expect(guard.operational).not.toHaveBeenCalled();
    },
  );
  it.each([false, true])(
    "keeps every ward measure and aggregate bed strip without operational rows (phone=%s)",
    (phone) => {
      installMatchMediaStub(phone);
      place(<StatisticsWardScreen unitId={base.wards[0].id} />);
      expect(screen.getByTestId("ward-statistics-ward-screen")).toBeInTheDocument();
      if (phone) {
        expect(screen.getByTestId("ward-statistics-ward-phone-not-listed")).toBeInTheDocument();
      } else {
        for (const id of [
          "ward-statistics-ward-beds-now",
          "ward-statistics-ward-discharge-planning",
          "ward-statistics-ward-referrals-panel",
          "ward-statistics-ward-roster",
        ]) {
          expect(screen.getByTestId(id)).toBeInTheDocument();
        }
        fireEvent.click(screen.getByRole("radio", { name: "Data" }));
        expect(screen.getByRole("region", { name: "Admission stay bands, scrollable table" })).toBeInTheDocument();
      }
      expect(document.body.textContent).not.toContain("[object Object]");
      expect(guard.operational).not.toHaveBeenCalled();
    },
  );
  it("fails closed for unavailable or absent ward detail aggregates", () => {
    const first = place(<StatisticsWardScreen unitId={base.wards[0].id} />, null);
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
    first.unmount();
    place(<StatisticsWardScreen unitId="synthetic-absent" />);
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
    expect(guard.operational).not.toHaveBeenCalled();
  });
  it.each([false, true])("keeps every service aggregate section and controls (phone=%s)", (phone) => {
    installMatchMediaStub(phone);
    place(<StatisticsServiceScreen serviceId="North Metro" />);
    expect(screen.getByTestId("ward-statistics-service-screen")).toBeInTheDocument();
    if (phone) {
      fireEvent.click(screen.getByTestId("ward-statistics-service-phone-out-of-area"));
      expect(screen.getByTestId("ward-statistics-service-phone-out-of-area-not-listed")).toBeInTheDocument();
    } else {
      for (const id of [
        "ward-statistics-service-placement",
        "ward-statistics-service-ready-beds",
        "ward-statistics-service-out-of-area",
        "ward-statistics-service-ed-waits",
        "ward-statistics-service-repatriation",
      ]) {
        expect(screen.getByTestId(id)).toBeInTheDocument();
      }
      const capacity = screen.getByTestId("ward-statistics-capacity-chart");
      for (const ward of base.wards) {
        if (ward.service === "North Metro") expect(capacity).toHaveTextContent(ward.name);
        else expect(capacity).not.toHaveTextContent(ward.name);
      }
      fireEvent.click(
        within(screen.getByRole("radiogroup", { name: "Where referrals landed view" })).getByRole("radio", {
          name: "Data",
        }),
      );
      expect(
        screen.getByRole("region", { name: "Service out-of-area admissions, scrollable table" }),
      ).toBeInTheDocument();
    }
    expect(document.querySelector('a[href="/ward-flow/out-of-area"]')).toBeNull();
    expect(document.body.textContent).not.toContain("[object Object]");
    expect(guard.operational).not.toHaveBeenCalled();
  });
  it("fails closed for service detail outside the current permitted scope", () => {
    const data = structuredClone(base);
    data.openableServiceIds = ["North Metro"];
    place(<StatisticsServiceScreen serviceId="South Metro" />, data);
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
    expect(guard.operational).not.toHaveBeenCalled();
  });
  it("keeps service-scoped public origins while closing foreign detail navigation and bed populations", () => {
    const data = projectExecutiveReportingFoundation(
      state,
      { role: "executive", scope: { kind: "service", service: "North Metro" } },
      options,
    );
    const first = place(<StatisticsServicesIndexScreen />, data);
    expect(screen.getByTestId("ward-statistics-section-eyebrow").parentElement).toHaveTextContent("North Metro");
    expect(screen.getByTestId("ward-statistics-services-card-South Metro")).toHaveTextContent("South Metro");
    expect(screen.getByTestId("ward-statistics-services-card-South Metro").querySelector("a")).toBeNull();
    first.unmount();
    place(<StatisticsServiceScreen serviceId="North Metro" />, data);
    const wardLinks = screen.getAllByTestId(/ward-statistics-service-ready-row-/);
    expect(wardLinks).toHaveLength(data.wards.length);
    expect(data.wards.every((ward) => ward.service === "North Metro")).toBe(true);
    expect(guard.operational).not.toHaveBeenCalled();
  });
  it("keeps protected ward shares and bands worded without numeric geometry", () => {
    const data = structuredClone(base),
      ward = data.wards[0];
    ward.dischargeDates.withDate = { kind: "small" };
    ward.dischargeDates.withoutDate = { kind: "withheld" };
    ward.readyToLeave = {
      state: "measured",
      total: { kind: "small" },
      byReason: ward.readyToLeave.byReason.map((row) => ({ ...row, count: { kind: "withheld" } })),
    };
    ward.stayBands = ward.stayBands.map((row) => ({ ...row, count: { kind: "withheld" } }));
    place(<StatisticsWardScreen unitId={ward.id} />, data);
    expect(screen.getByTestId("ward-stat-discharge-date-share")).toHaveTextContent("not shown");
    expect(screen.getByTestId("ward-stat-ready-share")).toHaveTextContent("share not shown");
    expect(screen.getByTestId("statistics-ward-stays-chart")).toHaveTextContent("not shown");
    expect(document.body.textContent).not.toContain("[object Object]");
    expect(guard.operational).not.toHaveBeenCalled();
  });
  it("draws the bed strip from public aggregate states without admission, stay or blocker coordinates", () => {
    const ward = base.wards[0];
    place(
      <StatisticsBedMap
        wardName={ward.name}
        aggregate={{ counts: ward.bedMapCounts, unplacedRecords: ward.unplacedBedMapRecords }}
      />,
    );
    const map = screen.getByTestId("ward-statistics-bed-map");
    expect(map.querySelectorAll("ol > li")).toHaveLength(ward.beds.total);
    expect(map.querySelector("[data-admission-id]")).toBeNull();
    expect(map.querySelector('[title*="day"]')).toBeNull();
    expect(map).toHaveTextContent("Grouped by state. Bed numbers are not recorded.");
    expect(guard.operational).not.toHaveBeenCalled();
  });
  it("does not restore raw bed-map records to an executive or retain aggregates after expiry", () => {
    const raw: BedMap = {
      counts: { occupied: 1, leave: 0, pulled: 0, ready: 0, prep: 0, closed: 0 },
      unplacedRecords: 0,
      cells: [{ kind: "occupied", admissionId: "AD-SYNTHETIC-HIDDEN", stayDays: 42, longStay: true, blocked: true }],
    };
    const first = place(<StatisticsBedMap wardName="Synthetic ward" map={raw} />);
    expect(screen.getByText("Counts only on this desk, so people are not listed.")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("AD-SYNTHETIC-HIDDEN");
    first.unmount();
    const ward = base.wards[0];
    place(
      <StatisticsBedMap
        wardName={ward.name}
        aggregate={{ counts: ward.bedMapCounts, unplacedRecords: ward.unplacedBedMapRecords }}
      />,
      base,
      200,
    );
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
  });
});
