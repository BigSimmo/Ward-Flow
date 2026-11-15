import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

// jsdom has no App Router context for next/link, as in every sibling dom suite.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { lensValue, siteFigures, StatisticsMapView } from "@/components/ward-management/statistics/statistics-map-view";
import { networkNamedHolds, totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { edJourneyWaitFigures as edWaitFigures } from "@/components/ward-management/statistics/statistics-ed-waits";
import { waitingInEds } from "@/components/ward-management/ward-shared-figures";

beforeAll(() => {
  // The ED wait field under the ED lens measures its card; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function renderView() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsMapView />
    </WardFlowProvider>,
  );
}

function figuresAtAnchor() {
  const state = seedWardFlowStateAt(0);
  return {
    state,
    sites: siteFigures({
      units: state.units,
      admissions: state.admissions,
      bedReleases: state.bedReleases,
      leaveBeds: state.leaveBeds,
      movements: state.movements,
      referrals: state.referrals,
      now: NOW_ANCHOR,
    }),
  };
}

describe("Summary, Map view", () => {
  it("keeps the view's anchor and gives its cards their own ids", () => {
    renderView();
    const view = screen.getByTestId("ward-statistics-map-view");
    expect(view.id).toBe("map");
    expect(view.querySelector("#map-canvas")).not.toBeNull();
    expect(view.querySelector("#map-rank")).not.toBeNull();
  });

  it("site figures add up to the network's own ready beds and ED waits", () => {
    const { state, sites } = figuresAtAnchor();
    // D-179 item 8 and D-181 item 5: Ready leaves out a bed still being made ready and a bed named for
    // an incoming patient, so the map adds up to the one Ready figure every screen prints.
    const ready = totalReadyBedsNow(
      state.units,
      state.admissions,
      state.bedReleases,
      networkNamedHolds(state.movements, state.referrals),
    );
    expect(sites.reduce((sum, site) => sum + lensValue(site, "beds"), 0)).toBe(ready);
    const waiting = allEmergencyDepartments().reduce(
      (sum, ed) => sum + edWaitFigures(state.movements, ed.id, NOW_ANCHOR).onTheList,
      0,
    );
    expect(sites.reduce((sum, site) => sum + lensValue(site, "ed"), 0)).toBe(waiting);
  });

  it("lists sites in health service then site name order, unnumbered, each opening its first ward A to Z (D-126)", () => {
    renderView();
    const list = screen.getByTestId("ward-statistics-map-rank");
    expect(within(list).getByRole("heading", { name: "Ready beds by site" })).toBeTruthy();
    expect(list.textContent).not.toMatch(/most ready/iu);
    expect(list.querySelector("ol")).toBeNull();
    expect(list.querySelector("[class*='rankNo']")).toBeNull();
    const links = within(list).getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);

    const { sites } = figuresAtAnchor();
    const expected = sites
      .filter((site) => site.wards.length > 0)
      .sort(
        (a, b) =>
          HEALTH_SERVICES.indexOf(a.service) - HEALTH_SERVICES.indexOf(b.service) || a.name.localeCompare(b.name),
      );
    const shownNames = links.map((link) => link.querySelector("[class*='rankName']")?.textContent);
    expect(shownNames).toEqual(expected.map((site) => site.name));
    // Not a league table: the shown ready-bed figures are not in most-first order at the anchor.
    const shown = links.map((link) => Number(link.querySelector("[class*='rankValue']")?.textContent));
    expect(shown).not.toEqual([...shown].sort((a, b) => b - a));

    expected.forEach((site, index) => {
      const first = [...site.wards].sort((a, b) => a.unit.name.localeCompare(b.unit.name))[0]!;
      expect(links[index]!.getAttribute("href")).toBe(`/ward-flow/statistics/ward/${first.unit.id}`);
      expect(links[index]!.querySelector("[class*='rankSub']")?.textContent?.startsWith(first.unit.name)).toBe(true);
    });
  });

  it("the ED lens ranks EDs and opens ED statistics pages", () => {
    renderView();
    fireEvent.click(screen.getByRole("radio", { name: /^ED journeys open/ }));
    const rank = screen.getByTestId("ward-statistics-map-rank");
    expect(within(rank).getByRole("heading", { name: "ED journeys open by ED" })).toBeTruthy();
    const links = within(rank).getAllByRole("link");
    expect(links).toHaveLength(allEmergencyDepartments().length);
    for (const link of links) expect(link.getAttribute("href")).toMatch(/^\/ward-flow\/statistics\/ed\//);
    const { state, sites } = figuresAtAnchor();
    const journeys = sites.reduce((sum, site) => sum + lensValue(site, "ed"), 0);
    expect(journeys).toBeGreaterThan(waitingInEds(state.movements, NOW_ANCHOR).total);
    expect(screen.getByRole("radio", { name: /^ED journeys open/u })).toHaveTextContent(String(journeys));
    expect(screen.getByText(/^Ring: longest wait in ED/u)).toHaveTextContent("Centre: ED journeys open.");
    expect(
      within(screen.getByTestId("ward-statistics-map-below")).getByRole("heading", {
        name: "Waiting in ED, by ED",
      }),
    ).toBeInTheDocument();
  });

  it("choosing a site on the map lists its wards and ED as links, and closes again", () => {
    renderView();
    const wide = screen.getByTestId("ward-statistics-wa-map-wide");
    const node = wide.querySelector<SVGGElement>('[data-site="RPH"]');
    expect(node).not.toBeNull();
    fireEvent.click(node!);
    expect(node!.getAttribute("aria-pressed")).toBe("true");
    const card = screen.getByTestId("ward-statistics-map-site");
    const hrefs = within(card)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs.some((href) => href?.includes("/statistics/ward/"))).toBe(true);
    expect(hrefs).toContain("/ward-flow/statistics/ed/rph-ed");
    fireEvent.click(within(card).getByRole("button", { name: /^Close/ }));
    expect(screen.queryByTestId("ward-statistics-map-site")).toBeNull();
  });

  it("the stay lens is measured, not a preview, and every lens names its key", () => {
    renderView();
    for (const name of [/^Beds/, /^ED journeys open/, /^Discharge/, /^Stay/]) {
      fireEvent.click(screen.getByRole("radio", { name }));
      expect(screen.getByTestId("ward-statistics-map-view").textContent).not.toContain("Not wired in this prototype.");
      expect(screen.getByText(/^Ring: /)).toBeTruthy();
    }
  });

  it("the stay lens uses the one name, says who it covers and writes days in full (W-3)", () => {
    renderView();
    fireEvent.click(screen.getByRole("radio", { name: /^Stay/ }));
    expect(screen.getByText(/^Ring: share over 3 months/u)).toHaveTextContent(
      "Centre: average stay in days, including people who have left.",
    );
    const rank = screen.getByTestId("ward-statistics-map-rank");
    expect(within(rank).getByRole("heading", { name: "Average stay by site" })).toBeTruthy();
    const view = screen.getByTestId("ward-statistics-map-view").textContent ?? "";
    expect(view).not.toMatch(/mean stay/iu);
    expect(view).not.toMatch(/\d\.\dd\b/u);
  });
});
