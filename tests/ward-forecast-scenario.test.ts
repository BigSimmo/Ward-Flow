import { describe, expect, it } from "vitest";

import { forecastByKind } from "@/components/ward-management/forecast/forecast-by-kind";
import { applyScenario, EMPTY_SCENARIO } from "@/components/ward-management/forecast/forecast-scenario";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const seed = seedWardFlowState();
const now = NOW_ANCHOR;
const original = seed.admissions.find((admission) => admission.state === "occupied")!;
const baseUnit = seed.units.find((unit) => unit.id === original.unitId)!;
const unit = {
  ...baseUnit,
  cohort: "Adult" as const,
  lockedBeds: 0,
  allocatableLocked: 0,
  empty: { ...baseUnit.empty, value: 0 },
  allocatable: { ...baseUnit.allocatable, value: 0 },
};

function stay(id: string, expectedAt: number, blocked = false, state: Admission["state"] = "occupied"): Admission {
  return {
    ...original,
    id,
    unitId: unit.id,
    patientId: null,
    state,
    bedKind: "open",
    expectedDischargeAt: expectedAt,
    blockReason: blocked ? "Awaiting pharmacy" : null,
  };
}

const forecast = (admissions: Admission[], releases: BedRelease[] = []) =>
  forecastByKind([unit], releases, admissions, [], now, 1);

describe("confirmation in a bed forecast scenario", () => {
  it.each([
    ["unblocked current date", now + 60, false, 1],
    ["blocked current date", now + 60, true, 0],
    ["overdue date", now - MINUTES_PER_DAY, false, 0],
  ] as const)("matches actually flagging and confirming a stay with an %s", (_, expectedAt, blocked, uplift) => {
    const admission = stay("scenario-stay", expectedAt, blocked);
    const before = { ...seed, units: [unit], admissions: [admission], bedReleases: [], movements: [] };
    const flagged = wardFlowReducer(before, {
      type: "FLAG_BED_RELEASE",
      role: "ward",
      now,
      unitId: unit.id,
      actingUnitId: unit.id,
      admissionId: admission.id,
      expectedAt,
      waitingOn: "Nothing outstanding",
    });
    expect(flagged.rejections).toEqual(before.rejections);
    const confirmed = wardFlowReducer(flagged, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now,
      actingUnitId: unit.id,
      releaseId: flagged.bedReleases[0]!.id,
    });
    expect(confirmed.rejections).toEqual(before.rejections);
    const initial = forecast(before.admissions);
    const result = applyScenario(initial, { ...EMPTY_SCENARIO, confirmDates: true }, [unit]);
    expect(result.after - result.before).toBe(uplift);
    expect(result.after).toBe(forecast(confirmed.admissions, confirmed.bedReleases).total.likely);
    expect(initial.total.plannedNotFlagged).toBe(1);
    expect(initial.total.high - initial.total.likely).toBe(1);
  });

  it("does not count a pulled stay as a discharge that can be confirmed", () => {
    const initial = forecast([stay("pulled-plan", now + 60, false, "pulled")]);
    expect(initial.total.plannedNotFlagged).toBe(1);
    const result = applyScenario(initial, { ...EMPTY_SCENARIO, confirmDates: true }, [unit]);
    expect(result.after).toBe(result.before);
  });

  it.each(Array.from({ length: 8 }, (_, mask) => mask))(
    "keeps each scenario action's population separate for combination %i",
    (mask) => {
      const admissions = [
        stay("eligible-plan", now + 60),
        stay("blocked-plan", now + 60, true),
        stay("overdue-plan", now - MINUTES_PER_DAY),
        stay("blocked-overdue-plan", now - MINUTES_PER_DAY, true),
        stay("pulled-plan", now + 60, false, "pulled"),
      ];
      const release = seed.bedReleases[0]!;
      const releases: BedRelease[] = [
        {
          ...release,
          id: "flagged-blocked",
          admissionId: "flagged-blocked-stay",
          unitId: unit.id,
          state: "expected",
          expectedAt: now + 60,
          blocker: "Awaiting pharmacy",
        },
        {
          ...release,
          id: "flagged-overdue",
          admissionId: "flagged-overdue-stay",
          unitId: unit.id,
          state: "expected",
          expectedAt: now - MINUTES_PER_DAY,
          blocker: null,
        },
      ];
      const initial = forecast(admissions, releases);
      const scenario = {
        ...EMPTY_SCENARIO,
        confirmDates: Boolean(mask & 1),
        clearHeldUp: Boolean(mask & 2),
        overdueGoAhead: Boolean(mask & 4),
      };
      const result = applyScenario(initial, scenario, [unit]);
      const expectedUplift =
        Number(scenario.confirmDates) + Number(scenario.clearHeldUp) + Number(scenario.overdueGoAhead);
      expect(result.after - result.before).toBe(expectedUplift);
      expect(initial.total.plannedNotFlagged).toBe(5);
      expect(initial.total.high - initial.total.likely).toBe(7);
    },
  );

  it("does not assume eligibility when an older forecast lacks confirmation metadata", () => {
    const initial = forecast([stay("eligible-plan", now + 60)]);
    const withoutEligibility = {
      ...initial,
      kinds: initial.kinds.map((kind) => ({ ...kind, confirmationEligible: undefined })),
    };
    const result = applyScenario(withoutEligibility, { ...EMPTY_SCENARIO, confirmDates: true }, [unit]);
    expect(result.after).toBe(result.before);
  });

  it.each([-3, 3])("stops applying a retained bed change of %i after its ward closes or disappears", (delta) => {
    const openUnit = { ...unit, isClosed: false };
    const scenario = { ...EMPTY_SCENARIO, bedChanges: [{ unitId: openUnit.id, delta }] };
    const openForecast = forecastByKind([openUnit], [], [], [], now, 1);
    const openResult = applyScenario(openForecast, scenario, [openUnit]);
    expect(openResult.after - openResult.before).toBe(delta);

    const closedUnit = { ...openUnit, isClosed: true };
    const closedForecast = forecastByKind([closedUnit], [], [], [], now, 1);
    expect(closedForecast.total.likely).toBe(0);
    const closedResult = applyScenario(closedForecast, scenario, [closedUnit]);
    expect(closedResult.after).toBe(closedResult.before);

    const removedForecast = forecastByKind([], [], [], [], now, 1);
    const removedResult = applyScenario(removedForecast, scenario, []);
    expect(removedResult.after).toBe(removedResult.before);
  });
});
