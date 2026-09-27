import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { wardSites } from "@/components/ward-management/ward-sites";

/**
 * Build plan `docs/ward-flow/plans/2026-09-17-build-plan-screens.md`, task G1 (item 51). The
 * plan's own §1 investigation found no CSS in `board.module.css`'s ≤70rem/≤40rem breakpoints
 * dropping a column or a field — read again here, independently, and confirmed: `.triageFigures`
 * and `.beds` both switch to `repeat(2, minmax(0, 1fr))`, a pure column-count reflow with no
 * `display: none` on either grid or its children, and `minmax(0, ...)` never forces a track wider
 * than its container.
 *
 * 🔴 **WHAT THIS FILE CAN AND CANNOT PROVE.** `vitest`/jsdom loads no CSS Modules and evaluates no
 * `@media` query (`tests/ward-screen-third-edition-headings.dom.test.tsx`'s own file comment gives
 * the same limit for a sibling screen) — so it cannot see a viewport, cannot compute
 * `body.scrollWidth`, and cannot tell a real sideways-scroll overflow from a wrapped grid. What it
 * CAN prove is the thing a narrow viewport could never fix if it were false: that neither React nor
 * this component's own JS ever drops a tile or a figure from the DOM at all — the population these
 * two grids reflow, at every width, is always the whole one. The full `ui-ward-board-narrow.spec.ts`
 * Playwright measurement at 375/390/820 (tile count, all ten figures visible, `body.scrollWidth <=
 * innerWidth`, and an `overflow-x: auto` wrapper on anything genuinely wider than its panel) needs a
 * browser and is NOT built or run here — this worktree cannot run Playwright (see the task's own
 * brief). Reported as "needs a browser check".
 */

function renderWardBoard(unitId: string) {
  return render(
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <WardBoard unitId={unitId} />
    </WardFlowProvider>,
  );
}

function unitBeds(unitId: string): number {
  const unit = wardSites.flatMap((site) => site.units).find((candidate) => candidate.id === unitId);
  if (unit === undefined) throw new Error(`No seeded unit ${unitId} — this test cannot check anything.`);
  return unit.beds;
}

/** Every key `ward-board.tsx`'s own `figures` array carries — copied from the array itself, not
 *  retyped from the drawing, so a future rename of one key updates this list by re-running the
 *  suite rather than by a second hand-typed copy silently drifting from the real one. */
const FIGURE_KEYS = [
  "availableNow",
  "held",
  "confirmedToday",
  "expectedToday",
  "blockedToday",
  "awayAtEd",
  "pulled",
  "blockedBeds",
  "overThreeMonths",
  "onLeave",
] as const;

describe("the bed board never drops a tile or a figure at the DOM/JS level (item 51, task G1)", () => {
  afterEach(() => cleanup());

  it("has exactly ten figures in the triage band, unconditionally", () => {
    expect(FIGURE_KEYS.length, "the list above must actually be ten, or this test proves nothing").toBe(10);

    renderWardBoard("rph-adult-secure");
    const band = screen.getByTestId("ward-board-triage");
    for (const key of FIGURE_KEYS) {
      expect(within(band).getByTestId(`ward-board-figure-${key}`), `figure "${key}" is missing`).toBeInTheDocument();
    }
    // No extra or renamed figure either — exactly this set, so a silent rename would fail here too.
    const rendered = within(band)
      .getAllByTestId(new RegExp("^ward-board-figure-"))
      .map((el) => el.getAttribute("data-testid"));
    expect(rendered.sort()).toEqual(FIGURE_KEYS.map((key) => `ward-board-figure-${key}`).sort());
  });

  it("draws exactly one tile per recorded bed, unfiltered, on more than one ward", () => {
    for (const unitId of ["rph-adult-secure", "fsh-adult-secure"]) {
      renderWardBoard(unitId);
      const beds = screen.getByTestId("ward-board-beds");
      // ⚠️ Anchored at BOTH ends: a tile's own children carry testids of the same prefix
      // (`ward-board-bed-{n}-days`, `-past`, `-away`), which an unanchored-at-the-end regex would
      // also match, over-counting tiles by however many of those detail spans happen to render.
      const tiles = within(beds).getAllByTestId(new RegExp("^ward-board-bed-\\d+$"));
      expect(tiles.length, `${unitId}'s tile count does not match its own recorded bed count`).toBe(unitBeds(unitId));
      for (const tile of tiles) {
        expect(tile).not.toHaveAttribute("hidden");
      }
      cleanup();
    }
  });
});
