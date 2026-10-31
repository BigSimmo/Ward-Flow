import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { BEDS_FORECAST_LIMITS } from "@/components/ward-management/capacity/beds-forecast";
import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The bed forecast's limits on Capacity. Since the redesign (31 Oct 2026) the forecast is the
 * full-width "Bed forecast" card, and its caveats open from "How this is worked out" under it. The
 * old panel's "Where beds are coming from" list was removed with it.
 */
describe("bed forecast disclosure", () => {
  it("shows the omitted arrivals, pooled bed kinds and synthetic-data limits under the chart", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
      </WardFlowProvider>,
    );

    const forecast = within(screen.getByRole("region", { name: "Bed forecast" }));
    fireEvent.click(forecast.getByText("How this is worked out"));
    expect(forecast.getByText(/^New people arriving at emergency departments are not predicted\./u)).toBeVisible();
    expect(forecast.getByText(/^Whole network, all bed kinds together\. A free bed may not suit/u)).toBeVisible();
    expect(
      forecast.getByText("Synthetic demonstration data, not live records and not validated decision support."),
    ).toBeVisible();
    for (const line of BEDS_FORECAST_LIMITS) expect(forecast.getByText(line)).toBeVisible();
  });
});
