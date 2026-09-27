import { describe, expect, it } from "vitest";

import { OVERRIDE_REASONS } from "@/components/ward-management/ward-change-reasons";
import { genderEligibility } from "@/components/ward-management/ward-eligibility";
import type { Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";

const NOW = 10 * 60 + 42;

/**
 * A minimal ward, shaped like `tests/ward-eligibility.test.ts`'s own `unit()` helper (kept as a
 * separate copy rather than imported: that file's subject is the thirteen movement/referral gates,
 * this file's subject is one standalone gender gate that reads a `Patient`, never a `Movement` or
 * `Referral` — sharing a fixture builder across the two would blur that boundary).
 */
function unit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "u-test",
    siteCode: "RPH",
    name: "Test Unit",
    cohort: "Adult",
    lockedBeds: 0,
    authorised: true,
    beds: 20,
    empty: { value: 3, source: "feed", confirmedAt: NOW - 2, staleAfterMinutes: 15 },
    allocatable: { value: 2, source: "ward", confirmedAt: NOW - 10, staleAfterMinutes: 120 },
    allocatableLocked: 0,
    held: 0,
    blocked: 0,
    sexMix: { Female: 10, Male: 8 },
    speciallingCapacity: 1,
    highAcuityCapacity: 1,
    sexDesignation: "Undesignated",
    forensic: false,
    ...overrides,
  };
}

function patient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "PT-T01",
    umrn: "UM900000",
    givenName: "Testable",
    familyName: "Quillfeather",
    dateOfBirth: "1990-06-01",
    ...overrides,
  };
}

/**
 * The fixture the six assertions below share. Assertion 5's anti-vacuity floor checks THIS array
 * directly, so a fixture edited down to something that no longer proves separation (every patient's
 * `sex` and `gender` agreeing, or nobody with `gender` unset) fails by name rather than letting the
 * assertions above pass on a fixture that can no longer distinguish the old behaviour from the new.
 */
const FIXTURE_PATIENTS: readonly Patient[] = [
  // Sex and gender agree — the ordinary case, and NOT what proves anything on its own.
  patient({ id: "PT-T01", sex: "Female", gender: "Female" }),
  // Sex and gender DISAGREE — the one patient that proves the two fields are read independently.
  // A version of the gate that reads `.sex` instead of `.gender` passes every OTHER assertion in
  // this file and fails only on this patient.
  patient({ id: "PT-T02", sex: "Male", gender: "Female" }),
  // Sex recorded, gender genuinely not yet recorded — the honest "cannot answer" state, mirroring
  // PT-007 in `ward-patients-seed.ts` (a non-binary patient the two-value `gender` field cannot
  // represent, so it is left undefined rather than forced).
  patient({ id: "PT-T03", sex: "Non-binary" }),
];

const [agrees, disagrees, unrecorded] = FIXTURE_PATIENTS;

describe("the gender gate — owner ruling 2026-09-09/2026-09-10, closing P1 #BAY1TY", () => {
  it("1. refuses a male-designated bed for a patient recorded Female, and names gender, not sex", () => {
    const maleOnly = unit({ sexDesignation: "Male only" });
    const result = genderEligibility(agrees, maleOnly);

    expect(result.pass, "a Female-gender patient must not be matched to a male-only bed").toBe(false);
    expect(result.detail.toLowerCase(), `detail was "${result.detail}"`).toContain("gender");
    expect(
      result.detail.toLowerCase(),
      `the refusal must name GENDER, never SEX — detail was "${result.detail}"`,
    ).not.toContain("sex");
  });

  it("2. matches on gender even when the recorded sex disagrees — proves the two fields are separate", () => {
    // `disagrees` carries sex: "Male", gender: "Female". If the gate ever reads `.sex` instead of
    // `.gender` (the exact defect this ruling closes), this patient is matched backwards: accepted
    // at the male-only bed and refused at the female-only one.
    expect(disagrees.sex, "the fixture must actually disagree, or this test proves nothing").not.toBe(disagrees.gender);

    const femaleOnly = unit({ sexDesignation: "Female only" });
    const maleOnly = unit({ sexDesignation: "Male only" });

    expect(
      genderEligibility(disagrees, femaleOnly).pass,
      "gender is Female, so a female-only bed must accept this patient regardless of the recorded sex",
    ).toBe(true);
    expect(
      genderEligibility(disagrees, maleOnly).pass,
      "gender is Female, so a male-only bed must refuse this patient regardless of the recorded sex",
    ).toBe(false);
  });

  it("3. per WLQ-35, an unrecorded gender is placed at a ward that takes either gender, and refused elsewhere", () => {
    expect(unrecorded.gender, "the fixture's third patient must genuinely have no gender recorded").toBeUndefined();

    // Owner ruling WLQ-35 (2026-09-15): "a person with no recorded gender may be placed on a ward
    // that takes either gender, and is refused on a single-gender ward until gender is recorded."
    const undesignated = unit({ sexDesignation: "Undesignated" });
    const undesignatedResult = genderEligibility(unrecorded, undesignated);

    expect(
      undesignatedResult.pass,
      "an Undesignated ward takes either gender, so an unrecorded gender must still be placed",
    ).toBe(true);
    expect(
      undesignatedResult.detail.toLowerCase(),
      `detail must say gender is not recorded — detail was "${undesignatedResult.detail}"`,
    ).toContain("not yet recorded");
    expect(
      undesignatedResult.detail.toLowerCase(),
      `detail must say the ward takes either gender — detail was "${undesignatedResult.detail}"`,
    ).toContain("either gender");

    for (const designation of ["Female only", "Male only"] as const) {
      const designatedUnit = unit({ sexDesignation: designation });
      const result = genderEligibility(unrecorded, designatedUnit);

      expect(result.pass, `an unrecorded gender must not be placed at a ${designation} ward`).toBe(false);
      expect(
        result.detail.toLowerCase(),
        `a gate that cannot answer must not say "refused" — detail was "${result.detail}"`,
      ).not.toContain("refus");
      expect(
        result.detail.toLowerCase(),
        `detail must name "not yet recorded" — detail was "${result.detail}"`,
      ).toContain("not yet recorded");
    }
  });

  it("4. no override reason the model defines can pass the gender gate", () => {
    const maleOnly = unit({ sexDesignation: "Male only" });

    // Every reason, not one — a gate that only special-cases a single string would slip past a
    // tenth reason nobody wrote a test for.
    for (const reason of OVERRIDE_REASONS) {
      const result = genderEligibility(agrees, maleOnly, reason);
      expect(result.pass, `override reason "${reason}" must not pass the gender gate`).toBe(false);
    }
    // And with no override argument at all — the ordinary call shape.
    expect(genderEligibility(agrees, maleOnly).pass).toBe(false);
  });

  it("5. anti-vacuity floor: the reason list and the fixture actually exercise what 1-4 and 6 claim", () => {
    expect(
      OVERRIDE_REASONS.length,
      "OVERRIDE_REASONS must not be empty, or assertion 4 iterates over nothing and proves nothing",
    ).toBeGreaterThan(0);
    expect(
      FIXTURE_PATIENTS.some((candidate) => candidate.gender !== undefined),
      "the fixture must include at least one patient with a recorded gender",
    ).toBe(true);
    expect(
      FIXTURE_PATIENTS.some((candidate) => candidate.gender === undefined),
      "the fixture must include at least one patient with gender absent",
    ).toBe(true);
  });

  it("6. the not-yet-recorded state is never derived from sex, even when sex would coincidentally match", () => {
    // `unrecorded` carries sex: "Non-binary" and no gender. Pointed at an UNDESIGNATED bed above
    // (assertion 3) proves nothing about defaulting, because an undesignated bed accepts anyone
    // regardless of the gate's answer. Here the bed is designated for the value `sex` alone would
    // suggest as a fallback, so a reintroduced `gender ?? (sex as Gender)` shortcut would wrongly
    // PASS this case where every other assertion in this file stays green.
    const maleOnly = unit({ sexDesignation: "Male only" });
    const femaleOnly = unit({ sexDesignation: "Female only" });

    for (const designatedUnit of [maleOnly, femaleOnly]) {
      const result = genderEligibility(unrecorded, designatedUnit);
      expect(
        result.pass,
        `a patient with no gender recorded must not be silently matched via their sex against ${designatedUnit.sexDesignation}`,
      ).toBe(false);
      expect(result.detail.toLowerCase()).toMatch(/not yet recorded|cannot determine/);
    }
  });
});
