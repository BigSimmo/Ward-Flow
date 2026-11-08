/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  compactPipPlace,
  RailOccupancyRing,
  RailReadyLine,
} from "@/components/ward-management/shell-next/next-rail-parts";

/**
 * WF-44 (5 Nov 2026): the live rail's closed tile names its place, and the open card puts Metro on
 * its own line above the ready count, so "Metro 74.6%" never paints over the row above it.
 */
describe("WF-44 live rail occupancy labels", () => {
  it("names the place under the closed ring, never a bare figure (Note 3: never cut off)", () => {
    expect(compactPipPlace({ name: "East Metro" })).toBe("East");
    expect(compactPipPlace({ name: "Metro" })).toBe("Metro");
    expect(compactPipPlace({ name: "RPH" })).toBe("RPH");
    expect(compactPipPlace(undefined)).toBe("Beds");
    expect(compactPipPlace({ name: "Synthetic Adult Ward" })).toBe("Beds");
  });

  it("draws the ring's figure, filled to the percent, amber only when a place is over the line", () => {
    const { container, rerender } = render(<RailOccupancyRing percent={85.9} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveTextContent("86");
    expect(svg).toHaveAttribute("data-alert", "true");
    rerender(<RailOccupancyRing percent={null} />);
    expect(container.querySelector("svg")).toHaveTextContent("—");
    expect(container.querySelector("svg")).not.toHaveAttribute("data-alert");
    // The ring's colour follows its own figure, not another place's alert.
    rerender(<RailOccupancyRing percent={70} />);
    expect(container.querySelector("svg")).not.toHaveAttribute("data-alert");
  });

  it("puts Metro and the ready count on separate lines inside one stack", () => {
    const { container } = render(<RailReadyLine metro={74.6} ready={3} />);
    const stack = container.firstElementChild!;
    expect(stack.children).toHaveLength(2);
    expect(stack.children[0]).toHaveTextContent(/^Metro 75%$/u);
    expect(stack.children[1]).toHaveTextContent("3 beds ready now");
    expect(stack.className).not.toBe("");
    expect(stack.children[0]!.className).not.toBe("");
  });

  it("shows only the ready count when Metro already has its own row", () => {
    const { container } = render(<RailReadyLine metro={null} ready={1} />);
    const stack = container.firstElementChild!;
    expect(stack.children).toHaveLength(1);
    expect(stack).toHaveTextContent("1 bed ready now");
    expect(stack).not.toHaveTextContent(/Metro/u);
  });
});
