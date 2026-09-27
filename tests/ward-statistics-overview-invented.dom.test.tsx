import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsOverviewScreen } from "@/components/ward-management/statistics/statistics-overview-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

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

function renderOverview() {
  render(
    <WardFlowProvider>
      <StatisticsOverviewScreen />
    </WardFlowProvider>,
  );
  return screen.getByTestId("ward-statistics-overview-invented");
}

describe("the overview's 'What is invented, and what is real' panel", () => {
  it("renders the panel", () => {
    expect(renderOverview()).toBeInTheDocument();
  });

  it("says that every figure here is invented, in wording that discloses sentence by sentence", () => {
    const panel = renderOverview();
    const text = (screen.getByTestId("ward-statistics-overview-invented-figures").textContent ?? "").trim();

    expect(text).toContain("Every figure here is invented and describes no real person or day.");
    const detail = panel.textContent ?? "";
    for (const namedFigure of [
      "network capacity",
      "four admission stages",
      "declines",
      "current movements",
      "referral worklist",
      "pending beds",
      "30 chart points",
    ]) {
      expect(detail, `the provenance disclosure no longer names ${namedFigure}`).toContain(namedFigure);
    }
  });

  /**
   * ⚠️ **THREE THINGS THIS PAGE CANNOT KNOW, AND EACH WAS CHECKED AGAINST THE MODEL BEFORE IT WAS
   * REPRODUCED.** The lane has already found two drawn sentences that were measurably false — one
   * claimed a field was untracked when it exists and is populated on every departure.
   */
  it("says what the page cannot know, and does not soften it into a figure", () => {
    renderOverview();
    const text = (screen.getByTestId("ward-statistics-overview-invented-unknowns").textContent ?? "").trim();

    expect(text).toContain("referrals turned away before a person reaches a department");
    expect(text).toContain("durations between unrecorded instants");
    expect(text).toContain("The prototype records no offer");
    expect(text, "the reason a gap is left as words rather than a number is gone").toContain(
      "remain stated absences rather than invented figures",
    );
  });

  /**
   * 🔴 **THE CASE THAT MAKES THE PANEL HONEST RATHER THAN MERELY PRESENT.** Every assertion reaches
   * for a figure's own element elsewhere on the page — never this panel's text. ⚠️ **If a later edit
   * removes one of those figures while the provenance sentence still lists it, this reddens and the
   * message names which.**
   */
  it("every figure the panel calls invented is actually rendered on this page", () => {
    renderOverview();

    for (const testId of [
      "ward-statistics-overview-capacity-ready",
      "ward-statistics-overview-capacity-empty",
      "ward-statistics-overview-capacity-allocatable",
      "ward-statistics-overview-declines-total",
      "ward-statistics-overview-declines-movements",
      "ward-statistics-overview-refused-so-far-value",
      "ward-statistics-overview-refused-so-far-escalated",
      "ward-statistics-overview-preparing-value",
    ]) {
      const rendered = (screen.getByTestId(testId).textContent ?? "").trim();
      expect(rendered, `${testId} is named as an invented figure but renders no number`).toMatch(/^\d+$/u);
    }

    // The four bed stages, and the thirty daily points — neither is a bare number, so each is
    // asserted by the element that carries it rather than by a digit match.
    expect(screen.getByTestId("ward-statistics-overview-stage-table")).toBeInTheDocument();
    expect(screen.getByTestId("ward-statistics-overview-demo-trend")).toBeInTheDocument();
  });

  /**
   * ⚠️ **THE DRAWING'S MIDDLE PARAGRAPH IS DELIBERATELY ABSENT, AND ITS ABSENCE IS PINNED.** *"What is
   * real"* is built from the mockup's own sample world — health-service names, a ward count, and the
   * Command screen's fixed day, clock and shift. 🔴 **This screen renders none of those, so the
   * paragraph would be a claim about things the page does not show.** **Asserted so that reinstating
   * it by copying the drawing reddens rather than passing quietly.**
   */
  it("does not reproduce the drawing's sample world", () => {
    const text = renderOverview().textContent ?? "";

    expect(text, "the drawing's fixed clock reached the live page").not.toMatch(/10:42/);
    expect(text).not.toMatch(/handover at 14:00/i);
    expect(text, "a ward count was quoted as prose rather than computed").not.toMatch(/twenty[- ]three ward/i);
  });

  it("draws no unsourced red 92% surge tick on the occupancy gauge", () => {
    renderOverview();
    const redTicks = Array.from(document.querySelectorAll("line")).filter(
      (line) => line.getAttribute("stroke") === "var(--danger)",
    );
    expect(redTicks).toHaveLength(0);
  });
});
