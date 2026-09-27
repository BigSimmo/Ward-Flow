import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { officialForms } from "@/lib/form-register";

/**
 * AN INPATIENT WARD MAY NOT LIST A COMMUNITY TREATMENT ORDER AMONG THE FORMS IT HOLDS.
 *
 * `ward-index.tsx` gives every ward an `mhaForms` line — the Mental Health Act 2014 authorities
 * under which that unit holds people. It renders on the ward profile as "WA MHA 2014 · {forms}".
 *
 * ⚠️ **WHY THIS FILE EXISTS, 2026-09-18.** All 24 ward entries and the unknown-ward fallback named
 * **Form 5A**. The register titles 5A "Community Treatment Order" — an order for treatment **in the
 * community**, which is the one place these patients are not. Every entry carrying it is a locked
 * HDU, a psychogeriatric unit, a forensic secure unit, a perinatal secure unit or an open inpatient
 * ward; not one is a community team. The inpatient authority is **Form 6A**, "Inpatient treatment
 * order in authorised hospital".
 *
 * 🔴 **AND IT HAD ALREADY BEEN RULED ON, TWICE, WITHOUT REACHING HERE.**
 * `tests/ward-legal-figure-guard.test.ts` records "Form 5A is a Community Treatment Order in the
 * register, never an involuntary inpatient status", and three screens — patient search, settings,
 * the movement horizon — each carry their own guard forbidding the string. The ward register had
 * none, so the ruling stopped at the screens somebody had already found it on. **A ruling enforced
 * per-screen protects only the screens somebody thought to check.** This guard is keyed on the
 * register's own categories instead, so a new community form code inherits it without an edit.
 *
 * **What this does NOT cover.** `handover-page.tsx` captioned a "Recorded form timings" panel
 * "Form 1A / Form 4A / Form 5A" while the panel below it renders only 1A and 4A items; that caption
 * was corrected in the same change and is NOT guarded here, because the property it broke is
 * "a caption names only what its own panel shows", which this file cannot see. If that panel gains
 * a form, nothing will notice the caption disagreeing.
 *
 * **Widening this test to let a community code through would remove the only thing that reports
 * the change.** If a ward genuinely holds someone on a community order — a leave arrangement, a
 * CTO written on the day of discharge — that belongs in a patient record, not in the ward's
 * standing list of authorities.
 */

const WARD_INDEX_PATH = "src/components/ward-management/wards/ward-index.tsx";

/** Every `mhaForms: "…"` value as written in source, including the unknown-ward fallback. */
function declaredFormLines(source: string): string[] {
  return [...source.matchAll(/mhaForms:\s*"([^"]+)"/gu)].map((entry) => entry[1]);
}

/**
 * The community-order codes, read from the register rather than typed here, so that adding a new
 * one to `form-register.ts` extends this guard rather than silently escaping it.
 */
const COMMUNITY_ORDER_CODES = officialForms
  .filter((form) => form.category === "Community treatment orders")
  .map((form) => form.code);

describe("ward register MHA authorities", () => {
  const source = readFileSync(WARD_INDEX_PATH, "utf8");
  const formLines = declaredFormLines(source);

  it("reads the register's community-order category at all, so an empty list cannot pass everything", () => {
    // Without this, renaming the category in form-register.ts would empty COMMUNITY_ORDER_CODES and
    // leave every assertion below passing over nothing to look for.
    expect(
      COMMUNITY_ORDER_CODES.length,
      "no form in form-register.ts is categorised 'Community treatment orders' any more — if that " +
        "category was renamed, update this guard in the same change rather than leaving it vacuous",
    ).toBeGreaterThanOrEqual(4);
  });

  it("still declares ward authorities at all, so a deletion cannot make this file vacuous", () => {
    expect(
      formLines.length,
      `${WARD_INDEX_PATH} declares ${formLines.length} mhaForms lines; it carried 25 when this ` +
        "guard was written. A large drop means the register was gutted, not that it became safe.",
    ).toBeGreaterThanOrEqual(20);
  });

  it("names no community treatment order on any inpatient ward", () => {
    const offenders = formLines.flatMap((line) =>
      COMMUNITY_ORDER_CODES.filter((code) => new RegExp(`\\bForm ${code}\\b`, "u").test(line)).map(
        (code) => `${code} in "${line}"`,
      ),
    );
    expect(
      offenders,
      "a ward lists a community treatment order among the authorities it holds people under. " +
        "Every entry in this register is an inpatient unit, so the authority is Form 6A " +
        "(Inpatient treatment order in authorised hospital). Correct the entry — never widen " +
        "this guard to accept it.",
    ).toEqual([]);
  });

  it("names the inpatient treatment order, so the correction is present rather than merely absent", () => {
    // The assertion above passes just as well if every mhaForms line were emptied. This one fails
    // in that case, and fails again if a later edit quietly drops 6A back out.
    const withInpatientOrder = formLines.filter((line) => /\bForm 6A\b/u.test(line));
    expect(
      withInpatientOrder.length,
      "no ward names Form 6A. The inpatient treatment order is the authority almost every unit " +
        "here holds people under; its total absence means the register is describing something else.",
    ).toBeGreaterThanOrEqual(20);
  });
});
