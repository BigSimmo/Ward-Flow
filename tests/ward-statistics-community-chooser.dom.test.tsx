import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite: `ClinicalRail` renders next/link anchors, and jsdom
// cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { STATISTICS_COMMUNITY_CHOOSER_ID } from "@/components/ward-management/statistics/statistics-sections";
import { communityStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE COMMUNITY-TEAM CHOOSER ON THE STATISTICS HUB, JUDGED FROM THE RENDERED DOM.
 *
 * `tests/ward-nav.test.ts` proves the fifth dynamic route
 * (`/mockups/ward-flow/statistics/community/[teamId]`) is REFERENCED, and its own
 * `WARD_DYNAMIC_ROUTE_ORPHANS` entry records why a source-text scan can see that much and no
 * further: the chooser calls `communityStatisticsHref(team.id)` as a plain function call inside a
 * `.map()`, which is neither a concrete quoted href nor a template literal at that call site, so the
 * scan cannot tell how many of the teams the hub actually links. Only a rendered page can.
 *
 * ⚠️ **THAT ORPHAN ENTRY NAMES THIS FILE BY PATH, SO THIS FILE EXISTING IS PART OF THE CONTRACT.**
 * A comment citing a test that does not exist reads as coverage to everybody who does not check.
 *
 * ⚠️ **THE LIMIT OF THIS FILE, CARRIED FROM THE SIBLING SUITES.** jsdom applies no CSS module, so
 * nothing here can testify about `display: none`, `visibility: hidden`, zero height, or a link
 * sitting under an overlay. Only a browser journey closes that gap, and no assertion below should be
 * read as having closed it.
 */

const COMMUNITY_ROUTE_PREFIX = "/mockups/ward-flow/statistics/community";

function renderHubMain(): HTMLElement {
  // v6: the hub entry's fragment opens the "Open a unit" finder on this chooser's own tab, so
  // arrive the way a person following that href does.
  window.history.replaceState(null, "", `#${STATISTICS_COMMUNITY_CHOOSER_ID}`);
  const { container } = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsScreen />
    </WardFlowProvider>,
  );
  const main = container.querySelector<HTMLElement>("main#main-content");
  expect(main, 'the hub rendered no <main id="main-content"> to scope to').not.toBeNull();
  return main as HTMLElement;
}

/** The chooser's own team links inside the hub's main region — scoped by containment so the rail's
 *  own seeded links (a different route entirely) can never be mistaken for one of these. */
function teamLinksIn(main: HTMLElement): HTMLAnchorElement[] {
  return [...main.querySelectorAll<HTMLAnchorElement>('a[data-testid^="ward-statistics-community-link-"]')];
}

describe("The community-team chooser's OWN reachability — the fifth section's hub entry", () => {
  /**
   * The zero-match guard, first, because every assertion below iterates the rendered links: a
   * chooser that rendered nothing at all would satisfy "every link points at the right prefix" and
   * "no link is duplicated" by scanning an empty list.
   */
  it("renders a link for every team the referral form can name, and for no others", () => {
    const main = renderHubMain();
    const links = teamLinksIn(main);

    expect(COMMUNITY_TEAM_PAGES.length).toBeGreaterThan(0);
    expect(links.length).toBe(COMMUNITY_TEAM_PAGES.length);

    // Compared as SETS against the source of truth, not as a count. A count agrees with a chooser
    // that renders the right number of the wrong teams.
    const rendered = new Set(links.map((link) => link.getAttribute("href")));
    const expected = new Set(COMMUNITY_TEAM_PAGES.map((team) => communityStatisticsHref(team.id)));
    expect(rendered).toEqual(expected);
  });

  /**
   * ⚠️ **THE ASSERTION THAT WOULD HAVE CAUGHT THE DEFECT THIS WHOLE ROUTE PATTERN EXISTS FOR.**
   * A chooser linking at the OPERATIONAL team page (`/community/[teamId]`) rather than the
   * statistics one would render identically, work when clicked, and leave the statistics route
   * reachable by nothing — which is the exact state the ward statistics page shipped in.
   */
  it("links at the statistics route, never at the operational team page", () => {
    const main = renderHubMain();
    const links = teamLinksIn(main);
    expect(links.length).toBeGreaterThan(0);

    for (const link of links) {
      const href = link.getAttribute("href") ?? "";
      expect(href.startsWith(`${COMMUNITY_ROUTE_PREFIX}/`)).toBe(true);
      // Not merely "starts with something plausible": the operational route is a strict prefix
      // relationship away, so it is named and excluded rather than left to the check above.
      expect(href.startsWith("/mockups/ward-flow/community/")).toBe(false);
    }
  });

  /** Two teams sharing one href would silently hide a team behind another team's page. */
  it("gives every team a distinct address", () => {
    const main = renderHubMain();
    const hrefs = teamLinksIn(main).map((link) => link.getAttribute("href"));
    expect(hrefs.length).toBeGreaterThan(0);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  /**
   * The anchor the section's own href points at. Without the id in the DOM the hub entry lands a
   * reader at the top of the statistics page, which looks like working navigation and is not.
   */
  it("renders the chooser anchor the section href points at", () => {
    const main = renderHubMain();
    expect(main.querySelector(`#${STATISTICS_COMMUNITY_CHOOSER_ID}`)).not.toBeNull();
  });
});
