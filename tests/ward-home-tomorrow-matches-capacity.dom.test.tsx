import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import { gapRangeWord } from "@/components/ward-management/capacity/capacity-gap-words";
import { BedsGapCard } from "@/components/ward-management/coordinator/beds-gap-card";
import { forecastTotalsByKind } from "@/components/ward-management/forecast/forecast-by-kind";
import { WardFlowProvider, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * FM-8 (D-191 item 6, PR C): Home's "Beds that fit" Tomorrow figure is Capacity's Tomorrow figure.
 * Both add each bed type's shortfall (`forecastTotalsByKind`), so a spare bed of one type never
 * nets off another type's shortfall on either page. Synthetic seed only.
 */
function CapacityTomorrow() {
  const { units, bedReleases, admissions, movements, plannedAdmissions, referrals } = useWardFlowSelect(
    "units",
    "bedReleases",
    "admissions",
    "movements",
    "plannedAdmissions",
    "referrals",
  );
  const planned = plannedAdmissions ?? [];
  const forecast = bedsForecast(
    units,
    bedReleases,
    admissions,
    movements,
    NOW_ANCHOR,
    planned,
    referrals,
    forecastTotalsByKind(units, bedReleases, admissions, movements, NOW_ANCHOR, planned, referrals),
  );
  const tomorrow = forecast.horizons[0]!;
  return (
    <output data-testid="capacity-tomorrow">
      {[tomorrow.low, tomorrow.likely, tomorrow.high].map((value) => gapRangeWord(value)).join("|")}
    </output>
  );
}

describe("FM-8: Home's Tomorrow matches Capacity's", () => {
  it("shows Capacity's likely figure and range for tomorrow", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BedsGapCard now={NOW_ANCHOR} bedsReady={0} condensed={false} />
        <CapacityTomorrow />
      </WardFlowProvider>,
    );
    const [low, likely, high] = screen.getByTestId("capacity-tomorrow").textContent!.split("|");
    const card = screen.getByTestId("home-beds-fit").textContent!.replace(/\s+/gu, " ");
    // The separator is the design's punctuation ("·" before PR E, "," after); the figures are the point.
    expect(card).toMatch(new RegExp(`Tomorrow ${likely}\\s*[·,]\\s*range ${low} to ${high}`, "u"));
  });
});
