import { assertStatisticsPresentation } from "./helpers/statistics-presentation";
import { render, screen, within } from "@testing-library/react";
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
import type { Admission } from "@/components/ward-management/ward-admissions";
import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **THE SECTION THE DRAWING CALLS "CLINICALLY READY, NOT YET GONE", AND THE NUMBER THAT COULD
 * DRIFT AWAY FROM ITS OWN TABLE.**
 *
 * This screen already rendered the headline count and the per-reason breakdown, three headings
 * apart, from two independently maintained filters. `readyNotYetGone` collapses them onto one pass
 * over one population; these tests hold the RENDERED page to that, reading both numbers out of the
 * DOM rather than comparing either against a fixture.
 *
 * ⚠️ **The existing ids are kept deliberately.** `ward-stat-ready-blocked` and the
 * `ward-stat-blocked-by-reason-*` family are asserted by three other suites, including one whose
 * whole point is that a malformed blocker must not take the ward page down. **Changing where the
 * numbers come from is the repair; removing the page's surface is not**, and a section that
 * silently dropped a tested id would be a reduction dressed as a rebuild.
 */

const BASE_UNIT = allUnits().find((candidate) => candidate.id === "rph-adult-secure");
if (!BASE_UNIT) throw new Error("ward-sites.ts no longer defines rph-adult-secure");

function renderWard(admissions: Admission[] = [], unit: Unit = BASE_UNIT!) {
  return render(
    <WardFlowProvider>
      <StatisticsWardScreen unitId={unit.id} units={[unit]} admissions={admissions} />
    </WardFlowProvider>,
  );
}

const ADMISSION_BASE = {
  specialling: false,
  highAcuity: false,
  referralId: null,
  sex: "Female",
  homeRegion: "Perth Metropolitan",
  tentativeDiagnosis: null,
  state: "occupied",
  awayAtEmergencyDepartmentSince: null,
  expectedDischargeAt: null,
  dischargeDateMoves: 0,
  dischargeDateSetAt: null,
  dischargeDateSetBy: null,
  leftAt: null,
  blockReason: null,
};

function admission(overrides: Record<string, unknown>): Admission {
  return {
    ...ADMISSION_BASE,
    unitId: BASE_UNIT!.id,
    pulledAt: NOW_ANCHOR - 60,
    arrivedAt: NOW_ANCHOR - 60,
    ...overrides,
  } as unknown as Admission;
}

/** Four patients, two of them blocked — so the share is a half and neither number is nought. */
const FOUR_WITH_TWO_BLOCKED = [
  admission({ id: "ADM-t", blockReason: "Awaiting transport" }),
  admission({ id: "ADM-c", blockReason: "Awaiting clean" }),
  admission({ id: "ADM-clear-1", blockReason: null }),
  admission({ id: "ADM-clear-2", blockReason: null }),
];

describe("clinically ready, not yet gone — the section", () => {
  it("renders under the name the drawing gives it", () => {
    renderWard(FOUR_WITH_TWO_BLOCKED);
    const section = screen.getByTestId("ward-stat-ready-section");
    expect(within(section).getByText(/Clinically ready, not yet gone/i)).toBeTruthy();
  });

  /**
   * 🔴 **THE ONE THAT EARNS THE SECTION.** The headline and the sum of the rendered rows are read
   * out of the same render — neither is a fixture — so a page whose number outran its table would
   * redden here rather than on a ward.
   */
  it("renders a headline that equals the sum of the reasons beneath it", () => {
    renderWard(FOUR_WITH_TWO_BLOCKED);

    const headline = screen.getByTestId("ward-stat-ready-blocked").textContent ?? "";
    const list = screen.getByTestId("ward-stat-blocked-by-reason-list");
    const counts = within(list)
      .getAllByTestId(/^ward-stat-blocked-by-reason-.+-count$/)
      .map((cell) => Number(cell.textContent));

    expect(counts.length, "no reason rows rendered, so this comparison would be vacuous").toBeGreaterThan(0);
    const summed = counts.reduce((running, count) => running + count, 0);
    expect(summed).toBeGreaterThan(0);
    expect(headline).toContain(String(summed));
  });

  it("states the share of the ward, and the denominator it was taken over", () => {
    renderWard(FOUR_WITH_TWO_BLOCKED);

    const share = screen.getByTestId("ward-stat-ready-share").textContent ?? "";
    expect(share).toContain("50");
    expect(share).toContain("4");
  });

  /**
   * 🔴 **AN EMPTY WARD HAS NO SHARE, AND MUST NOT SAY "0%".** `0 of 0` is undefined; a nought there
   * would be a measurement of a question nobody could ask, which is the whole reason this figure is
   * a `StatisticsFigure` rather than a number.
   */
  it("refuses to state a share on a ward with nobody on it", () => {
    renderWard([]);

    const share = screen.getByTestId("ward-stat-ready-share").textContent ?? "";
    expect(share).toMatch(/divide/i);
    expect(share).not.toMatch(/\b0\s*%/);
  });

  /**
   * ⚠️ **The drawing's own footer, and it is not decoration.** It refuses the reading a coordinator
   * would otherwise bring: that a falling count is an improvement and a patient on this list is a
   * problem.
   */
  it("uses visible operational panels instead of the retired explanation: says the count is a description rather than a target", () => {
    assertStatisticsPresentation("hub");
  });

  /**
   * 🔴 **THE EXISTING RULING, RE-PROVED AGAINST THE NEW WIRING.** One malformed blocker must not
   * take the ward page down. The breakdown throws by design; the headline still has to say
   * something, and what it says must be honest about the table being unavailable.
   */
  it("keeps the headline when a malformed blocker makes the breakdown uncomputable", () => {
    renderWard([admission({ id: "ADM-bad", blockReason: "not-a-real-blocker" })]);

    expect(screen.getByTestId("ward-stat-blocked-by-reason-error")).toBeTruthy();
    expect(screen.queryByTestId("ward-stat-blocked-by-reason-list")).toBeNull();
    expect(screen.getByTestId("ward-stat-ready-blocked")).toBeTruthy();
    expect(screen.getByTestId("ward-statistics-ward-identity")).toBeTruthy();
  });
});

/**
 * 🔴 **O-16.7 — THE OWNER RULED A NINTH BLOCKER IN, AND THIS IS THE ONE PLACE A LITERAL IS CORRECT.**
 *
 * *"Funding or plan decision pending"* was the largest row of the approved drawing's reason table and
 * the one concept `BED_RELEASE_BLOCKERS` refused. **That refusal was right when it was made** — the
 * list's own comment excluded guardianship and financial arrangements as facts about the PERSON
 * rather than about the bed, and said adding an entry *"remains a recorded product decision, never an
 * implementer's convenience"*. ✅ **The owner has now made that recorded product decision:** *"A real
 * reason a discharge stalls, with nowhere to record it today. Ruled in."*
 *
 * ⚠️ **WHY THESE TWO ASSERTIONS AND NOT A COUNT.** This repository deliberately refuses to pin list
 * LENGTHS — the owner has said he adds and removes entries, and a hard-coded size breaks on his next
 * edit and invites someone to "fix" the number rather than read the change. **A count is the wrong
 * thing to pin. The RULING is the right thing to pin**, and a ruling is a specific string: remove
 * this member and the owner's decision has been reversed by whoever removed it.
 *
 * 🔴 **AND THE SECOND TEST IS THE ONE THAT EARNS ITS PLACE.** The first proves the word is in a list.
 * **The second proves the ruling reached the SCREEN** — and it does so without the screen being
 * edited at all, because the section's rows are generated from the vocabulary rather than typed out.
 * **That is the design paying for itself: an owner decision became a row on every ward page with no
 * change to any component.**
 */
describe("O-16.7 — the ninth blocker the owner ruled in", () => {
  const FUNDING_OR_PLAN = "Funding or plan decision pending";

  it("is a member of the vocabulary, because a ruling is a string and not a count", () => {
    expect(BED_RELEASE_BLOCKERS).toContain(FUNDING_OR_PLAN);
  });

  /**
   * ⚠️ **The row is asserted against a ward that has NOBODY carrying this blocker**, deliberately.
   * The section renders every member of the vocabulary including those at nought, so a row appearing
   * only when somebody happens to be blocked by it would be a different, weaker guarantee — and it
   * would make this test pass for the wrong reason on a fixture that happened to include one.
   */
  it("reaches the ward page as its own row, generated rather than typed", () => {
    renderWard([admission({ id: "ADM-other", blockReason: "Awaiting transport" })]);

    const row = screen.getByTestId(`ward-stat-blocked-by-reason-${FUNDING_OR_PLAN}`);
    expect(row.textContent).toContain(FUNDING_OR_PLAN);
    expect(screen.getByTestId(`ward-stat-blocked-by-reason-${FUNDING_OR_PLAN}-count`).textContent).toBe("0");
  });
});
