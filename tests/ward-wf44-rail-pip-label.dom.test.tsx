/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { compactPipText, RailReadyLine } from "@/components/ward-management/shell-next/next-rail-parts";

/**
 * WF-44 (5 Nov 2026): the live rail's closed tile names its place, and the open card puts Metro on
 * its own line above the ready count, so "Metro 74.6%" never paints over the row above it.
 */
describe("WF-44 live rail occupancy labels", () => {
  it("names the place before the percent on the closed tile, never a bare figure", () => {
    expect(compactPipText({ name: "East Metro", percent: 74.4 })).toBe("East 74%");
    expect(compactPipText({ name: "Metro", percent: 85.9 })).toBe("Metro 86%");
    expect(compactPipText({ name: "RPH", percent: 81 })).toBe("RPH 81%");
    expect(compactPipText({ name: "RPH", percent: null })).toBe("—");
    expect(compactPipText(undefined)).toBe("—");
    expect(compactPipText({ name: "North Metro", percent: 60 })).not.toMatch(/^\d/u);
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
