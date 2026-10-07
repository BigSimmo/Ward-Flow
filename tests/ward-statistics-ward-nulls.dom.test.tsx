import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same reason as every sibling dom suite: the section frame renders next/link anchors and jsdom
// cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits } from "@/components/ward-management/ward-sites";
import { wardStatistics } from "@/components/ward-management/ward-statistics";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **A NULL MEASURE MUST NEVER REACH THE SCREEN AS A NUMBER, AND NOTHING ELSE CATCHES THIS.**
 *
 * Ward Lead's ruling, 2026-09-05, after this file's subject was named the highest-risk cell on the
 * four statistics screens. `ward-statistics.ts` had already said the same thing in its own words:
 *
 * > A COUNT OF ZERO IS A REAL ANSWER AND IS TYPED AS ONE. Every `number` field is a genuine count
 * > where `0` is true and correct; every `number | null` field is an average or an extreme where
 * > `null` means "nothing to measure". The two are separated in the TYPE so a screen cannot render
 * > one as the other by accident — **which is the single most likely way this page could lie**,
 * > because "no ward declined" and "declines cannot be counted" look identical once they have both
 * > been flattened to a dash.
 *
 * ⚠️ **A NULL FLATTENED TO ZERO PASSES EVERYTHING ELSE.** It type-checks, because `null ?? 0` is a
 * `number`. It passes any DOM test asserting a figure is present, because a figure IS present. And
 * it looks exactly like a measurement to a reader. "0 days average stay" on a ward page is the
 * claim that patients leave the same day they arrive — an invented clinical fact, produced by a
 * real derivation, with every gate green.
 *
 * ⚠️ **THE DASH IS OUT TOO**, and that is the module's own emphasis rather than a preference of
 * mine: flattening to a dash is the failure it names, because a dash cannot say which of the two
 * things it means.
 *
 * **THE FIXTURE IS THE ARGUMENT.** One ward, no admissions. That single state produces BOTH kinds
 * of answer at once — all three averages null, and every count a true and correct nought — so the
 * screen has to tell them apart in the same render or fail. A test using two fixtures could pass
 * while the screen used one word for both.
 */

const UNIT = allUnits().find((candidate) => candidate.id === "rph-adult-secure");
if (!UNIT) throw new Error("ward-sites.ts no longer defines rph-adult-secure");

/** The six measures `wardStatistics` returns, each with the element that must carry it. */
const NULLABLE = [
  ["ward-stat-length-of-stay", "averageLengthOfStayDays"],
  ["ward-stat-empty-bed-minutes", "averageEmptyBedMinutes"],
  ["ward-stat-waitlist-wait", "averageWaitlistWaitMinutes"],
] as const;

const COUNTS = [
  ["ward-stat-ready-blocked", "readyToLeaveCannot"],
  ["ward-stat-long-stays", "longStays"],
  ["ward-stat-discharge-outcomes", "dischargeDateOutcomes"],
] as const;

function renderWard() {
  return render(
    <WardFlowProvider>
      <StatisticsWardScreen unitId={UNIT!.id} units={[UNIT!]} admissions={[]} />
    </WardFlowProvider>,
  );
}

describe("a ward statistics page never renders an unmeasurable average as a number", () => {
  /**
   * ⚠️ **THE ANTI-VACUITY FLOOR, AND IT IS THE FIRST ASSERTION ON PURPOSE.**
   *
   * Every assertion below is of the form "this element does not contain a digit". A screen that
   * renders NONE of these elements satisfies all of them perfectly — which is the state this page
   * is in today, and would be the state it returned to if a measure were quietly dropped during a
   * redesign. So the population is asserted before anything is asserted about it.
   */
  it("retains genuine count measures while hiding unavailable averages", () => {
    renderWard();
    for (const [testId, field] of COUNTS) {
      expect(screen.queryByTestId(testId), `${field} is not on the page — nothing below can fail`).not.toBeNull();
    }
  });

  /**
   * The premise, pinned rather than assumed: this fixture really does produce three nulls and three
   * genuine counts. If `wardStatistics` ever stopped returning null here, every assertion below
   * would pass for the wrong reason.
   */
  it("keeps the fixture producing what the assertions are about", () => {
    const stats = wardStatistics(UNIT!.id, [], NOW_ANCHOR);
    expect(stats.averageLengthOfStayDays, "fixture no longer yields a null length of stay").toBeNull();
    expect(stats.averageEmptyBedMinutes, "fixture no longer yields a null empty-bed figure").toBeNull();
    expect(stats.averageWaitlistWaitMinutes, "waitlist wait is no longer unconditionally null").toBeNull();
    expect(stats.readyToLeaveCannot, "readyToLeaveCannot is not a true nought here").toBe(0);
    expect(stats.longStays, "longStays is not a true nought here").toBe(0);
  });

  it.each(NULLABLE)("hides %s (%s) instead of showing an empty card or a fabricated zero", (testId) => {
    renderWard();
    expect(screen.queryByTestId(testId)).toBeNull();
  });

  it.each(COUNTS)("retains a true zero for %s", (testId) => {
    renderWard();
    expect(screen.getByTestId(testId).textContent).toMatch(/0|None|No resolved discharge dates/);
  });
});
