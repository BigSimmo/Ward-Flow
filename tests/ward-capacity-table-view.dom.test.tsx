import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { BedMap, bedMapWards } from "@/components/ward-management/capacity/bed-map";
import { bedReleases } from "@/components/ward-management/ward-movements";
import { allUnits } from "@/components/ward-management/ward-sites";

/**
 * v10 Capacity (pass 3): the bed map's Table view is one shared `WardCapacityRow` per ward. A ward
 * with a ready bed takes the one fit tint, a highlight dims the other wards by colour in every
 * layout and hides none, and pressing a row opens that ward.
 */
const units = allUnits();

describe("Capacity bed map, Table view", () => {
  it("draws one shared capacity row per ward, tinting only wards with a ready bed", () => {
    render(<BedMap units={units} bedReleases={bedReleases} initialLayout="table" />);
    const rows = screen.getAllByTestId("wf-ward-capacity-row");
    expect(rows).toHaveLength(units.length);

    const wards = bedMapWards(units, bedReleases);
    const withReady = wards.filter((ward) => ward.ready > 0).length;
    expect(withReady).toBeGreaterThan(0);
    expect(rows.filter((row) => row.getAttribute("data-fit") === "true")).toHaveLength(withReady);
  });

  it("switches to Table from the layout control and opens a ward from its row", () => {
    const onSelectWard = vi.fn();
    render(<BedMap units={units} bedReleases={bedReleases} onSelectWard={onSelectWard} />);
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    expect(screen.getByRole("button", { name: "Table" })).toHaveAttribute("aria-pressed", "true");

    const first = units[0]!;
    fireEvent.click(screen.getByRole("button", { name: `Open ${first.name}` }));
    expect(onSelectWard).toHaveBeenCalledWith(first.id);
  });

  it("dims every ward outside a highlight, by attribute, and keeps them all on screen", () => {
    const keep = new Set([units[0]!.id, units[1]!.id]);
    const { unmount } = render(
      <BedMap units={units} bedReleases={bedReleases} initialLayout="table" highlightUnitIds={keep} />,
    );
    const rows = screen.getAllByTestId("wf-ward-capacity-row");
    expect(rows).toHaveLength(units.length);
    expect(rows.filter((row) => row.getAttribute("data-dim") === "true")).toHaveLength(units.length - keep.size);
    unmount();

    // The card layouts dim the same wards.
    render(<BedMap units={units} bedReleases={bedReleases} initialLayout="grid" highlightUnitIds={keep} />);
    for (const unit of units) {
      const card = screen.getByTestId(`ward-bed-map-ward-${unit.id}`);
      if (keep.has(unit.id)) expect(card).not.toHaveAttribute("data-dim");
      else expect(card).toHaveAttribute("data-dim", "true");
    }
  });
});
