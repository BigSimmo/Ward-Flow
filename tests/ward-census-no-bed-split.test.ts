import { describe, expect, it } from "vitest";

import { buildCensus, CENSUS_GROUPS } from "@/components/ward-management/search/patient-census";
import { countGroups } from "@/components/ward-management/search/patient-search-model";
import { demoDayZero, dueSoonThresholdsOf } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * P027 (Josh, 27 Oct 2026): Patients' "No bed yet" group splits in two, "No ward asked yet" and
 * "Ward asked, waiting for answer", and the groups still add up to every row on the census.
 */
const state = seedWardFlowState();
const census = buildCensus({
  ...state,
  now: NOW_ANCHOR,
  thresholds: dueSoonThresholdsOf(state.configuration),
  dayZero: demoDayZero(new Date("2026-10-19T00:00:00Z")),
});
const byId = new Map<string, (typeof state.movements)[number]>(
  state.movements.map((movement) => [movement.id, movement]),
);
const labelOf = (id: string) => CENSUS_GROUPS.find((group) => group.id === id)?.label;

describe('Patients splits "No bed yet" by whether a ward has been asked', () => {
  it("names the two groups and drops the old one", () => {
    const labels = CENSUS_GROUPS.map((group) => group.label);
    expect(labels).toContain("No ward asked yet");
    expect(labels).toContain("Ward asked, waiting for answer");
    expect(labels).not.toContain("No bed yet");
  });

  it("puts a bed request with no ward asked in one group and one with a ward asked in the other", () => {
    const notAsked = census.rows.filter((row) => row.kind === "movement" && labelOf(row.group) === "No ward asked yet");
    const asked = census.rows.filter(
      (row) => row.kind === "movement" && labelOf(row.group) === "Ward asked, waiting for answer",
    );
    expect(notAsked.length, "the seed has a bed request with no ward asked").toBeGreaterThan(0);
    expect(asked.length, "the seed has a bed request waiting for a ward's answer").toBeGreaterThan(0);
    for (const row of notAsked) expect(byId.get(row.key)!.referredUnitIds).toHaveLength(0);
    for (const row of asked) {
      // A ward that declined or was withdrawn leaves `referredUnitIds` but still counts as asked.
      const m = byId.get(row.key)!;
      const everAsked =
        m.referredUnitIds.length > 0 ||
        m.referredAt !== undefined ||
        m.declines.length > 0 ||
        (m.withdrawnReferrals?.length ?? 0) > 0 ||
        (m.waitlistedUnitIds?.length ?? 0) > 0;
      expect(everAsked).toBe(true);
      expect(byId.get(row.key)!.acceptedUnitId).toBeUndefined();
    }
  });

  it("counts every row once, so the groups still add up", () => {
    const counts = countGroups(census.rows);
    expect(Object.keys(counts).sort()).toEqual(CENSUS_GROUPS.map((group) => group.id).sort());
    expect(Object.values(counts).reduce((sum, n) => sum + n, 0)).toBe(census.rows.length);
  });
});
