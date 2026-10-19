import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import { BedsForecastPanel } from "@/components/ward-management/capacity/beds-forecast-panel";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("bed forecast disclosure", () => {
  it("shows the omitted arrivals, pooled bed kinds and synthetic-data limits beside the chart", () => {
    render(<BedsForecastPanel forecast={bedsForecast([], [], [], [], NOW_ANCHOR)} />);

    const forecast = within(screen.getByRole("region", { name: "Next 48 hours forecast" }));
    expect(forecast.getByText(/^New people arriving at emergency departments are not predicted\./u)).toBeVisible();
    expect(forecast.getByText(/^Whole network, all bed kinds together\. A free bed may not suit/u)).toBeVisible();
    expect(
      forecast.getByText("Synthetic demonstration data, not live records and not validated decision support."),
    ).toBeVisible();
  });
});
