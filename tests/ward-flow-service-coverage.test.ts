import { readFileSync } from "node:fs";

import { stripSourceComments } from "./helpers/strip-source-comments";
import { describe, expect, it } from "vitest";

import { wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";

/**
 * A health service cannot go missing from the screens that group by it.
 *
 * WHY THIS EXISTS. The owner intends to replace this invented network with real WA figures and,
 * in his words, to allow "real parts changing in real life as well ... i.e. building another
 * hospital or more beds". A hospital in a SIXTH health service was, until 2026-08-29, a silent
 * data loss: `HealthService` was a bare type union with no runtime array — the only multi-value
 * union in `ward-model.ts` without one — the five services were re-typed by hand in
 * `wardServiceOrder`, and `ward-management-network.tsx` tested membership through a
 * `readonly string[]` cast that defeated the compiler too. Add the sixth and it compiled clean,
 * then simply was not on the network map or the ED screen's unit table. No error, no red test.
 *
 * `ward-model.ts`'s own `COHORTS` comment records the same defect having already happened once
 * with `Cohort`, which is why this is a repeat rather than a hypothetical.
 *
 * WHY ONE ASSERTION IS ENOUGH, and this is the part worth reading before adding more. Every
 * surface that groups by health service derives its list from `wardServiceOrder` rather than
 * holding its own — verified when this was written, and pinned by the second test below:
 *
 *   (ed/ed-screen.tsx's statewide unit table left the ED page on 11 Oct 2026, device audit pick A2;
 *    the Capacity page owns that table now, so the ED screen no longer groups by service.)
 *   ward-management-network.tsx       `columnServices.right` is `wardServiceOrder.filter(...)`
 *   coordinator/flow-diagram.tsx      groups by `wardServiceOrder`
 *   wards/ward-index.tsx              headings run in `wardServiceOrder`
 *
 * So a service present in `HEALTH_SERVICES` and absent from `wardServiceOrder` is invisible on all
 * three, and a service present in both is visible on all three. The completeness of that ONE list is
 * the whole property.
 *
 * WHAT THIS DOES NOT CLAIM. It does not check which COLUMN a service lands in on the network map —
 * `LEFT_COLUMN_SERVICES` decides that, and a service missing from it still appears, on the right.
 * Placement is a presentation choice; presence is the safety property. Stated so the next reader
 * knows the gap is deliberate rather than overlooked.
 */

/** The two surfaces that group by health service (three until the Network screen's map was
 *  retired, 19 Oct 2026). Each must derive from `wardServiceOrder` rather
 *  than hold its own copy — that is what makes the single completeness assertion above sufficient
 *  for all of them, and re-typing a list here is exactly how the original hole was dug. */
const SERVICE_GROUPING_SURFACES = new Map([
  ["src/components/ward-management/coordinator/flow-diagram.tsx", "the flow diagram's service groups"],
  ["src/components/ward-management/wards/ward-index.tsx", "the ward index's service headings"],
]);

describe("no health service can go missing from the screens that group by it", () => {
  it("knows what it is checking, so it cannot pass by scanning nothing", () => {
    // The canary. Both assertions below pass by finding no discrepancy, which reads identically to
    // an empty list on either side.
    expect(HEALTH_SERVICES.length).toBeGreaterThan(1);
    expect(wardServiceOrder.length).toBeGreaterThan(1);
    expect(SERVICE_GROUPING_SURFACES.size).toBe(2);
  });

  it("orders exactly the health services that exist, each once", () => {
    const declared = [...HEALTH_SERVICES].sort();
    const ordered = [...wardServiceOrder].sort();

    expect(
      ordered,
      "wardServiceOrder and HEALTH_SERVICES disagree. Every screen that groups by health service " +
        "derives its list from wardServiceOrder, so a service in HEALTH_SERVICES and missing here " +
        "is absent from the ED unit table, the flow diagram and the ward index — " +
        "silently, with no error and no other failing test. Add it to wardServiceOrder, deciding " +
        "where in the order it belongs; do not remove it from HEALTH_SERVICES to make this pass.",
    ).toEqual(declared);

    expect(new Set(wardServiceOrder).size, "wardServiceOrder contains a duplicate").toBe(wardServiceOrder.length);
  });

  it("keeps every grouping surface deriving from that one list rather than holding its own", () => {
    const offenders = [...SERVICE_GROUPING_SURFACES.keys()].filter(
      /*
       * ⚠️ COMMENTS STRIPPED FIRST, AND THIS GUARD WAS PROVED DEFEATED WITHOUT IT. Two-step
       * mutation on 2026-09-04: rename every real `wardServiceOrder` use in `wards/ward-index.tsx`
       * away and this test correctly goes red (3 collected, 1 failed). Then add ONE comment line
       * mentioning `wardServiceOrder` — changing nothing about the broken code — and it passes,
       * 3 of 3. The single assertion this file exists for was fully satisfied by prose.
       *
       * 🔴 THAT IS THE SILENT DIRECTION. A comment that BREAKS a guard is loud and gets fixed
       * within the hour. A comment that SATISFIES one is a check that cannot fail, and the screen
       * it was watching can revert to a hand-typed service list — the exact regression this file
       * was written for, which had already happened once — with nothing to say so.
       */
      (file) => !stripSourceComments(readFileSync(file, "utf8")).includes("wardServiceOrder"),
      // 🔴 STILL DEFEATED BY A TRAILING `// wardServiceOrder`, and that is measured, not feared.
      // `stripSourceComments` strips a line comment ONLY when the line begins with `//` — a
      // deliberate choice recorded in the helper, because widening it would eat the `//` in a URL
      // or a regex. Verified 2026-09-04: broken code plus `const x = 1; // wardServiceOrder`
      // passes 3 of 3. The realistic shape — a comment on its own line — IS caught. Do not read
      // this guard as closed; read it as narrowed from "any mention" to "a mention on a code line".
      // Pinned executably in tests/ward-guard-comment-blindness.test.ts (CHARACTERISATION).
    );

    expect(
      offenders,
      "A surface that groups by health service no longer derives from wardServiceOrder. The " +
        "completeness check above only protects these screens while they all read that one list — " +
        "a hand-written copy is exactly how the original hole was dug, and it would be invisible " +
        "to every other test.",
    ).toEqual([]);
  });
});
