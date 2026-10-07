import { assertStatisticsPresentation } from "./helpers/statistics-presentation";
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

import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { STATISTICS_SERVICE_CHOOSER_ID } from "@/components/ward-management/statistics/statistics-sections";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE HEALTH-SERVICE CHOOSER ON THE STATISTICS HUB, JUDGED FROM THE RENDERED DOM.
 *
 * `tests/ward-nav.test.ts` proves the fourth dynamic route (`/mockups/ward-flow/statistics/service/
 * [serviceId]`) is REFERENCED — its own `WARD_DYNAMIC_ROUTE_ORPHANS` entry records why a source-text
 * scan can see that much and no further: the chooser below calls `serviceStatisticsHref(service)` as
 * a plain function call inside a `.map()`, which is neither a concrete quoted href nor a template
 * literal at that call site, so the scan cannot tell how many of the five services the hub actually
 * links. Only a rendered page can. This file is that proof, matching the same pattern
 * `tests/ward-community-index.dom.test.tsx` and the ward index's own DOM suite already establish for
 * their own dynamic routes.
 *
 * ⚠️ **THE LIMIT OF THIS FILE, CARRIED FROM THOSE SAME SUITES.** jsdom applies no CSS module, so
 * nothing here can testify about `display: none`, `visibility: hidden`, zero height, or a link
 * sitting under an overlay. Only a browser journey closes that gap, and no assertion below should be
 * read as having closed it.
 */

const SERVICE_ROUTE_PREFIX = "/mockups/ward-flow/statistics/service";

function renderHubMain(): HTMLElement {
  const { container } = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsScreen />
    </WardFlowProvider>,
  );
  const main = container.querySelector<HTMLElement>("main#main-content");
  expect(main, 'the hub rendered no <main id="main-content"> to scope to').not.toBeNull();
  return main as HTMLElement;
}

/** The chooser's own service links inside the hub's main region — scoped by containment so the
 *  rail's own seeded links (a different route entirely) can never be mistaken for one of these. */
function serviceLinksIn(main: HTMLElement): HTMLAnchorElement[] {
  return [...main.querySelectorAll<HTMLAnchorElement>('a[data-testid^="ward-statistics-service-link-"]')];
}

describe("The health-service chooser's OWN reachability — the fourth section's own hub entry", () => {
  /**
   * The fourth `STATISTICS_SECTIONS` entry (id "service") points at
   * `STATISTICS_SERVICE_CHOOSER_HREF`, a fragment on this same hub page. This is the anchor that
   * fragment names, so a rename of the chooser's id without moving the hub entry's href would leave
   * the index pointing at nothing — the exact defect class `tests/ward-community-index.dom.test.tsx`
   * guards for the community index's own rail entry.
   */
  it("mounts the chooser at the id the fourth hub entry's href points to", () => {
    const main = renderHubMain();
    const anchored = main.querySelector(`#${STATISTICS_SERVICE_CHOOSER_ID}`);
    expect(anchored, `no element with id="${STATISTICS_SERVICE_CHOOSER_ID}" in the hub's main region`).not.toBeNull();
  });

  it("uses visible operational panels instead of the retired explanation: links every entry in HEALTH_SERVICES from the hub's own index above the chooser", () => {
    assertStatisticsPresentation("service");
  });
});

describe("Health-service chooser — the links a person can actually reach", () => {
  it("links exactly the five HEALTH_SERVICES, once each, with every segment decoding back to its name", () => {
    const anchors = serviceLinksIn(renderHubMain());
    expect(anchors.length, "the chooser rendered no service links at all").toBeGreaterThan(0);

    const names = anchors.map((anchor) => {
      const href = anchor.getAttribute("href") ?? "";
      expect(href.startsWith(`${SERVICE_ROUTE_PREFIX}/`), `"${href}" is not a health-service statistics route`).toBe(
        true,
      );
      return decodeURIComponent(href.slice(SERVICE_ROUTE_PREFIX.length + 1));
    });

    // Floored rather than pinned to today's exact five: `HEALTH_SERVICES` is the vocabulary this
    // file must track, never a literal copied from it, so a member added or renamed there fails
    // this assertion for the right reason instead of being silently missed.
    expect(
      HEALTH_SERVICES.length,
      "HEALTH_SERVICES is empty — nothing below this line proves anything",
    ).toBeGreaterThan(1);
    expect(names.length, "the chooser did not render exactly one link per health service").toBe(HEALTH_SERVICES.length);
    expect(new Set(names).size, "a health service is linked more than once").toBe(names.length);
    expect([...names].sort()).toEqual([...HEALTH_SERVICES].sort());
  });

  it("renders no link inside a hidden, aria-hidden, inert or collapsed ancestor", () => {
    const anchors = serviceLinksIn(renderHubMain());
    expect(anchors.length, "the chooser rendered no service links at all").toBeGreaterThan(0);

    // Every one of these keeps a link in the DOM and takes it away from a person, so a markup scan
    // reports full coverage while the page delivers none of it — the same check the community and
    // ward indexes run over their own links.
    for (const anchor of anchors) {
      for (let node: HTMLElement | null = anchor; node !== null; node = node.parentElement) {
        expect(node.hasAttribute("hidden"), `a link sits inside a hidden ${node.tagName}`).toBe(false);
        expect(node.getAttribute("aria-hidden"), `a link sits inside an aria-hidden ${node.tagName}`).not.toBe("true");
        expect(node.hasAttribute("inert"), `a link sits inside an inert ${node.tagName}`).toBe(false);
        if (node.tagName === "DETAILS") {
          expect(node.hasAttribute("open"), "a link sits inside a closed <details>").toBe(true);
        }
      }
    }
  });

  it("keeps service selection free of redundant explanatory prose", () => {
    const main = renderHubMain();
    const rationale = main.querySelector('[data-testid="ward-statistics-service-chooser-rationale"]');
    expect(rationale).toBeNull();
    expect(main.querySelectorAll('[data-testid^="ward-statistics-service-link-"]')).toHaveLength(
      HEALTH_SERVICES.length,
    );
  });
});
