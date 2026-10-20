import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import { BedsForecastPanel } from "@/components/ward-management/capacity/beds-forecast-panel";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

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

describe("where beds are coming from", () => {
  it("lists each ward's flagged discharges by shift with who said it, and flags a ward with no update", async () => {
    const units = allUnits().slice(0, 2);
    const [first, second] = units;
    const quiet = { ...second, allocatable: { ...second.allocatable, confirmedAt: 6 * 60 } };
    const fresh = { ...first, allocatable: { ...first.allocatable, confirmedAt: NOW_ANCHOR - 30 } };
    const releases: BedRelease[] = [
      {
        id: "WR-DOM-1",
        unitId: first.id,
        admissionId: "AD-DOM-1",
        state: "expected",
        expectedAt: 14 * 60,
        waitingOn: "Awaiting ward round",
        blocker: null,
        blockedBy: null,
        preparing: false,
        preparationNote: null,
        confirmedAt: 9 * 60 + 10,
        confirmedBy: "NUM Test Unit",
      },
    ];
    render(<BedsForecastPanel forecast={bedsForecast([fresh, quiet], releases, [], [], NOW_ANCHOR)} />);

    const sources = screen.getByTestId("ward-capacity-beds-forecast-sources");
    expect(within(sources).getByTestId("ward-capacity-beds-forecast-sources-total")).toHaveTextContent(
      "1 discharge from 1 ward",
    );
    await userEvent.click(within(sources).getByText("Where beds are coming from"));
    const dayShift = within(screen.getByRole("region", { name: "Day shift to 15:00 1 discharge" }));
    expect(dayShift.getByText(first.name)).toBeVisible();
    expect(dayShift.getByText(/^14:00 · Expected · Awaiting ward round/u)).toHaveTextContent(
      "said by NUM Test Unit, 09:10",
    );
    expect(within(sources).getByTestId("ward-capacity-beds-forecast-sources-updates")).toHaveTextContent(
      "1 of 2 wards have not updated since the day shift began at 07:00.",
    );
    expect(within(sources).getByTestId("ward-capacity-beds-forecast-sources-quiet")).toHaveTextContent(
      `${second.name} (no update this shift)`,
    );
  });
});
