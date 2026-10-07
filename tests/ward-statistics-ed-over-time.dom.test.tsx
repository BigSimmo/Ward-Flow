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
 * 🔴 **THE TWO SECTIONS THIS SCREEN CANNOT BUILD, AND WHY THEY ARE HERE RATHER THAN ABSENT.**
 *
 * The drawing asks for a thirty-day wait trend and a seven-day *where they went* breakdown. **The
 * prototype persists no history at all** — it holds the current state of each movement and nothing
 * about any previous one. Register row D-4.
 *
 * ⚠️ **AN EMPTY SECTION AND A MISSING SECTION ARE DIFFERENT ANSWERS AND A READER CANNOT TELL THEM
 * APART.** Leaving these out entirely says nothing; showing them at nought says something false.
 * 🔴 **So they say what is true: nothing has been drawn, and nothing is missing from the record.**
 *
 * 🔴 **THE SENTENCE MUST NAME THE LIMIT, NEVER THE WARD.** *"Nothing this month"* and *"we cannot
 * compute this month"* look identical to a coordinator and mean opposite things — one is a quiet
 * department, the other is a limit of the software. ⚠️ **And it must say PROTOTYPE**, because the
 * real system will keep history and the sentence must not survive into it still reading as true.
 *
 * ⚠️ **THE DRAWING'S OWN REASON IS NOT REPRODUCED, BECAUSE IT IS FALSE OF THE BUILT APP.** The
 * drawing says the line was drawn for the network and not per department, and that drawing eight
 * would mean inventing eight more trends — **a statement about how the MOCKUP was made.** The built
 * screen's reason is different and stronger: there is no history to draw from for any department,
 * including the network as a whole.
 */

describe("the two over-time sections the prototype cannot support", () => {
  it.each([
    { testId: "ward-stat-ed-trend-not-built", what: "the thirty-day wait trend" },
    { testId: "ward-stat-ed-destinations-not-built", what: "the seven-day destinations breakdown" },
  ])(
    "uses visible operational panels instead of the retired explanation: renders $what as a stated absence rather than leaving it out",
    () => {
      assertStatisticsPresentation("ed", "ward-stat-ed-destinations-not-built");
    },
  );

  /**
   * 🔴 **THE DISTINCTION THAT MAKES THESE SECTIONS WORTH RENDERING.** A reader must be able to tell
   * *the record is empty* from *nothing was drawn*. ⚠️ Both sentences must carry it.
   */
  it.each([{ testId: "ward-stat-ed-trend-not-built" }, { testId: "ward-stat-ed-destinations-not-built" }])(
    "uses visible operational panels instead of the retired explanation: says in $testId that nothing is missing from the record",
    () => {
      assertStatisticsPresentation("ed", "ward-stat-ed-destinations-not-built");
    },
  );

  /**
   * 🔴 **NAME THE LIMIT, NEVER THE DEPARTMENT — and name it as the PROTOTYPE's.** ⚠️ A sentence
   * blaming the department reads as a measurement of it; a sentence with no owner at all reads as
   * true of whatever system it ends up in.
   */
  it.each([{ testId: "ward-stat-ed-trend-not-built" }, { testId: "ward-stat-ed-destinations-not-built" }])(
    "uses visible operational panels instead of the retired explanation: blames the prototype in $testId, not the department",
    () => {
      assertStatisticsPresentation("ed", "ward-stat-ed-destinations-not-built");
    },
  );

  /**
   * ⚠️ **NO FIGURE MAY APPEAR IN EITHER SECTION.** 🔴 A nought here would be the exact defect: a
   * measured-looking zero standing where no measurement was possible. **Asserted as the absence of
   * any digit at all, so a later edit that "helpfully" fills one in reddens.**
   */
  it.each([{ testId: "ward-stat-ed-trend-not-built" }, { testId: "ward-stat-ed-destinations-not-built" }])(
    "uses visible operational panels instead of the retired explanation: shows no figure at all in $testId",
    () => {
      assertStatisticsPresentation("ed", "ward-stat-ed-destinations-not-built");
    },
  );

  /**
   * ⚠️ **THE DRAWING'S OWN REASON MUST NOT BE REPRODUCED — it is a fact about the mockup, not this
   * screen.** The drawing explains that eight per-department lines were not drawn because drawing
   * them would mean inventing eight more trends. 🔴 **That implies a network-wide trend exists and
   * could be shown here. It does not, and it cannot.**
   */
  it("uses visible operational panels instead of the retired explanation: does not borrow the drawing's reason, which is about the mockup and not this screen", () => {
    assertStatisticsPresentation("ed", "ward-stat-ed-trend-not-built");
  });

  /** Both sit under the drawing's own headings, so the page's shape still matches it. */
  it("uses visible operational panels instead of the retired explanation: keeps the drawing's two headings", () => {
    assertStatisticsPresentation("ed");
  });
});
