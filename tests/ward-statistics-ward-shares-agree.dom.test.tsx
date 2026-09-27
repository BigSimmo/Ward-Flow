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
import type { Admission } from "@/components/ward-management/ward-admissions";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **TWO PANELS ON ONE SCREEN EACH SAY "OF THE N PATIENTS ON THIS WARD", AND NOTHING IN THE TYPE
 * SYSTEM MAKES THEM AGREE.**
 *
 * `readyNotYetGone` takes its denominator from `blockedDischargesByReason`'s single pass;
 * `dischargeDateCoverage` filters the same population in its own module. **Both are correct today.
 * Neither knows the other exists.** ⚠️ **A screen reading "25% of the 12 patients on this ward" above
 * "50% of the 11 patients on this ward" is arithmetic nobody could check and both halves would be
 * individually defensible.**
 *
 * ✅ **So this reads BOTH denominators out of the RENDERED PAGE and requires them to match.** Neither
 * side is a fixture; the test knows nothing about how either derivation filters. **It is the same
 * repair as the ready section's own headline, one level up: where two figures must agree and nothing
 * enforces it, the agreement is the thing to assert.**
 */

const BASE_UNIT = allUnits().find((candidate) => candidate.id === "rph-adult-secure");
if (!BASE_UNIT) throw new Error("ward-sites.ts no longer defines rph-adult-secure");

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

function renderWard(admissions: Admission[], unit: Unit = BASE_UNIT!) {
  render(
    <WardFlowProvider>
      <StatisticsWardScreen unitId={unit.id} units={[unit]} admissions={admissions} />
    </WardFlowProvider>,
  );
}

/** Every whole number a cell renders, so the comparison is over what a reader can actually see. */
function numbersIn(testId: string): number[] {
  const text = screen.getByTestId(testId).textContent ?? "";
  return [...text.matchAll(/\d+(?:\.\d+)?/gu)].map((match) => Number(match[0]));
}

describe("the ward screen's two share-of-the-ward denominators", () => {
  it("name the same number of patients, read from the rendered page", () => {
    const admissions = [
      admission({ id: "a", blockReason: "Awaiting transport", expectedDischargeAt: NOW_ANCHOR + 1_000 }),
      admission({ id: "b", blockReason: null, expectedDischargeAt: NOW_ANCHOR + 1_000 }),
      admission({ id: "c", blockReason: null, expectedDischargeAt: null }),
      admission({ id: "d", blockReason: null, expectedDischargeAt: null }),
      // Departed: in neither population, and the guard against one panel counting them.
      admission({ id: "gone", state: "departed", leftAt: NOW_ANCHOR - 10, expectedDischargeAt: NOW_ANCHOR - 20 }),
    ];
    renderWard(admissions);

    const readyNumbers = numbersIn("ward-stat-ready-share");
    const dateNumbers = numbersIn("ward-stat-discharge-date-share");

    expect(readyNumbers.length, "the ready share rendered no numbers, so this would be vacuous").toBeGreaterThan(1);
    expect(dateNumbers.length, "the date share rendered no numbers").toBeGreaterThan(1);

    // The denominator is the last number in each sentence — "N% of the M patients …".
    const readyDenominator = readyNumbers.at(-1);
    const dateDenominator = dateNumbers.at(-1);

    expect(
      dateDenominator,
      "the two panels disagree about how many patients are on this ward — a reader cannot check " +
        "either figure once the denominators differ",
    ).toBe(readyDenominator);
    expect(readyDenominator, "the departed admission was counted into the ward").toBe(4);
  });

  /**
   * ⚠️ **Both panels must refuse a share on an empty ward, and refuse it the SAME way.** One saying
   * "0%" while the other says it cannot divide would be two answers to one question on one screen.
   */
  it("both refuse a share on a ward with nobody on it", () => {
    renderWard([]);

    for (const testId of ["ward-stat-ready-share", "ward-stat-discharge-date-share"]) {
      const cell = screen.getByTestId(testId);
      expect(cell.textContent, `${testId} stated a share over an empty ward`).toMatch(/divide/i);
      expect(cell.getAttribute("data-unmeasured"), `${testId} is not marked unmeasured`).toBe("");
    }
  });

  /**
   * 🔴 **THE PARTITION, ASSERTED ON THE RENDERED PAGE AND NOT ONLY IN THE DERIVATION'S OWN SUITE.**
   * Recorded and not-recorded must sum to the denominator both panels share — so a future edit that
   * renders one of them from somewhere else reddens here.
   */
  it("renders two discharge-date buckets that sum to that same denominator", () => {
    renderWard([
      admission({ id: "a", expectedDischargeAt: NOW_ANCHOR + 1_000 }),
      admission({ id: "b", expectedDischargeAt: null }),
      admission({ id: "c", expectedDischargeAt: null }),
    ]);

    const recorded = numbersIn("ward-stat-discharge-date-recorded").at(0);
    const notRecorded = numbersIn("ward-stat-discharge-date-not-recorded").at(0);
    const denominator = numbersIn("ward-stat-discharge-date-share").at(-1);

    expect(recorded).toBe(1);
    expect(notRecorded).toBe(2);
    expect((recorded ?? 0) + (notRecorded ?? 0), "the two buckets do not sum to the ward").toBe(denominator);
  });

  /**
   * ⚠️ **THE DRAWING'S FALSE LINE MUST NOT REAPPEAR.** *"Where a discharge went — not tracked here"*
   * was measured false and is deliberately absent; this refuses a version that copies it back in.
   */
  it("does not claim the destination of a discharge is untracked", () => {
    renderWard([admission({ id: "a", expectedDischargeAt: null })]);
    const panel = screen.getByTestId("ward-stat-discharge-date-coverage").textContent ?? "";
    expect(panel).not.toMatch(/not tracked here/i);
  });
});
