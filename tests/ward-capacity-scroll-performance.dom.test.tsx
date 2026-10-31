import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { bedMapWards, groupBedMapWardsByService } from "@/components/ward-management/capacity/bed-map";
import { BedMapCards, type Highlight } from "@/components/ward-management/capacity/capacity-bed-map-cards";
import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import type { CapacityModel } from "@/components/ward-management/capacity/capacity-model";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { bedMapCards, bedMapGroup, bedMapGroupToggle, bedSquares } from "./helpers/capacity-ward-table";

/**
 * Capacity bed map scroll and layout cost. The old `BedMap` drew each service as a sideways
 * carousel that measured its track on every scroll frame (ResizeObserver, scrollWidth, animation
 * frames); this file used to pin that lifecycle. The October 2026 redesign removed the carousel:
 * each ward is a card whose bed squares share one line at any bed count (one grid column per bed),
 * so the map scrolls with the page and needs no measuring at all. This file pins that it stays so:
 * drawing the map, switching Grid and Rows, folding a service and lighting a highlight read no
 * layout, start no observer and schedule no frame.
 */
const seeded = seedWardFlowState();
const groups = groupBedMapWardsByService(
  bedMapWards(seeded.units, [...seeded.bedReleases], seeded.admissions, seeded.leaveBeds),
);
const model = {
  mapGroups: groups,
  networkRows: networkWardRows(seeded.units, NOW_ANCHOR, seeded.bedReleases, seeded.admissions, seeded.leaveBeds),
  now: NOW_ANCHOR,
} as Pick<CapacityModel, "mapGroups" | "networkRows" | "now"> as CapacityModel;

function BedMapOnly() {
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  return <BedMapCards model={model} onSelectWard={() => {}} highlight={highlight} onHighlight={setHighlight} />;
}

function countMeasurement() {
  const counts = { layoutReads: 0, observers: 0, frames: 0 };
  for (const property of ["clientWidth", "scrollWidth", "offsetWidth", "offsetLeft", "scrollLeft"] as const) {
    vi.spyOn(HTMLElement.prototype, property, "get").mockImplementation(() => {
      counts.layoutReads += 1;
      return 0;
    });
  }
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => {
    counts.layoutReads += 1;
    return new DOMRect();
  });
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => {
    counts.frames += 1;
    return counts.frames;
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor() {
        counts.observers += 1;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  return counts;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Capacity bed map layout cost", () => {
  it("draws, switches layout, folds and highlights without reading layout, observing or scheduling a frame", () => {
    const counts = countMeasurement();
    render(<BedMapOnly />);
    const populated = groups.filter((group) => group.wards.length > 0);
    expect(populated.length, "need at least two services to fold one independently").toBeGreaterThan(1);

    fireEvent.click(screen.getByRole("radio", { name: "Rows" }));
    fireEvent.click(screen.getByRole("radio", { name: "Grid" }));
    const toggle = bedMapGroupToggle(bedMapGroup(populated[0]!.service)!);
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    fireEvent.click(within(screen.getByRole("group", { name: "Highlight wards" })).getAllByRole("button")[0]!);

    console.info("capacity-bed-map-measurement", JSON.stringify(counts));
    expect(counts).toEqual({ layoutReads: 0, observers: 0, frames: 0 });
  });

  it("keeps every ward's bed squares on one line, one column per bed, in Grid and in Rows", () => {
    render(<BedMapOnly />);
    for (const layout of ["Grid", "Rows"] as const) {
      fireEvent.click(screen.getByRole("radio", { name: layout }));
      let checked = 0;
      for (const group of groups) {
        if (group.wards.length === 0) continue;
        const cards = bedMapCards(bedMapGroup(group.service)!);
        expect(cards, `${layout}: ${group.service}`).toHaveLength(group.wards.length);
        group.wards.forEach((ward, index) => {
          const squares = bedSquares(cards[index]!);
          expect(squares, `${layout}: ${ward.unit.id}`).toHaveLength(ward.unit.beds);
          expect(squares[0]!.parentElement!.style.gridTemplateColumns, `${layout}: ${ward.unit.id}`).toMatch(
            new RegExp(`^repeat\\(${ward.unit.beds},`, "u"),
          );
          checked += 1;
        });
      }
      expect(checked, layout).toBe(seeded.units.length);
    }
  });
});
