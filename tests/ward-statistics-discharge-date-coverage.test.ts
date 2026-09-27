/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { figureText } from "@/components/ward-management/statistics/statistics-absence";
import { dischargeDateCoverage } from "@/components/ward-management/statistics/statistics-ward-discharge-dates";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

/**
 * 🔴 **HOW MANY PATIENTS ON THIS WARD HAVE A DISCHARGE DATE WRITTEN DOWN — the buildable half of the
 * drawing's Discharge planning panel.**
 *
 * The other half, a table of **this month's** discharges, is not built and is not buildable: the
 * prototype keeps no history and the whole network holds five departed admissions, the oldest about
 * 43 hours old. That is D-4 and it is with the owner.
 *
 * ⚠️ **THE DRAWING'S FOURTH FACT IS DELIBERATELY ABSENT.** It reads *"Where a discharge went — not
 * tracked here"*, and that line was **measured false**: `Admission.leavingDestination` exists, has
 * eight members, and the seed populates it on every departure. 🔴 **Ruled: not reproduced, and not
 * silently corrected either** — the drawing carries it as a defect and the omission is recorded under
 * §7.0(2).
 *
 * 🔴 **AND THE PROPERTY THAT MATTERS MOST HERE IS THE PARTITION.** `recorded` and `notRecorded` must
 * sum to the population exactly — no third bucket, no record counted twice. A neighbouring derivation
 * in this same family carries a doc comment warning that ITS three figures are **not** a partition
 * and must never be summed; this one is, and a test says so rather than a reader having to know.
 */

const SEED = seedWardFlowState();
const TEMPLATE = SEED.admissions[0];
const UNIT = "a-ward";

function bend(changes: Partial<Admission>): Admission {
  expect(TEMPLATE, "the seed carries no admissions, so this suite would assert nothing").toBeDefined();
  return { ...structuredClone(TEMPLATE!), unitId: UNIT, state: "occupied", ...changes } as Admission;
}

describe("discharge-date coverage on one ward", () => {
  it("splits the ward into exactly two buckets that sum to it", () => {
    const result = dischargeDateCoverage(
      [
        bend({ id: "a", expectedDischargeAt: 1_000 }),
        bend({ id: "b", expectedDischargeAt: 2_000 }),
        bend({ id: "c", expectedDischargeAt: null }),
      ],
      UNIT,
    );

    expect(result.recorded).toBe(2);
    expect(result.notRecorded).toBe(1);
    expect(result.recorded + result.notRecorded, "the two buckets do not sum to the ward").toBe(result.population);
  });

  /**
   * 🔴 **A CORRUPT DATE IS NOT A RECORDED DATE, AND `!== null` ALONE WOULD COUNT IT AS ONE.** `NaN`
   * is not null, so the obvious predicate reports a date written down where there is no readable
   * date at all — **a patient counted as planned for, on a screen a coordinator reads to find who is
   * not.** `wardStatistics` already guards this exact field with `Number.isFinite`; this matches it
   * rather than inventing a second rule.
   */
  it("does not count an unreadable date as a date", () => {
    const result = dischargeDateCoverage(
      [bend({ id: "a", expectedDischargeAt: Number.NaN }), bend({ id: "b", expectedDischargeAt: 1_000 })],
      UNIT,
    );

    expect(result.recorded).toBe(1);
    expect(result.notRecorded).toBe(1);
  });

  it("excludes departed admissions from both buckets alike", () => {
    const result = dischargeDateCoverage(
      [
        bend({ id: "here", expectedDischargeAt: 1_000 }),
        bend({ id: "gone", expectedDischargeAt: 1_000, state: "departed" }),
      ],
      UNIT,
    );

    expect(result.population).toBe(1);
    expect(result.recorded).toBe(1);
  });

  it("counts only this ward", () => {
    const result = dischargeDateCoverage(
      [bend({ id: "mine", expectedDischargeAt: null }), bend({ id: "theirs", unitId: "elsewhere" })],
      UNIT,
    );

    expect(result.population).toBe(1);
    expect(result.notRecorded).toBe(1);
  });

  /**
   * 🔴 **0 of 0 IS UNDEFINED, NOT NOUGHT** — the same distinction the ready-section's share keeps, and
   * kept by the same vocabulary rather than by a second rule.
   */
  it("cannot form a share on a ward with nobody on it", () => {
    const result = dischargeDateCoverage([], UNIT);
    expect(result.shareRecorded.kind).toBe("cannot-be-formed");
    expect(figureText(result.shareRecorded)).toMatch(/divide/i);
  });

  it("reports a true nought share when nobody on the ward has a date", () => {
    const result = dischargeDateCoverage([bend({ id: "a", expectedDischargeAt: null })], UNIT);
    expect(result.shareRecorded).toEqual({ kind: "measured", value: 0 });
  });

  it("states the share as a percentage of the ward", () => {
    const result = dischargeDateCoverage(
      [
        bend({ id: "a", expectedDischargeAt: 1_000 }),
        bend({ id: "b", expectedDischargeAt: null }),
        bend({ id: "c", expectedDischargeAt: null }),
        bend({ id: "d", expectedDischargeAt: null }),
      ],
      UNIT,
    );
    expect(figureText(result.shareRecorded)).toBe("25");
  });

  /**
   * ⚠️ **The anti-vacuity pass over the real seed.** Every assertion above uses a bent fixture; this
   * one proves the derivation runs over the shipped data and finds a ward with patients — otherwise
   * the suite would be describing a function nothing real ever reaches.
   */
  it("runs over the real seed and finds at least one ward with patients on it", () => {
    const withPatients = SEED.units.filter((unit) => dischargeDateCoverage(SEED.admissions, unit.id).population > 0);
    expect(withPatients.length, "no seeded ward has anybody on it").toBeGreaterThan(0);

    for (const unit of withPatients) {
      const coverage = dischargeDateCoverage(SEED.admissions, unit.id);
      expect(coverage.recorded + coverage.notRecorded, `ward ${unit.id} does not partition`).toBe(coverage.population);
    }
  });
});
