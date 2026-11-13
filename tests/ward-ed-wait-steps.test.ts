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
    // K27 (F-32): "from", because each step starts at its threshold minute.
    expect(edWaitStep(long)?.label).toBe("Step 3, from 24 hours");
    expect(edWaitStep(severe)?.label).toBe("Step 2, from 8 hours");
  });

  it("gives each step its signed-off next step (Josh, 9 Nov 2026)", () => {
    expect(edWaitStep(elevated)?.nextStep).toBe("Ask wards with a free bed");
    expect(edWaitStep(severe)?.nextStep).toBe("Call the site bed manager");
    expect(edWaitStep(long)?.nextStep).toBe("Consider an out-of-area bed and add to the bed meeting");
    expect(edWaitStep(veryLong)?.nextStep).toBe("Tell the executive on call");
  });
});
