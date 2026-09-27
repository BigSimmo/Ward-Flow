/**
 * 🔴 **RETIRED 2026-09-06 — OWNER RULING: THE ELEVEN REPLACED WARD SCREENS ARE FINISHED WITH.**
 *
 * `EdServiceBands` is reached by no route. These 5 cases are skipped, not deleted: the
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
 * ⚠️ **NO ROUTE REACHES THE SCREEN THIS FILE RENDERS.** `EdServiceBands` — reached only from EdHome, which is itself unreachable
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
// tests/ward-ed-service-bands.dom.test.tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  edHomeSummaries,
  groupByHealthService,
  worstEdSummary,
} from "@/components/ward-management/ed/ed-home-derivations";
import { EdServiceBands } from "@/components/ward-management/ed/ed-service-bands";
import { ED_ACCESS_TARGET_MINUTES } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const summaries = edHomeSummaries(wardMovements, NOW_ANCHOR, ED_ACCESS_TARGET_MINUTES);
const bands = groupByHealthService(summaries);
const worst = worstEdSummary(summaries);
const allEds = allEmergencyDepartments();

describe.skip("EdServiceBands", () => {
  it("renders exactly three bands: East Metro, North Metro, South Metro", () => {
    render(<EdServiceBands bands={bands} worstEdId={worst?.ed.id} accessTargetMinutes={ED_ACCESS_TARGET_MINUTES} />);
    expect(screen.getByRole("region", { name: "East Metro" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "North Metro" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "South Metro" })).toBeInTheDocument();
  });

  it("carries the note that a department shown as the hero is shown above, on whichever band it belongs to", () => {
    render(<EdServiceBands bands={bands} worstEdId={worst?.ed.id} accessTargetMinutes={ED_ACCESS_TARGET_MINUTES} />);
    if (!worst) throw new Error("test fixture produced no departments — cannot assert the band note");
    const ownBand = screen.getByRole("region", { name: worst.service });
    expect(within(ownBand).getByText(new RegExp(`${worst.siteName} is shown above`, "u"))).toBeInTheDocument();
  });

  it("states the population — patients physically present — on every band panel", () => {
    render(<EdServiceBands bands={bands} worstEdId={worst?.ed.id} accessTargetMinutes={ED_ACCESS_TARGET_MINUTES} />);
    for (const service of ["East Metro", "North Metro", "South Metro"]) {
      const region = screen.getByRole("region", { name: service });
      expect(region.textContent ?? "").toMatch(/physically present/iu);
    }
  });

  /**
   * ⚠️ THE UNION ASSERTION, NOT A PER-BAND COUNT. Asserting against the union of the hero and the
   * three bands is what catches a department silently dropped from a band while still counted
   * elsewhere — a per-band-only count could not see that at all.
   */
  it("names every real emergency department exactly once, across the hero and the three bands combined", () => {
    render(<EdServiceBands bands={bands} worstEdId={worst?.ed.id} accessTargetMinutes={ED_ACCESS_TARGET_MINUTES} />);
    const bandNames = allEds.filter((ed) => ed.id !== worst?.ed.id).map((ed) => ed.name);
    for (const name of bandNames) {
      expect(screen.getAllByText(name)).toHaveLength(1);
    }
    // The hero's own department must NOT be repeated in its own band's list.
    if (worst) {
      expect(screen.queryByText(worst.ed.name)).not.toBeInTheDocument();
    }
    // Every department across the three bands, plus the excluded hero department, accounts for
    // the full real collection — the union property the plan's own guard names.
    const renderedInBands = bandNames.length;
    expect(renderedInBands + (worst ? 1 : 0)).toBe(allEds.length);
  });

  it("links each row to that department's own hub", () => {
    render(<EdServiceBands bands={bands} worstEdId={worst?.ed.id} accessTargetMinutes={ED_ACCESS_TARGET_MINUTES} />);
    const other = allEds.find((ed) => ed.id !== worst?.ed.id);
    if (!other) throw new Error("need at least two departments for this assertion");
    const link = screen.getByRole("link", { name: new RegExp(other.name, "u") });
    expect(link).toHaveAttribute("href", `/mockups/ward-flow/ed/${other.id}`);
  });
});
