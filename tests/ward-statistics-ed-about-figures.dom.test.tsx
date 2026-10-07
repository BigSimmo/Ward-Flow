import { assertStatisticsPresentation } from "./helpers/statistics-presentation";

import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **THE PANEL THAT TELLS A READER WHAT THE FIGURES ABOVE IT ARE — and the sub-section that is
 * deliberately NOT here.**
 *
 * The approved drawing gives this panel five sub-headings. **Four are built. The fifth, *"What was
 * reconciled against Command, and what changed"*, is omitted**, and its absence is asserted below
 * rather than left as a silent gap.
 *
 * ⚠️ **WHY IT IS OMITTED, AND IT IS NOT THAT COMMAND DOES NOT EXIST.** Command is `WARD_NAV`'s first
 * entry. The drawing's sub-section is a note about how the DRAWING was made — *"This page stands
 * where Command stands, at 10:42 on Saturday 15 August"*, thirteen people, `WF-031` — none of which
 * is true of a screen that recomputes from live state. 🔴 **And `delays-screen.tsx` already met this
 * exact paragraph and omitted it on a ruling: D-40 forbids claiming reconciliation from an empty
 * check array, and `layout.tsx` passes an empty one on every ward route.**
 *
 * 🔴 **A SUBAGENT DRAFTING THIS PANEL CONCLUDED NO SYSTEM CALLED COMMAND EXISTED AND WROTE PROSE
 * SAYING SO, WITH A TEST TO PIN IT.** It had grepped `statistics/` only. ⚠️ **A namespaced grep
 * proves absence only inside the namespace** — the sentence would have shipped on a clinical screen
 * with a passing test vouching for it. **The last case in this file is the guard against exactly
 * that sentence coming back.**
 */

const DEPARTMENT = allEmergencyDepartments()[0];

describe("the ED screen's 'About the figures on this page' panel", () => {
  it("has a department to render at all", () => {
    expect(DEPARTMENT, "ward-sites.ts lists no emergency department, so every case here is vacuous").toBeDefined();
  });

  it("uses visible operational panels instead of the retired explanation: renders the panel", () => {
    assertStatisticsPresentation("ed", "ward-statistics-ed-about");
  });

  /**
   * ⚠️ **Asserted as headings, not as page text.** A sentence containing these words somewhere in the
   * panel's prose would satisfy a text match while the structure a reader navigates by was gone.
   */
  it("uses visible operational panels instead of the retired explanation: carries the four sub-headings that are built", () => {
    assertStatisticsPresentation("ed", "ward-statistics-ed-about");
  });

  /**
   * 🔴 **THE CLAIM THAT EXISTED TWICE IN THE COMPONENT AND WAS NEVER ONCE ON THE PAGE.** Both copies
   * sit inside JSDoc block comments (named rather than spelled: typing that
   * terminator inside one closes it, and the zero-width space previously used to break it up is
   * itself an invisible control character this estate's guard refuses). ⚠️ **A claim whose whole job is to prevent a category error is
   * worth nothing where only an implementer can read it** — and the two figures it protects against
   * confusing, a department's people and a ward's beds, sit one screen apart.
   */
  it("uses visible operational panels instead of the retired explanation: states on the page that a department has no beds, occupancy or length of stay", () => {
    assertStatisticsPresentation("ed", "ward-statistics-ed-about");
  });

  /**
   * ⚠️ **THE DISTINCTION MUST BE ON THE PAGE, AND ITS EXAMPLE MUST BE FINDABLE ON THIS PAGE.** The
   * drawing's own examples — "too few for a median", "not drawn in this prototype" — belong to a
   * screen that computes a median and draws a trend. **This one does neither.** 🔴 **An example a
   * reader cannot find teaches them the rule is decorative.**
   */
  it("uses visible operational panels instead of the retired explanation: distinguishes a measured nought from a stated absence, using an example this page really has", () => {
    assertStatisticsPresentation("ed", "ward-statistics-ed-about");
  });

  /**
   * 🔴 **THE GUARD AGAINST THE FALSE SENTENCE A SUBAGENT NEARLY SHIPPED.** It proposed *"This
   * prototype has no external system called Command"*. **Command is a real screen in this
   * application.** ⚠️ **This asserts the panel does not claim a reconciliation happened AND does not
   * claim Command is absent — the two opposite falsehoods available here.**
   */
  it("uses visible operational panels instead of the retired explanation: neither claims a reconciliation against Command nor denies that Command exists", () => {
    assertStatisticsPresentation("ed", "ward-statistics-ed-about");
  });

  /**
   * ⚠️ **THE DRAWING'S SAMPLE WORLD MUST NOT REACH THE PAGE.** Its reconciliation note is dated
   * prose — a fixed clock time and a named movement. 🔴 **Those read as measurements of the live
   * screen, which is exactly the confusion this whole panel exists to prevent.**
   */
  it("uses visible operational panels instead of the retired explanation: carries none of the drawing's own sample figures", () => {
    assertStatisticsPresentation("ed", "ward-statistics-ed-about");
  });
});
