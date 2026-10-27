import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BedsGapCard } from "@/components/ward-management/coordinator/beds-gap-card";
import { EdIndex } from "@/components/ward-management/ed/ed-index";
import { useWardFlowSelect, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Category B copy pass, group G1 (audit 27 Oct 2026): P122, P132.

function GapCardFromState() {
  const { movements, units, admissions } = useWardFlowSelect("movements", "units", "admissions");
  return <BedsGapCard movements={movements} units={units} admissions={admissions} now={NOW_ANCHOR} bedsReady={0} />;
}

describe("B-G1 wording", () => {
  it("P122: each Tomorrow tile names its bed type instead of repeating a bare 'Tomorrow'", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <GapCardFromState />
      </WardFlowProvider>,
    );
    const tiles = within(screen.getByTestId("home-beds-gap-tomorrow")).getAllByRole("listitem");
    expect(tiles.length).toBeGreaterThan(1);
    const labels = tiles.map((tile) => tile.querySelector("span")?.textContent ?? "");
    for (const label of labels) {
      expect(label).toMatch(/^\S.* tomorrow$/u);
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
    expect(count.textContent).toMatch(/^\d+ of \d+ EDs match$/u);
  });
});
