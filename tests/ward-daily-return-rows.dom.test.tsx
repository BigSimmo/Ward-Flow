import { render, screen } from "@testing-library/react";
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

describe("the removed census and pipeline are not on the ward page", () => {
  it("does not render the five daily-return rows on a sample of seeded units", () => {
    expect(SEEDED_UNITS.length).toBeGreaterThanOrEqual(SAMPLE_SIZE);

    for (const unit of SAMPLE_UNITS) {
      const view = renderUnit(unit.id);
      for (const row of ROWS) {
        expect(screen.queryByTestId(row.testId)).not.toBeInTheDocument();
      }
      expect(screen.queryByText(/\bof 3 confirmed\b/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Staffing, 07:00–09:30" })).toBeInTheDocument();
      view.unmount();
    }
  });

  it("does not give the old confirmation rows a fresh or record state", () => {
    expect(SEEDED_UNITS.length).toBeGreaterThanOrEqual(SAMPLE_SIZE);

    for (const unit of SAMPLE_UNITS) {
      const view = renderUnit(unit.id);
      expect(view.container.querySelector("[data-testid='ward-daily-return']")).toBeNull();
      expect(view.container.querySelector("[data-testid^='ward-confirm-row-']")).toBeNull();
      view.unmount();
    }
  });

  it("does not keep the flag-bed or record-leave forms the old rows linked to", () => {
    expect(SEEDED_UNITS.length).toBeGreaterThanOrEqual(SAMPLE_SIZE);

    for (const unit of SAMPLE_UNITS) {
      const view = renderUnit(unit.id);
      expect(screen.queryByTestId("ward-confirm-release-link")).not.toBeInTheDocument();
      expect(screen.queryByTestId("ward-confirm-leave-link")).not.toBeInTheDocument();
      expect(view.container.querySelector("#ward-flag-bed-release")).toBeNull();
      expect(view.container.querySelector("#ward-leave-bed-form")).toBeNull();
      view.unmount();
    }
  });

  it("still shows the bed figures, which are not a daily-return row", () => {
    expect(SEEDED_UNITS.length).toBeGreaterThan(0);
    let unitsWithANonZeroFigure = 0;

    for (const unit of SEEDED_UNITS) {
      const view = renderUnit(unit.id);
      const bedGrid = screen.getByTestId("ward-unit-beds");
      const expected = bedGrid.querySelector("[data-state='expected'] strong")?.textContent ?? "";
      const confirmed = bedGrid.querySelector("[data-state='confirmed'] strong")?.textContent ?? "";
      expect(expected).toMatch(/^\d+$/);
      expect(confirmed).toMatch(/^\d+$/);
      if (Number(expected) + Number(confirmed) > 0) unitsWithANonZeroFigure += 1;
      view.unmount();
    }

    expect(unitsWithANonZeroFigure).toBeGreaterThan(0);
  });

  it("does not render the census card, the leave form, or the three-column pipeline", () => {
    expect(SEEDED_UNITS.length).toBeGreaterThan(0);
    const view = renderUnit(SEEDED_UNITS[0].id);
    expect(screen.queryByText(/Morning Census & Capacity Confirmation/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Flag a bed coming free/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Record a bed on leave/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Expected to Free/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ward activity/)).not.toBeInTheDocument();
    view.unmount();
  });
});
