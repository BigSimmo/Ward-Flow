// src/components/ward-management/forecast/forecast-scenario.ts
//
// "Try a scenario" (forecasting build, Josh, 23 Oct 2026, screen 2). The coordinator ticks what
// might happen and sees tomorrow's likely figure recalculated. A scenario is never saved, never
// sent and never changes a record: it is arithmetic on the forecast already on screen.
import type { BedKindId } from "@/components/ward-management/capacity/capacity-derivations";
import type { Unit } from "@/components/ward-management/ward-model";
import { bedKindOfBed, type ForecastByKind } from "./forecast-by-kind";

export type ForecastScenario = {
  /** Every held-up release due tomorrow goes ahead. */
  clearHeldUp: boolean;
  /** Every planned discharge date not yet flagged is confirmed by its ward. */
  confirmDates: boolean;
  /** Every overdue release goes ahead after all. */
  overdueGoAhead: boolean;
  /** Beds a ward closes (negative) or opens (positive) before tomorrow. */
  bedChanges: { unitId: string; delta: number }[];
};

export const EMPTY_SCENARIO: ForecastScenario = {
  clearHeldUp: false,
  confirmDates: false,
  overdueGoAhead: false,
  bedChanges: [],
};

export function scenarioIsEmpty(scenario: ForecastScenario): boolean {
  return (
    !scenario.clearHeldUp &&
    !scenario.confirmDates &&
    !scenario.overdueGoAhead &&
    scenario.bedChanges.every((c) => c.delta === 0)
  );
}

/**
 * The bed type a ward's opened or closed beds count against, by the forecast's own rule
 * (`bedKindOfBed` with no admission): an adult ward with no open beds can only change locked
 * ones (production audit USC-01). A mixed adult ward's changes still count as open beds.
 */
function scenarioKindOfUnit(unit: Unit): BedKindId {
  return bedKindOfBed(unit, undefined);
}

export type ScenarioResult = {
  kinds: { id: BedKindId; before: number; after: number }[];
  before: number;
  after: number;
};

export function applyScenario(
  forecast: ForecastByKind,
  scenario: ForecastScenario,
  units: readonly Unit[],
): ScenarioResult {
  const kinds = forecast.kinds.map((kind) => {
    const change = scenario.bedChanges.reduce((total, entry) => {
      const unit = units.find((candidate) => candidate.id === entry.unitId);
      return unit && scenarioKindOfUnit(unit) === kind.id ? total + entry.delta : total;
    }, 0);
    const after =
      kind.likely +
      (scenario.clearHeldUp ? kind.heldUp : 0) +
      (scenario.confirmDates ? kind.plannedNotFlagged : 0) +
      (scenario.overdueGoAhead ? kind.overdue : 0) +
      change;
    return { id: kind.id, before: kind.likely, after };
  });
  return {
    kinds,
    before: kinds.reduce((total, kind) => total + kind.before, 0),
    after: kinds.reduce((total, kind) => total + kind.after, 0),
  };
}
