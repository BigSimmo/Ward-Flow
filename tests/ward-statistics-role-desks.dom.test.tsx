import { act, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { StatisticsCommunityScreen } from "@/components/ward-management/statistics/statistics-community-screen";
import { StatisticsEdScreen } from "@/components/ward-management/statistics/statistics-ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR, allEmergencyDepartments } from "@/components/ward-management/ward-sites";

/**
 * Role views built from the as-ed-statistics and as-community-statistics mock-ups (Josh, 31 Oct 2026,
 * "Yes to all"): an ED or team desk's own Statistics page leads with its counts, says "Counts only"
 * once in the eyebrow, and the coordinator's page is unchanged.
 */

const [ownEd] = allEmergencyDepartments();
const [ownTeam] = COMMUNITY_TEAM_PAGES;
const coordinator: WardAccess = { role: "coordinator", scope: { kind: "statewide" } };
const edDesk: WardAccess = { role: "ed", scope: { kind: "ed", edId: ownEd!.id } };
const teamDesk: WardAccess = { role: "community", scope: { kind: "team", teamName: ownTeam!.name } };

afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

function renderAs(access: WardAccess, page: ReactNode) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(access);
  });
  return render(<WardFlowProvider initialNow={NOW_ANCHOR}>{page}</WardFlowProvider>);
}

describe("an ED desk's own Statistics page leads with its counts", () => {
  it("says Counts only once in the eyebrow and splits the chart's journeys in its aside", () => {
    renderAs(edDesk, <StatisticsEdScreen edId={ownEd!.id} />);
    expect(screen.getAllByTestId("ward-statistics-people-not-listed")).toHaveLength(1);
    expect(screen.getByTestId("ward-statistics-people-not-listed").textContent).toMatch(/Counts only/u);
    expect(screen.queryByTestId("ward-statistics-ed-phone-not-listed")).toBeNull();
    const bands = screen.getByTestId("ward-statistics-ed-bands");
    expect(within(bands).getByTestId("ward-statistics-ed-population").textContent).toMatch(
      /^\d+ still in ED · \d+ in transit/u,
    );
    const declines = screen.getByTestId("ward-statistics-ed-declines");
    expect(declines.textContent).toMatch(/No suitable bed/u);
    expect(declines.textContent).not.toMatch(/Declined, no suitable bed/u);
  });

  it("keeps the coordinator's eyebrow and decline labels", () => {
    renderAs(coordinator, <StatisticsEdScreen edId={ownEd!.id} />);
    expect(screen.getByTestId("ward-statistics-ed-site")).toBeTruthy();
    expect(screen.queryByTestId("ward-statistics-people-not-listed")).toBeNull();
    expect(screen.getByTestId("ward-statistics-ed-declines").textContent).toMatch(/Declined, no suitable bed/u);
  });
});

describe("a team desk's own Statistics page leads with its counts", () => {
  it("gathers the follow-up figures in one Coming back to the team card", () => {
    renderAs(teamDesk, <StatisticsCommunityScreen teamId={ownTeam!.id} />);
    expect(screen.getByTestId("ward-statistics-people-not-listed").textContent).toMatch(
      /Community team · Counts only/u,
    );
    const card = document.querySelector('dl[aria-label="Coming back to the team"]');
    expect(card).not.toBeNull();
    const labels = [...card!.querySelectorAll("dt")].map((term) => (term.textContent ?? "").trim());
    expect(labels).toEqual([
      "Due out within 7 days",
      "Past discharge date",
      "No discharge date",
      "Discharged here",
      "Left another way",
      "No follow-up yet",
    ]);
    expect(screen.getByTestId("ward-statistics-community-operational-link").textContent).toBe("Open caseload");
  });

  it("keeps the coordinator's network eyebrow", () => {
    renderAs(coordinator, <StatisticsCommunityScreen teamId={ownTeam!.id} />);
    expect(screen.queryByTestId("ward-statistics-people-not-listed")).toBeNull();
    expect(screen.getByText(/teams in the network/u)).toBeTruthy();
  });
});
