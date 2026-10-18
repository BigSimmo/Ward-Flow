import { describe, expect, it } from "vitest";
import {
  ACT_PERIOD_DEMO_LABEL,
  actPeriodCountdownText,
  actPeriodFor,
  actPeriodReading,
  actPeriodsDemo,
  addPeriod,
  orderByActPeriodShare,
} from "@/components/ward-management/legal-forms/act-periods-demo";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
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

function withForm(code: string, formedAt?: number, cohort: Movement["cohort"] = "Adult"): Movement {
  return { ...template, legalForm: { code }, formedAt, cohort } as Movement;
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

describe("Act period countdown for a young person", () => {
  it("counts down to the under-18 period on Forms 6A, 6B and 6C when the date of birth shows under 18", () => {
    const start = NOW - 60;
    for (const code of ["6A", "6B"]) {
      const reading = actPeriodReading(withForm(code, start, "Youth"), DAY_ZERO, "2010-01-01")!;
      expect(reading.band, code).toBe("under18");
      expect(reading.endsAt, code).toBe(start + 14 * 24 * 60);
      expect(actPeriodCountdownText(reading, NOW), code).toMatch(/^Under-18 period would end/);
    }
    const sixC = actPeriodReading(withForm("6C", start, "Youth"), DAY_ZERO, "2010-01-01")!;
    expect(sixC.endsAt).toBe(start + 28 * 24 * 60);
  });

  it("keeps the adult period for a Youth patient whose date of birth shows 18 or over", () => {
    // The Youth cohort runs to 24, so a 21 year old is Youth and still an adult under the Act.
    const reading = actPeriodReading(withForm("6A", NOW - 60, "Youth"), DAY_ZERO, "2005-01-01")!;
    expect(reading.band).toBe("adult");
    expect(reading.endsAt).toBe(NOW - 60 + 21 * 24 * 60);
    expect(actPeriodCountdownText(reading, NOW)).toMatch(/^Adult period would end/);
  });

  it("reads the age when the period started, not today", () => {
    // Turns 18 on 1 Sept 2026, the demo's day zero; a form written the evening before is under 18.
    const reading = actPeriodReading(withForm("6A", -120, "Youth"), DAY_ZERO, "2008-09-01")!;
    expect(reading.band).toBe("under18");
    expect(actPeriodReading(withForm("6A", 60, "Youth"), DAY_ZERO, "2008-09-01")!.band).toBe("adult");
  });

  it("shows the shorter period, and says the age was not recorded, for a Youth movement with no date of birth", () => {
    const reading = actPeriodReading(withForm("6A", NOW - 60, "Youth"), DAY_ZERO)!;
    expect(reading.band).toBe("unknown");
    expect(reading.endsAt).toBe(NOW - 60 + 14 * 24 * 60);
    expect(actPeriodCountdownText(reading, NOW)).toMatch(/^Under-18 period would end \(age not recorded/);
  });

  it("uses the age band recorded from the form when there is no date of birth", () => {
    const under18 = {
      ...withForm("6A", NOW - 60, "Adult"),
      legalForm: { code: "6A", ageBand: "under_18" },
    } as Movement;
    expect(actPeriodReading(under18, DAY_ZERO)!.band).toBe("under18");
    expect(actPeriodReading(under18, DAY_ZERO)!.endsAt).toBe(NOW - 60 + 14 * 24 * 60);
    const adult = { ...withForm("6A", NOW - 60, "Youth"), legalForm: { code: "6A", ageBand: "adult" } } as Movement;
    expect(actPeriodReading(adult, DAY_ZERO)!.band).toBe("adult");
    expect(actPeriodReading(adult, DAY_ZERO)!.endsAt).toBe(NOW - 60 + 21 * 24 * 60);
    // A date of birth outranks the recorded band.
    expect(actPeriodReading(adult, DAY_ZERO, "2010-01-01")!.band).toBe("under18");
  });

  it("keeps the adult period for Adult and Older adult movements with no date of birth", () => {
    for (const cohort of ["Adult", "Older adult"] as const) {
      const reading = actPeriodReading(withForm("6A", NOW - 60, cohort), DAY_ZERO)!;
      expect(reading.band, cohort).toBe("adult");
      expect(reading.endsAt, cohort).toBe(NOW - 60 + 21 * 24 * 60);
    }
  });

  it("uses the adult period where no source gives an under-18 one", () => {
    const reading = actPeriodReading(withForm("3A", NOW - 60, "Youth"), DAY_ZERO, "2010-01-01")!;
    expect(reading.endsAt).toBe(NOW - 60 + 24 * 60);
    expect(actPeriodCountdownText(reading, NOW)).toMatch(/^Period would end/);
  });

  it("orders an under-18 6A ahead of an adult 6A opened at the same time", () => {
    const adult = { ...withForm("6A", undefined, "Youth"), id: "WF-901", openedAt: NOW - 10 * 24 * 60 } as Movement;
    const young = { ...withForm("6A", undefined, "Youth"), id: "WF-902", openedAt: NOW - 10 * 24 * 60 } as Movement;
    const dateOfBirthOf = (movement: Movement) => (movement.id === "WF-902" ? "2010-01-01" : "2005-01-01");
    expect(orderByActPeriodShare([adult, young], NOW, DAY_ZERO, dateOfBirthOf).map((movement) => movement.id)).toEqual([
      "WF-902",
      "WF-901",
    ]);
  });
});

describe("age band recorded with the written time", () => {
  function movementWithForm(code: string): { before: WardFlowState; movementId: `WF-${string}` } {
    const seeded = seedWardFlowState();
    const source = seeded.movements.find((movement) => !movement.closure)!;
    const movementId: `WF-${string}` = `WF-BAND-${code}`;
    const before: WardFlowState = {
      ...seeded,
      movements: [
        ...seeded.movements,
        { ...source, id: movementId, legalForm: { code }, legalClock: undefined, closure: undefined },
      ],
    };
    return { before, movementId };
  }

  it("saves the band, keeps it on a same-form time edit and refuses an unknown band", () => {
    const { before, movementId } = movementWithForm("6A");
    const base = { type: "RECORD_LEGAL_FORM_WRITTEN", role: "ed", now: NOW, movementId, formCode: "6A" } as const;
    const saved = wardFlowReducer(before, { ...base, writtenAt: NOW - 30, ageBand: "under_18" });
    expect(saved.rejections).toEqual([]);
    expect(saved.movements.find((m) => m.id === movementId)!.legalForm?.ageBand).toBe("under_18");
    const edited = wardFlowReducer(saved, { ...base, writtenAt: NOW - 20 });
    expect(edited.movements.find((m) => m.id === movementId)!.legalForm?.ageBand).toBe("under_18");
    // Choosing "Not recorded" clears it, so a mistaken Adult can be taken back to the shorter period.
    const cleared = wardFlowReducer(edited, { ...base, writtenAt: NOW - 20, ageBand: null });
    expect(cleared.rejections).toEqual([]);
    expect(cleared.movements.find((m) => m.id === movementId)!.legalForm?.ageBand).toBeUndefined();
    const refused = wardFlowReducer(before, { ...base, writtenAt: NOW - 30, ageBand: "child" as never });
    expect(refused.rejections.length).toBeGreaterThan(0);
  });
});
