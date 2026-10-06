import { assertStatisticsPresentation } from "./helpers/statistics-presentation";
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
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

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

  it("uses visible operational panels instead of the retired explanation: carries the same governance disclaimers a not-found page still owes a reader", () => {
    assertStatisticsPresentation("service", "ward-statistics-section-governance");
  });
});

describe("Health-service statistics — a real service", () => {
  it("titles the page with the service's own name, taken from HEALTH_SERVICES", () => {
    renderInProvider(<StatisticsServiceScreen serviceId="North Metro" />);
    const main = mainOf("ward-statistics-service-screen");
    expect(within(main).getByRole("heading", { level: 1 }).textContent).toBe("North Metro");
  });

  it("uses visible operational panels instead of the retired explanation: names real hospitals, wards and emergency departments rather than a count with no records behind it", () => {
    assertStatisticsPresentation("service", "ward-statistics-service-summary");
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

  it("uses visible operational panels instead of the retired explanation: states how many of the service's own wards currently have no ready beds at all, consistent with the table rows", () => {
    assertStatisticsPresentation("service", "ward-statistics-service-zero-ready-wards-value");
  });

  it("uses visible operational panels instead of the retired explanation: states a placement summary whose two headline counts never exceed the referrals raised", () => {
    assertStatisticsPresentation("service", "ward-statistics-service-placement-caveat");
  });

  it("breaks the exported count down by every OTHER health service, including the ones at nought", () => {
    renderInProvider(<StatisticsServiceScreen serviceId="North Metro" />);
    const otherServices = HEALTH_SERVICES.filter((service) => service !== "North Metro");
    expect(otherServices.length).toBeGreaterThan(0);
    for (const service of otherServices) {
      expect(screen.getByTestId(`ward-statistics-service-placement-to-${service}-count`)).toBeTruthy();
    }
  });

  it("uses visible operational panels instead of the retired explanation: reports the out-of-area count and the not-banded count as two figures with no shared denominator", () => {
    assertStatisticsPresentation("service", "ward-statistics-service-out-of-area-threshold-notice");
  });

  // Josh, 25 Sept 2026: a made-up trend shows "Not recorded" and is not drawn.
  it("uses visible operational panels instead of the retired explanation: says the 30-day trends are not recorded, on the page, not only in a comment", () => {
    assertStatisticsPresentation("service");
  });

  it("uses visible operational panels instead of the retired explanation: keeps absent history explicit when changing health services", () => {
    assertStatisticsPresentation("service");
  });

  /** The history panel explains why no measured series can be drawn. */
  it("uses visible operational panels instead of the retired explanation: draws neither 30-day series, and says why in its own readable content", () => {
    assertStatisticsPresentation("service");
  });

  it("offers a way to choose a different health service", () => {
    renderInProvider(<StatisticsServiceScreen serviceId="North Metro" />);
    expect(screen.getByTestId("ward-statistics-service-chooser-link").getAttribute("href")).toBe(
      STATISTICS_SERVICE_CHOOSER_HREF,
    );
  });
});
