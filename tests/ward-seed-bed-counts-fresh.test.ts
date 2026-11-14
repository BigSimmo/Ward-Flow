import { describe, expect, it } from "vitest";

import { isBedCountStale } from "@/components/ward-management/ward-clinical-values";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * D-229 (14 Nov 2026): a stale bed count refuses a pull (D-214). The demo's one pull comes about
 * five minutes into the script, and the presenter may wait up to 15 minutes for the room after
 * Reset, so every seeded count but the one left stale on purpose stays fresh for 45 minutes.
 */
const DELIBERATELY_STALE = ["gry-older-adult"];

describe("seeded bed counts stay fresh through the demo", () => {
  const units = seedWardFlowState("standard", { workedExamples: true }).units;

  it("keeps every count fresh 45 minutes after the start, bar the one left stale on purpose", () => {
    const stale = units
      .filter((unit) => isBedCountStale(unit.allocatable.confirmedAt, NOW_ANCHOR + 45))
      .map((unit) => unit.id);
    expect(stale).toEqual(DELIBERATELY_STALE);
  });

  it("still shows the one stale count the script names at the start", () => {
    expect(
      units.filter((unit) => isBedCountStale(unit.allocatable.confirmedAt, NOW_ANCHOR)).map((unit) => unit.id),
    ).toEqual(DELIBERATELY_STALE);
  });
});
