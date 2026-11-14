import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GroupHead, WardCapacityRow } from "@/components/wf";

afterEach(cleanup);

/*
 * Design lane A (R-FIGS-1, 14 Nov 2026): a kit part that draws a name or a group heading as a button
 * carries `data-print-show`, so the global print rule that hides buttons lets it print as text.
 * Synthetic names only.
 */
describe("kit name and heading buttons opt in to print", () => {
  it("prints a group heading that toggles", () => {
    render(<GroupHead title="In ED" count={3} onToggle={vi.fn()} expanded={false} controls="rows" />);
    expect(screen.getByTestId("wf-group-head")).toHaveAttribute("data-print-show");
  });

  it("prints a ward name drawn as a button", () => {
    render(
      <WardCapacityRow
        name="Dabakarn"
        segments={[{ id: "occ", value: 18, fill: "data-1", label: "Occupied" }]}
        percent={90}
        alertAt={85}
        onSelect={vi.fn()}
        actionLabel="Open Dabakarn"
      />,
    );
    expect(screen.getByTestId("wf-ward-capacity-row")).toHaveAttribute("data-print-show");
  });

  it("leaves a heading that is not a button as it is", () => {
    render(<GroupHead title="In ED" count={3} />);
    expect(screen.getByTestId("wf-group-head").tagName).toBe("DIV");
  });
});
