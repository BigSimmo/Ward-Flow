// tests/ward-beds-forecast.test.ts
//
// Tomorrow's beds forecast (smart feature 10). The arithmetic is asserted on hand-built records so
// each bucket can be reached on its own, then once against the seed so the screen's figures are
// known to come from the same function.
import { describe, expect, it } from "vitest";

import {
  bedsForecast,
  forecastFigureText,
  forecastHeadline,
  forecastRangeEnd,
  BEDS_FORECAST_LIMITS,
} from "@/components/ward-management/capacity/beds-forecast";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { lockedBedsFree, openBedsFree } from "@/components/ward-management/ward-bed-designation";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { bedReleases, wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import type { BedRelease, Movement } from "@/components/ward-management/ward-model";

const NOW = NOW_ANCHOR;
const unit = allUnits()[0];
const READY = lockedBedsFree(unit) + openBedsFree(unit);

let nextId = 0;
function release(overrides: Partial<BedRelease>): BedRelease {
  nextId += 1;
  return {
    id: `WR-FC-${nextId}`,
    unitId: unit.id,
    admissionId: `AD-FC-${nextId}`,
    state: "expected",
    expectedAt: NOW + 120,
    waitingOn: null,
    blocker: null,
    blockedBy: null,
    preparing: false,
    preparationNote: null,
    confirmedAt: NOW,
    confirmedBy: "NUM Test Unit",
    ...overrides,
  };
}

const baseMovement = wardMovements[0];
function movement(overrides: Partial<Movement>): Movement {
  return { ...baseMovement, closure: undefined, ...overrides } as Movement;
}

const occupiedAdmission = wardAdmissions.find((admission) => admission.state === "occupied")!;
function admission(overrides: Partial<Admission>): Admission {
  return { ...occupiedAdmission, unitId: unit.id, ...overrides } as Admission;
}

function horizon(forecast: ReturnType<typeof bedsForecast>, hours: 24 | 48) {
  return forecast.horizons.find((entry) => entry.hours === hours)!;
}

describe("bedsForecast", () => {
  it("adds confirmed and expected discharges due in the window and subtracts people still needing a bed", () => {
    const releases = [
      release({ state: "confirmed", expectedAt: NOW + 60 }),
      release({ state: "expected", expectedAt: NOW + 600 }),
      release({ state: "expected", expectedAt: NOW + MINUTES_PER_DAY + 600 }), // 48h only
      release({ state: "expected", expectedAt: NOW + 3 * MINUTES_PER_DAY }), // beyond both
      release({ state: "discharged", expectedAt: NOW - 60 }), // already free, already in Ready
    ];
    const movements = [
      movement({ id: "MV-FC-1" as Movement["id"], stage: "accepted_awaiting_bed" }),
      movement({ id: "MV-FC-2" as Movement["id"], stage: "placement_requested" }),
      movement({ id: "MV-FC-3" as Movement["id"], stage: "pulled" }), // bed already taken
      movement({ id: "MV-FC-4" as Movement["id"], stage: "arrived" }), // closed
    ];
    const forecast = bedsForecast([unit], releases, [], movements, NOW);

    const day = horizon(forecast, 24);
    expect(day).toMatchObject({ readyNow: READY, confirmed: 1, expected: 1, waitingForBed: 2, heldUp: 0, overdue: 0 });
    expect(day.until).toBe(NOW + 24 * 60);
    expect(day.low).toBe(READY + 1 - 2);
    expect(day.likely).toBe(READY + 1 + 1 - 2);
    expect(day.high).toBe(day.likely);

    const twoDays = horizon(forecast, 48);
    expect(twoDays.expected).toBe(2);
    expect(twoDays.likely).toBe(READY + 1 + 2 - 2);
  });

  it("keeps held-up, overdue and unflagged planned discharges out of the likely figure but in the high end", () => {
    const flagged = release({ state: "expected", expectedAt: NOW + 60, admissionId: "AD-FLAGGED" });
    const releases = [
      flagged,
      release({ state: "confirmed", expectedAt: NOW + 60, blocker: BED_RELEASE_BLOCKERS[0], blockedBy: "NUM" }),
      release({ state: "expected", expectedAt: NOW - 2 * MINUTES_PER_DAY }), // slipped from an earlier day
    ];
    const admissions = [
      admission({ id: "AD-PLANNED", expectedDischargeAt: NOW + 300 }), // date on record, no release
      admission({ id: "AD-FLAGGED", expectedDischargeAt: NOW + 60 }), // already counted via its release
      admission({ id: "AD-LATER", expectedDischargeAt: NOW + 3 * MINUTES_PER_DAY }),
    ];
    const day = horizon(bedsForecast([unit], releases, admissions, [], NOW), 24);

    expect(day).toMatchObject({ confirmed: 0, expected: 1, heldUp: 1, overdue: 1, plannedNotFlagged: 1 });
    expect(day.likely).toBe(READY + 1);
    expect(day.high).toBe(day.likely + 3);
  });

  it("ignores releases and stays on wards outside the units it was given", () => {
    const other = allUnits()[1];
    const forecast = bedsForecast(
      [unit],
      [release({ unitId: other.id })],
      [admission({ id: "AD-OTHER", unitId: other.id, expectedDischargeAt: NOW + 60 })],
      [],
      NOW,
    );
    expect(horizon(forecast, 24)).toMatchObject({ expected: 0, plannedNotFlagged: 0 });
  });

  it("runs on the seeded network and keeps low <= likely <= high", () => {
    const forecast = bedsForecast(allUnits(), bedReleases, wardAdmissions, wardMovements, NOW);
    expect(forecast.horizons.map((entry) => entry.hours)).toEqual([24, 48]);
    for (const entry of forecast.horizons) {
      expect(entry.low).toBeLessThanOrEqual(entry.likely);
      expect(entry.likely).toBeLessThanOrEqual(entry.high);
    }
    expect(horizon(forecast, 48).likely).toBeGreaterThanOrEqual(horizon(forecast, 24).likely);
  });
});

describe("forecastFigureText", () => {
  it("says a shortfall as one instead of clamping it to zero", () => {
    expect(forecastFigureText(-3)).toBe("short by 3");
    expect(forecastFigureText(0)).toBe("none");
    expect(forecastFigureText(4)).toBe("4");
    expect(forecastHeadline(-3)).toBe("Likely short by 3 beds");
    expect(forecastHeadline(-1)).toBe("Likely short by 1 bed");
    expect(forecastHeadline(0)).toBe("No beds likely free");
    expect(forecastHeadline(6)).toBe("6 beds likely free");
    expect(forecastRangeEnd(-23)).toBe("23 short");
    expect(forecastRangeEnd(0)).toBe("none free");
    expect(forecastRangeEnd(30)).toBe("30 free");
  });

  it("states that new arrivals are not predicted and that the data is synthetic", () => {
    expect(BEDS_FORECAST_LIMITS.join(" ")).toMatch(/not predicted/);
    expect(BEDS_FORECAST_LIMITS.join(" ")).toMatch(/Synthetic/);
  });
});
