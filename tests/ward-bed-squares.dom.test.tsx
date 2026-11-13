import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  BedSquares,
  BedSquaresKey,
  bedSquareCounts,
  bedSquaresNotes,
} from "@/components/ward-management/bed-squares/bed-squares";

/**
 * Bed squares, shared pattern v1 (wave 4, ruling 7, D-191): one ward's beds as squares in state
 * order, a head line in words and a note line only when there is something to note. Held up is
 * said in the note line, never as a coloured square. Synthetic figures only.
 */
describe("BedSquares", () => {
  it("draws one square per bed in state order and says the head in words", () => {
    const counts = bedSquareCounts({ beds: 20, ready: 1, prep: 1, dischargesToday: 2, closed: 1 });
    expect(counts).toEqual({ ready: 1, prep: 1, free: 2, use: 15, closed: 1 });
    render(
      <BedSquares
        counts={counts}
        tag="Adult · Locked"
        notes={bedSquaresNotes({ dischargesToday: 2, heldUp: 1, pulled: 2, prep: 1, closed: 1 })}
        testId="sq"
      />,
    );
    const block = screen.getByTestId("sq");
    expect(block.textContent).toContain("1ready of 20 beds");
    expect(block.textContent).toContain("Adult · Locked");
    const strip = screen.getByTestId("bed-squares-strip");
    expect(strip.getAttribute("aria-hidden")).toBe("true");
    const states = [...strip.querySelectorAll("i")].map((square) => square.dataset.s);
    expect(states).toHaveLength(20);
    expect(states.slice(0, 4)).toEqual(["ready", "prep", "free", "free"]);
    expect(states.at(-1)).toBe("closed");
    // No tone colours: held up is a word on the note line, not a square.
    expect(states.every((state) => ["ready", "prep", "free", "use", "closed"].includes(state ?? ""))).toBe(true);
    expect(screen.getByTestId("sq-note").textContent).toBe(
      "2 discharges today · 1 held up · 2 pulled · 1 being made ready · 1 closed",
    );
  });

  it("writes zero as 0, singular bed, and draws no note line when there is nothing to note", () => {
    render(<BedSquares counts={bedSquareCounts({ beds: 1, ready: 0 })} testId="one" />);
    const block = screen.getByTestId("one");
    expect(block.textContent).toContain("0ready of 1 bed");
    expect(block.querySelector('[data-zero="true"]')).not.toBeNull();
    expect(screen.queryByTestId("one-note")).toBeNull();
  });

  it("puts a stale count first in warning words and leaves out zeros", () => {
    const notes = bedSquaresNotes({ staleFor: "5h", closed: 0, onLeave: 1, staffRequested: true });
    expect(notes).toEqual([
      { text: "Count 5h old", tone: "warning" },
      { text: "1 on leave" },
      { text: "Staff requested" },
    ]);
  });

  it("never colours more discharge squares than beds in use", () => {
    expect(bedSquareCounts({ beds: 4, ready: 2, closed: 1, dischargesToday: 5 })).toEqual({
      ready: 2,
      prep: 0,
      free: 1,
      use: 0,
      closed: 1,
    });
  });

  it("names every square state in the key", () => {
    render(<BedSquaresKey />);
    expect(screen.getByLabelText("Bed squares key").textContent).toBe(
      "ReadyBeing made readyDischarge todayIn useClosed",
    );
  });
});
