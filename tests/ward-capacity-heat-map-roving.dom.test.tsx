import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Josh, 4 Nov 2026: on the bed forecast's By ward heat map each ward row is one Tab stop. The row's
 * first cell takes Tab, and Left, Right, Home and End move focus along that row, so the focused
 * cell's tip (shown on focus) follows. Synthetic seed data only.
 */
describe("By ward heat map keyboard", () => {
  it("makes each ward row one Tab stop and moves along it with the arrows, Home and End", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
      </WardFlowProvider>,
    );
    const forecast = within(screen.getByRole("region", { name: "Bed forecast" }));
    fireEvent.click(forecast.getByRole("radio", { name: "By ward" }));

    const table = forecast.getByRole("table", { name: /by ward and day/u });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll<HTMLElement>("[data-hm-cell]"));
      expect(cells.length).toBeGreaterThan(2);
      expect(cells.filter((cell) => cell.tabIndex === 0)).toEqual([cells[0]]);
      expect(cells.slice(1).every((cell) => cell.tabIndex === -1)).toBe(true);
    }

    const cells = Array.from(rows[0]!.querySelectorAll<HTMLElement>("[data-hm-cell]"));
    const last = cells.length - 1;
    cells[0]!.focus();
    fireEvent.keyDown(cells[0]!, { key: "ArrowRight" });
    expect(cells[1]).toHaveFocus();
    fireEvent.keyDown(cells[1]!, { key: "End" });
    expect(cells[last]).toHaveFocus();
    fireEvent.keyDown(cells[last]!, { key: "ArrowRight" });
    expect(cells[last]).toHaveFocus();
    fireEvent.keyDown(cells[last]!, { key: "ArrowLeft" });
    expect(cells[last - 1]).toHaveFocus();
    fireEvent.keyDown(cells[last - 1]!, { key: "Home" });
    expect(cells[0]).toHaveFocus();
    fireEvent.keyDown(cells[0]!, { key: "ArrowLeft" });
    expect(cells[0]).toHaveFocus();

    // The focused cell still carries its tip, which the CSS shows on focus.
    expect(cells[0]!.querySelector('[aria-hidden="true"] b')).not.toBeNull();
  });
});
