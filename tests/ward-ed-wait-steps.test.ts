// Top 25 item 13: one set of ED long wait steps, built from the shared
// thresholds the ED screens already use. No 12 hour step and no 22 hour edge.

import { describe, expect, it } from "vitest";

import { edWaitStep } from "../src/components/ward-management/ward-ed-wait-steps";
import { CLINICAL_VALUES } from "../src/components/ward-management/ward-clinical-values";

const elevated = CLINICAL_VALUES.edElevatedPressure.value;
const severe = CLINICAL_VALUES.edSeverePressure.value;
const long = CLINICAL_VALUES.longWait.value;
const veryLong = CLINICAL_VALUES.veryLongWait.value;

describe("ED long wait steps (Top 25 item 13)", () => {
  it("has no step below the first threshold", () => {
    expect(edWaitStep(elevated - 1)).toBeUndefined();
    expect(edWaitStep(Number.NaN)).toBeUndefined();
  });

  it("steps up exactly at each shared threshold", () => {
    expect(edWaitStep(elevated)?.step).toBe(1);
    expect(edWaitStep(severe - 1)?.step).toBe(1);
    expect(edWaitStep(severe)?.step).toBe(2);
    expect(edWaitStep(long)?.step).toBe(3);
    expect(edWaitStep(veryLong)?.step).toBe(4);
  });

  it("does not use the retired 12 hour step or 22 hour edge", () => {
    expect(edWaitStep(12 * 60)?.step).toBe(2);
    expect(edWaitStep(22 * 60)?.step).toBe(2);
    expect("edSecondEscalation" in CLINICAL_VALUES).toBe(false);
    expect("edLadderActNowEdge" in CLINICAL_VALUES).toBe(false);
  });

  it("labels each step in plain words", () => {
    expect(edWaitStep(long)?.label).toBe("Step 3, over 24 hours");
    expect(edWaitStep(severe)?.label).toBe("Step 2, over 8 hours");
  });
});
