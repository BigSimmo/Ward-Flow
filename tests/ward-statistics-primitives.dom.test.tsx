/**
 * 🔴 **RETIRED 2026-09-06 — OWNER RULING: THE ELEVEN REPLACED WARD SCREENS ARE FINISHED WITH.**
 *
 * `StatFootnote` is reached by no route. These 2 cases are skipped, not deleted: the
 * source stays, and every case's own words are recorded in
 * `docs/ward-flow/retired-coverage-record-2026-09-06.md` so the cover is recoverable if the
 * screen is ever revived. ⚠️ **A retired test with no record of its subject is a deletion
 * wearing a softer word.**
 *
 * ⚠️ **THE COMPONENT IS NOT DELETED BY THIS RULING, AND THAT IS DELIBERATE.** This repository
 * forbids removing an exported symbol on a "nothing imports it" basis, and three of the defects
 * found on 2026-09-06 were held in place BY unreachability — which is more fragile than a live
 * defect, not less. **An unreachable wrong screen is a fix, not a delete.** What closes here is
 * the false coverage, which was the actual harm.
 *
 * **Do not un-skip these to make a number go up.** `tests/ward-component-reachability.test.ts`
 * reddens if this component becomes reachable again, and that is the signal to restore cover —
 * from the record, deliberately, not by deleting a `.skip`.
 */
/**
 * ✅ **COVER RESTORED 2026-09-07 — `StatFootnote` IS REACHED BY A ROUTE AGAIN, AND THE GUARD IS WHAT
 * SAID SO.** The paragraph below described the state until 2026-09-06 and is kept, because the
 * reasoning in it is why these cases were skipped rather than deleted and is what makes restoring
 * them legitimate rather than a number going up.
 *
 * **What changed:** `statistics-service-screen.tsx` imports `StatFootnote` (`:7`) and renders it
 * (`:370`), and `/mockups/ward-flow/statistics/service/[serviceId]` renders that screen. So these
 * cases now cover something a coordinator can open.
 *
 * ⚠️ **RESTORED THROUGH THE PROCEDURE THIS FILE ITSELF PRESCRIBES, NOT BY DELETING A `.skip`.** Its
 * own instruction reads: *"Do not un-skip these to make a number go up. `ward-component-
 * reachability.test.ts` reddens if this component becomes reachable again, and that is the signal to
 * restore cover — from the record, deliberately."* **That guard did redden**, naming the module and
 * the declaration to delete. This is that signal being obeyed.
 *
 * 🔴 **AND THE HALF-FIX IS THE POINT WORTH KEEPING.** Deleting the `DECLARED_UNREACHABLE` entry was
 * done first and on its own, with a commit message claiming these tests "now are counted as real
 * coverage by construction". **That was false while they were still skipped** — the entry and the
 * skip are two halves of one arrangement, and the guard only reddens on the first. **A guard that
 * catches one half of a pair will be satisfied by fixing that half**, and the tree then reads as
 * fully repaired.
 *
 * ── the state until 2026-09-06, kept for its reasoning ──
 *
 * ⚠️ **NO ROUTE REACHES THE SCREEN THIS FILE RENDERS.** `StatFootnote` — referenced by nothing in src/ at all
 * (measured 2026-09-06, `docs/ward-flow/unreachable-ward-screens-2026-09-06.md`).
 *
 * **These cases passed and always would have. They were not coverage of anything a coordinator
 * could open.** ⚠️ **The line above this one used to say nothing here was skipped or retired.
 * That stopped being true on 2026-09-06 and is corrected rather than left standing.**
 *
 * ⚠️ **THIS COMMENT IS A POINTER, NOT THE GUARANTEE.** A comment saying a screen is
 * unreachable stays exactly as true-looking on the day it becomes reachable again.
 * `tests/ward-component-reachability.test.ts` holds the property: it reddens if this file
 * starts rendering a newly orphaned component, AND it reddens if the component comes back,
 * naming the declaration to delete. **If the two ever disagree, believe the guard.**
 */
// tests/ward-statistics-primitives.dom.test.tsx
//
// `statistics-primitives.tsx` originally ported six components from the statistics prototype;
// five were removed 2026-09-05 because each duplicated a general-purpose primitive already
// shipping in `src/components/ward-management/` (see that file's own header comment for the full
// accounting — `StatPanel`/`WardPanel`, `KpiStrip`+`Kpi`/`WardFigureStrip`+`WardFigure`,
// `DistributionBar`/`WardBar`, `StatChip`/`WardChip`). This file now proves only what survived:
// `StatFootnote`, a headed, grouped list of invented figures that no existing primitive renders.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { provenanceFailure, statesItsOwnProvenance } from "./helpers/ward-invented-figures";

import { StatFootnote } from "@/components/ward-management/statistics/statistics-primitives";

describe("StatFootnote", () => {
  it("renders every group's heading and every one of its items", () => {
    render(
      <StatFootnote
        groups={[
          { heading: "Invented figures", items: ["28 referrals is synthetic.", "19 acceptances is synthetic."] },
          { heading: "What this cannot yet show", items: ["Movements is not built."] },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Invented figures" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What this cannot yet show" })).toBeInTheDocument();
    expect(screen.getByText("28 referrals is synthetic.")).toBeInTheDocument();
    expect(screen.getByText("19 acceptances is synthetic.")).toBeInTheDocument();
    expect(screen.getByText("Movements is not built.")).toBeInTheDocument();
  });

  /**
   * ⚠️ THE PROPERTY IS "EACH GROUP KEEPS ITS OWN ITEMS", NOT "EVERY ITEM TEXT APPEARS SOMEWHERE
   * ON THE PAGE". A component that flattened every group into one shared list, or that dropped a
   * group's heading while still rendering its items under the previous one, would still pass an
   * assertion that merely checked each string was present. Reading each `<section>`'s own child
   * `<div>` list is what a cross-group mix-up cannot survive.
   */
  it("keeps each group's items under its own heading, not merged across groups", () => {
    render(
      <StatFootnote
        groups={[
          {
            heading: "Invented figures",
            items: ["28 referrals is synthetic.", "19 acceptances is synthetic."],
          },
          { heading: "What this cannot yet show", items: ["Movements is not built."] },
        ]}
      />,
    );
    const groupDivs = screen.getByRole("heading", { name: "Invented figures" }).closest("div");
    // 🔴 "28 referrals" REMOVED — a FIGURE OR'd with its own CLAIM, so the figure alone satisfied it.
    // Measured 2026-09-09: the caption "28 referrals is synthetic." replaced with "There were 28
    // referrals this period." — an invented number stated as measured fact, under a heading that
    // reads "Invented figures" — and BOTH TESTS PASSED.
    // ⚠️ "invented" is NOT an accepted spelling here: the group's own <h2> says "Invented figures",
    // so it sits in this haystack and would be a bystander. Checked, not assumed.
    // 🔴 **NARROWED FROM THE GROUP TO THE ITEM, 2026-09-09, on the owner's ruling** (*"the number
    // should always carry that it's invented"*, `owner-decisions-2026-09-09.md` §2). Reading the
    // group's textContent meant ONE compliant item vouched for every sibling: with two items and
    // only one carrying "synthetic", a sibling stating an invented number as measured fact passed.
    // ⚠️ And the caveat above about "invented" being a bystander EXPIRED WITH THIS CHANGE — it was
    // excluded because the group's own <h2> reads "Invented figures" and sat in the haystack. The
    // haystack is now the <li>, the heading is no longer in it, and "invented" is admissible again.
    // Recorded rather than silently reinstated: a caveat whose reason has gone still reads as live.
    const inventedItems = Array.from(groupDivs?.querySelectorAll("li") ?? []);
    expect(inventedItems.length).toBeGreaterThan(0);
    for (const item of inventedItems) {
      // 🔴 **THE SAME INVERSION STOOD HERE UNDER `expectSays`, and it is the copy Ward Builder Four
      // did not see.** `expectSays` is `some()`, so the weakest spelling sets the whole strength —
      // my own rule, applying to itself. Five topic words, and *"are NOT invented"* satisfied the
      // list by containing "invented".
      // ⚠️ **Both suites now call ONE predicate.** Two copies drift, and the copy nobody re-reads is
      // the one that rots — which is how this one survived being written the same day as the
      // correction that named the class.
      const sentence = item.textContent ?? "";
      expect(statesItsOwnProvenance(sentence), provenanceFailure(sentence)).toBe(true);
    }
    expect(groupDivs?.textContent).not.toContain("Movements is not built.");
  });
});
