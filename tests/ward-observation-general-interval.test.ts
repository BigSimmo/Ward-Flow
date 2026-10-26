import { afterEach, describe, expect, it, vi } from "vitest";

import { CLINICAL_VALUES } from "../src/components/ward-management/ward-clinical-values";
import { CLINICAL_VALUE_LIST } from "../src/components/ward-management/ward-clinical-value-notes";
import { GENERAL_OBSERVATION, observationSummary } from "../src/components/ward-management/ward-observation";

/** Audit F3, Option A (Josh, 26 Oct 2026): General's interval lives in the clinical values file. */
describe("General observation interval from the clinical values file", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is listed as General observation interval, 1 hour, synthetic until Josh approves it", () => {
    const entry = CLINICAL_VALUE_LIST.find((candidate) => candidate.id === "observationGeneral");
    expect(entry).toMatchObject({
      name: "General observation interval",
      group: "Observation levels",
      value: 1,
      unit: "hours",
      status: "synthetic",
    });
  });

  it("still reads General as hourly", () => {
    expect(observationSummary(GENERAL_OBSERVATION)).toBe("General, hourly");
  });

  it("reads the interval from the clinical values file, not a typed word", () => {
    vi.spyOn(CLINICAL_VALUES.observationGeneral, "value", "get").mockReturnValue(2);
    expect(observationSummary(GENERAL_OBSERVATION)).toBe("General, every 2 hours");
  });
});
