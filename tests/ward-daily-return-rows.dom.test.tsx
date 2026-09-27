import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same jsdom-App-Router workaround as tests/ward-screen-overview-and-entry.dom.test.tsx.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The daily return's rows 4 and 5 ("A bed coming free", "A bed going on leave"), added 2026-09-07
 * from the owner-approved ward-home drawing.
 *
 * ⚠️ **WHAT THIS FILE EXISTS TO PROTECT, AND IT IS NOT THAT THE ROWS RENDER.** The rows are the
 * easy part. The decision underneath them is that **they are not confirmations**: rows 1-3 record
 * an answer act, rows 4 and 5 have no such act anywhere in the model, so an empty list cannot be
 * told apart from a question nobody asked. Three consequences follow, and each has its own
 * assertion here because each can regress on its own:
 *
 * 1. The panel counts **three**, not five, while showing five rows. The obvious "fix" — noticing
 *    five rows above a count of three and correcting the count — puts two members in the
 *    denominator that can never increment. `ward-screen-overview-and-entry.dom.test.tsx` already
 *    pins the denominator `of 3`; what it does NOT pin is that five rows exist above
 *    it, so on its own it stays green if these two rows are simply deleted. Both halves are needed
 *    and they live in different files, so this one asserts the pair together.
 * 2. Rows 4 and 5 must not carry `data-fresh`. That attribute means confirmation freshness and
 *    both its values are claims — green says an answer was given, amber says one is overdue.
 * 3. The link on each row must actually arrive. An `href` is not an arrival: `#ward-leave-bed-form`
 *    is a promise about an `id` in a different part of a 2100-line file, and nothing in TypeScript,
 *    lint or a render test notices when that id is renamed or the form is replaced.
 *
 * The two tests whose result depends on what a unit's data actually contains (row 4's arithmetic,
 * and the empty/populated branch coverage below) run across **every seeded unit**; the branch-
 * coverage floor at the bottom refuses to pass if the suite never actually met a populated row or
 * never met an empty one — without it, "all units satisfied the empty-list wording" would be
 * equally true of a build where no unit has any data at all. The other three tests assert facts
 * that are structural rather than data-dependent (see the note above `SAMPLE_UNITS`) and run over
 * a small derived sample instead, to keep this file's render count down.
 */

/** `allUnits` is a FUNCTION, not an array — bound once here. Every loop below reads this, and
 * the `.length` floor at the top of each test is what turned that mistake into a red test
 * rather than four tests iterating an empty list and passing. */
const SEEDED_UNITS = allUnits();

/**
 * Three of the five tests below assert STRUCTURAL facts that do not vary by which unit is
 * rendered: that five rows exist, that rows 1-3 carry `data-fresh` and rows 4-5 carry
 * `data-kind` instead, and that both row links resolve via `getElementById` to the form they
 * name. Those facts are true (or false) by construction of `WardScreen` — no seeded unit's data
 * can make a row disappear or an id go missing — so sweeping all 23 units buys those three tests
 * nothing but ~20 extra 2200-line renders each. They run over this small derived sample instead.
 *
 * The other two tests (row 4's arithmetic, and the empty/populated branch coverage) depend on
 * what each unit's data actually contains, so they still sweep every seeded unit below.
 *
 * `SAMPLE_UNITS` is derived from `SEEDED_UNITS`, never a hand-picked ward id — a hard-coded list
 * of ids would rot the moment the seed changes shape. The floor asserts the sample is real: if
 * the seed ever shrinks below `SAMPLE_SIZE`, the slice below would silently iterate fewer units,
 * so the length check catches that instead.
 */
const SAMPLE_SIZE = 3;
const SAMPLE_UNITS = SEEDED_UNITS.slice(0, SAMPLE_SIZE);

type RowKind = "confirmation" | "record";

const ROWS: { testId: string; kind: RowKind }[] = [
  { testId: "ward-confirm-row-empty", kind: "confirmation" },
  { testId: "ward-confirm-row-allocatable", kind: "confirmation" },
  { testId: "ward-confirm-row-constraints", kind: "confirmation" },
  { testId: "ward-confirm-row-release", kind: "record" },
  { testId: "ward-confirm-row-leave", kind: "record" },
];

function renderUnit(unitId: string) {
  const view = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={unitId} />
    </WardFlowProvider>,
  );
  return view;
}

describe("the daily return — five questions, three of which are confirmations", () => {
  it("shows five rows above a count that still says three, on a sample of seeded units", () => {
    // Floor: if the seed ever shrinks below the sample size, this fails instead of the slice
    // above silently iterating fewer units than intended.
    expect(SEEDED_UNITS.length).toBeGreaterThanOrEqual(SAMPLE_SIZE);

    for (const unit of SAMPLE_UNITS) {
      const view = renderUnit(unit.id);

      for (const row of ROWS) {
        expect(screen.getByTestId(row.testId)).toBeInTheDocument();
      }

      // The pair. Five rows AND a count of three — the whole point is that these disagree on
      // purpose, so asserting either one alone protects nothing.
      /*
       * ⚠️ **THE DENOMINATOR IS WHAT THIS PINS, NEVER THE WORD AFTER IT.** The assertion read
       * `/\bof 3 confirmed today$/` when it was written, and the label was corrected the same day
       * from "today" to "since this page opened" — `confirmedToday` is `useState`, so it counts
       * taps in this session and resets on reload. **Pinning the trailing words would have made this
       * guard redden on the truthfulness fix and green on the defect it exists to catch.**
       *
       * 🔴 **AND THE NEGATIVE TWIN WAS LEFT PINNING THE WORD THE POSITIVE ONE HAD JUST DROPPED.**
       * It read `/\bof 5 confirmed today$/` for an hour after the label stopped saying "today", so
       * it could never match anything and asserted nothing: change the denominator to five and the
       * label reads "of 5 confirmed since this page opened", which that pattern does not match, and
       * the guard stays green through the exact defect it names.
       *
       * ⚠️ **THE SHAPE, AND IT IS WHY THIS SURVIVED A COMMIT THAT WAS ABOUT PRECISELY THIS BUG:
       * a fix applied to a positive assertion and not to its negative pair READS AS COMPLETE**,
       * because the corrected form is what the eye lands on and the twin below it looks like more
       * of the same. The warning above was written in the same commit that missed the line under
       * it. Both halves must move together, or the negative silently stops being an assertion.
       *
       * ⚠️ **STATED AS INSPECTION, NOT AS A MUTATION PROOF, BECAUSE THE MUTATION DOES NOT ISOLATE
       * IT.** The old pattern ended in `today$` while the rendered label ends in "opened", so it
       * could not match at ANY denominator — that is checkable by reading the template and needs no
       * run. But changing the denominator to five reddens this case through the POSITIVE assertion
       * either way, so no source mutation distinguishes the two negative patterns. **Two attempts
       * to isolate it both came back red for the wrong reason, and the second only revealed itself
       * because the edit that was supposed to remove the positive assertion matched zero lines.**
       * The honest position: the repair is right by inspection and unproven by mutation, and the
       * negative twin's independent value over its positive partner is small.
       */
      //
      // ⚠️ **THE NUMBER IS PINNED; THE WORDING DELIBERATELY IS NOT.** This read
      // happen: the Ward Flow master line (`codex/task-ward-flow-live-state-20260831`) already
      // renders `of 3 confirmed since this page opened`, having corrected a session count that
      // was wearing a day label. Checked, not assumed — `git show <branch>:<path>`, with the
      // branch verified to resolve first, because `git show` on a missing ref returns empty and
      // a count taken from empty input reads exactly like "searched and found none".
      //
      // My claim is that the count says THREE while five rows are visible. "today" versus "since
      // this page opened" was never my claim, and a test that pins a neighbouring team's wording
      // fails on their correct work — which is how a guard starts getting widened until it means
      // nothing. Matching `of 3 confirmed` holds the number under either wording, and still
      // catches the mutation that matters (someone "correcting" the count to five).
      expect(screen.getByText(/\bof 3 confirmed\b/)).toBeInTheDocument();
      expect(screen.queryByText(/\bof 5 confirmed\b/)).not.toBeInTheDocument();

      view.unmount();
    }
  });

  it("gives a confirmation state to the three that have one, and to neither of the two that do not", () => {
    expect(SEEDED_UNITS.length).toBeGreaterThanOrEqual(SAMPLE_SIZE);

    for (const unit of SAMPLE_UNITS) {
      const view = renderUnit(unit.id);

      for (const row of ROWS) {
        const element = screen.getByTestId(row.testId);
        if (row.kind === "confirmation") {
          // A real state, and one of the two the CSS actually draws a rail for.
          expect(element.getAttribute("data-fresh")).toMatch(/^(confirmed|waiting)$/);
          expect(element).not.toHaveAttribute("data-kind");
        } else {
          // ⚠️ The load-bearing negative. `data-fresh` on these rows would assert an answer act
          // that nothing in the model records.
          expect(element).not.toHaveAttribute("data-fresh");
          expect(element).toHaveAttribute("data-kind", "record");
        }
      }

      view.unmount();
    }
  });

  it("links that arrive: each row's href resolves to an element that is really in the document", () => {
    expect(SEEDED_UNITS.length).toBeGreaterThanOrEqual(SAMPLE_SIZE);

    const links: { linkTestId: string; expectedTargetTestId: string }[] = [
      { linkTestId: "ward-confirm-release-link", expectedTargetTestId: "ward-flag-bed-release" },
      { linkTestId: "ward-confirm-leave-link", expectedTargetTestId: "ward-leave-bed-form" },
    ];

    for (const unit of SAMPLE_UNITS) {
      const view = renderUnit(unit.id);

      for (const link of links) {
        const href = screen.getByTestId(link.linkTestId).getAttribute("href");
        expect(href).toMatch(/^#.+/);

        // The arrival check. `getElementById` is what the browser itself does with a fragment,
        // so this fails exactly when a real reader would land nowhere.
        const target = view.container.ownerDocument.getElementById(href!.slice(1));
        expect(target, `${unit.id}: ${href} resolves to nothing`).not.toBeNull();

        // And it must be the control the row names, not merely *an* element that took that id.
        expect(target).toBe(screen.getByTestId(link.expectedTargetTestId));
      }

      view.unmount();
    }
  });

  it("row 4's number is the same number the capacity chips below it show — one arithmetic, not two", () => {
    expect(SEEDED_UNITS.length).toBeGreaterThan(0);

    /**
     * ⚠️ THIS GUARD EXISTS BECAUSE THE FIRST VERSION OF ROW 4 DERIVED ITS OWN COUNT and agreed
     * with the chips on all 23 units by accident — the accident being that the only control that
     * creates a release has a `type="time"` input, so it cannot produce the `beyond-today` band
     * that `capacityBreakdown()` excludes. Agreement by seed is not agreement by construction, and
     * a second derivation of one clinical population is the thing to catch, not the coincidence
     * that it currently matches.
     *
     * The floors below are load-bearing for exactly that reason: if the chips stop being found,
     * or every unit reports zero, "the numbers agree" is true of a screen showing nothing.
     */
    let unitsCompared = 0;
    let unitsWithANonZeroFigure = 0;

    for (const unit of SEEDED_UNITS) {
      const view = renderUnit(unit.id);

      const row = screen.getByTestId("ward-confirm-row-release");
      const rowNumber = Number(within(row).getByText(/^\d+$/).textContent);

      const chip = (state: string, label: string) => {
        const bedGrid = screen.getByTestId("ward-unit-beds");
        const element = bedGrid.querySelector<HTMLElement>(`[data-state="${state}"]`);
        expect(element, `${unit.id}: no ${label} chip found`).not.toBeNull();
        expect(within(element!).getByText(label, { selector: "span" })).toBeInTheDocument();
        const value = element!.querySelector("strong");
        expect(value, `${unit.id}: ${label} chip has no numeric value`).not.toBeNull();
        expect(value!.textContent, `${unit.id}: ${label} is not an exact non-negative integer`).toMatch(/^\d+$/u);
        return Number(value!.textContent);
      };
      const expectedToday = chip("expected", "Expected");
      const confirmedToday = chip("confirmed", "Confirmed");

      // Floor: a missing chip must not silently become a zero and make the comparison trivially
      // true. Both chips are unconditional on this screen, so absence is a defect in the probe.
      const chipsSay = expectedToday + confirmedToday;
      expect(rowNumber, `${unit.id}: row 4 says ${rowNumber}, chips say ${chipsSay}`).toBe(chipsSay);

      unitsCompared += 1;
      if (chipsSay > 0) unitsWithANonZeroFigure += 1;

      view.unmount();
    }

    expect(unitsCompared).toBe(SEEDED_UNITS.length);
    expect(
      unitsWithANonZeroFigure,
      "every unit reported zero beds coming free — the comparison proved nothing",
    ).toBeGreaterThan(0);
  });

  it("never renders a blank stamp, and says in words that an empty list is not an answer", () => {
    expect(SEEDED_UNITS.length).toBeGreaterThan(0);

    /**
     * ⚠️ **THE FLOORS ARE PER ROW KIND, AND THE FIRST VERSION SHARED THEM.** Two counters covering
     * both rows meant "the populated branch was exercised" could be satisfied entirely by leave
     * rows while every single release row was empty — a floor computed over a population that is
     * not the one its own failure message names. Same shape as the `allUnits.length` mistake this
     * file's header records: the floor looked like proof and proved something else.
     */
    const seen: Record<string, { empty: number; populated: number }> = {
      "ward-confirm-row-release": { empty: 0, populated: 0 },
      "ward-confirm-row-leave": { empty: 0, populated: 0 },
    };

    for (const unit of SEEDED_UNITS) {
      const view = renderUnit(unit.id);

      for (const testId of Object.keys(seen)) {
        const row = screen.getByTestId(testId);
        const count = Number(within(row).getByText(/^\d+$/).textContent);

        /**
         * 🔴 **THE WORD "Confirmed" MUST NOT APPEAR IN THESE TWO ROWS, IN EITHER BRANCH.**
         *
         * They used to render `WardFreshness`, which given a `confirmedAt` and a role emits
         * "Confirmed 09:12 · NUM <ward>" — and `FLAG_BED_RELEASE` stamps `confirmedAt` on a
         * release whose `state` is `"expected"`. So the row said **Confirmed** about a bed the
         * capacity chip on the same screen called **Expected**: one clinical word, two meanings,
         * inviting a reader to treat a planned discharge as a decided one. The empty branch said
         * "Never confirmed", a stronger unanswered claim than the honest session-scoped wording
         * rows 1-3 use, on rows this panel argues owe no answer at all.
         *
         * The old version of this test asserted BOTH of those strings, so the guard was pinning
         * the defect in place. That is why the negative below is the load-bearing assertion and
         * not the positive one.
         */
        expect(row.textContent, `${unit.id} ${testId}: the confirmation word is back`).not.toMatch(
          /\bConfirmed\b|\bconfirmed\b/,
        );

        if (count === 0) {
          seen[testId].empty += 1;
          expect(row).toHaveTextContent(/No bed (flagged|recorded) here yet/);
          expect(row).toHaveTextContent(/no record shows whether this was checked today/i);
        } else {
          seen[testId].populated += 1;
          // A record was entered, by a role, at a time — that and no more.
          expect(row).toHaveTextContent(/Last (flagged|recorded) \d\d:\d\d/);
          expect(row).toHaveTextContent(/does not establish that the list is complete/);
        }
      }

      view.unmount();
    }

    for (const [testId, counts] of Object.entries(seen)) {
      expect(counts.empty, `${testId}: no unit exercised its empty branch — proved nothing`).toBeGreaterThan(0);
      expect(counts.populated, `${testId}: no unit exercised its populated branch — proved nothing`).toBeGreaterThan(0);
    }
  });
});
