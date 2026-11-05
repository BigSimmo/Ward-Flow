import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { COMMUNITY_TEAM_PAGES, communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { useStatisticsCounts } from "@/components/ward-management/shell/ward-access";
import { StatisticsEdScreen } from "@/components/ward-management/statistics/statistics-ed-screen";
import { StatisticsNav } from "@/components/ward-management/statistics/statistics-nav";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { seedWardFlowState, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import {
  ROLE_SCREENS,
  ownStatisticsHrefFor,
  screenDecision,
  screenForPath,
  type WardAccess,
} from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR, allEmergencyDepartments } from "@/components/ward-management/ward-sites";

/**
 * D-80 PR 5c: a ward, ED or community team desk opens its own place's Statistics page, as counts,
 * and nothing else in Statistics. An ED's copy keeps each ward's decline without its reason, and its
 * page still says how many declines named no suitable bed and how many gave another reason.
 */

const BASE = "/ward-flow";
const state = seedWardFlowState();
const places = wardPlaceLookup(state.units);
const [ownUnit, otherUnit] = state.units;
const [ownEd, otherEd] = allEmergencyDepartments();
const [ownTeam, otherTeam] = COMMUNITY_TEAM_PAGES;

const wardDesk: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [ownUnit!.id] } };
const edDesk: WardAccess = { role: "ed", scope: { kind: "ed", edId: ownEd!.id } };
const teamDesk: WardAccess = { role: "community", scope: { kind: "team", teamName: ownTeam!.name } };

const opens = (access: WardAccess, path: string) => screenDecision(access, screenForPath(path), places).open;

afterEach(() => {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("own-place Statistics for ward, ED and team desks (D-80)", () => {
  it("grants Statistics as counts to each of the three desks", () => {
    expect(ROLE_SCREENS.ward.statistics).toBe("counts");
    expect(ROLE_SCREENS.ed.statistics).toBe("counts");
    expect(ROLE_SCREENS.community.statistics).toBe("counts");
  });

  it("opens each desk's own place's page and points Statistics at it", () => {
    const wardHref = ownStatisticsHrefFor(wardDesk, communityTeamSlug)!;
    const edHref = ownStatisticsHrefFor(edDesk, communityTeamSlug)!;
    const teamHref = ownStatisticsHrefFor(teamDesk, communityTeamSlug)!;
    expect(wardHref).toBe(`${BASE}/statistics/ward/${ownUnit!.id}`);
    expect(edHref).toBe(`${BASE}/statistics/ed/${ownEd!.id}`);
    expect(teamHref).toBe(`${BASE}/statistics/community/${ownTeam!.id}`);
    expect(opens(wardDesk, wardHref)).toBe(true);
    expect(opens(edDesk, edHref)).toBe(true);
    expect(opens(teamDesk, teamHref)).toBe(true);
  });

  it("closes another place's page, the hub, Compare, Weekly and every index", () => {
    expect(opens(wardDesk, `${BASE}/statistics/ward/${otherUnit!.id}`)).toBe(false);
    expect(opens(edDesk, `${BASE}/statistics/ed/${otherEd!.id}`)).toBe(false);
    expect(opens(teamDesk, `${BASE}/statistics/community/${otherTeam!.id}`)).toBe(false);
    for (const desk of [wardDesk, edDesk, teamDesk]) {
      for (const section of ["", "/overview", "/compare", "/weekly", "/wards", "/eds", "/teams", "/services"]) {
        expect(opens(desk, `${BASE}/statistics${section}`), `${desk.role} ${section}`).toBe(false);
      }
      // A desk never opens another kind of place's page either.
      expect(opens(desk, `${BASE}/statistics/service/${encodeURIComponent("North Metro")}`)).toBe(false);
    }
    expect(opens(wardDesk, `${BASE}/statistics/ed/${ownEd!.id}`)).toBe(false);
    expect(opens(edDesk, `${BASE}/statistics/ward/${ownUnit!.id}`)).toBe(false);
  });

  it("leaves the bed manager, executive and coordinator their Statistics", () => {
    expect(ownStatisticsHrefFor({ role: "executive", scope: { kind: "statewide" } }, communityTeamSlug)).toBe(
      undefined,
    );
    expect(opens({ role: "executive", scope: { kind: "statewide" } }, `${BASE}/statistics/compare`)).toBe(true);
    const site = { role: "bed_manager", scope: { kind: "site", siteCode: ownUnit!.siteCode } } as const;
    expect(opens(site, `${BASE}/statistics`)).toBe(true);
  });

  it("shows an own-place desk no section track, since no section opens", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess(edDesk);
    });
    render(<StatisticsNav withSamples={false} />);
    expect(screen.queryByTestId("ward-statistics-nav")).toBeNull();
  });
});

describe("an ED's own Statistics page reads its stripped copy (D-80)", () => {
  // Two answers on one of this ED's journeys: a refusal for another reason, and no suitable bed.
  const journey = state.movements.find(
    (movement) => movement.originEdId === ownEd!.id && movement.sourceAdmissionId === undefined,
  )!;
  const world: WardFlowState = {
    ...state,
    movements: state.movements.map((movement) =>
      movement.id === journey.id
        ? {
            ...movement,
            declines: [
              { unitId: ownUnit!.id, at: NOW_ANCHOR - 30, reason: "acuity_mix" },
              { unitId: otherUnit!.id, at: NOW_ANCHOR - 20, reason: "no_suitable_bed" },
            ],
          }
        : movement,
    ),
  };
  const copy = scopeWardFlowState(world, edDesk, { now: NOW_ANCHOR, places }).state;
  const copied = new Set(copy.movements.map((movement) => movement.id));
  // The coordinator's view of the same journeys, every reason intact.
  const whole: Movement[] = world.movements.filter((movement) => copied.has(movement.id));

  const text = (testId: string) => (screen.getByTestId(testId).textContent ?? "").trim();

  function renderAs(access: WardAccess, movements: Movement[]) {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess(access);
    });
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsEdScreen edId={ownEd!.id} movements={movements} />
      </WardFlowProvider>,
    );
  }

  it("holds no other ward's refusal reason", () => {
    const declines = copy.movements.find((movement) => movement.id === journey.id)!.declines;
    expect(declines.map((decline) => decline.reason)).toEqual([undefined, "no_suitable_bed"]);
  });

  it("gives the two decline counts the coordinator sees for the same journeys", () => {
    const coordinator = renderAs({ role: "coordinator", scope: { kind: "statewide" } }, whole);
    const noFreeBed = text("ward-stat-ed-declined-no-free-bed");
    const other = text("ward-stat-ed-declined-not-suitable");
    expect(noFreeBed).toMatch(/^[1-9]\d* declines? names? a ward that had no suitable bed\.$/u);
    expect(other).toMatch(/^[1-9]\d* declines? gave a reason other than having no suitable bed\.$/u);
    coordinator.unmount();

    renderAs(edDesk, copy.movements);
    expect(text("ward-stat-ed-declined-no-free-bed")).toBe(noFreeBed);
    expect(text("ward-stat-ed-declined-not-suitable")).toBe(other);
    expect(screen.queryByTestId("ward-stat-ed-declined-not-suitable-unavailable")).toBeNull();
  });

  it("leaves out other departments and the ways to them", () => {
    renderAs(edDesk, copy.movements);
    expect(screen.queryByTestId("ward-stat-ed-comparison")).toBeNull();
    expect(screen.queryByTestId("ward-statistics-ed-all-eds")).toBeNull();
    expect(screen.queryByTestId("ward-statistics-ed-compare")).toBeNull();
    expect(screen.queryByRole("button", { name: /change ed/iu })).toBeNull();
  });

  it("keeps the comparison and the ways out for the coordinator", () => {
    renderAs({ role: "coordinator", scope: { kind: "statewide" } }, whole);
    expect(screen.getByTestId("ward-stat-ed-comparison")).toBeTruthy();
    expect(screen.getByTestId("ward-statistics-ed-all-eds")).toBeTruthy();
    expect(screen.getByRole("button", { name: /change ed/iu })).toBeTruthy();
  });
});

describe("a counts grant shows no list of people (D-80)", () => {
  function Probe() {
    const { countsOnly, small } = useStatisticsCounts();
    return <p data-testid="probe">{`${countsOnly}:${String(small(2))}`}</p>;
  }

  function probeAs(access: WardAccess) {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess(access);
    });
    const view = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Probe />
      </WardFlowProvider>,
    );
    const text = screen.getByTestId("probe").textContent;
    view.unmount();
    return text;
  }

  it("is counts only for the ward, ED and team desks, with exact small counts", () => {
    for (const desk of [wardDesk, edDesk, teamDesk]) expect(probeAs(desk), desk.role).toBe("true:2");
  });

  it("keeps the executive on small numbers and the coordinator on lists", () => {
    expect(probeAs({ role: "executive", scope: { kind: "statewide" } })).toBe("true:fewer than 5");
    expect(probeAs({ role: "coordinator", scope: { kind: "statewide" } })).toBe("false:2");
  });
});
