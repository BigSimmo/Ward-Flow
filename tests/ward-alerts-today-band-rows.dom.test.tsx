import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TodayBand, markGapMinutes } from "@/components/ward-management/alerts/alerts-today-band";
import type { Instant } from "@/components/ward-management/ward-clock";

describe("Today band rows", () => {
  it("opens another row instead of drawing a fourth mark over the first", () => {
    const now = 600 as Instant;
    const raised = ["A1", "A2", "A3", "A4", "A5"].map((id) => ({
      id,
      at: 540 as Instant,
      shape: "act" as const,
      title: `Synthetic alert ${id}`,
    }));
    render(<TodayBand raised={raised} acted={[]} broadcasts={[]} now={now} onPick={() => {}} noTimeCount={0} />);
    const bottoms = raised.map((point) => screen.getByRole("button", { name: point.title }).style.bottom);
    expect(new Set(bottoms).size).toBe(raised.length);
    const track = screen.getByRole("group", { name: "Alerts raised and acted on today" });
    expect(track.style.height).toBe(`${84 + 2 * 26}px`);
  });

  it("stacks marks drawn at the left edge, even when their real times are far apart (review on #1238)", () => {
    // Now 600 puts the window at 360 to 720, so marks at 100, 200 and 300 are all drawn at 360.
    const raised = [100, 200, 300].map((at, index) => ({
      id: `E${index}`,
      at: at as Instant,
      shape: "act" as const,
      title: `Synthetic early alert ${index}`,
    }));
    render(
      <TodayBand raised={raised} acted={[]} broadcasts={[]} now={600 as Instant} onPick={() => {}} noTimeCount={0} />,
    );
    const bottoms = raised.map((point) => screen.getByRole("button", { name: point.title }).style.bottom);
    expect(new Set(bottoms).size).toBe(raised.length);
  });

  describe("marks never overlap into small targets (A8, accessibility check 2 Nov 2026)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("needs more minutes between marks on a narrow track", () => {
      expect(markGapMinutes(0)).toBe(10);
      expect(markGapMinutes(1200)).toBe(10);
      // 26px of a 500px six-hour track is about 19 minutes.
      expect(markGapMinutes(500)).toBe(19);
      expect(markGapMinutes(320)).toBe(30);
    });

    // Page tops (9 Nov 2026): the window now runs 08:00 to 10:30 here (150 minutes, now near 80%), so
    // at 500px a mark's 26px is about 8 minutes and the 10-minute floor applies.
    it("puts marks 6 minutes apart on separate rows when the track is 500px wide", () => {
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(500);
      const raised = [540, 546, 552, 558].map((at, index) => ({
        id: `T${index}`,
        at: at as Instant,
        shape: "wait" as const,
        title: `Synthetic transport alert ${index}`,
      }));
      render(
        <TodayBand raised={raised} acted={[]} broadcasts={[]} now={600 as Instant} onPick={() => {}} noTimeCount={0} />,
      );
      const bottoms = raised.map((point) => screen.getByRole("button", { name: point.title }).style.bottom);
      // Six minutes is 20px on this track, so one row would overlap; they alternate between two.
      expect(new Set(bottoms).size).toBe(2);
      expect(bottoms[0]).toBe(bottoms[2]);
      expect(bottoms[1]).toBe(bottoms[3]);
      expect(bottoms[0]).not.toBe(bottoms[1]);
    });
  });
});
