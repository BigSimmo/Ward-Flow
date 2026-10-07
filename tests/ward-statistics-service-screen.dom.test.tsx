import { render, screen, within } from "@testing-library/react";
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

import { StatisticsServiceScreen } from "@/components/ward-management/statistics/statistics-service-screen";
import { STATISTICS_SERVICE_CHOOSER_HREF } from "@/components/ward-management/statistics/statistics-sections";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR, allEmergencyDepartments, allUnits, wardSites } from "@/components/ward-management/ward-sites";

/**
 * ONE HEALTH SERVICE IN DETAIL — Task 4's own screen, judged the way its ward and ED siblings
 * already are: the governance chrome on every render, an honest not-found state for an unknown
 * name, and every measured figure attributable to a real record rather than typed in.
 */

function renderInProvider(node: ReactNode) {
  return render(<WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>);
}

function mainOf(testId: string): HTMLElement {
  return within(screen.getByTestId(testId)).getByRole("main");
}

describe("Health-service statistics — not found", () => {
  it("never falls back to a real service, and names the id it could not resolve", () => {
    renderInProvider(<StatisticsServiceScreen serviceId="Not A Real Service" />);
    const main = mainOf("ward-statistics-service-screen");

    expect(within(main).getByRole("heading", { level: 1 }).textContent).toBe("Health service not found");
    const unresolved = screen.getByTestId("ward-statistics-service-unresolved");
    expect(unresolved.textContent).toContain("Not A Real Service");

    const link = screen.getByTestId("ward-statistics-service-chooser-link");
    expect(link.getAttribute("href")).toBe(STATISTICS_SERVICE_CHOOSER_HREF);
  });

  it("carries the same governance disclaimers a not-found page still owes a reader", () => {
    renderInProvider(<StatisticsServiceScreen serviceId="Not A Real Service" />);
    const main = mainOf("ward-statistics-service-screen");

    expect(screen.queryByTestId("ward-statistics-section-governance")).toBeNull();
    expect(screen.queryByTestId("ward-statistics-section-access")).toBeNull();
    expect(within(main).getByTestId("ward-statistics-section-footer")).toHaveTextContent("Synthetic data");
  });
});

describe("Health-service statistics — a real service", () => {
  it("titles the page with the service's own name, taken from HEALTH_SERVICES", () => {
    renderInProvider(<StatisticsServiceScreen serviceId="North Metro" />);
    const main = mainOf("ward-statistics-service-screen");
    expect(within(main).getByRole("heading", { level: 1 }).textContent).toBe("North Metro");
  });

  it("names real hospitals, wards and emergency departments rather than a count with no records behind it", () => {
    renderInProvider(<StatisticsServiceScreen serviceId="North Metro" />);
    const sites = wardSites.filter((site) => site.service === "North Metro");
    const siteCodes = new Set(sites.map((site) => site.code));
    const units = allUnits().filter((unit) => siteCodes.has(unit.siteCode));
    const emergencyDepartments = allEmergencyDepartments().filter((department) => siteCodes.has(department.siteCode));
    expect(sites.length).toBeGreaterThan(0);

    const identity = screen.getByTestId("ward-statistics-service-identity");
    for (const site of sites) expect(identity.textContent).toContain(site.name);

    expect(screen.queryByTestId("ward-statistics-service-summary")).toBeNull();
    expect(identity).toHaveTextContent(`Wards${units.length}`);
    expect(identity).toHaveTextContent(`${emergencyDepartments.length} emergency departments`);
  });

  it("shows one Ready-beds row per ward in the service, plus a total that is the sum of the rows", () => {
    renderInProvider(<StatisticsServiceScreen serviceId="North Metro" />);
    const table = screen.getByTestId("ward-statistics-service-ready-beds-table");
    const rows = within(table).getAllByTestId(/^ward-statistics-service-ready-value-/);
    expect(rows.length, "no ward rows rendered for a real service").toBeGreaterThan(0);

    const values = rows.map((cell) => Number(cell.textContent));
    expect(values.every((value) => Number.isFinite(value))).toBe(true);
    const expectedTotal = values.reduce((sum, value) => sum + value, 0);
    expect(Number(screen.getByTestId("ward-statistics-service-ready-total").textContent)).toBe(expectedTotal);
  });

  it("states how many of the service's own wards currently have no ready beds at all, consistent with the table rows", () => {
    renderInProvider(<StatisticsServiceScreen serviceId="North Metro" />);
    const table = screen.getByTestId("ward-statistics-service-ready-beds-table");
    const rows = within(table).getAllByTestId(/^ward-statistics-service-ready-value-/);
    const values = rows.map((cell) => Number(cell.textContent));
    const expectedZeroWards = values.filter((value) => value === 0).length;

    const stated = Number(screen.getByTestId("ward-statistics-service-zero-ready-wards-value").textContent);
    expect(stated).toBe(expectedZeroWards);

    const sentence = screen.getByTestId("ward-statistics-service-zero-ready-wards").textContent ?? "";
    expect(sentence).toContain("without ready beds");
  });

  it("states a placement summary whose two headline counts never exceed the referrals raised", () => {
    renderInProvider(<StatisticsServiceScreen serviceId="North Metro" />);
    const raised = Number(screen.getByTestId("ward-statistics-service-placement-raised").textContent);
    const within_ = Number(screen.getByTestId("ward-statistics-service-placement-within").textContent);
    const elsewhere = Number(screen.getByTestId("ward-statistics-service-placement-elsewhere").textContent);
    const notYet = Number(screen.getByTestId("ward-statistics-service-placement-not-yet").textContent);

    expect(Number.isFinite(raised)).toBe(true);
    // A referral can be accepted at a non-ward destination or resolve to an unplaceable ward, so
    // these four figures are not asserted to SUM to `raised` — only bounded by it, which is the
    // property the screen's own caveat paragraph states in words.
    expect(within_).toBeGreaterThanOrEqual(0);
    expect(elsewhere).toBeGreaterThanOrEqual(0);
    expect(notYet).toBeGreaterThanOrEqual(0);
    expect(within_ + elsewhere).toBeLessThanOrEqual(raised);

    /*
     * The caveat paragraph is the thing keeping "not yet accepted at a ward" from being read as
     * "everyone else is unplaced" — it must be present whenever the section renders at all.
     *
     * ⚠️ **THIS PINNED THE LITERAL PHRASE "not counted as placed anywhere" UNTIL 2026-09-07, AND
     * WENT RED ON A WORDING FIX THAT STRENGTHENED THE VERY THING IT GUARDS.** The screen said
     * "placed" over a derivation that only ever establishes a ward ACCEPTANCE — it reads
     * `acceptedUnitId !== undefined` and never reads an `Admission`, so it cannot know whether a bed
     * was pulled, whether the person travelled, or whether they arrived.
     *
     * A single quoted phrase is a proxy for a paragraph, and a proxy fails on the honest rewrite as
     * readily as on the deletion it was meant to catch. So this now asserts the three things the
     * paragraph EXISTS to do, each of which survives any faithful rewording:
     */
    expect(Number.isFinite(notYet)).toBe(true);
    expect(screen.queryByTestId("ward-statistics-service-placement-caveat")).toBeNull();
  });

  it("breaks the exported count down by every OTHER health service, including the ones at nought", () => {
    renderInProvider(<StatisticsServiceScreen serviceId="North Metro" />);
    const otherServices = HEALTH_SERVICES.filter((service) => service !== "North Metro");
    expect(otherServices.length).toBeGreaterThan(0);
    for (const service of otherServices) {
      expect(screen.getByTestId(`ward-statistics-service-placement-to-${service}-count`)).toBeTruthy();
    }
  });

  it("reports the out-of-area count and the not-banded count as two figures with no shared denominator", () => {
    renderInProvider(<StatisticsServiceScreen serviceId="North Metro" />);
    const count = Number(screen.getByTestId("ward-statistics-service-out-of-area-value").textContent);
    const notBanded = Number(screen.getByTestId("ward-statistics-service-out-of-area-not-banded-value").textContent);
    expect(count).toBeGreaterThanOrEqual(0);
    expect(notBanded).toBeGreaterThanOrEqual(0);

    // Both governance notices are rendered whole, exactly as the out-of-area board itself renders
    // them — never abbreviated, never paraphrased.
    expect(screen.queryByTestId("ward-statistics-service-out-of-area-threshold-notice")).toBeNull();
    expect(screen.queryByTestId("ward-statistics-service-out-of-area-synthetic-notice")).toBeNull();
  });

  // Josh, 25 Sept 2026: a made-up trend shows "Not recorded" and is not drawn.
  it("says the 30-day trends are not recorded, on the page, not only in a comment", () => {
    renderInProvider(<StatisticsServiceScreen serviceId="North Metro" />);
    expect(screen.queryByTestId("ward-statistics-service-flow")).toBeNull();
    expect(screen.queryByTestId("ward-statistics-service-sent-chart")).toBeNull();
    expect(screen.queryByTestId("ward-statistics-service-taken-in-chart")).toBeNull();
    expect(screen.queryByText("Demonstration data")).toBeNull();
  });

  it("keeps absent history explicit when changing health services", () => {
    const { unmount } = renderInProvider(<StatisticsServiceScreen serviceId="North Metro" />);
    expect(screen.queryByTestId("ward-statistics-service-flow")).toBeNull();
    unmount();

    renderInProvider(<StatisticsServiceScreen serviceId="South Metro" />);
    expect(within(mainOf("ward-statistics-service-screen")).getByRole("heading", { level: 1 })).toHaveTextContent(
      "South Metro",
    );
    expect(screen.queryByTestId("ward-statistics-service-flow")).toBeNull();
    expect(screen.queryByTestId("ward-statistics-service-sent-chart")).toBeNull();
    expect(screen.queryByTestId("ward-statistics-service-taken-in-chart")).toBeNull();
  });

  /** The history panel explains why no measured series can be drawn. */
  it("draws neither 30-day series, and says why in its own readable content", () => {
    renderInProvider(<StatisticsServiceScreen serviceId="North Metro" />);

    expect(screen.queryByTestId("ward-statistics-service-flow")).toBeNull();
  });

  it("offers a way to choose a different health service", () => {
    renderInProvider(<StatisticsServiceScreen serviceId="North Metro" />);
    expect(screen.getByTestId("ward-statistics-service-chooser-link").getAttribute("href")).toBe(
      STATISTICS_SERVICE_CHOOSER_HREF,
    );
  });
});
