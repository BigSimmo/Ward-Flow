import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const guard = vi.hoisted(() => ({
  operational: vi.fn(() => {
    throw new Error("Executive community view read operational rows");
  }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/statistics",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("../src/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => ({ role: "coordinator", scope: { kind: "statewide" } }),
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

import { StatisticsCommunityScreen } from "../src/components/ward-management/statistics/statistics-community-screen";
import { ExecutiveStatisticsProvider } from "../src/components/ward-management/statistics/executive-statistics-context";
import { projectExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-projector";
import type { ExecutiveReportingFoundation } from "../src/components/ward-management/statistics/executive-statistics-contract";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { installMatchMediaStub } from "./setup/jsdom.setup";
import { downloadCsv } from "../src/components/ward-management/statistics/statistics-csv";
vi.mock("../src/components/ward-management/statistics/statistics-csv", () => ({ downloadCsv: vi.fn() }));
const state = seedWardFlowState();
const base = projectExecutiveReportingFoundation(
  state,
  { role: "executive", scope: { kind: "statewide" } },
  {
    now: NOW_ANCHOR,
    dayZero: "2026-09-22T16:00:00.000Z",
    startedAt: "2026-09-23T02:42:00.000Z",
    places: wardPlaceLookup(state.units),
  },
);
const binding = { actorId: "synthetic-community-reader", accessContext: "a".repeat(64), epoch: 1, revision: 1 };
function place(
  data: ExecutiveReportingFoundation | null = structuredClone(base),
  teamId = base.teams[0].id,
  clock = 150,
) {
  return render(
    <ExecutiveStatisticsProvider
      binding={binding}
      snapshot={data ? { binding, receivedAt: 100, expiresAt: 200, data } : null}
      now={clock}
      controls={{ executive: true, paused: false, togglePause: vi.fn() }}
    >
      <StatisticsCommunityScreen teamId={teamId} />
    </ExecutiveStatisticsProvider>,
  );
}
afterEach(() => {
  cleanup();
  installMatchMediaStub(false);
  vi.clearAllMocks();
});
describe("executive community detail aggregate", () => {
  it.each([null, 200])("fails closed for absent or expired context (%s)", (expiry) => {
    place(expiry === null ? null : structuredClone(base), base.teams[0].id, expiry ?? 150);
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
    expect(guard.operational).not.toHaveBeenCalled();
  });
  it("fails closed for a foreign or missing team", () => {
    const data = structuredClone(base);
    data.openableCommunityTeamIds = [data.teams[0].id];
    const first = place(data, data.teams[1].id);
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
    first.unmount();
    place(data, "synthetic-absent");
    expect(screen.getByTestId("ward-statistics-unavailable")).toBeInTheDocument();
    expect(guard.operational).not.toHaveBeenCalled();
  });
  it("retains handover, comparison, follow-up, due-out, search, measures, view and export controls", () => {
    place();
    for (const id of [
      "statistics-community-handover-chart",
      "ward-statistics-community-comparison",
      "ward-statistics-community-follow-up-not-listed",
      "ward-statistics-community-due-out-not-listed",
      "ward-statistics-community-unseen",
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    for (const label of ["With date", "Discharged", "Left", "In beds"]) {
      fireEvent.click(
        within(screen.getByRole("radiogroup", { name: "Team comparison measure" })).getByRole("radio", { name: label }),
      );
    }
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Sort teams" })).getByRole("radio", { name: "A to Z" }),
    );
    fireEvent.change(screen.getByRole("searchbox", { name: "Search Team comparison" }), {
      target: { value: base.teams[0].name },
    });
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Team comparison view" })).getByRole("radio", { name: "Data" }),
    );
    expect(screen.getByTestId("ward-statistics-community-comparison-table")).toHaveTextContent(base.teams[0].name);
    fireEvent.click(screen.getByRole("button", { name: /^CSV$/ }));
    expect(downloadCsv).toHaveBeenCalledOnce();
    expect(JSON.stringify(vi.mocked(downloadCsv).mock.calls[0])).not.toContain("[object Object]");
    expect(screen.queryByTestId("ward-statistics-community-operational-link")).toBeNull();
    expect(screen.queryByTestId("ward-statistics-community-coverage-link")).toBeNull();
    expect(document.body.textContent).not.toContain("[object Object]");
    expect(guard.operational).not.toHaveBeenCalled();
  });
  it("keeps protected positive teams in the default comparison without ranking or drawing their hidden counts", () => {
    const data = structuredClone(base),
      selected = data.teams.slice(0, 3);
    data.openableCommunityTeamIds = selected.map((team) => team.id);
    selected[0].figures.admitted = { kind: "measured", count: { kind: "small" } };
    selected[1].figures.admitted = { kind: "measured", count: { kind: "withheld" } };
    selected[2].figures.admitted = { kind: "measured", count: { kind: "exact", value: 10 } };
    place(data);
    const chart = screen.getByTestId("statistics-community-comparison-chart");
    for (const team of selected) expect(chart).toHaveTextContent(team.name);
    expect(chart).toHaveTextContent("fewer than 5");
    expect(chart).toHaveTextContent("not shown");
    expect(chart).not.toHaveTextContent("Mean per team");
    expect(chart.querySelectorAll('span[style*="width:"]')).toHaveLength(1);
    const ranked = within(chart).getAllByRole("listitem");
    expect(ranked[0]).toHaveTextContent(selected[2].name);
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Team comparison view" })).getByRole("radio", { name: "Data" }),
    );
    expect(screen.getAllByTestId(/ward-statistics-community-compare-row-/)).toHaveLength(3);
    expect(guard.operational).not.toHaveBeenCalled();
  });
  it("uses released phone coverage, follow-up and past-date counts without people", () => {
    installMatchMediaStub(true);
    const data = structuredClone(base),
      team = data.teams[0];
    team.figures.admitted = { kind: "measured", count: { kind: "exact", value: 8 } };
    team.figures.expected = { kind: "measured", count: { kind: "small" } };
    team.figures.discharged = { kind: "measured", count: { kind: "exact", value: 10 } };
    team.noDischargeDate = { kind: "measured", count: { kind: "withheld" } };
    team.followUpArranged = { kind: "measured", count: { kind: "small" } };
    team.followUpNotArranged = { kind: "measured", count: { kind: "withheld" } };
    team.dueOutWeek = { kind: "measured", count: { kind: "small" } };
    team.pastDate = { kind: "measured", count: { kind: "small" } };
    place(data);
    expect(screen.getByTestId("ward-statistics-community-phone-not-listed")).toBeInTheDocument();
    expect(screen.getByTestId("ward-statistics-community-past-date")).toHaveTextContent("fewer than 5");
    expect(screen.getAllByText("not shown").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("[object Object]");
    expect(guard.operational).not.toHaveBeenCalled();
  });
  it("keeps unlinked figures explicitly unmeasured", () => {
    const data = structuredClone(base),
      team = data.teams[0],
      absent = { kind: "unlinkable" as const, words: "not linked to this team" as const };
    team.figures = { admitted: absent, expected: absent, discharged: absent, other: absent };
    team.noDischargeDate = absent;
    team.dueOutWeek = absent;
    team.pastDate = absent;
    team.followUpArranged = absent;
    team.followUpNotArranged = absent;
    place(data);
    expect(screen.getByTestId("ward-statistics-community-kpi-admitted")).toHaveTextContent("not linked to this team");
    expect(screen.getByTestId("ward-statistics-community-kpi-admitted")).toHaveAttribute("data-unmeasured", "true");
    expect(guard.operational).not.toHaveBeenCalled();
  });
});
