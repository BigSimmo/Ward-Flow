// DA-16 (overall review, 20 Oct 2026): plain words for the held-up discharges.
import { describe, expect, it } from "vitest";

import { kpiCardLabel } from "@/components/ward-management/discharges/discharge-board-model";

describe("discharge labels a ward nurse reads at a glance", () => {
  it('says "Releases held up", not "Blocked releases", and keeps "Discharges held up" for patients (decision 15)', () => {
    expect(kpiCardLabel("blocked", "releases")).toBe("Releases held up");
    expect(kpiCardLabel("blocked", "records")).toBe("Records held up");
  });
});
