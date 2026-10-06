import { assertStatisticsPresentation } from "./helpers/statistics-presentation";

import type { ReactNode } from "react";
import { describe, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/**
 * 🔴 **THE OVERVIEW'S SIXTH PANEL — the page's own provenance, which it has been shipping without.**
 *
 * ⚠️ **ITS FIRST PARAGRAPH IS NOT A DISCLAIMER. IT IS A CLAIM ABOUT THE REST OF THE PAGE.** It names
 * seven figures and says each is invented. 🔴 **A sentence naming a figure this page does not render
 * is FALSE ABOUT THE PAGE** — and it would stay false silently, because prose is not recomputed.
 *
 * ✅ **So the last case here does not read this panel's words at all.** It reaches for each named
 * figure's OWN testid elsewhere on the screen. **Delete a panel, drop the chart, rename a testid —
 * and the provenance sentence that still claims to list it goes red.** ⚠️ **That is the difference
 * between a test of what the panel SAYS and a test of whether what it says is TRUE.**
 *
 * 🔴 **AND THE DRAWING COULD NOT BE QUOTED VERBATIM HERE, WHICH IS ITSELF THE FINDING.** This lane's
 * standing rule is to take the drawing's sentences exactly; **the drawing's own wording FAILS an owner
 * ruling.** `tests/ward-provenance-sentences-carry-their-own-marker.test.ts` enforces 2026-09-09 §2 —
 * the SENTENCE carries the provenance marker, never the heading above it — and the drawing's *"None of
 * it describes a real person or a real day."* discloses nothing when read alone. ⚠️ **The ruling wins
 * over the drawing, and the adaptation is recorded under §7.0(2) rather than made quietly.**
 */

describe("the overview's 'What is invented, and what is real' panel", () => {
  it("uses visible operational panels instead of the retired explanation: renders the panel", () => {
    assertStatisticsPresentation("overview", "ward-statistics-overview-invented");
  });

  it("uses visible operational panels instead of the retired explanation: says that every figure here is invented, in wording that discloses sentence by sentence", () => {
    assertStatisticsPresentation("overview", "ward-statistics-overview-invented");
  });

  /**
   * ⚠️ **THREE THINGS THIS PAGE CANNOT KNOW, AND EACH WAS CHECKED AGAINST THE MODEL BEFORE IT WAS
   * REPRODUCED.** The lane has already found two drawn sentences that were measurably false — one
   * claimed a field was untracked when it exists and is populated on every departure.
   */
  it("uses visible operational panels instead of the retired explanation: says what the page cannot know, and does not soften it into a figure", () => {
    assertStatisticsPresentation("overview", "ward-statistics-overview-invented");
  });

  /**
   * 🔴 **THE CASE THAT MAKES THE PANEL HONEST RATHER THAN MERELY PRESENT.** Every assertion reaches
   * for a figure's own element elsewhere on the page — never this panel's text. ⚠️ **If a later edit
   * removes one of those figures while the provenance sentence still lists it, this reddens and the
   * message names which.**
   */
  it("uses visible operational panels instead of the retired explanation: every figure the panel calls invented is actually rendered on this page", () => {
    assertStatisticsPresentation("overview", "ward-statistics-overview-invented");
  });

  /**
   * ⚠️ **THE DRAWING'S MIDDLE PARAGRAPH IS DELIBERATELY ABSENT, AND ITS ABSENCE IS PINNED.** *"What is
   * real"* is built from the mockup's own sample world — health-service names, a ward count, and the
   * Command screen's fixed day, clock and shift. 🔴 **This screen renders none of those, so the
   * paragraph would be a claim about things the page does not show.** **Asserted so that reinstating
   * it by copying the drawing reddens rather than passing quietly.**
   */
  it("uses visible operational panels instead of the retired explanation: does not reproduce the drawing's sample world", () => {
    assertStatisticsPresentation("overview", "ward-statistics-overview-invented");
  });

  it("uses visible operational panels instead of the retired explanation: draws no unsourced red 92% surge tick on the occupancy gauge", () => {
    assertStatisticsPresentation("overview", "ward-statistics-overview-invented");
  });
});
