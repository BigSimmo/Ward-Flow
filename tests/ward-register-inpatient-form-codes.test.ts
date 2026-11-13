import { describe, expect, it } from "vitest";

import { STANDARD_WARD_SITES } from "@/components/ward-management/ward-sites";
import { officialForms } from "@/lib/form-register";

/**
 * AN INPATIENT WARD MAY NOT LIST A COMMUNITY TREATMENT ORDER AMONG THE FORMS IT HOLDS.
 *
 * `ward-index.tsx` gave every authorised ward a forms line, derived from October 2026 by
 * `wardFormsHeld` from the unit's `authorised` and `forensic` flags (it was a hand-typed `mhaForms`
 * string per ward before). D-170 item 7 (Josh, 13 Nov 2026) dropped that "Forms held" row, so
 * `tests/ward-fix-D-ward-profile.dom.test.tsx` now opens every authorised ward's profile and checks
 * it lists no standing form at all. This file keeps the register checks that guard is built on.
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

/**
 * The community-order codes, read from the register rather than typed here, so that adding a new
 * one to `form-register.ts` extends this guard rather than silently escaping it.
 */
const COMMUNITY_ORDER_CODES = officialForms
  .filter((form) => form.category === "Community treatment orders")
  .map((form) => form.code);

describe("ward register MHA authorities", () => {
  it("reads the register's community-order category at all, so an empty list cannot pass everything", () => {
    // Without this, renaming the category in form-register.ts would empty COMMUNITY_ORDER_CODES and
    // leave every assertion below passing over nothing to look for.
    expect(
      COMMUNITY_ORDER_CODES.length,
      "no form in form-register.ts is categorised 'Community treatment orders' any more — if that " +
        "category was renamed, update this guard in the same change rather than leaving it vacuous",
    ).toBeGreaterThanOrEqual(4);
  });

  it("still covers the standard network, so an emptied register cannot make this file vacuous", () => {
    const units = STANDARD_WARD_SITES.flatMap((site) => site.units);
    expect(units.filter((unit) => unit.authorised).length).toBeGreaterThanOrEqual(20);
  });
});
