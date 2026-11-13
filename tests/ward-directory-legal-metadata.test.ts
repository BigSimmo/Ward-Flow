import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { STANDARD_WARD_SITES } from "@/components/ward-management/ward-sites";

/**
 * ALL WARDS: "FORMS HELD" IS READ FROM THE UNIT, NEVER TYPED PER WARD.
 *
 * Review, October 2026: the directory's hand-typed table listed Form 1A / 3A / 6A on both private
 * Subiaco wards, which `ward-sites.ts` records as not authorised; listed a "Form 2" the intake
 * picker does not offer on six older adult wards; listed "CLMA Remand" on Broome, which is not
 * forensic; and gave every ward an invented nurse unit manager's name and extension. The forms are
 * then derived by `wardFormsHeld` from `unit.authorised` and `unit.forensic`, and the contact row
 * went. D-170 item 7 and check pack E1 (Josh, 13 Nov 2026) then dropped the "Forms held" row with
 * its "CLMA" chip, and the invented "Admits" lines, until a service supplies its own words.
 */

const WARD_INDEX_PATH = "src/components/ward-management/wards/ward-index.tsx";
const units = STANDARD_WARD_SITES.flatMap((site) => site.units);

describe("All wards: ward profile", () => {
  it("covers the standard network, so an empty list cannot pass everything", () => {
    expect(units.length).toBeGreaterThanOrEqual(20);
    expect(units.some((unit) => !unit.authorised)).toBe(true);
  });

  it("shows no Forms held row, no CLMA chip and no invented Admits lines (D-170 item 7, E1)", () => {
    const source = readFileSync(WARD_INDEX_PATH, "utf8");
    expect(source).not.toMatch(/<dt>Forms held<\/dt>|<dt>Admits<\/dt>/u);
    expect(source).not.toMatch(/\bCLMA\b|WARD_ADMITS|wardFormsHeld/u);
    // Two of the invented sentences, so a pasted-back table fails too.
    expect(source).not.toMatch(/Inner-city high-acuity crisis assessment|psychiatric containment/u);
  });

  it("shows no Form 2 anywhere", () => {
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
