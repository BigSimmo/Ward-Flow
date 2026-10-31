import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BedsGapCard } from "@/components/ward-management/coordinator/beds-gap-card";
import { EdIndex } from "@/components/ward-management/ed/ed-index";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Category B copy pass, group G1 (audit 27 Oct 2026): P122, P132.

function GapCardFromState() {
  return <BedsGapCard now={NOW_ANCHOR} bedsReady={0} condensed={false} />;
}

describe("B-G1 wording", () => {
  it("P122: each Beds that fit row names its bed type instead of repeating a bare 'Tomorrow'", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <GapCardFromState />
      </WardFlowProvider>,
    );
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
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <EdIndex />
      </WardFlowProvider>,
    );
    const count = screen.getByTestId("ed-index-match-count");
    expect(count.textContent).toMatch(/^\d+ of \d+ EDs match, sample data$/u);
  });
});
