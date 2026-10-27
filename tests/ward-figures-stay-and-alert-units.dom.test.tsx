import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ForecastAlert } from "@/components/ward-management/forecast/forecast-alerts";
import type { Instant } from "@/components/ward-management/ward-clock";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const alerts: ForecastAlert[] = [
  { kind: "kind_short", id: "open_adult", likely: -3, low: -5, threshold: 3 },
  { kind: "ed_access_risk", edId: "ed-1", people: 2, firstMinutesLeft: 90, alreadyOver: 0, threshold: 240 },
  { kind: "forecast_worse", from: -1, to: -4, since: 600 as Instant, threshold: 1 },
];

vi.mock("@/components/ward-management/forecast/use-forecast-model", () => ({
  useForecastAlerts: () => alerts,
  forecastEdName: () => "Synthetic ED",
}));

import { ForecastAlertsGroup } from "@/components/ward-management/forecast/forecast-alerts-group";

/**
 * W-10 (fresh audit 26 Oct 2026): the three forecast alerts read "Your line is 3 short", "4 hours
 * ahead" and "3 beds", a different unit each time. Each alert line now names its own unit: beds for
 * the two bed lines, hours before the target for the ED line. Synthetic values only.
 */
describe("forecast alert lines name their unit (W-10)", () => {
  it("says beds, hours or beds on each line", () => {
    render(<ForecastAlertsGroup now={720 as Instant} head={(count) => <h2>{count} forecast alerts</h2>} />);
    expect(screen.getByTestId("ward-alerts-forecast-short-open_adult")).toHaveTextContent(
      "Alert set at 3 beds or more short (Settings).",
    );
    expect(screen.getByTestId("ward-alerts-forecast-ed-ed-1")).toHaveTextContent(
      "Alert set at 4 hours before the target (Settings).",
    );
    expect(screen.getByTestId("ward-alerts-forecast-worse")).toHaveTextContent(
      "Alert set at a drop of 1 bed or more (Settings).",
    );
  });
});
