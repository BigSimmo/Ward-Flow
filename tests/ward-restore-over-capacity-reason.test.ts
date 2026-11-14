import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  isValidStoredWardFlowState,
  storedStateRestoreProblem,
} from "@/components/ward-management/ward-flow-storage-validation";

/*
 * D-229 (stress test RV2-18): a stored day with more people on a ward than it has beds is refused,
 * as before, but the refusal now names the rule, as the "two active ward stays" refusal does.
 */
const stored = () => JSON.parse(JSON.stringify(seedWardFlowState("standard")));

describe("restore names the bed rule when a ward holds more people than beds", () => {
  it("leaves an ordinary seeded day valid with no problem named", () => {
    const day = stored();
    expect(isValidStoredWardFlowState(day)).toBe(true);
    expect(storedStateRestoreProblem(day)).toBeUndefined();
  });

  it("refuses a ward's people count above its beds, and says why", () => {
    const day = stored();
    const ward = day.units.find(
      (unit: { sexMix: { Female: number; Male: number } }) => unit.sexMix.Female + unit.sexMix.Male > 1,
    );
    expect(ward).toBeDefined();
    ward.sexMix.Female += ward.beds;
    expect(isValidStoredWardFlowState(day)).toBe(false);
    expect(storedStateRestoreProblem(day)).toBe("a ward holds more patients than it has beds");
  });
});
