import { describe, expect, it } from "vitest";

import { applyScenario, EMPTY_SCENARIO } from "@/components/ward-management/forecast/forecast-scenario";
import type { ForecastByKind, KindForecast } from "@/components/ward-management/forecast/forecast-by-kind";
import { taskItems, type TaskSource } from "@/components/ward-management/ward-act-now-items";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const seed = seedWardFlowState();

describe("USC-01: Try a scenario on an all-locked adult ward", () => {
  function kind(id: KindForecast["id"], likely: number): KindForecast {
    return {
      id,
      now: 0,
      waiting: 0,
      bedsThatFit: 0,
      low: likely,
      likely,
      high: likely,
      confirmed: 0,
      expected: 0,
      heldUp: 0,
      overdue: 0,
      plannedNotFlagged: 0,
      plannedAdmissions: 0,
    };
  }

  it("puts closed beds against locked adult beds, not open adult beds", () => {
    const secure = seed.units.find(
      (unit) => unit.cohort === "Adult" && unit.beds > 0 && (unit.lockedBeds ?? 0) === unit.beds,
    );
    expect(secure, "the seed has an adult ward whose beds are all locked").toBeDefined();
    const forecast = {
      kinds: [kind("locked_adult", 3), kind("open_adult", 5), kind("older_adult", 1), kind("youth", 1)],
    } as unknown as ForecastByKind;
    const result = applyScenario(
      forecast,
      { ...EMPTY_SCENARIO, bedChanges: [{ unitId: secure!.id, delta: -2 }] },
      seed.units,
    );
    const after = Object.fromEntries(result.kinds.map((entry) => [entry.id, entry.after]));
    expect(after).toEqual({ locked_adult: 1, open_adult: 5, older_adult: 1, youth: 1 });
  });
});

describe("PERF-02: the shared task list keeps one answer per caller shape", () => {
  it("does not rebuild when the bar and the notifier take turns", () => {
    const full: TaskSource = {
      movements: seed.movements,
      units: seed.units,
      configuration: seed.configuration,
      inboxSnoozes: seed.inboxSnoozes,
      admissions: seed.admissions,
      patients: seed.patients,
      referrals: seed.referrals,
      supportNotifications: seed.supportNotifications,
      plannedAdmissions: seed.plannedAdmissions,
      leaveBeds: seed.leaveBeds,
      stuckHandoverMinutes: 30,
    };
    // The act-now notifier passes no support notifications, planned admissions or handover limit.
    const notifier: TaskSource = {
      ...full,
      supportNotifications: undefined,
      plannedAdmissions: undefined,
      stuckHandoverMinutes: undefined,
    };
    const bar = taskItems(full, NOW_ANCHOR);
    const fromNotifier = taskItems(notifier, NOW_ANCHOR);
    expect(taskItems(full, NOW_ANCHOR)).toBe(bar);
    expect(taskItems(notifier, NOW_ANCHOR)).toBe(fromNotifier);
  });
});
