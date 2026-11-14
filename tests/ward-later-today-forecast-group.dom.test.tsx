import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { PlannedList } from "@/components/ward-management/coordinator/planned-list";
import type { PlannedRow } from "@/components/ward-management/coordinator/planned-model";
import { shiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import { dayOf, MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Check B6 (wave 4 pictures, 14 Nov 2026): the ED target forecast row sat first under "Rest of your
 * shift · until 15:00" at 23:46, outside the group's range and out of time order. It now sits in
 * the group its time belongs to, in time order among the rows. Synthetic rows and a stubbed
 * forecast only; the forecast's own figures are not tested here.
 */
const forecastAt = vi.hoisted(() => ({ minutesLeft: 0 }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ward-management/forecast/use-forecast-model", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/forecast/use-forecast-model")>()),
  useForecastModel: () => ({
    risk: {
      byEd: [{ edId: "synthetic-ed", atRisk: 2, firstMinutesLeft: forecastAt.minutesLeft }],
      atRisk: [{}, {}],
      targetMinutes: 24 * 60,
    },
  }),
}));

const until = shiftEndInstant(NOW_ANCHOR);
const endOfDay = (dayOf(NOW_ANCHOR) + 1) * MINUTES_PER_DAY;

const row = (id: string, at: number): PlannedRow => ({
  id,
  at,
  kind: "move",
  what: "Planned move",
  who: `Synthetic, ${id}`,
  where: "Synthetic ED to Synthetic Ward",
  later: at > until,
  past: false,
});

function show(minutesLeft: number) {
  forecastAt.minutesLeft = minutesLeft;
  const rows = [row("Shift", NOW_ANCHOR + 10), row("Evening", until + 30), row("Night", endOfDay - 5)];
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <PlannedList now={NOW_ANCHOR} title="Later today" rows={rows} />
    </WardFlowProvider>,
  );
}

const order = (group: HTMLElement) =>
  within(group)
    .getAllByRole("listitem")
    .map((item) =>
      item.dataset.kind === "forecast" ? "forecast" : item.textContent?.match(/Synthetic, ([A-Z][a-z]+)/u)?.[1],
    );

describe("Later today: the ED forecast row's group (check B6)", () => {
  it("puts a forecast after the shift's end under After your shift, in time order", () => {
    // Between the evening row and the late-night row.
    show(until + 60 - NOW_ANCHOR);
    expect(order(screen.getByTestId("home-planned-group-shift"))).toEqual(["Shift"]);
    expect(order(screen.getByTestId("home-planned-group-later"))).toEqual(["Evening", "forecast", "Night"]);
  });

  it("keeps a forecast inside the shift under Rest of your shift, in time order", () => {
    show(20);
    expect(order(screen.getByTestId("home-planned-group-shift"))).toEqual(["Shift", "forecast"]);
    expect(order(screen.getByTestId("home-planned-group-later"))).toEqual(["Evening", "Night"]);
  });
});
