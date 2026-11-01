// Alerts redesign (1 Nov 2026), the Today band: marks never cover one another, and Acted on today
// counts only today. Review on #1233.
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { stackRows, TodayBand } from "@/components/ward-management/alerts/alerts-today-band";
import type { Instant } from "@/components/ward-management/ward-clock";

afterEach(cleanup);

const at = (minutes: number) => minutes as Instant;

describe("Today band", () => {
  it("opens a new row when every row is taken at the same time, so no mark covers another", () => {
    const rows = stackRows([0, 1, 2, 3].map((index) => ({ id: `m${index}`, at: at(600) })));
    expect(rows.map((mark) => mark.row)).toEqual([0, 1, 2, 3]);
  });

  it("grows the track for the extra row and keeps every raised alert a separate button", () => {
    const raised = [0, 1, 2, 3].map((index) => ({
      id: `a${index}`,
      at: at(600),
      shape: "act" as const,
      title: `Synthetic alert ${index}`,
    }));
    render(<TodayBand raised={raised} acted={[]} broadcasts={[]} now={at(640)} onPick={() => {}} noTimeCount={0} onOpenBroadcast={() => {}} />);
    const marks = screen.getAllByRole("button", { name: /^Synthetic alert/ });
    expect(new Set(marks.map((mark) => mark.style.bottom)).size).toBe(4);
    expect(screen.getByRole("group", { name: "Alerts raised and acted on today" })).toHaveStyle({ height: "96px" });
  });
});
