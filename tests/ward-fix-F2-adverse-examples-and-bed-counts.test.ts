import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import {
  adverseExampleWard,
  mayCarryAdverseExample,
  wardCarriesRealName,
} from "@/components/ward-management/ward-demo-adverse-wards";
import { allUnits } from "@/components/ward-management/ward-sites";

/**
 * Audit 15 (Josh, 13 Nov 2026).
 * A15-27: an invented incident, closure, intake limit, closed bed or staff request is seeded only on
 * a ward with a generic or fictional label, never beside a real ward's own name. The Seclusion rooms
 * list is kept as it is (script step 6B).
 * A15-28: no ward's bed count equals the reference pack's published count, but for the one approved
 * exception, recorded by id.
 * A15-29: designations that only exercise a matching rule sit on generic-label wards.
 */

describe("A15-27 the shared rule for adverse examples", () => {
  it("tells a real ward name from a generic or fictional label", () => {
    expect(wardCarriesRealName({ name: "Maali (Ward 4.2)" })).toBe(true);
    expect(wardCarriesRealName({ name: "Mental Health Unit" })).toBe(true);
    expect(wardCarriesRealName({ name: "Mabu Liyan / Broome Mental Health Unit" })).toBe(true);
    expect(wardCarriesRealName({ name: "RGH Adult Secure" })).toBe(false);
    expect(wardCarriesRealName({ name: "Graylands Older Adult" })).toBe(false);
    expect(wardCarriesRealName({ name: "Fictional Quartz Adult Ward 1" })).toBe(false);
  });

  it("passes over a preferred ward that carries a real name", () => {
    const units = [
      { id: "named", name: "Maali (Ward 4.2)" },
      { id: "generic", name: "FRE Adult Open" },
    ];
    expect(adverseExampleWard(units, "named")?.id).toBe("generic");
    expect(adverseExampleWard(units, "generic")?.id).toBe("generic");
  });

  it("seeds no incident, closure, intake limit, closed bed or staff request on a real-named ward", () => {
    for (const scenario of WARD_SCENARIOS) {
      const state = seedWardFlowState(scenario);
      const named = state.units.filter(wardCarriesRealName);
      // The fictional network carries no real ward name at all.
      if (scenario === "standard") expect(named.length, scenario).toBeGreaterThan(0);
      for (const unit of named) {
        const where = `${scenario} ${unit.name}`;
        expect(unit.restrictivePractice?.incidents ?? [], where).toEqual([]);
        expect(unit.isClosed ? unit.admissionsClosure : undefined, where).toBeUndefined();
        expect(unit.intakeConstraints ?? [], where).toEqual([]);
        expect(unit.closedBeds ?? [], where).toEqual([]);
      }
      const namedIds = new Set(named.map((unit) => unit.id));
      expect(
        (state.staffRequests ?? []).filter((request) => namedIds.has(request.unitId)).map((r) => r.unitId),
        scenario,
      ).toEqual([]);
    }
  });

  it("still seeds the examples, on generic-label wards, and keeps every secure ward's room status", () => {
    const state = seedWardFlowState();
    const incidents = state.units.flatMap((unit) => unit.restrictivePractice?.incidents ?? []);
    expect(incidents.length).toBeGreaterThan(0);
    expect(state.units.some((unit) => (unit.closedBeds ?? []).length > 0)).toBe(true);
    expect(state.units.some((unit) => unit.isClosed && mayCarryAdverseExample(unit))).toBe(true);
    expect((state.staffRequests ?? []).length).toBe(1);
    // The Seclusion rooms list reads room status, which named secure wards keep (Josh's ruling).
    const rooms = state.units.filter((unit) => unit.restrictivePractice?.seclusionRoom);
    expect(rooms.some(wardCarriesRealName)).toBe(true);
  });
});

/** The pack's published counts, by the reference ward each demo ward points at. */
const PACK = JSON.parse(readFileSync("docs/ward-flow/reference-data/capacity_assertions.json", "utf8")) as {
  capacity_assertions: { target_id: string; value: number; capacity_type: string }[];
};

/**
 * A15-28: the one published figure kept on purpose. Josh, 26 Sept 2026 ("Confirmed public fact:
 * Mabu Liyan has 13 beds", `ward-sites.ts`). Whether it stays is his earlier ruling, not this test's.
 */
const APPROVED_PUBLISHED_COUNTS: Readonly<Record<string, string>> = {
  "brm-adult-secure": "Josh, 26 Sept 2026: Mabu Liyan's published 13 beds",
};

describe("A15-28 no ward's bed count equals its published figure", () => {
  const matches = allUnits().flatMap((unit) => {
    if (!unit.referenceUnitId) return [];
    return PACK.capacity_assertions
      .filter((assertion) => assertion.target_id === unit.referenceUnitId && assertion.value === unit.beds)
      .map((assertion) => ({ id: unit.id, beds: unit.beds, type: assertion.capacity_type }));
  });

  it("finds no match outside the approved exception", () => {
    expect(matches.filter((match) => !(match.id in APPROVED_PUBLISHED_COUNTS))).toEqual([]);
  });

  it("keeps the exception list honest: each listed ward still matches, so a stale entry is removed", () => {
    for (const id of Object.keys(APPROVED_PUBLISHED_COUNTS))
      expect(
        matches.some((match) => match.id === id),
        id,
      ).toBe(true);
  });
});

describe("A15-29 matching-rule designations sit on generic-label wards", () => {
  it("gives no real-named ward a sex designation, a forensic flag or a not-authorised mark", () => {
    const named = allUnits().filter(wardCarriesRealName);
    expect(named.length).toBeGreaterThan(0);
    for (const unit of named) {
      expect(unit.sexDesignation ?? "Undesignated", unit.id).toBe("Undesignated");
      expect(unit.forensic ?? false, unit.id).toBe(false);
      expect(unit.authorised ?? true, unit.id).toBe(true);
    }
  });
});
