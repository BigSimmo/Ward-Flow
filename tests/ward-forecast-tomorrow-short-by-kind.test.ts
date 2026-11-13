// tests/ward-forecast-tomorrow-short-by-kind.test.ts
//
// D-191 item 6 for tomorrow (fixes thread, under D-196). Synthetic data only. "Short" adds each bed
// type's shortfall and never subtracts a spare bed of another type: Tomorrow's low, likely and high
// on the by-type total, the network forecast Capacity shows (`bedsForecast` given `forecastTotalsByKind`)
// and the scenario's "before" all follow the same rule as today's gap. The Ward page's one-ward line
// keeps the plain sum for now (phone size; after-C list).
import { describe, expect, it } from "vitest";

import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import { combinedKindGap } from "@/components/ward-management/capacity/capacity-derivations";
import {
  forecastByKind,
  forecastTotalsByKind,
  type ForecastByKind,
} from "@/components/ward-management/forecast/forecast-by-kind";
import { applyScenario, EMPTY_SCENARIO } from "@/components/ward-management/forecast/forecast-scenario";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const RANGE = ["low", "likely", "high"] as const;
const shortfall = (values: readonly number[]) => values.reduce((sum, value) => sum + Math.min(0, value), 0);

function expectShortAddsUp(forecast: ForecastByKind) {
  for (const end of RANGE) {
    const parts = forecast.kinds.map((kind) => kind[end]);
    expect(forecast.total[end], end).toBe(combinedKindGap(parts));
    if (parts.some((value) => value < 0)) expect(forecast.total[end], `${end} short`).toBe(shortfall(parts));
    else expect(forecast.total[end], `${end} even or spare`).toBe(parts.reduce((sum, value) => sum + value, 0));
  }
}

describe("D-191 item 6: tomorrow's short adds each bed type's shortfall", () => {
  const seed = seedWardFlowState("standard");
  const args = [seed.units, seed.bedReleases, seed.admissions, seed.movements, NOW_ANCHOR] as const;

  it("Standard day: the headline is the sum of the per-type shortfalls, and the network forecast agrees", () => {
    // Capacity passes the by-type totals to the network forecast (`capacity-model.ts`).
    const network = bedsForecast(
      ...args,
      seed.plannedAdmissions,
      seed.referrals,
      forecastTotalsByKind(...args, seed.plannedAdmissions, seed.referrals),
    );
    for (const days of [1, 2, 3]) {
      const byKind = forecastByKind(...args, days, seed.plannedAdmissions, seed.referrals);
      expectShortAddsUp(byKind);
      const horizon = network.horizons.find((entry) => entry.hours === days * 24)!;
      for (const end of RANGE) expect(horizon[end], `${days} day ${end}`).toBe(byKind.total[end]);
    }
    const tomorrow = forecastByKind(...args, 1, seed.plannedAdmissions, seed.referrals);
    // The seed is short on locked, open and older adult beds at the low end while youth is spare, so
    // the old netted sum would read 1 fewer short.
    const low = tomorrow.kinds.map((kind) => kind.low);
    expect(Math.min(...low), "a type short at the low end").toBeLessThan(0);
    expect(Math.max(...low), "a type spare at the low end").toBeGreaterThan(0);
    expect(tomorrow.total.low).toBeLessThan(low.reduce((sum, value) => sum + value, 0));
    expect(applyScenario(tomorrow, EMPTY_SCENARIO, seed.units).before).toBe(tomorrow.total.likely);
  });

  it("records with one type spare: a spare youth bed never nets off the adult shortfall, low, likely or high", () => {
    // Every adult ward and one youth ward, with nobody waiting for a youth bed: the youth ward's
    // ready beds are spare while the adult people waiting leave the adult types short.
    const youth = seed.units.find((unit) => unit.cohort === "Youth" && !unit.isClosed && unit.beds > 0)!;
    const units = [...seed.units.filter((unit) => unit.cohort === "Adult"), youth];
    const ids = new Set(units.map((unit) => unit.id));
    const admissions = seed.admissions.filter((admission) => ids.has(admission.unitId));
    const releases = seed.bedReleases.filter((release) => ids.has(release.unitId));
    const movements = seed.movements.filter((movement) => movement.cohort !== "Youth");
    const byKind = forecastByKind(units, releases, admissions, movements, NOW_ANCHOR, 1);
    const youthKind = byKind.kinds.find((kind) => kind.id === "youth")!;
    for (const end of RANGE) {
      const parts = byKind.kinds.map((kind) => kind[end]);
      expect(youthKind[end], `youth ${end} spare`).toBeGreaterThan(0);
      expect(Math.min(...parts), `an adult type ${end} short`).toBeLessThan(0);
      expect(byKind.total[end], end).toBe(shortfall(parts));
      // The old netted sum would have read fewer short.
      expect(byKind.total[end]).toBeLessThan(parts.reduce((sum, value) => sum + value, 0));
    }
    expectShortAddsUp(byKind);
    const network = bedsForecast(
      units,
      releases,
      admissions,
      movements,
      NOW_ANCHOR,
      [],
      [],
      forecastTotalsByKind(units, releases, admissions, movements, NOW_ANCHOR),
    ).horizons[0]!;
    for (const end of RANGE) expect(network[end], `network ${end}`).toBe(byKind.total[end]);
    expect(applyScenario(byKind, EMPTY_SCENARIO, units).before).toBe(byKind.total.likely);
  });
});
