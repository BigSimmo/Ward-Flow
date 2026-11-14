import { describe, expect, it } from "vitest";

import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  TRANSPORT_EXCEPTION_GAP_LABELS,
  arrivalGaps,
  fitToTravelGaps,
  transportExceptionRecord,
  transportExceptionText,
} from "@/components/ward-management/ward-transport-checks";

/**
 * D-207 (Josh, 14 Nov 2026): fit to travel recorded as "Not cleared" reads "Fit to travel: not
 * cleared", never "Fit to travel not recorded". Nothing recorded keeps the "not recorded" line.
 */
describe("fit to travel recorded as not cleared (D-207)", () => {
  it("uses Josh's words for not cleared and keeps the not-recorded line", () => {
    expect(TRANSPORT_EXCEPTION_GAP_LABELS.fit_to_travel_not_cleared).toBe("Fit to travel: not cleared");
    expect(TRANSPORT_EXCEPTION_GAP_LABELS.fit_to_travel_missing).toBe("Fit to travel not recorded");
  });

  it("tells nothing recorded apart from not cleared at every step", () => {
    expect(fitToTravelGaps(undefined)).toEqual(["fit_to_travel_missing"]);
    expect(fitToTravelGaps({ cleared: false })).toEqual(["fit_to_travel_not_cleared"]);
    expect(fitToTravelGaps({ cleared: true })).toEqual([]);

    const notCleared = { medicalClearance: { cleared: false, at: NOW_ANCHOR } };
    expect(arrivalGaps({ transport: undefined, ...notCleared })).toEqual(["fit_to_travel_not_cleared"]);
    expect(arrivalGaps({ transport: undefined, medicalClearance: undefined })).toEqual(["fit_to_travel_missing"]);
  });

  it("the engine accepts and words a not-cleared reason", () => {
    const record = transportExceptionRecord(
      { gaps: ["fit_to_travel_not_cleared"], reason: "treating_team_confirmed" },
      NOW_ANCHOR,
      "coordinator",
      "booked",
    );
    expect(typeof record).not.toBe("string");
    if (typeof record === "string") return;
    expect(transportExceptionText(record)).toBe("Fit to travel: not cleared. Confirmed with the treating team");
  });
});
