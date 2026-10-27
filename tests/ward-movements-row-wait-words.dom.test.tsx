import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * P099 (Josh, 27 Oct 2026, 10:32 PM AWST): the Movements row's wait cue is about time waited in ED,
 * not a form deadline. It reads "Long wait" past the ED severe-pressure time and "Over target" past
 * the ED access target — never the deadline words "Due soon" / "Overdue", for sighted or
 * screen-reader users. Form-deadline chips elsewhere keep their own words.
 */
function waitCells(): HTMLElement[] {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MovementsScreen />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /^Show all \d+$/u }));
  const rows = document.querySelectorAll<HTMLElement>("[data-ward-primitive='record-row'][data-record-key]");
  const cells: HTMLElement[] = [];
  rows.forEach((row) => {
    const timer = row.querySelector<HTMLElement>("[role='timer']");
    if (timer?.parentElement?.parentElement) cells.push(timer.parentElement.parentElement);
  });
  return cells;
}

describe("Movements row ED wait words (P099)", () => {
  it("says Long wait / Over target, never Due soon / Overdue, on the wait cue", () => {
    const cells = waitCells();
    expect(cells.length).toBeGreaterThan(0);
    const text = cells.map((cell) => cell.textContent ?? "");
    for (const t of text) expect(t).not.toMatch(/Due soon|Overdue/u);
    expect(text.some((t) => t.includes("Over target"))).toBe(true);
    expect(text.some((t) => t.includes("Long wait"))).toBe(true);
  });
});
