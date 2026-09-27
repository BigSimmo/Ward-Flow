import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsEdScreen } from "@/components/ward-management/statistics/statistics-ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

/**
 * The ED statistics page shows no typed figures.
 *
 * Until 25 Sept 2026 it drew typed triage-category waits against benchmarks, a made-up 24-hour
 * arrivals curve, a made-up 30-day WEAT history with KPIs computed from it, and a "3h 42m" median
 * length of stay. Josh's ruling that day: a figure comes from the record, says "Not recorded", or is
 * a labelled target (the 4-hour ED target stays, labelled).
 */
const DEPARTMENT = allEmergencyDepartments()[0];

describe("ED statistics: no typed figures", () => {
  it("says the triage-category waits, hourly pattern and WEAT history are not recorded", () => {
    const { container } = render(
      <WardFlowProvider>
        <StatisticsEdScreen edId={DEPARTMENT!.id} />
      </WardFlowProvider>,
    );

    for (const testId of [
      "ward-statistics-ed-urgency-not-recorded",
      "ward-statistics-ed-diurnal-not-recorded",
      "ward-statistics-ed-weat-not-recorded",
    ]) {
      expect(screen.getByTestId(testId).textContent, testId).toContain("not recorded in Ward Flow");
    }
    const text = container.textContent ?? "";
    // The caption once read a typed "4-hour target"; it now names the configured ED access target
    // (edAccessTargetMinutes, 24 hours by default), per the 26 September figures clean-up.
    expect(text).toContain("Access target as configured: 24 hours");
    expect(text).not.toContain("4-hour target");
    expect(text, "the typed median length of stay").not.toContain("3h 42m");
  });
});
