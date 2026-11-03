import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => <a {...props}>{children}</a>,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/statistics",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// The Tools contact directory went with the old Tools tabs (Tools review, 15 Oct 2026). Contacts
// now reads the On-call directory, pinned in tests/ward-tools-sheet.dom.test.tsx. The old
// NetworkFigures view went with the Tools overhaul (#1316); Key figures (ward-tool-figures.tsx)
// replaced it with four headline figures and a link to Statistics.
import { ToolFigures } from "@/components/ward-management/tools/ward-tool-figures";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
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

describe("visible statistics across every main mode", () => {
  it.each(["hub", "overview", "compare", "service", "ward", "ed", "community"] as const)(
    "keeps %s panels visible without explanatory disclosures",
    (mode) => assertStatisticsPresentation(mode),
  );
});

describe("Key figures in Tools", () => {
  it("prints the same occupancy as every other page, Occupied plus Pulled, and no movement reference", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <OccupancyProbe />
        <ToolFigures onNavigate={vi.fn()} />
      </WardFlowProvider>,
    );
    const expected = screen.getByTestId("occupancy-probe").textContent;
    expect(screen.getByText("Occupancy", { selector: "dt" }).parentElement?.querySelector("dd")).toHaveTextContent(
      `${expected}%`,
    );
    expect(screen.getByTestId("ward-stats-drawer-content").textContent).not.toMatch(/WF-/u);
  });
});
