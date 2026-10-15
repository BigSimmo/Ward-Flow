import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => <a {...props}>{children}</a>,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/statistics",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// The Tools contact directory went with the old Tools tabs (Tools review, 15 Oct 2026). Contacts
// now reads the On-call directory, pinned in tests/ward-tools-sheet.dom.test.tsx.
import { NetworkFigures } from "@/components/ward-management/tools/ward-network-figures";
import { WardFlowProvider, useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { occupancyPercent, occupiedBeds } from "@/components/ward-management/statistics/statistics-occupancy";
import { assertStatisticsPresentation } from "./helpers/statistics-presentation";

function OccupancyProbe() {
  const { units, admissions, bedReleases, leaveBeds } = useWardFlow();
  return (
    <span data-testid="occupancy-probe">
      {occupancyPercent(occupiedBeds(units, admissions, [...bedReleases], leaveBeds))}
    </span>
  );
}

function AdvanceClock() {
  const { dispatch } = useWardFlow();
  const now = useWardFlowClock();
  return (
    <button onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 70 })}>
      Advance test clock
    </button>
  );
}

describe("visible statistics across every main mode", () => {
  it.each(["hub", "overview", "compare", "service", "ward", "ed", "community"] as const)(
    "keeps %s panels visible without explanatory disclosures",
    (mode) => assertStatisticsPresentation(mode),
  );
});

describe("whole-network tools figures", () => {
  it("keeps the full bed base on a ward route and narrows only the chosen figure category", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <NetworkFigures />
      </WardFlowProvider>,
    );
    const totalLabel = screen.getByText("Total beds");
    expect(totalLabel.parentElement?.querySelector("dd")).toHaveTextContent(
      String(allUnits().reduce((sum, unit) => sum + unit.beds, 0)),
    );
    fireEvent.click(screen.getByRole("button", { name: "Flow" }));
    expect(screen.queryByText("Total beds")).toBeNull();
    expect(screen.getByText("Admissions today")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "All figures" }));
    expect(screen.getByText("Total beds")).toBeVisible();
  });
  it("prints the same occupancy as every other page, Occupied plus Pulled", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OccupancyProbe />
        <NetworkFigures />
      </WardFlowProvider>,
    );
    const expected = screen.getByTestId("occupancy-probe").textContent;
    expect(screen.getByText("Occupied").parentElement?.textContent).toContain(`${expected}% occupancy`);
  });
  it("shows the longest wait as a duration with its ED, never a movement reference", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <NetworkFigures />
      </WardFlowProvider>,
    );
    const figure = screen.getByText("Longest wait").parentElement;
    expect(figure?.textContent).not.toMatch(/WF-|waiting/u);
    expect(figure?.querySelector("small")?.textContent).toMatch(/\S/u);
  });
  it("updates recorded deadline totals when the shared clock advances", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AdvanceClock />
        <NetworkFigures />
      </WardFlowProvider>,
    );
    const count = () => Number(screen.getByText("Deadline passed").parentElement?.querySelector("dd")?.textContent);
    const before = count();
    fireEvent.click(screen.getByRole("button", { name: "Advance test clock" }));
    expect(count()).toBeGreaterThan(before);
  });
});
