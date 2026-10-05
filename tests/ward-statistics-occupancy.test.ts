import { describe, expect, it } from "vitest";

import { hoursText, occupiedBeds } from "@/components/ward-management/statistics/statistics-occupancy";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

describe("statistics occupancy", () => {
  const state = seedWardFlowState();

  it("splits the old occupied count into occupied and pulled, so pulled beds are not occupancy", () => {
    const figures = occupiedBeds(state.units, state.admissions, state.bedReleases, state.leaveBeds);
    const old = state.units.reduce((sum, unit) => sum + unitCapacity(unit, state.bedReleases).occupied, 0);
    expect(figures.occupied + figures.pulled).toBe(old);
    expect(figures.pulled).toBeGreaterThan(0);
  });

  it("writes waits of a day or more as days and hours", () => {
    expect(hoursText(13)).toBe("13h");
    expect(hoursText(169)).toBe("7d 1h");
  });
});
