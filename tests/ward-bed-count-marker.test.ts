import { describe, expect, it } from "vitest";

import { CLINICAL_VALUES, isBedCountStale } from "@/components/ward-management/ward-clinical-values";
import { bedCountMarker } from "@/components/ward-management/ward-bed-count-marker";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const LIMIT = CLINICAL_VALUES.bedCountFresh.value;

describe("one bed count limit (owner ruling 14 Nov 2026, supersedes P025)", () => {
  it("is stale only past the signed time, whatever the ward stores", () => {
    expect(isBedCountStale(NOW_ANCHOR - LIMIT, NOW_ANCHOR)).toBe(false);
    expect(isBedCountStale(NOW_ANCHOR - LIMIT - 1, NOW_ANCHOR)).toBe(true);
    expect(isBedCountStale(Number.NaN, NOW_ANCHOR)).toBe(true);
  });

  it("gives the three marker states", () => {
    expect(bedCountMarker(NOW_ANCHOR - 5, NOW_ANCHOR).state).toBe("fresh");
    const old = bedCountMarker(NOW_ANCHOR - 75, NOW_ANCHOR);
    expect(old.state).toBe("old");
    expect(old.text).toMatch(/1h 15m old$/);
    expect(bedCountMarker(undefined, NOW_ANCHOR)).toEqual({ state: "never", text: "Never checked" });
  });
});
