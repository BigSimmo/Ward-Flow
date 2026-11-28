import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BedsGapCard } from "@/components/ward-management/coordinator/beds-gap-card";
import { EdIndex } from "@/components/ward-management/ed/ed-index";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Category B copy pass, group G1 (audit 27 Oct 2026): P122, P132.

function GapCardFromState() {
  return <BedsGapCard now={NOW_ANCHOR} bedsReady={0} condensed={false} />;
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("B-G1 wording", () => {
  it("P122: each Beds that fit row names its bed type instead of repeating a bare 'Tomorrow'", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <GapCardFromState />
      </WardFlowProvider>,
    );
    // Simplification area 2 item 5: the card rests folded on its one line; open it for the table.
    fireEvent.click(screen.getByRole("button", { name: "Show the beds that fit table" }));
    // Home and Activity design (31 Oct 2026): one table, with Tomorrow as a column heading once.
    const table = within(screen.getByTestId("home-beds-fit")).getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Bed type", "Now", "Tomorrow"]);
    const rows = within(table).getAllByRole("rowheader");
    expect(rows.length).toBeGreaterThan(1);
    const labels = rows.map((row) => row.firstChild?.textContent ?? "");
    for (const label of labels) {
      expect(label).toMatch(/^\S/u);
      expect(label).not.toBe("Tomorrow");
    }
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("P132: All EDs counts EDs, not 'synthetic records'", () => {
    // Audit two #21: the count line shows only once a filter is on; the address names one.
    window.history.replaceState(null, "", "/bedchart/ed?status=past-target");
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdIndex />
      </WardFlowProvider>,
    );
    const count = screen.getByTestId("ed-index-match-count");
    // E1 (Josh, 3 Nov 2026): the line says what is showing. Page tops (Josh, 9 Nov 2026): the order
    // is stated by the Order control beside it, so the line no longer repeats it.
    expect(count.textContent).toMatch(/^Showing \d+ of \d+ EDs · Over target, sample data$/u);
  });
});
