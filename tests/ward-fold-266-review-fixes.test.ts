import { describe, expect, it } from "vitest";

import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { allUnits } from "@/components/ward-management/ward-sites";
import { redactLogValue } from "@/lib/privacy";

describe("review fixes carried from #266", () => {
  it("redacts 10-digit and hyphenated record identifiers in log values", () => {
    expect(redactLogValue("Error for UMRN: 1234567890")).not.toContain("1234567890");
    expect(redactLogValue("Error for UMRN-1234567")).not.toContain("1234567");
  });

  it("never reports more locked-ready beds than ready beds for a closed ward", () => {
    const base = allUnits().find((unit) => unit.lockedBeds > 0) ?? allUnits()[0];
    const closed = { ...base, isClosed: true };
    const [row] = networkWardRows([closed], 0 as never);
    expect(row.ready).toBe(0);
    expect(row.lockedReady).toBeLessThanOrEqual(row.ready);
  });
});
