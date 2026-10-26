// tests/ward-forecast-engine.test.ts
//
// The forecasting build's pure modules (Josh, 23 Oct 2026): levers, horizon, scenario, ED access
// risk, since you looked, the bed meeting brief and the forecast alerts. Each is asserted against
// the seed by an invariant that ties it back to the forecast it explains, so a figure on one card
// can never drift from the figure on another.
import { describe, expect, it } from "vitest";

import { bedKindGaps } from "@/components/ward-management/capacity/capacity-derivations";
import { edAccessRisk } from "@/components/ward-management/forecast/ed-access-risk";
import { forecastAlerts } from "@/components/ward-management/forecast/forecast-alerts";
import { forecastBrief } from "@/components/ward-management/forecast/forecast-brief";
import { bedKindOfNeed, forecastByKind, isWaitingForBed } from "@/components/ward-management/forecast/forecast-by-kind";
import {
  forecastHorizonDays,
  horizonDays,
  sevenDayHorizon,
} from "@/components/ward-management/forecast/forecast-horizon";
import {
  forecastChangeSentence,
  forecastChangeSinceLook,
  parseForecastLook,
  takeForecastLook,
} from "@/components/ward-management/forecast/forecast-last-look";
import {
  blockerGroups,
  forecastLevers,
  notYetCounted,
  shortBlocker,
} from "@/components/ward-management/forecast/forecast-levers";
import {
  applyScenario,
  EMPTY_SCENARIO,
  scenarioIsEmpty,
} from "@/components/ward-management/forecast/forecast-scenario";
import { wardAdmissions, wardPlannedAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { MINUTES_PER_DAY, perthMidnight } from "@/components/ward-management/ward-clock";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import { bedReleases, leaveBeds, wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

const units = allUnits();
const now = NOW_ANCHOR;
const tomorrow = forecastByKind(units, bedReleases, wardAdmissions, wardMovements, now, 1, wardPlannedAdmissions);

describe("forecastLevers", () => {
  it("moves held-up and overdue levers with the current plan date", () => {
    const unit = units.find((entry) => !entry.isClosed)!;
    const stay = {
      ...wardAdmissions[0]!,
      unitId: unit.id,
      state: "occupied" as const,
      expectedDischargeAt: now + 3 * MINUTES_PER_DAY,
    };
    const release = {
      ...bedReleases[0]!,
      unitId: unit.id,
      admissionId: stay.id,
      state: "expected" as const,
      expectedAt: now + 60,
      blocker: "Awaiting transport" as const,
    };
    expect(forecastLevers([unit], [release], [stay], now)).toEqual([]);
    const overdueStay = { ...stay, expectedDischargeAt: now - 2 * MINUTES_PER_DAY };
    expect(forecastLevers([unit], [{ ...release, blocker: null }], [overdueStay], now)).toEqual([
      { kind: "review_overdue", beds: 1 },
    ]);
    expect(
      forecastLevers(
        [unit],
        [{ ...release, expectedAt: now - 2 * MINUTES_PER_DAY, blocker: null }],
        [{ ...stay, expectedDischargeAt: now + 60 }],
        now,
      ),
    ).toEqual([]);
  });

  const levers = forecastLevers(units, bedReleases, wardAdmissions, now);

  it("covers exactly the beds the forecast range is made of", () => {
    const beds = (kind: string) => levers.find((lever) => lever.kind === kind)?.beds ?? 0;
    expect(beds("confirm_dates")).toBe(tomorrow.total.plannedNotFlagged);
    expect(beds("clear_held_up")).toBe(tomorrow.total.heldUp);
    expect(beds("review_overdue")).toBe(tomorrow.total.overdue);
  });

  it("puts the biggest lever first and an overdue review last", () => {
    const moving = levers.filter((lever) => lever.kind !== "review_overdue");
    expect(moving.map((lever) => lever.beds)).toEqual([...moving.map((lever) => lever.beds)].sort((a, b) => b - a));
    const overdueAt = levers.findIndex((lever) => lever.kind === "review_overdue");
    if (overdueAt >= 0) expect(overdueAt).toBe(levers.length - 1);
  });

  it("splits blocked beds into same-day and escalate groups that add up", () => {
    const groups = blockerGroups(units, wardAdmissions);
    const sum = [...groups.sameDay, ...groups.escalate].reduce((total, entry) => total + entry.count, 0);
    expect(sum).toBe(groups.total);
    expect(shortBlocker("Awaiting clean")).toBe("Clean");
  });

  it("counts leave beds and repatriations only on open wards", () => {
    const counted = notYetCounted(units, leaveBeds, [], wardAdmissions);
    expect(counted.leaveBeds).toBeLessThanOrEqual(leaveBeds.length);
    expect(counted.repatriations).toBe(0);
  });
});

describe("forecast horizon", () => {
  it("adds a third day on a Friday and before a WA public holiday", () => {
    // 23 Oct 2026 is a Friday, 21 Oct a Wednesday, 25 Jan 2027 the Monday before Australia Day.
    expect(forecastHorizonDays(now, perthMidnight(2026, 9, 23))).toEqual([1, 2, 3]);
    expect(forecastHorizonDays(now, perthMidnight(2026, 9, 21))).toEqual([1, 2]);
    expect(forecastHorizonDays(now, perthMidnight(2027, 0, 25))).toEqual([1, 2, 3]);
  });

  it("runs the last day to the first working day after a long weekend (audit TC2-06)", () => {
    // Friday 25 Sep 2026, before King's Birthday: Tuesday is the first working day.
    expect(forecastHorizonDays(now, perthMidnight(2026, 8, 25))).toEqual([1, 2, 4]);
    // Thursday 2 Apr 2026, before Easter: Good Friday to Easter Monday are closed.
    expect(forecastHorizonDays(now, perthMidnight(2026, 3, 2))).toEqual([1, 2, 5]);
    // Thursday 24 Dec 2026: Christmas Day to the Boxing Day additional day.
    expect(forecastHorizonDays(now, perthMidnight(2026, 11, 24))).toEqual([1, 2, 5]);
    // Saturday 26 Sep 2026: Sunday and the Monday holiday.
    expect(forecastHorizonDays(now, perthMidnight(2026, 8, 26))).toEqual([1, 2, 3]);
    // An ordinary Saturday: the two days already reach Monday.
    expect(forecastHorizonDays(now, perthMidnight(2026, 9, 24))).toEqual([1, 2]);
  });

  it("labels seven days with weekend and holiday marks", () => {
    const days = horizonDays(now, perthMidnight(2026, 11, 23));
    expect(days.map((day) => day.label)).toEqual([
      "Wed 23",
      "Thu 24",
      "Fri 25",
      "Sat 26",
      "Sun 27",
      "Mon 28",
      "Tue 29",
    ]);
    expect(days.filter((day) => day.holiday).map((day) => day.label)).toEqual(["Fri 25", "Mon 28"]);
    expect(days.filter((day) => day.weekend).map((day) => day.label)).toEqual(["Sat 26", "Sun 27"]);
  });

  it("totals each day across wards", () => {
    const grid = sevenDayHorizon(units, wardAdmissions, wardPlannedAdmissions, now);
    for (let day = 0; day < 7; day += 1) {
      expect(grid.total.out[day]).toBe(grid.rows.reduce((total, row) => total + row.out[day]!, 0));
    }
  });
});

describe("applyScenario", () => {
  it("changes nothing when nothing is ticked", () => {
    expect(scenarioIsEmpty(EMPTY_SCENARIO)).toBe(true);
    const result = applyScenario(tomorrow, EMPTY_SCENARIO, units);
    expect(result.after).toBe(result.before);
    expect(result.before).toBe(tomorrow.total.likely);
  });

  it("reaches the best case when everything on record goes ahead", () => {
    const result = applyScenario(
      tomorrow,
      { ...EMPTY_SCENARIO, clearHeldUp: true, confirmDates: true, overdueGoAhead: true },
      units,
    );
    expect(result.after).toBe(tomorrow.total.high);
  });

  it("counts a closed bed against its ward's bed type", () => {
    const youth = units.find((unit) => unit.cohort === "Youth" && !unit.isClosed)!;
    const result = applyScenario(tomorrow, { ...EMPTY_SCENARIO, bedChanges: [{ unitId: youth.id, delta: -2 }] }, units);
    expect(result.after).toBe(result.before - 2);
    expect(result.kinds.find((kind) => kind.id === "youth")!.after).toBe(
      tomorrow.kinds.find((kind) => kind.id === "youth")!.likely - 2,
    );
  });
});

describe("edAccessRisk", () => {
  it("uses the current discharge plan for timed supply and the named next release", () => {
    const baseUnit = units.find((entry) => !entry.isClosed && entry.cohort === "Adult")!;
    const unit = {
      ...baseUnit,
      empty: { ...baseUnit.empty, value: 0 },
      allocatable: { ...baseUnit.allocatable, value: 0 },
    };
    const stay = {
      ...wardAdmissions[0]!,
      unitId: unit.id,
      bedKind: "locked" as const,
      state: "occupied" as const,
      expectedDischargeAt: now + 3 * MINUTES_PER_DAY,
    };
    const release = {
      ...bedReleases[0]!,
      unitId: unit.id,
      admissionId: stay.id,
      state: "expected" as const,
      blocker: null,
      expectedAt: now + 60,
    };
    const movement = {
      ...wardMovements.find(isWaitingInEd)!,
      id: "WF-RESCHEDULED" as (typeof wardMovements)[number]["id"],
      stage: "accepted_awaiting_bed" as const,
      security: "Secure" as const,
      cohort: "Adult" as const,
      openedAt: now,
      admissionId: undefined,
      allocatedBed: undefined,
      acceptedUnitId: unit.id,
      closure: undefined,
    };
    const postponed = edAccessRisk([movement], [unit], [release], [stay], now, 120);
    expect(postponed.atRisk).toHaveLength(1);
    expect(postponed.atRisk[0]).toMatchObject({ slotAt: now + 3 * MINUTES_PER_DAY, nextRelease: null });
    const broughtForward = edAccessRisk(
      [movement],
      [unit],
      [{ ...release, expectedAt: now + 3 * MINUTES_PER_DAY }],
      [{ ...stay, expectedDischargeAt: now + 180 }],
      now,
      120,
    );
    expect(broughtForward.atRisk[0]).toMatchObject({ slotAt: now + 180, nextRelease: { at: now + 180 } });
    expect(
      edAccessRisk([movement], [unit], [release], [{ ...stay, expectedDischargeAt: now + 60 }], now, 120).atRisk,
    ).toEqual([]);
  });

  it("sorts people waiting into bed types the same way as the mismatch table", () => {
    const gaps = bedKindGaps([...wardMovements], [...units], now, wardAdmissions);
    for (const gap of gaps) {
      expect(
        wardMovements.filter((movement) => isWaitingForBed(movement) && bedKindOfNeed(movement) === gap.id),
      ).toHaveLength(gap.waiting);
    }
  });

  it("lists only people who pass the target in the next day before a bed in line for them", () => {
    const risk = edAccessRisk(wardMovements, units, bedReleases, wardAdmissions, now, 24 * 60);
    for (const row of risk.atRisk) {
      expect(row.passesAt).toBeGreaterThan(now);
      expect(row.passesAt).toBeLessThanOrEqual(now + MINUTES_PER_DAY);
      if (row.slotAt !== null) expect(row.slotAt).toBeGreaterThan(row.passesAt);
    }
    const byEd = risk.byEd.reduce((total, ed) => total + ed.atRisk, 0);
    expect(byEd).toBe(risk.atRisk.length);
  });

  it("counts everyone still waiting in ED as already over when the target is one minute", () => {
    const inEd = wardMovements.filter(
      (movement) => isWaitingForBed(movement) && isWaitingInEd(movement) && movement.openedAt < now,
    );
    const risk = edAccessRisk(wardMovements, units, bedReleases, wardAdmissions, now, 1);
    expect(risk.alreadyOver).toBe(inEd.length);
    expect(risk.atRisk).toHaveLength(0);
  });
});

describe("since you looked", () => {
  const world = { scenario: "seed", worldGeneration: 0, userId: "local-demo" };

  it("names the parts that moved and refuses another scenario's picture", () => {
    const before = takeForecastLook(world, tomorrow, now - 90);
    const worse = {
      ...takeForecastLook(world, tomorrow, now),
      likely: before.likely - 4,
      parts: { ...before.parts, waiting: before.parts.waiting + 2, heldUp: before.parts.heldUp + 2 },
    };
    const change = forecastChangeSinceLook(before, worse)!;
    expect(change.delta).toBe(-4);
    expect(forecastChangeSentence(change, now)).toMatch(
      /^Since you looked at 09:12, tomorrow moved from .+\. 2 more people waiting for a bed and 2 more releases held up\.$/,
    );
    expect(forecastChangeSinceLook(before, { ...worse, scenario: "other" })).toBeUndefined();
  });

  it("round trips through storage text and rejects a malformed picture", () => {
    const snapshot = takeForecastLook(world, tomorrow, now);
    expect(parseForecastLook(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(parseForecastLook(JSON.stringify({ ...snapshot, likely: "four" }))).toBeUndefined();
    expect(parseForecastLook("{")).toBeUndefined();
  });
});

describe("brief and alerts", () => {
  const levers = forecastLevers(units, bedReleases, wardAdmissions, now);
  const risk = edAccessRisk(wardMovements, units, bedReleases, wardAdmissions, now, 24 * 60);

  it("writes the four brief lines from fixed templates", () => {
    const brief = forecastBrief(tomorrow, levers, risk, (id) => `ED ${id}`);
    expect(brief.map((line) => line.label)).toEqual(["Tightest", "Biggest blocker", "ED waits", "Biggest lever"]);
    for (const line of brief) expect(line.text).toMatch(/\.$/);
  });

  it("raises a bed type alert only at or past its threshold", () => {
    const worst = Math.min(...tomorrow.kinds.map((kind) => kind.likely));
    const thresholds = { shortBeds: Math.max(1, -worst), edLeadMinutes: 12 * 60, worseBeds: 2 };
    const raised = forecastAlerts(tomorrow, risk, undefined, thresholds).filter((alert) => alert.kind === "kind_short");
    expect(raised.length > 0).toBe(worst <= -thresholds.shortBeds);
    const none = forecastAlerts(tomorrow, risk, undefined, { ...thresholds, shortBeds: 1 - worst });
    expect(none.filter((alert) => alert.kind === "kind_short")).toHaveLength(0);
  });

  it("raises a worse-since-you-looked alert from the change", () => {
    const change = { since: now - 60, from: -9, to: -13, delta: -4, reasons: [], worseKinds: [] };
    const alerts = forecastAlerts(tomorrow, risk, change, { shortBeds: 99, edLeadMinutes: 0, worseBeds: 2 });
    expect(alerts).toEqual([{ kind: "forecast_worse", from: -9, to: -13, since: now - 60, threshold: 2 }]);
  });
});
