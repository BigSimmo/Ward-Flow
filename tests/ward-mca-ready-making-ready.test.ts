import { describe, expect, it } from "vitest";

import { searchWardFlow, unitReadyBedCount } from "@/components/ward-management/search/ward-smart-search";
import { bedStates, readyBedsNow } from "@/components/ward-management/ward-bed-states";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * M7 (mechanics and clock audit, 14 Nov 2026; D-179 item 8): a bed still being made ready is not
 * Ready. The ward peek, Search and the global search preview counted it as Ready because they
 * passed no bed releases, so they read one higher than Capacity, Home and the nav whenever a bed
 * was being made ready. Synthetic seed data only.
 */
const seed = seedWardFlowState();
const holds = [...seed.movements, ...seed.referrals];
const unit = seed.units.find(
  (candidate) => (unitReadyBedCount(candidate, seed.admissions, holds, seed.bedReleases) ?? 0) >= 2,
)!;

// One bed on this ward discharged and still being cleaned.
const cleaning: BedRelease = {
  ...(seed.bedReleases.find((release) => release.unitId === unit.id) ?? seed.bedReleases[0]!),
  id: "WR-MCA-CLEAN",
  unitId: unit.id,
  admissionId: "AD-MCA-CLEAN",
  state: "discharged",
  preparing: true,
  blocker: null,
};
const releases = [...seed.bedReleases.filter((release) => release.id !== cleaning.id), cleaning];

describe("M7: Search and the ward peek leave a bed being made ready out of Ready", () => {
  it("reaches the case: the ward has a bed being made ready", () => {
    expect(unit, "a ward with two ready beds in the seed").toBeDefined();
    expect(bedStates(unit, seed.admissions, releases, [], holds).beingMadeReady).toBeGreaterThan(0);
  });

  it("Search's ward ready count is Capacity's Ready, not one more", () => {
    const capacity = readyBedsNow(unit, seed.admissions, releases, holds);
    expect(unitReadyBedCount(unit, seed.admissions, holds, releases)).toBe(capacity);
    expect(unitReadyBedCount(unit, seed.admissions, holds, [])).toBe(capacity + 1);
  });

  it("the ward result in global search carries the same count", () => {
    const results = searchWardFlow({
      query: unit.name,
      patients: seed.patients,
      movements: seed.movements,
      units: seed.units,
      referrals: seed.referrals,
      admissions: seed.admissions,
      bedReleases: releases,
      now: NOW_ANCHOR,
    });
    const ward = results.wards.find((result) => result.unit.id === unit.id);
    expect(ward?.readyBeds).toBe(readyBedsNow(unit, seed.admissions, releases, holds));
  });
});
