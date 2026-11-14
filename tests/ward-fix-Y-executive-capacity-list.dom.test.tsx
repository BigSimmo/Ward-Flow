import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/ward-flow/capacity",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import { ExecutiveCapacityScreen } from "@/components/ward-management/capacity/capacity-executive-screen";
import { ExecutiveStatisticsProvider } from "@/components/ward-management/statistics/executive-statistics-context";
import { projectExecutiveReportingFoundation } from "@/components/ward-management/statistics/executive-statistics-projector";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * F-51 (C01, design critique v2, Josh 13 Nov 2026): the Executive desk's Capacity table listed every
 * ward in one long table. The kit's list rule is eight rows, then Show more (DESIGN-SYSTEM.md). The
 * totals row still adds up every ward. Synthetic seed only.
 */
afterEach(() => cleanup());

function show() {
  const state = seedWardFlowState();
  const data = projectExecutiveReportingFoundation(
    state,
    { role: "executive", scope: { kind: "statewide" } },
    {
      now: NOW_ANCHOR,
      dayZero: "2026-09-22T16:00:00.000Z",
      startedAt: "2026-10-23T02:42:00.000Z",
      places: wardPlaceLookup(state.units),
    },
  );
  const binding = { actorId: "synthetic-report-reader", accessContext: "a".repeat(64), epoch: 1, revision: 1 };
  render(
    <ExecutiveStatisticsProvider
      binding={binding}
      snapshot={{ binding, receivedAt: 100, expiresAt: 200, data: structuredClone(data) }}
      now={150}
      controls={{ executive: true, paused: false, togglePause: null }}
    >
      <ExecutiveCapacityScreen />
    </ExecutiveStatisticsProvider>,
  );
  return data.network.wards.length;
}

describe("F-51: executive Capacity follows the kit's list rule", () => {
  it("shows eight wards, then Show more, then Show fewer; the total counts every ward", () => {
    const wards = show();
    expect(wards, "the seed network has more than nine wards").toBeGreaterThan(9);
    const table = screen.getByRole("table", { name: /Beds by ward/u });
    // Wave 4 (C7, PR F): the rows are grouped by service, one body per service; count ward rows.
    const bodyRows = () => table.querySelectorAll('tbody th[scope="row"]').length;
    expect(bodyRows()).toBe(8);
    expect(screen.getByTestId("ward-capacity-executive-total")).toHaveTextContent(`All ${wards} wards`);
    const more = screen.getByRole("button", { name: `Show ${wards - 8} more` });
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    expect(bodyRows()).toBe(wards);
    fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(bodyRows()).toBe(8);
  });
});
