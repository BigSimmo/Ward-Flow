import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { placeTrackLabels, WaitTrack } from "@/components/ward-management/alerts/alerts-visuals";

/**
 * AL1 (bug pass, 4 Nov 2026): on a long transport wait the "Transport accepted" mark sits near the
 * track's start, and the label centred on it ran off the card's left edge. Labels now read away
 * from the nearest edge and drop below the line when they would meet the one before. jsdom has no
 * layout, so the track uses its 366px fallback width.
 */
describe("Recorded times track labels", () => {
  it("reads from the mark rightwards when the mark is near the start", () => {
    render(<WaitTrack points={[{ at: 600, label: "Transport accepted", shape: "wait" }]} now={1200} />);
    const label = screen.getByText("Transport accepted");
    expect(label).toHaveAttribute("text-anchor", "start");
    expect(Number(label.getAttribute("x"))).toBeGreaterThanOrEqual(6);
  });

  it("ends at the mark when the mark is near the end", () => {
    const [placed] = placeTrackLabels([{ x: 360, label: "Transport accepted" }], 366);
    expect(placed.anchor).toBe("end");
    expect(placed.x).toBeLessThanOrEqual(360);
  });

  it("centres a label with room either side", () => {
    const [placed] = placeTrackLabels([{ x: 183, label: "Booked" }], 366);
    expect(placed).toEqual({ x: 183, y: 10, anchor: "middle" });
  });

  it("drops a label below the line when it would meet the one before", () => {
    const [first, second] = placeTrackLabels(
      [
        { x: 150, label: "Transport booked" },
        { x: 170, label: "Transport accepted" },
      ],
      366,
    );
    expect(first.y).toBe(10);
    expect(second.y).toBe(46);
  });

  // Visual review (5 Nov 2026): "Pull ended" a few minutes ago crossed the Now line.
  it("keeps a label off the Now line, on its mark's side", () => {
    const [placed] = placeTrackLabels([{ x: 340, label: "Pull ended" }], 366, 344);
    expect(placed.anchor).toBe("end");
    expect(placed.x).toBeLessThanOrEqual(344 - 6);
  });

  it("puts a label after Now when its mark is after Now", () => {
    const [placed] = placeTrackLabels([{ x: 190, label: "Expected" }], 366, 183);
    expect(placed.anchor).toBe("start");
    expect(placed.x).toBeGreaterThanOrEqual(183 + 6);
  });

  // WF-35 (5 Nov 2026): three close marks used to share one baseline and paint over each other.
  it("drops a third colliding label onto the lowest row", () => {
    const [first, second, third] = placeTrackLabels(
      [
        { x: 140, label: "Transport booked" },
        { x: 155, label: "Transport accepted" },
        { x: 170, label: "Arrived at ward" },
      ],
      366,
    );
    expect(first.y).toBe(10);
    expect(second.y).toBe(46);
    expect(third.y).toBe(62);
  });

});
