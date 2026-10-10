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
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { edWaitFigures } from "@/components/ward-management/statistics/statistics-ed-waits";

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
    const ready = state.units.reduce((sum, unit) => sum + unitCapacity(unit, state.bedReleases).available, 0);
    expect(sites.reduce((sum, site) => sum + lensValue(site, "beds"), 0)).toBe(ready);
    const waiting = allEmergencyDepartments().reduce(
      (sum, ed) => sum + edWaitFigures(state.movements, ed.id, NOW_ANCHOR).onTheList,
      0,
    );
    expect(sites.reduce((sum, site) => sum + lensValue(site, "ed"), 0)).toBe(waiting);
  });

  it("ranks sites by the lens, highest first, and each row opens a ward statistics page", () => {
    renderView();
    const rank = screen.getByTestId("ward-statistics-map-rank");
    const links = within(rank).getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.getAttribute("href")).toMatch(/^\/mockups\/ward-flow\/statistics\/ward\//);

    const { sites } = figuresAtAnchor();
    const values = sites.filter((site) => site.wards.length > 0).map((site) => lensValue(site, "beds"));
    const shown = links.map((link) => Number(link.querySelector("[class*='rankValue']")?.textContent));
    expect(shown).toEqual([...values].sort((a, b) => b - a));
  });

  it("the ED lens ranks EDs and opens ED statistics pages", () => {
    renderView();
    fireEvent.click(screen.getByRole("radio", { name: /^ED waits/ }));
    const rank = screen.getByTestId("ward-statistics-map-rank");
    expect(within(rank).getByRole("heading", { name: "Most waiting in ED" })).toBeTruthy();
    const links = within(rank).getAllByRole("link");
    expect(links).toHaveLength(allEmergencyDepartments().length);
    for (const link of links) expect(link.getAttribute("href")).toMatch(/^\/mockups\/ward-flow\/statistics\/ed\//);
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
    expect(hrefs).toContain("/mockups/ward-flow/statistics/ed/rph-ed");
    fireEvent.click(within(card).getByRole("button", { name: /^Close/ }));
    expect(screen.queryByTestId("ward-statistics-map-site")).toBeNull();
  });

  it("the stay lens is measured, not a preview, and every lens names its key", () => {
    renderView();
    for (const name of [/^Beds/, /^ED waits/, /^Discharge/, /^Stay/]) {
      fireEvent.click(screen.getByRole("radio", { name }));
      expect(screen.getByTestId("ward-statistics-map-view").textContent).not.toContain("Not wired in this prototype.");
      expect(screen.getByText(/^Ring: /)).toBeTruthy();
    }
  });
});
