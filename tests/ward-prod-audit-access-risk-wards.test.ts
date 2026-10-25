import { describe, expect, it } from "vitest";

import { releaseText } from "../src/components/ward-management/forecast/ed-access-risk-card";
import type { EdAccessRiskRow } from "../src/components/ward-management/forecast/ed-access-risk";

// Synthetic row. The card names a ward only once that ward has accepted the person (Josh, 25 Oct
// 2026), so the earliest release elsewhere never reads as a best-match ward suggestion.
const row = (acceptedUnitName: string | null): EdAccessRiskRow => ({
  movementId: "WF-TEST",
  edId: "ed-test",
  kind: "open_adult",
  urgency: 3,
  passesAt: 600,
  minutesLeft: 600,
  slotAt: null,
  nextRelease: { unitId: "unit-b", unitName: "Ward B", at: 300, blocker: null },
  acceptedUnitName,
  declines: 1,
});

describe("access risk card ward names", () => {
  it("does not name a ward that has not accepted the person, even for the coordinator", () => {
    expect(releaseText(row(null), 0, true)).not.toContain("Ward B");
  });

  it("names the accepting ward for the coordinator only", () => {
    expect(releaseText(row("Ward B"), 0, true)).toContain(" at Ward B");
    expect(releaseText(row("Ward B"), 0, false)).not.toContain("Ward B");
  });
});
