import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import { STANDARD_WARD_SITES } from "@/components/ward-management/ward-sites";
import { CLMA_LABEL, VOLUNTARY_ONLY_LABEL, wardFormsHeld } from "@/components/ward-management/wards/ward-index";

/**
 * ALL WARDS: "FORMS HELD" IS READ FROM THE UNIT, NEVER TYPED PER WARD.
 *
 * Review, October 2026: the directory's hand-typed table listed Form 1A / 3A / 6A on both private
 * Subiaco wards, which `ward-sites.ts` records as not authorised; listed a "Form 2" the intake
 * picker does not offer on six older adult wards; listed "CLMA Remand" on Broome, which is not
 * forensic; and gave every ward an invented nurse unit manager's name and extension. The forms are
 * now derived by `wardFormsHeld` from `unit.authorised` and `unit.forensic`, and the contact row
 * is gone.
 */

const WARD_INDEX_PATH = "src/components/ward-management/wards/ward-index.tsx";
const units = STANDARD_WARD_SITES.flatMap((site) => site.units);
const selectableCodes = new Set(SELECTABLE_LEGAL_FORMS.map((form) => `Form ${form.code}`));

describe("All wards: forms held", () => {
  it("covers the standard network, so an empty list cannot pass everything", () => {
    expect(units.length).toBeGreaterThanOrEqual(20);
    expect(units.some((unit) => !unit.authorised)).toBe(true);
  });

  it("shows only codes from the selectable forms list (plus CLMA or the voluntary wording)", () => {
    for (const unit of units) {
      for (const form of wardFormsHeld(unit)) {
        if (form === CLMA_LABEL || form === VOLUNTARY_ONLY_LABEL) continue;
        expect(selectableCodes, `${unit.id}: ${form}`).toContain(form);
      }
    }
  });

  it("shows voluntary only, and no involuntary form, on a unit that is not authorised", () => {
    for (const unit of units.filter((candidate) => !candidate.authorised)) {
      expect(wardFormsHeld(unit), unit.id).toEqual([VOLUNTARY_ONLY_LABEL]);
    }
    for (const id of ["sjgs-adult-open", "sjgs-adult-secure"]) {
      const unit = units.find((candidate) => candidate.id === id)!;
      expect(unit.authorised, id).toBe(false);
      expect(wardFormsHeld(unit).join(" "), id).not.toMatch(/Form|CLMA/u);
    }
    // Even a forensic flag cannot put CLMA on an unauthorised unit.
    expect(wardFormsHeld({ authorised: false, forensic: true })).toEqual([VOLUNTARY_ONLY_LABEL]);
  });

  it("names CLMA only on a forensic unit", () => {
    for (const unit of units) {
      expect(wardFormsHeld(unit).includes(CLMA_LABEL), unit.id).toBe(unit.forensic && unit.authorised);
    }
    const broome = units.find((unit) => unit.id === "brm-adult-secure")!;
    expect(broome.forensic).toBe(false);
    expect(wardFormsHeld(broome)).not.toContain(CLMA_LABEL);
    expect(wardFormsHeld({ authorised: true, forensic: true })).toContain(CLMA_LABEL);
  });

  it("lists the inpatient treatment order, and never a community treatment order, on an authorised unit", () => {
    const forms = wardFormsHeld({ authorised: true, forensic: false });
    expect(forms).toContain("Form 6A");
    expect(forms).not.toContain("Form 5A");
  });

  it("shows no Form 2 anywhere", () => {
    for (const unit of units) expect(wardFormsHeld(unit), unit.id).not.toContain("Form 2");
    expect(readFileSync(WARD_INDEX_PATH, "utf8")).not.toMatch(/\bForm 2\b/u);
  });

  it("renders no nurse unit manager name, extension or Vocera handle", () => {
    const source = readFileSync(WARD_INDEX_PATH, "utf8");
    expect(source).not.toMatch(/NUM on shift/u);
    expect(source).not.toMatch(/\bext \{|\bext:\s*"/u);
    expect(source).not.toMatch(/#NUM-\d/u);
    expect(source).not.toMatch(/\bnum:\s*"/u);
    expect(source).not.toMatch(/\bvocera\b/iu);
    // The old fallback's invented values.
    expect(source).not.toMatch(/Adult acute clinical assessment|Shift coordinator|"2000"/u);
  });

  it("types no legal form by hand in the ward table", () => {
    const source = readFileSync(WARD_INDEX_PATH, "utf8");
    expect(source).not.toMatch(/mhaForms/u);
  });
});
