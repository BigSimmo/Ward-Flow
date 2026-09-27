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

import type { Admission } from "@/components/ward-management/ward-admissions";
import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Task 5 — three things this screen did not have before, covered here rather than reusing
 * `tests/ward-statistics-ward-nulls.dom.test.tsx` or `tests/ward-statistics-number-agreement.dom.test.tsx`
 * (both untouched, both out of this build's scope):
 *
 *   1. Ready/Empty/Allocatable (`unitCapacity`) — genuinely new wiring, ruling R-B-09.
 *   2. Blocked discharges scoped to one ward, via `blockedDischargesByReason`.
 *   3. The demonstration wrapper actually rendering two series on this page.
 *
 * The real seed (`ward-sites.ts`) never has `allocatable.value > empty.value` on any unit, so a
 * test against the seed alone could not tell "Ready is the smaller of the two" from "Ready is
 * always allocatable" — the two claims agree on every seeded ward. `unitWithCapacity` below
 * overrides both figures directly so both directions of the `min()` are actually exercised.
 */

const BASE_UNIT = allUnits().find((candidate) => candidate.id === "rph-adult-secure");
if (!BASE_UNIT) throw new Error("ward-sites.ts no longer defines rph-adult-secure");

function unitWithCapacity(emptyValue: number, allocatableValue: number): Unit {
  return {
    ...BASE_UNIT!,
    empty: { ...BASE_UNIT!.empty, value: emptyValue },
    allocatable: { ...BASE_UNIT!.allocatable, value: allocatableValue },
  };
}

function renderWard(unit: Unit, admissions: Admission[] = []) {
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
    pulledAt: NOW_ANCHOR - 60,
    arrivedAt: NOW_ANCHOR - 60,
    ...overrides,
  } as unknown as Admission;
}

describe("ward capacity — Ready, Empty, Allocatable", () => {
  it("shows Empty and Allocatable as the two raw figures, and Ready as their minimum, when allocatable is smaller", () => {
    const unit = unitWithCapacity(5, 2);
    renderWard(unit);

    expect(screen.getByTestId("ward-stat-capacity-empty").textContent).toContain("5");
    expect(screen.getByTestId("ward-stat-capacity-allocatable").textContent).toContain("2");
    expect(screen.getByTestId("ward-stat-capacity-ready").textContent).toMatch(/^2\b/);
  });

  it("shows Ready as the minimum in the other direction too, when empty is the smaller figure", () => {
    const unit = unitWithCapacity(1, 4);
    renderWard(unit);

    expect(screen.getByTestId("ward-stat-capacity-empty").textContent).toContain("1");
    expect(screen.getByTestId("ward-stat-capacity-allocatable").textContent).toContain("4");
    expect(screen.getByTestId("ward-stat-capacity-ready").textContent).toMatch(/^1\b/);
  });

  /**
   * Ruling: "no free bed" names the raw `allocatable` gate and is correct; "no bed free" is
   * retired wording and must never appear. Checked against the whole capacity panel's text, not
   * just the Allocatable sentence, so a stray occurrence anywhere in the block would be caught.
   */
  it("says 'no free bed' when allocatable is zero, and never the retired 'no bed free'", () => {
    const unit = unitWithCapacity(3, 0);
    renderWard(unit);

    const allocatableText = screen.getByTestId("ward-stat-capacity-allocatable").textContent ?? "";
    expect(allocatableText).toContain("no free bed");

    const readyText = screen.getByTestId("ward-stat-capacity-ready").textContent ?? "";
    expect(readyText).toMatch(/^0\b/);

    expect(allocatableText).not.toContain("no bed free");
    expect(readyText).not.toContain("no bed free");
  });
});

describe("ward capacity — blocked discharges by blocker", () => {
  it("tallies only this ward's admissions, and the total matches the existing bare count beside it", () => {
    const unit = BASE_UNIT!;
    const otherUnit = allUnits().find((candidate) => candidate.id !== unit.id);
    if (!otherUnit) throw new Error("ward-sites.ts needs a second unit for this fixture");

    const admissions = [
      admission({ id: "ADM-transport", unitId: unit.id, blockReason: "Awaiting transport" }),
      admission({ id: "ADM-clean", unitId: unit.id, blockReason: "Awaiting clean" }),
      // Scoped OUT: a different ward's blocked admission must not inflate this ward's tally.
      admission({ id: "ADM-other-ward", unitId: otherUnit.id, blockReason: "Awaiting clean" }),
      // Scoped OUT: no blocker recorded.
      admission({ id: "ADM-clear", unitId: unit.id, blockReason: null }),
    ];
    renderWard(unit, admissions);

    const population = screen.getByTestId("ward-stat-blocked-by-reason-population").textContent ?? "";
    expect(population).toContain("2 blocked discharges");

    expect(screen.getByTestId("ward-stat-blocked-by-reason-Awaiting transport-count").textContent).toBe("1");
    expect(screen.getByTestId("ward-stat-blocked-by-reason-Awaiting clean-count").textContent).toBe("1");

    // Cross-check against the pre-existing bare count this breakdown sits beside — both are
    // scoped to admissions still on THIS ward, so they must agree.
    expect(screen.getByTestId("ward-stat-ready-blocked").textContent).toContain("2");
  });

  it("renders a genuine nought for a blocker nobody hit, rather than omitting its row", () => {
    const unit = BASE_UNIT!;
    renderWard(unit, [admission({ id: "ADM-transport", unitId: unit.id, blockReason: "Awaiting transport" })]);

    expect(screen.getByTestId("ward-stat-blocked-by-reason-Awaiting transport-count").textContent).toBe("1");
    expect(screen.getByTestId("ward-stat-blocked-by-reason-Awaiting clean-count").textContent).toBe("0");
  });

  /**
   * 🔴 **THE GUARD THIS FIXTURE EXISTS FOR.** `blockedDischargesByReason` throws on any
   * `blockReason` that is not a member of `BED_RELEASE_BLOCKERS` — by design, so a real defect
   * cannot quietly shrink the total. A real seed admission can never carry an invalid value (the
   * field is typed `BedReleaseBlocker | null` wherever it is authored), but this fixture bypasses
   * that the same way `tests/ward-statistics-number-agreement.dom.test.tsx` already does elsewhere
   * on this same screen, to prove the page degrades to an honest, named failure for this ONE
   * breakdown rather than crashing the whole render.
   */
  it("names the failure instead of crashing when a blockReason cannot be found in the model's vocabulary", () => {
    const unit = BASE_UNIT!;
    const admissions = [admission({ id: "ADM-bad", unitId: unit.id, blockReason: "not-a-real-blocker" })];
    renderWard(unit, admissions);

    expect(screen.getByTestId("ward-stat-blocked-by-reason-error")).toBeTruthy();
    expect(screen.queryByTestId("ward-stat-blocked-by-reason-list")).toBeNull();

    // The rest of the page — including the pre-existing bare count fed by the same admissions —
    // still renders; one malformed field must not take the whole ward page down with it.
    expect(screen.getByTestId("ward-statistics-ward-identity")).toBeTruthy();
    expect(screen.getByTestId("ward-stat-ready-blocked")).toBeTruthy();
  });
});

describe("ward capacity — occupancy and readiness over time (demonstration)", () => {
  // Josh, 25 Sept 2026: a made-up trend shows "Not recorded" and is not drawn.
  it("renders both trends through the demonstration wrapper as Not recorded, drawing neither", () => {
    const unit = unitWithCapacity(5, 2);
    renderWard(unit);

    const disclaimer = screen.getByTestId("ward-stat-trends-disclaimer").textContent ?? "";
    expect(disclaimer).toContain("Neither trend below is recorded");

    for (const testId of ["ward-stat-occupancy-trend", "ward-stat-ready-trend"]) {
      const chart = screen.getByTestId(testId);
      expect(chart.getAttribute("data-ward-primitive")).toBe("demonstration-chart");
      expect(chart.textContent).toContain("Not recorded");
      expect(chart.querySelector("svg")).toBeNull();
    }
    expect(screen.getByTestId("ward-statistics-ward-occupancy").querySelector("svg"), "no hand-drawn trend").toBeNull();
  });

  it("draws a different-looking trend for each series even though both share the same ward and clock", () => {
    const unit = unitWithCapacity(5, 2);
    renderWard(unit);

    const occupancyText = screen.getByTestId("ward-stat-occupancy-trend").textContent ?? "";
    const readyText = screen.getByTestId("ward-stat-ready-trend").textContent ?? "";
    expect(occupancyText).not.toBe(readyText);
  });
});
