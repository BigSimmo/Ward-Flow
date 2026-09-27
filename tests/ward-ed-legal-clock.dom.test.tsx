import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **THIS FILE REPLACES A GUARD FOR BEHAVIOUR THAT NO LONGER EXISTS, RATHER THAN EXTENDING IT —
 * A DELIBERATE REDUCTION RECORDED IN `diff-integrity.json`.**
 *
 * Until 2026-09-17 this file pinned `isCommunityFormed`/`legalClockReference` — the emergency
 * department board dating a *form* clock from `formedAt` when that was earlier than `openedAt`,
 * and from `openedAt` (the department's own arrival clock) otherwise, published as
 * `data-community-formed` and `data-minutes-legal-clock`. Owner answer 1, 17 September 2026,
 * quoted verbatim in `docs/ward-flow/owner-answers-2026-09-17.md`: *"the timer that starts when a
 * patient arrives is separate to forms. One records time in ED and the other is a forms
 * category."* `docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md` item 1 names that
 * merge as the defect — *"That is the ED clock standing in for a form clock"* — and Task T1
 * deletes both functions and both data attributes rather than repairing the boundary logic they
 * implemented, so nothing here can be "corrected forward": the thing this file asserted about is
 * gone from the render entirely.
 *
 * What replaces it: `tests/ward-ed-form-expiry.dom.test.tsx` proves the POSITIVE side of the same
 * separation — that the form-expiry line reads only `legalForm.dueAt` and the access-target line
 * reads only `openedAt`, each blind to the other's input. This file keeps the NEGATIVE side: a
 * floored check, across every department's board, that neither deleted attribute has quietly come
 * back. A regression that reintroduced the merge by resurrecting the old attribute names (rather
 * than by touching `dueAt`/`openedAt` directly) would not be caught by the separation property
 * alone, because that property only compares two attributes that would both still be present.
 */

const NOW = NOW_ANCHOR;

describe("the emergency department board does not merge the ED clock into a form clock", () => {
  afterEach(cleanup);

  it("never publishes the deleted merged-clock attributes on any department's board", () => {
    let rowsChecked = 0;
    for (const department of allEmergencyDepartments()) {
      const { container } = render(
        <WardFlowProvider initialNow={NOW}>
          <EdScreen edId={department.id} />
        </WardFlowProvider>,
      );
      const rows = Array.from(container.querySelectorAll('[data-testid^="ward-ed-patient-"]'));
      rowsChecked += rows.length;
      for (const row of rows) {
        const id = row.getAttribute("data-testid") ?? "";
        expect(row.hasAttribute("data-community-formed"), `${id} still publishes data-community-formed`).toBe(false);
        expect(row.hasAttribute("data-minutes-legal-clock"), `${id} still publishes data-minutes-legal-clock`).toBe(
          false,
        );
      }
      cleanup();
    }
    // ⚠️ FLOOR THE POPULATION WALKED, same discipline the file this replaces used — an empty or
    // near-empty render would make the loop above pass while proving nothing.
    expect(rowsChecked, "too few patients rendered for this check to mean anything").toBeGreaterThan(8);
  });
});
