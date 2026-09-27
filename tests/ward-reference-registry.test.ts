import { describe, expect, it } from "vitest";

import {
  referenceEntitiesOfKind,
  referenceEntity,
  WARD_REFERENCE_ENTITIES,
} from "../src/components/ward-management/reference/ward-reference-registry";

/**
 * The real WA names Ward Flow is allowed to use, and the boundary that keeps the pack's UNRATIFIED
 * NUMBERS out of the app.
 *
 * 🔴 THE FIRST TEST IS THE WHOLE POINT, AND IT IS STRUCTURAL RATHER THAN A POLICY. Every row in
 * `docs/ward-flow/reference-data/` carries `operational_use_approved: false` and
 * `automatic_routing_approved: false`. Graylands is published as BOTH 109 and 122 beds, and the
 * pack's own decision on it is "prefer neither". The pack's INGEST_MAP recommends a CI rule
 * forbidding `staffed_beds` from reaching the tip fixtures.
 *
 * A rule like that depends on someone remembering it. A type with no number in it does not: there
 * is no field to import, so there is no import to police. The assertion below walks every property
 * of every entity and fails on any number at all — including one added innocently later, which is
 * how this would actually break.
 */
describe("the WA reference registry", () => {
  it("carries no numeric field, so no unratified figure can reach a screen from here", () => {
    for (const entity of WARD_REFERENCE_ENTITIES) {
      for (const [key, value] of Object.entries(entity)) {
        expect(typeof value, `${entity.id}.${key} is a number; the registry must carry none`).not.toBe("number");
        if (Array.isArray(value)) {
          for (const item of value) {
            expect(typeof item, `${entity.id}.${key}[] contains a number`).not.toBe("number");
          }
        }
      }
    }
  });

  it("holds every named ward and unit the pack records", () => {
    expect(referenceEntitiesOfKind("named_ward")).toHaveLength(14);
    expect(referenceEntitiesOfKind("named_unit")).toHaveLength(12);
  });

  it("holds all twelve emergency departments, including the two the app is missing", () => {
    const eds = referenceEntitiesOfKind("emergency_department");
    expect(eds).toHaveLength(12);
    expect(eds.map((ed) => ed.id)).toEqual(expect.arrayContaining(["ed-kemh", "ed-pch"]));
  });

  it("holds the facilities and community services", () => {
    expect(referenceEntitiesOfKind("facility")).toHaveLength(28);
    expect(referenceEntitiesOfKind("community_service")).toHaveLength(32);
  });

  it("carries the real ward names, not the demo's invented ones", () => {
    const names = referenceEntitiesOfKind("named_ward").map((entity) => entity.name);
    expect(names).toContain("Ward 2K");
    expect(names).toContain("Moodjar");
    // The register holds real ward names only. The demo's invented placeholders — built as
    // "<SITE> <cohort>", e.g. the one Royal Perth's unit used to carry — must never appear in it.
    expect(names.some((name) => /^(RPH|SCGH|FSH|ARM|SJGM|RGH|FRE|BTY|GRY) /.test(name))).toBe(false);
  });

  it("resolves an id, and returns null rather than a near miss", () => {
    expect(referenceEntity("rph-2k")?.name).toBe("Ward 2K");
    expect(referenceEntity("rph-2")).toBeNull();
    expect(referenceEntity("")).toBeNull();
  });

  it("has unique ids across every kind, because callers key on the id alone", () => {
    const ids = WARD_REFERENCE_ENTITIES.map((entity) => entity.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("carries no replacement characters, so no name was mangled in transit", () => {
    for (const entity of WARD_REFERENCE_ENTITIES) {
      expect(entity.name, entity.id).not.toMatch(/�/);
    }
  });

  it("every ward and unit points at a facility that is itself in the registry", () => {
    const facilities = new Set(referenceEntitiesOfKind("facility").map((entity) => entity.id));
    for (const entity of [...referenceEntitiesOfKind("named_ward"), ...referenceEntitiesOfKind("named_unit")]) {
      expect(entity.facilityId, `${entity.id} has no facility`).not.toBeNull();
      expect(facilities.has(entity.facilityId!), `${entity.id} -> ${entity.facilityId}`).toBe(true);
    }
  });

  it("every entity carries at least one source id", () => {
    // Provenance is the reason to prefer these names over invented ones. A row without it is a
    // name somebody typed, which is what the demo fixtures already are.
    for (const entity of WARD_REFERENCE_ENTITIES) {
      expect(entity.sourceIds.length, `${entity.id} has no source`).toBeGreaterThan(0);
    }
  });
});
