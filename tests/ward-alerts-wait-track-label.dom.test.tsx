import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WaitTrack } from "@/components/ward-management/alerts/alerts-visuals";

/**
 * AL1 (bug pass, 4 Nov 2026): on a long transport wait the "Transport accepted" mark sits near the
 * track's start, and the label centred on it ran off the card's left edge. The label now moves in
 * just far enough to show in full. jsdom has no layout, so the track uses its 366px fallback width.
 */
describe("Recorded times track labels", () => {
  it("keeps a long first label inside the track when its mark is near the start", () => {
    // Accepted ten hours ago: the mark sits a few pixels from the track's left end.
    render(<WaitTrack points={[{ at: 600, label: "Transport accepted", shape: "wait" }]} now={1200} />);
    const label = screen.getByText("Transport accepted");
    expect(label).toHaveAttribute("text-anchor", "middle");
    // About 120px wide at 12px, so its centre must be at least 60px in from the left end.
    expect(Number(label.getAttribute("x"))).toBeGreaterThanOrEqual(60);
  });

  it("keeps a label inside the track when its mark is at the end", () => {
    render(<WaitTrack points={[{ at: 1200, label: "Transport accepted", shape: "wait" }]} now={1200} />);
    const label = screen.getByText("Transport accepted");
    expect(Number(label.getAttribute("x"))).toBeLessThanOrEqual(366 - 60);
  });
});
