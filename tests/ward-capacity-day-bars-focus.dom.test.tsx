import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DayBars, type DayBar } from "@/components/ward-management/capacity/capacity-day-bars";

/**
 * C3 (Josh, 4 Nov 2026): a day bar's detail card opens without a mouse. Each day is a button; a
 * keyboard focus or a tap opens its card, Escape closes it, and the card is the button's
 * description (read once), while the chart's summary stays the screen reader's text for the chart.
 * Synthetic figures only.
 */
const DAYS: DayBar[] = [
  { key: 0, label: "Wed 4", sub: "Today", value: 2, firm: true, second: 1 },
  { key: 1, label: "Thu 5", sub: "Tomorrow", value: 3, firm: true, tip: ["Synthetic Ward A 2", "Synthetic Ward B 1"] },
  { key: 2, label: "Fri 6", sub: "May move", value: 4, firm: false },
];

describe("DayBars detail without a mouse", () => {
  beforeEach(() => {
    // jsdom lays nothing out, so give the chart a width; the hit areas draw once it is measured.
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(600);
  });
  afterEach(() => vi.restoreAllMocks());

  it("shows a day's detail on focus, describes the button with it, and closes on Escape", () => {
    render(<DayBars days={DAYS} summary="Synthetic summary of every figure" />);
    expect(screen.getByRole("img", { name: "Synthetic summary of every figure" })).toBeInTheDocument();
    const thursday = screen.getByRole("button", { name: "Thu 5, Tomorrow" });
    expect(thursday).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("3 going out")).toBeNull();

    act(() => thursday.focus());
    expect(thursday).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("3 going out")).toBeInTheDocument();
    expect(screen.getByText("Synthetic Ward A 2")).toBeInTheDocument();
    // Read once, as the focused button's description.
    expect(thursday).toHaveAccessibleDescription(/3 going out/u);

    fireEvent.keyDown(thursday, { key: "Escape" });
    expect(thursday).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("3 going out")).toBeNull();
  });

  it("toggles a day's detail on a tap", () => {
    render(<DayBars days={DAYS} summary="Synthetic summary" />);
    const friday = screen.getByRole("button", { name: "Fri 6, May move" });
    fireEvent.pointerDown(friday, { pointerType: "touch" });
    fireEvent.click(friday);
    expect(screen.getByText("4 going out, may move")).toBeInTheDocument();
    fireEvent.pointerDown(friday, { pointerType: "touch" });
    fireEvent.click(friday);
    expect(screen.queryByText("4 going out, may move")).toBeNull();
  });
});
