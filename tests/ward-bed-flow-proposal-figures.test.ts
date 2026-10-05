import { describe, expect, it } from "vitest";

import { stillNeedsABed } from "@/components/ward-management/bed-flow-proposal/use-bed-flow-proposal";
import { bedKindGaps, bedKindTotals } from "@/components/ward-management/capacity/capacity-derivations";
import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import {
  networkFigures,
  wardFigures,
} from "@/components/ward-management/statistics/proposal/statistics-proposal-figures";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The Capacity and Network proposal matches only people still without a bed against ready beds,
 * so the mismatch, the forecast and the "Still need a bed" tile must all count the same people.
 */
describe("capacity and network proposal figures", () => {
  const state = seedWardFlowState();
  const now = NOW_ANCHOR;
  const needing = state.movements.filter(stillNeedsABed);
  const open = state.movements.filter(isOpen);

  it("counts the same people waiting in the mismatch and the forecast", () => {
    const totals = bedKindTotals(bedKindGaps(needing, state.units, now));
    expect(totals.waiting).toBe(needing.length);
    for (const horizon of bedsForecast(state.units, state.bedReleases, state.admissions, state.movements, now)
      .horizons) {
      expect(horizon.waitingForBed, `${horizon.hours}h`).toBe(needing.length);
    }
  });

  it("leaves out people whose bed is already held, and only them", () => {
    expect(needing.length).toBeLessThan(open.length);
    expect(
      open
        .filter((movement) => !stillNeedsABed(movement))
        .every((movement) => ["pulled", "handover_ready", "moving"].includes(movement.stage)),
    ).toBe(true);
  });

  it("offers the same ready beds to the mismatch as the bed map shows", () => {
    const wards = wardFigures(state.units, state.admissions, state.bedReleases, state.leaveBeds, state.movements, now);
    expect(bedKindTotals(bedKindGaps(needing, state.units, now)).bedsThatFit).toBe(networkFigures(wards).ready);
  });
});
