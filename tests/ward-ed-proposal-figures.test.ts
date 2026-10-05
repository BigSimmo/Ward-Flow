import { describe, expect, it } from "vitest";

import {
  ED_STEPS,
  edCounts,
  edRows,
  hubRows,
  readyBeds,
  recentEvents,
  sumCounts,
} from "@/components/ward-management/ed/proposal/ed-proposal-figures";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The ED redesign proposal promises one set of figures: each person in exactly one step, the hub
 * row for a department equal to that department's own strip, and the network the sum of its rows.
 */
describe("ED proposal figures", () => {
  const state = seedWardFlowState();
  const now = NOW_ANCHOR;
  const target = state.configuration.edAccessTargetMinutes;
  const hub = hubRows(state, now, target);

  it("puts every person on a list in exactly one step", () => {
    for (const row of hub) {
      const total = ED_STEPS.reduce((sum, step) => sum + row.counts.steps[step.id], 0);
      expect(total, row.ed.id).toBe(row.counts.onList);
    }
  });

  it("gives a department the same counts on the hub as on its own screen", () => {
    for (const row of hub) {
      expect(edCounts(edRows(row.ed.id, state, now, target))).toEqual(row.counts);
    }
  });

  it("adds the departments up to the network total", () => {
    const total = sumCounts(hub);
    expect(total.onList).toBe(hub.reduce((sum, row) => sum + row.counts.onList, 0));
    expect(total.noBed + total.bedFound + total.inTransit + total.steps.closed_here).toBe(total.onList);
  });

  it("counts Peel's people with no bed separately from those with a bed found", () => {
    const peel = edCounts(edRows("peel-ed", state, now, target));
    expect(peel.onList).toBe(9);
    expect(peel.noBed).toBe(3);
    expect(peel.bedFound).toBe(5);
    expect(peel.pastTarget).toBe(1);
  });

  it("uses the same beds-ready figure as the capacity source", () => {
    expect(readyBeds(state.units, state.bedReleases)).toBe(
      state.units.reduce((sum, unit) => sum + (unitCapacity(unit, state.bedReleases).available ?? 0), 0),
    );
  });

  it("shows initials only and keeps the last-24-hours list to 24 hours", () => {
    const rows = edRows("peel-ed", state, now, target);
    for (const row of rows) expect(row.initials).toMatch(/^([A-Z]\. ?)+$|^—$/);
    for (const event of recentEvents(rows, state.units, now)) expect(now - event.at).toBeLessThanOrEqual(24 * 60);
  });
});
