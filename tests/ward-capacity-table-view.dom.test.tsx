import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { bedMapCards, bedMapRegion } from "./helpers/capacity-ward-table";

/**
 * The Capacity bed map, one line per ward. The October 2026 redesign (Josh, 31 Oct 2026) removed
 * the bed map's Table layout and its shared `WardCapacityRow` (every ward as a table lives on All
 * wards now). Its Rows layout is the same map one line per ward, so this file pins what the Table
 * view used to promise, on Rows: every ward appears once, a highlight dims the other wards and
 * hides none, and pressing a ward opens that ward.
 *
 * Expected figures come from `networkWardRows` over the seeded state the provider starts from.
 */
const seeded = seedWardFlowState();
const rows = networkWardRows(seeded.units, NOW_ANCHOR, seeded.bedReleases, seeded.admissions, seeded.leaveBeds);

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CapacityScreen />
    </WardFlowProvider>,
  );
}

function showRows() {
  const layouts = within(bedMapRegion()).getByRole("radiogroup", { name: "Bed map layout" });
  fireEvent.click(within(layouts).getByRole("radio", { name: "Rows" }));
  return layouts;
}

afterEach(() => {
  window.sessionStorage.clear();
});

describe("Capacity bed map, Rows layout", () => {
  it("switches to Rows from the layout control and keeps exactly one entry per ward", () => {
    renderScreen();
    expect(bedMapCards()).toHaveLength(rows.length);
    const layouts = showRows();
    expect(within(layouts).getByRole("radio", { name: "Rows" })).toHaveAttribute("aria-checked", "true");
    expect(within(layouts).getByRole("radio", { name: "Grid" })).toHaveAttribute("aria-checked", "false");
    const cards = bedMapCards();
    expect(cards).toHaveLength(rows.length);
    for (const card of cards) expect(card.className).toMatch(/wardRow/u);
  });

  it("dims every ward outside a highlight in Rows, and keeps them all on screen", () => {
    renderScreen();
    showRows();
    const withReady = rows.filter((row) => row.ready > 0).length;
    expect(withReady, "no ward has a ready bed — the highlight proves nothing").toBeGreaterThan(0);
    expect(withReady, "every ward has a ready bed — nothing would be dimmed").toBeLessThan(rows.length);
    fireEvent.click(
      within(bedMapRegion()).getByRole("button", {
        name: `Any ready · ${withReady} ${withReady === 1 ? "ward" : "wards"}`,
      }),
    );
    const cards = bedMapCards();
    expect(cards).toHaveLength(rows.length);
    expect(cards.filter((card) => /dimmed/u.test(card.className))).toHaveLength(rows.length - withReady);
  });

  it("opens a ward's drawer from its row", () => {
    renderScreen();
    showRows();
    const [first] = bedMapCards();
    expect(first, "the bed map drew no ward").toBeDefined();
    fireEvent.click(first!);
    expect(screen.getByTestId("ward-capacity-ward-drawer")).toBeInTheDocument();
    expect(first).toHaveAttribute("data-selected");
  });
});
