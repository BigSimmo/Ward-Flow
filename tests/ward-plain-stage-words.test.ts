// DA-16 (overall review, 20 Oct 2026): plain words for the held-up discharges.
import { describe, expect, it } from "vitest";

import { kpiCardLabel } from "@/components/ward-management/discharges/discharge-board-model";

describe("discharge labels a ward nurse reads at a glance", () => {
  it('says "Discharges held up", the owner-approved words, not "Blocked releases"', () => {
    expect(kpiCardLabel("blocked", "releases")).toBe("Discharges held up");
    expect(kpiCardLabel("blocked", "records")).toBe("Records held up");
  });
});
