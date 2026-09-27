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

import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardStatistics } from "@/components/ward-management/ward-statistics";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";

/**
 * ═══ THE AVERAGE STAY IS NOT A COMPLETED-STAY AVERAGE, AND THE SCREEN SAID IT WAS ══════════════
 *
 * `lengthOfStayMinutes` (`ward-statistics.ts:152-157`) measures from `arrivedAt` to
 * **`leftAt ?? now`**, and returns `null` only when `arrivedAt` is missing. So:
 *
 * - the population is **everyone who has ARRIVED**, with a stay still in progress measured to the
 *   current clock;
 * - the figure is absent only when **nobody has arrived**, never when nobody has left.
 *
 * Until 2026-09-07 the ward screen said *"averaged over the admissions on this ward that have both
 * arrived and left"*, and its empty state said *"no admission has both arrived and left"*. **Wrong
 * in opposite directions**, and the seed holds five departures across twenty-three wards — so on
 * most ward pages a real number was printed above a sentence describing a population of nobody.
 * The comparisons screen said `"none completed"` for the same reason.
 *
 * ## Why this file exists rather than a corrected sentence alone
 *
 * 🔴 **The whole ward suite was green before the fix and green after it.** Nothing asserted the
 * wording, which is why it survived. A sentence naming the wrong population is invisible to every
 * gate this repository has: it is not a wrong number, not a type error, not an unresolved token.
 *
 * ⚠️ **This does NOT pin the wording.** It pins the two facts that make the sentence checkable —
 * that a figure appears for a ward where nobody has left, and that the screen does not claim the
 * departed-only population. Any honest rewording passes; the specific false claim does not.
 */

const UNIT = allUnits()[0];

/**
 * Arrived, still here — the exact case the old sentence described as impossible.
 *
 * ⚠️ **DERIVED FROM A SEEDED ADMISSION, NEVER BUILT FROM A LITERAL.** The first version of this
 * file constructed all twenty-one fields by hand and closed with `as Admission`. Every field was
 * present and it still did not typecheck: `Instant` and `Sex` are branded, so a plain `number` and
 * a plain `"female"` do not satisfy them. **The cast hid that, and `vitest` does not typecheck, so
 * the suite went green while `tsc` went red** — the defect reached a commit.
 *
 * Cloning a real admission and overriding only the two fields under test is both typesafe and a
 * better fixture: it cannot drift out of shape when `Admission` gains a field.
 */
function arrivedNotLeft(source: Admission, id: string, arrivedDaysAgo: number): Admission {
  return {
    ...source,
    id,
    unitId: UNIT.id,
    state: "occupied",
    arrivedAt: (NOW_ANCHOR - arrivedDaysAgo * 1440) as Admission["arrivedAt"],
    leftAt: null,
  };
}

const SEEDED = seedWardFlowStateAt(0).admissions.find((a) => a.arrivedAt !== null)!;
const ARRIVED_ONLY = [arrivedNotLeft(SEEDED, "AD-STAY-1", 4), arrivedNotLeft(SEEDED, "AD-STAY-2", 2)];

function renderWith(admissions: Admission[]) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsWardScreen unitId={UNIT.id} units={[UNIT]} admissions={admissions} />
    </WardFlowProvider>,
  );
}

describe("the average-stay sentence names the population the figure measures", () => {
  it("the fixture really is arrived-and-not-left, or every assertion below is about nothing", () => {
    // THE FLOOR. If any of these had a `leftAt`, the case under test would not exist and the
    // assertions would pass against an ordinary completed-stay population.
    expect(ARRIVED_ONLY.length).toBeGreaterThan(0);
    for (const admission of ARRIVED_ONLY) {
      expect(admission.arrivedAt, `${admission.id} has not arrived`).not.toBeNull();
      expect(admission.leftAt, `${admission.id} has left, so it is the wrong fixture`).toBeNull();
    }
  });

  it("produces a figure for a ward where nobody has left — which the derivation confirms", () => {
    // Checked against the derivation directly as well as through the screen, so a screen that
    // stopped rendering the figure could not make this file pass by omission.
    const derived = wardStatistics(UNIT.id, ARRIVED_ONLY, NOW_ANCHOR);
    expect(derived.averageLengthOfStayDays, "a stay in progress must still be measurable").not.toBeNull();

    renderWith(ARRIVED_ONLY);
    const text = screen.getByTestId("ward-stat-length-of-stay").textContent ?? "";
    expect(text, "no figure rendered for a ward where people have arrived").toMatch(/\d/u);
  });

  it("never claims the average covers only admissions that have left", () => {
    renderWith(ARRIVED_ONLY);
    const text = screen.getByTestId("ward-stat-length-of-stay").textContent ?? "";
    expect(
      text,
      "the screen says the average is over admissions that have both arrived and left. It is not: " +
        "`lengthOfStayMinutes` measures to `leftAt ?? now`, so a stay still in progress is included " +
        "and measured up to the clock. Say what is measured, not what would be tidier.",
    ).not.toMatch(/both arrived and left/iu);
  });

  it("the empty state fires on nobody ARRIVED, not on nobody left", () => {
    // The mirror half of the same defect, and the rarer state — so the one nobody would have hit
    // by accident.
    renderWith([]);
    const text = screen.getByTestId("ward-stat-length-of-stay").textContent ?? "";
    expect(text, "the empty state should name arrival, which is what makes the figure absent").toMatch(/arrived/iu);
    expect(text, "the empty state still describes a completed-stay population").not.toMatch(/both arrived and left/iu);
  });
});
