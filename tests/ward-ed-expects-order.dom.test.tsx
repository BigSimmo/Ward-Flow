import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **THE EXPECTS LIST MAKES AN ORDERING CLAIM IN PROSE, AND NOTHING PINNED THE ORDER TO IT.**
 *
 * The section tells the reader the list is ordered. `edExpectsFor` sorts by `raisedAt`. **Those are
 * two independent facts held in two files, and nothing failed if they stopped agreeing** — a change
 * to the sort would leave a sentence on screen that is simply false, and no gate in this repository
 * would have gone red.
 *
 * ## ⚠️ Why the WORDING half matters, and it is not pedantry
 *
 * The sentence used to read *"longest wait first"*. **That is TRUE — and on a list of people who have
 * not arrived, a reader hears "wait" as wait-to-ARRIVE.** It is wait since REFERRAL. The two are
 * different clocks in opposite directions, and the ED drawing has already ruled on exactly this:
 *
 * > **Two different clocks.** Expected is measured forward to an arrival that has not happened.
 * > Everything else is measured back from arrival at the department. They are never ranked against
 * > one another…
 *
 * ⚠️ **And a bed coordinator reading arrival order off a referral-order list would work the list in
 * the wrong sequence** — the person at the top is the one referred longest ago, who may well be the
 * last to turn up. ✅ **Each ROW already says "Waiting since referral" and is not at fault; it is the
 * summary line a scanning reader takes that has to name which wait.**
 *
 * 🔴 **BOTH HALVES ARE ASSERTED, BECAUSE EITHER ALONE PERMITS THE WRONG OUTCOME.** Pinning only the
 * order allows the sentence to go back to a bare "wait"; pinning only the words allows the sort to
 * change underneath a sentence that then lies.
 *
 * ⚠️ **POPULATION.** The ED screen in jsdom over the seeded departments, at `NOW_ANCHOR`. It says
 * nothing about expects that carry an expected time of arrival — **the model has no such field**, and
 * if one is ever added this file is the one that must be revisited, because "longest since referral
 * first" would stop being the right order to show.
 */

function renderEd(edId: string) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdScreen edId={edId} />
    </WardFlowProvider>,
  );
}

/** The waits down the rendered Expects list, in render order, for one department. */
function waitsDownTheList(): number[] {
  const section = screen.queryByTestId("ward-ed-expects");
  if (section === null) return [];
  return within(section)
    .queryAllByTestId(/^ward-ed-expects-row-/u)
    .map((row) => Number(row.getAttribute("data-minutes-waiting")));
}

describe("the Expects list is ordered the way it says it is", () => {
  /**
   * 🔴 **ANTI-VACUITY, AND IT IS THE WHOLE FILE.** An ordering assertion over a list of one — or over
   * rows that all share a wait — passes on ascending, on descending and on unsorted alike. This case
   * refuses to let the rest of the file be trivially green.
   */
  it("🔴 some department has at least two expects with DIFFERENT waits, or nothing below means anything", () => {
    let best = 0;
    for (const department of allEmergencyDepartments()) {
      renderEd(department.id);
      best = Math.max(best, new Set(waitsDownTheList()).size);
      cleanup();
    }
    expect(
      best,
      "no seeded department has two expects whose waits differ, so an ordering claim cannot be tested " +
        "at all — seed one rather than deleting this file, because the claim is still on the screen",
    ).toBeGreaterThan(1);
  });

  it("renders longest-since-referral first, on every department that has expects", () => {
    for (const department of allEmergencyDepartments()) {
      renderEd(department.id);
      const waits = waitsDownTheList();

      for (let index = 1; index < waits.length; index += 1) {
        expect(
          waits[index - 1],
          `${department.name}'s expects are not in the order the section claims: row ${index} has ` +
            `waited ${waits[index]} minutes and the row above it ${waits[index - 1]}. The sentence on ` +
            "screen would be false, and a coordinator would work the list in the wrong sequence",
        ).toBeGreaterThanOrEqual(waits[index]);
      }
      cleanup();
    }
  });

  /**
   * ⚠️ **NEGATIVE AND POSITIVE TOGETHER.** "Says referral" alone would pass on *"longest wait first,
   * since referral"* — a sentence that still leads with the ambiguous word. The negative half is what
   * stops the bare phrase coming back.
   */
  it("names WHICH wait it is ordering by, and no longer says a bare 'longest wait first'", () => {
    const withExpects = allEmergencyDepartments().find((department) => {
      renderEd(department.id);
      const any = waitsDownTheList().length > 0;
      cleanup();
      return any;
    });
    expect(withExpects, "no department renders any expects, so the ordering sentence has no subject").toBeDefined();
    if (withExpects === undefined) return;

    renderEd(withExpects.id);
    const said = screen.getByTestId("ward-ed-expects").textContent ?? "";

    expect(
      said,
      "the Expects section has gone back to a bare 'longest wait first'. On a list of people who have " +
        "not arrived, a reader hears that as wait-to-arrive; it is wait since referral, and the two " +
        "clocks run in opposite directions",
    ).not.toMatch(/longest wait first/iu);
    expect(
      said,
      "the ordering claim no longer names which wait it means — see the file header for why the bare " +
        "word is the problem",
    ).toMatch(/since referral|since they were referred/iu);
  });
});
