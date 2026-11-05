import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PortraitList } from "@/components/wf/portrait";

/*
 * Design audit A13 (5 Nov 2026): at iPad portrait, Handover listed every row of every group (70
 * rows, about 5,200px). An open group now shows about eight rows, then "Show N more", as phone and
 * desktop fold. The open row stays shown past the fold. Synthetic names only.
 */
const rows = (count: number, selectedAt?: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `row-${index}`,
    name: `Testperson, Synthetic ${index + 1}`,
    figure: `${index + 1}h`,
    selected: index === selectedAt,
  }));

describe("PortraitList fold", () => {
  it("shows eight rows of a long group, then Show N more opens the rest", () => {
    render(
      <PortraitList label="Test list" onOpen={() => {}} groups={[{ id: "a", title: "Group A", rows: rows(12) }]} />,
    );
    const list = screen.getByTestId("wf-portrait-list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "Show 4 more" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(12);
    expect(screen.queryByRole("button", { name: /^Show \d+ more$/ })).toBeNull();
  });

  it("never folds away a single row, and keeps the open row shown", () => {
    render(
      <PortraitList
        label="Test list"
        onOpen={() => {}}
        groups={[
          { id: "a", title: "Group A", rows: rows(9) },
          { id: "b", title: "Group B", rows: rows(12, 10) },
        ]}
      />,
    );
    const list = screen.getByTestId("wf-portrait-list");
    // Group A: hiding one row would be a "Show 1 more", so all nine show. Group B: eight plus the open row.
    expect(within(list).getAllByRole("listitem")).toHaveLength(9 + 9);
    expect(screen.getByRole("button", { name: "Show 3 more" })).toBeTruthy();
  });
});
