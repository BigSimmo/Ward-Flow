import { describe, expect, it } from "vitest";
import {
  ACT_PERIOD_DEMO_LABEL,
  actPeriodCountdownText,
  actPeriodFor,
  actPeriodReading,
  actPeriodsDemo,
  addPeriod,
} from "@/components/ward-management/legal-forms/act-periods-demo";
import type { Movement } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Owner ruling, 4 October 2026: Act periods may appear only as a labelled synthetic demo, from a
 * written source, counted from a time a person typed. These tests pin each of those three limbs.
 */
const NOW = NOW_ANCHOR;
const DAY_ZERO = new Date("2026-09-01T00:00:00+08:00");
const template = wardMovements.find((movement) => movement.id === "WF-001");
if (!template) throw new Error("WF-001 is not in the fixture any more");

function withForm(code: string, formedAt?: number): Movement {
  return { ...template, legalForm: { code }, formedAt } as Movement;
}

describe("Act period table (synthetic demo)", () => {
  it("holds only the sourced periods, each with a source, and leaves out the unsourced forms", () => {
    expect(Object.keys(actPeriodsDemo).sort()).toEqual(
      ["1A", "2", "3A", "3B", "3C", "4A", "4B", "5A", "5B", "6A", "6B", "6C", "7D"].sort(),
    );
    for (const code of ["1B", "3D", "6D"]) expect(actPeriodFor(code), code).toBeUndefined();
    for (const period of Object.values(actPeriodsDemo)) expect(["act", "guidance"]).toContain(period.source);
  });

  it("pins the periods checked against the Act text", () => {
    expect(actPeriodsDemo["1A"]).toMatchObject({ adult: { hours: 72 }, section: "s 44" });
    expect(actPeriodsDemo["2"]).toMatchObject({ adult: { hours: 6 }, section: "s 34(3)" });
    expect(actPeriodsDemo["3A"]).toMatchObject({ adult: { hours: 24 }, section: "s 28(1)" });
    expect(actPeriodsDemo["3B"]).toMatchObject({ adult: { hours: 24 }, section: "s 28(2)" });
    expect(actPeriodsDemo["3C"]).toMatchObject({ adult: { hours: 72 }, section: "s 55(3)" });
    expect(actPeriodsDemo["5B"]).toMatchObject({ adult: { months: 3 }, section: "s 121(1)" });
    expect(actPeriodsDemo["6C"]).toMatchObject({ adult: { months: 3 }, under18: { days: 28 }, section: "s 89(3)" });
  });

  it("counts hours and days exactly, and months on the calendar", () => {
    expect(addPeriod(100, { hours: 72 }, DAY_ZERO)).toBe(100 + 72 * 60);
    expect(addPeriod(100, { days: 14 }, DAY_ZERO)).toBe(100 + 14 * 24 * 60);
    // 1 Sept to 1 Dec 2026 (Perth) is 91 days, not 90.
    expect(addPeriod(0, { months: 3 }, DAY_ZERO)).toBe(91 * 24 * 60);
    // 31 Aug plus 3 months ends on 30 Nov, not 1 Dec.
    expect(addPeriod(-24 * 60, { months: 3 }, DAY_ZERO)).toBe(90 * 24 * 60);
  });
});

describe("Act period reading for a movement", () => {
  it("counts only from the written time, and labels every sentence as a synthetic demo", () => {
    const reading = actPeriodReading(withForm("1A", NOW - 60), DAY_ZERO);
    expect(reading?.endsAt).toBe(NOW - 60 + 72 * 60);
    expect(
      reading?.text.startsWith(`${ACT_PERIOD_DEMO_LABEL}: 72 hours from when the referral is made (s 44, Act text)`),
    ).toBe(true);
    expect(actPeriodCountdownText(reading!, NOW)).toMatch(/^Period would end .+, in \S+/);
  });

  it("shows no countdown without a written time, and none at all for a form with no sourced period", () => {
    const reading = actPeriodReading(withForm("1A"), DAY_ZERO);
    expect(reading?.endsAt).toBeUndefined();
    expect(actPeriodCountdownText(reading!, NOW)).toBe(
      "No written time recorded on the form, so there is nothing to count from.",
    );
    expect(actPeriodReading(withForm("3D", NOW), DAY_ZERO)).toBeUndefined();
  });

  it("says the countdown is the adult period where a child's period differs", () => {
    const reading = actPeriodReading(withForm("6A", NOW - 30 * 24 * 60), DAY_ZERO)!;
    expect(reading.text).toContain("21 days for an adult (14 days under 18)");
    expect(reading.text).toContain("WA guidance");
    expect(actPeriodCountdownText(reading, NOW)).toMatch(/^Adult period would end .*ago\.$/);
  });

  it("never writes a dueAt: the typed expiry stays the record", () => {
    const movement = withForm("3A", NOW);
    actPeriodReading(movement, DAY_ZERO);
    expect(movement.legalForm?.dueAt).toBeUndefined();
  });
});
