import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { StatisticsMapView } from "@/components/ward-management/statistics/statistics-map-view";
import { StatisticsNav } from "@/components/ward-management/statistics/statistics-nav";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import {
  STATISTICS_COMPARE_HREF,
  STATISTICS_EDS_HREF,
  STATISTICS_SERVICES_HREF,
  STATISTICS_TEAMS_HREF,
} from "@/components/ward-management/statistics/statistics-sections";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

/**
 * Access audit (31 Oct 2026): the Statistics page offers each desk only the links its access opens.
 * The site bed manager had Compare, Services, EDs and Teams links it could not open. Synthetic data only.
 */

const UNOPENABLE_FOR_SITE = [
  STATISTICS_COMPARE_HREF,
  STATISTICS_SERVICES_HREF,
  STATISTICS_EDS_HREF,
  STATISTICS_TEAMS_HREF,
];
// A site with wards and an ED, so the map offers both.
const siteCode = "RPH";
const ownWardHrefs = new Set(
  allUnits()
    .filter((unit) => unit.siteCode === siteCode)
    .map((unit) => `/ward-flow/statistics/ward/${encodeURIComponent(unit.id)}`),
);

const DESKS: Record<string, WardAccess> = {
  coordinator: { role: "coordinator", scope: { kind: "statewide" } },
  bedManager: { role: "bed_manager", scope: { kind: "site", siteCode } },
  executive: { role: "executive", scope: { kind: "statewide" } },
  ward: { role: "ward", scope: { kind: "ward", unitIds: [allUnits()[0]!.id] } },
  ed: { role: "ed", scope: { kind: "ed", edId: "fsh-ed" } },
  community: { role: "community", scope: { kind: "team", teamName: "Albany" } },
};

function asDesk(access: WardAccess) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(access);
  });
}

function withShell(children: ReactNode) {
  return render(<WardFlowProvider initialNow={NOW_ANCHOR}>{children}</WardFlowProvider>);
}

const hrefs = (root: HTMLElement) =>
  within(root)
    .queryAllByRole("link")
    .map((link) => link.getAttribute("href") ?? "");

// Each chip's own words, without the count beside it.
const navLabels = () => {
  const nav = screen.queryByTestId("ward-statistics-nav");
  return nav
    ? within(nav)
        .getAllByRole("link")
        .map((link) => link.firstChild?.textContent)
    : [];
};

beforeAll(() => {
  // The ED wait field under the ED lens measures its card; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

/** Every href the map shows across its Beds and ED lenses, with the desk's own site chosen. */
function mapHrefs() {
  withShell(<StatisticsMapView />);
  const view = () => screen.getByTestId("ward-statistics-map-site").closest("section") ?? document.body;
  const node = screen
    .getByTestId("ward-statistics-wa-map-wide")
    .querySelector<SVGGElement>(`[data-site="${siteCode}"]`);
  fireEvent.click(node!);
  const beds = hrefs(view());
  fireEvent.click(screen.getByRole("radio", { name: /^Open ED journeys/ }));
  return [...beds, ...hrefs(view())];
}

afterEach(() => {
  cleanup();
  act(() => resetWardAccessStoreForTests());
  window.history.replaceState(null, "", "/");
});

describe("Statistics links follow the desk's access", () => {
  it("offers the site bed manager none of Compare, Services, EDs or Teams, nor an ED or service page", () => {
    asDesk(DESKS.bedManager!);
    withShell(<StatisticsScreen />);
    const page = screen.getByTestId("ward-statistics-screen");
    const shown = hrefs(page);
    for (const href of UNOPENABLE_FOR_SITE) expect(shown).not.toContain(href);
    expect(shown.filter((href) => /\/statistics\/(ed|service)\//.test(href))).toEqual([]);
    expect(within(page).queryByRole("link", { name: "Compare wards" })).toBeNull();
  });

  it("still offers the coordinator Compare, Services, EDs and Teams", () => {
    asDesk(DESKS.coordinator!);
    withShell(<StatisticsScreen />);
    const shown = hrefs(screen.getByTestId("ward-statistics-screen"));
    for (const href of UNOPENABLE_FOR_SITE) expect(shown).toContain(href);
  });

  it("links the site bed manager's map only to its own site's wards", () => {
    asDesk(DESKS.bedManager!);
    const shown = mapHrefs();
    expect(shown.filter((href) => /\/statistics\/(ed|service)\//.test(href))).toEqual([]);
    const wards = shown.filter((href) => href.includes("/statistics/ward/"));
    expect(wards.length).toBeGreaterThan(0);
    expect(wards.filter((href) => !ownWardHrefs.has(href))).toEqual([]);
  });

  it("still links the coordinator's map to ED and service pages", () => {
    asDesk(DESKS.coordinator!);
    const shown = mapHrefs();
    expect(shown.some((href) => href.includes("/statistics/service/"))).toBe(true);
    expect(shown).toContain(`/ward-flow/statistics/ed/${siteCode.toLowerCase()}-ed`);
  });

  it("gives each desk the section tabs it saw before", () => {
    const seen = Object.fromEntries(
      Object.entries(DESKS).map(([name, access]) => {
        asDesk(access);
        withShell(<StatisticsNav withSamples={false} variant="chips" />);
        const labels = navLabels();
        cleanup();
        return [name, labels];
      }),
    );
    const every = ["Network", "Compare", "Services", "Wards", "EDs", "Teams", "Weekly"];
    expect(seen).toEqual({
      coordinator: every,
      bedManager: ["Site", "Wards", "Weekly"],
      executive: every,
      // D-80: a ward, ED or team desk opens only its own place's page, so it gets no section row.
      ward: [],
      ed: [],
      community: [],
    });
  });
});
