import { assertStatisticsPresentation } from "./helpers/statistics-presentation";

import type { ReactNode } from "react";
import { describe, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/**
 * The ED statistics page shows no typed figures.
 *
 * Until 25 Sept 2026 it drew typed triage-category waits against benchmarks, a made-up 24-hour
 * arrivals curve, a made-up 30-day WEAT history with KPIs computed from it, and a "3h 42m" median
 * length of stay. Josh's ruling that day: a figure comes from the record, says "Not recorded", or is
 * a labelled target (the 4-hour ED target stays, labelled).
 */

describe("ED statistics: no typed figures", () => {
  it("uses visible operational panels instead of the retired explanation: says the triage-category waits, hourly pattern and WEAT history are not recorded", () => {
    assertStatisticsPresentation("ed", "ward-statistics-ed-urgency-not-recorded");
  });
});
