import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TodayBand } from "@/components/ward-management/alerts/alerts-today-band";
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
    render(
      <TodayBand
        raised={raised}
        acted={[]}
        broadcasts={[]}
        now={now}
        onPick={() => {}}
        noTimeCount={0}
        onOpenBroadcast={() => {}}
      />,
    );
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
      <TodayBand
        raised={raised}
        acted={[]}
        broadcasts={[]}
        now={600 as Instant}
        onPick={() => {}}
        noTimeCount={0}
        onOpenBroadcast={() => {}}
      />,
    );
    const bottoms = raised.map((point) => screen.getByRole("button", { name: point.title }).style.bottom);
    expect(new Set(bottoms).size).toBe(raised.length);
  });
});
