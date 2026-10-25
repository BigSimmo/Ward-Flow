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
import type { BedRelease, Movement, Unit } from "@/components/ward-management/ward-model";

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
  it.each(["expected", "confirmed"] as const)(
    "removes a rescheduled %s discharge from both horizons and its source list",
    (state) => {
      const flagged = release({ admissionId: "AD-MOVED", state, expectedAt: NOW + 60 });
      const stay = admission({ id: flagged.admissionId, expectedDischargeAt: NOW + 60 });
      expect(horizon(bedsForecast([unit], [flagged], [stay], [], NOW), 24)[state]).toBe(1);

      const forecast = bedsForecast(
        [unit],
        [flagged],
        [{ ...stay, expectedDischargeAt: NOW + 3 * MINUTES_PER_DAY }],
        [],
        NOW,
      );
      for (const entry of forecast.horizons) {
        expect(entry).toMatchObject({ confirmed: 0, expected: 0, overdue: 0, plannedNotFlagged: 0 });
        expect(entry.high).toBe(entry.readyNow);
      }
      expect(forecast.sources.windows.reduce((sum, window) => sum + window.total, 0)).toBe(0);
      expect(forecast.sources.laterFlagged).toBe(1);
      expect(flagged.expectedAt).toBe(NOW + 60);
    },
  );

  it.each([
    { from: NOW + 60, to: NOW + MINUTES_PER_DAY + 60, day: 0, twoDays: 1, overdue: 0 },
    { from: NOW + 3 * MINUTES_PER_DAY, to: NOW + 60, day: 1, twoDays: 1, overdue: 0 },
    { from: NOW - 2 * MINUTES_PER_DAY, to: NOW + 60, day: 1, twoDays: 1, overdue: 0 },
    { from: NOW + 60, to: NOW - 2 * MINUTES_PER_DAY, day: 0, twoDays: 0, overdue: 1 },
    { from: NOW + 3 * MINUTES_PER_DAY, to: 0, day: 1, twoDays: 1, overdue: 0 },
  ])("uses a rescheduled date for windows and overdue groups ($from to $to)", ({ from, to, day, twoDays, overdue }) => {
    const flagged = release({ admissionId: "AD-MOVED", expectedAt: from });
    const stay = admission({
      id: flagged.admissionId,
      expectedDischargeAt: to,
      dischargeDateSetAt: NOW - 10,
      dischargeDateSetBy: "Ward manager",
    });
    const forecast = bedsForecast([unit], [flagged], [stay], [], NOW);
    expect(horizon(forecast, 24)).toMatchObject({ expected: day, overdue, plannedNotFlagged: 0 });
    expect(horizon(forecast, 48)).toMatchObject({ expected: twoDays, overdue, plannedNotFlagged: 0 });
    const entries = forecast.sources.windows.flatMap((window) => window.wards.flatMap((ward) => ward.entries));
    expect(entries).toHaveLength(day + overdue);
    if (entries.length) {
      expect(entries[0]).toMatchObject({
        expectedAt: to,
        saidAt: flagged.confirmedAt,
        saidBy: flagged.confirmedBy,
        planDate: { recordedAt: NOW - 10, recordedBy: "Ward manager" },
      });
    }
    const nextDay = horizon(forecast, 24);
    expect(forecast.sources.windows.reduce((sum, window) => sum + window.total, 0)).toBe(
      nextDay.confirmed + nextDay.expected + nextDay.heldUp + nextDay.overdue,
    );
  });

  it("uses the rescheduled date for held-up releases without putting them in the likely figure", () => {
    const flagged = release({
      admissionId: "AD-MOVED",
      expectedAt: NOW + 60,
      blocker: BED_RELEASE_BLOCKERS[0],
      blockedBy: "NUM Test Unit",
    });
    const stay = admission({ id: flagged.admissionId, expectedDischargeAt: NOW + MINUTES_PER_DAY + 60 });
    const forecast = bedsForecast([unit], [flagged], [stay], [], NOW);
    expect(horizon(forecast, 24)).toMatchObject({ heldUp: 0, expected: 0 });
    const twoDays = horizon(forecast, 48);
    expect(twoDays).toMatchObject({ heldUp: 1, expected: 0 });
    expect(twoDays.likely).toBe(twoDays.readyNow);
    expect(twoDays.high).toBe(twoDays.likely + 1);
    expect(forecast.sources.laterFlagged).toBe(1);
  });

  it("keeps the release date when the linked admission is missing or has no date", () => {
    const releases = [release({ admissionId: "AD-MISSING" }), release({ admissionId: "AD-NO-DATE" })];
    const stay = admission({ id: "AD-NO-DATE", expectedDischargeAt: null });
    const forecast = bedsForecast([unit], releases, [stay], [], NOW);
    expect(horizon(forecast, 24)).toMatchObject({ expected: 2, plannedNotFlagged: 0 });
    const entries = forecast.sources.windows.flatMap((window) => window.wards.flatMap((ward) => ward.entries));
    expect(entries.map((entry) => entry.expectedAt)).toEqual(releases.map((entry) => entry.expectedAt));
  });

  it.each([
    { allocatable: 2, movementId: "WF-RESERVED", ready: 1 },
    { allocatable: 1, movementId: "WF-RESERVED", ready: 1 },
    { allocatable: 2, movementId: null, ready: 2 },
  ] as const)(
    "reconciles a pulled bed without subtracting it twice ($allocatable, $movementId)",
    ({ allocatable, movementId, ready }) => {
      const observed = {
        ...unit,
        beds: 10,
        blocked: 0,
        empty: { ...unit.empty, value: 2 },
        allocatable: { ...unit.allocatable, value: allocatable },
      };
      const admissions = [admission({ state: "pulled", movementId })];
      for (const entry of bedsForecast([observed], [], admissions, [], NOW).horizons) {
        expect(entry.readyNow).toBe(ready);
        expect(entry.likely).toBe(ready);
      }
      expect(observed.allocatable.value).toBe(allocatable);
      expect(observed.empty.value).toBe(2);
    },
  );

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

  it("deduplicates beds needed in forecast when a waiting movement already has an allocated bed (WF-A3-01)", () => {
    const releases = [release({ state: "confirmed", expectedAt: NOW + 60 })];
    const movements = [
      movement({ id: "MV-FC-1" as Movement["id"], stage: "accepted_awaiting_bed", allocatedBed: "BED-01" }),
      movement({ id: "MV-FC-2" as Movement["id"], stage: "placement_requested" }),
    ];
    const forecast = bedsForecast([unit], releases, [], movements, NOW);
    const day = horizon(forecast, 24);
    // Clinical owner ruling 14 Oct 2026: the pulled/allocated movement is left out of the bed-wait count.
    expect(day.waitingForBed).toBe(1);
    expect(day.bedsNeeded).toBe(1);
    expect(day.low).toBe(READY + 1 - 1);
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

  it("excludes every projected supply bucket from closed wards", () => {
    const closedUnit = { ...allUnits()[1], isClosed: true };
    const releases = [
      release({ unitId: closedUnit.id, state: "confirmed" }),
      release({ unitId: closedUnit.id, state: "expected" }),
      release({ unitId: closedUnit.id, blocker: BED_RELEASE_BLOCKERS[0] }),
      release({ unitId: closedUnit.id, expectedAt: NOW - 2 * MINUTES_PER_DAY }),
      release({ unitId: unit.id, state: "confirmed" }),
    ];
    const admissions = [
      admission({ id: "AD-CLOSED-PLANNED", unitId: closedUnit.id, expectedDischargeAt: NOW + 60 }),
      admission({ id: "AD-OPEN-PLANNED", expectedDischargeAt: NOW + 60 }),
    ];
    const forecast = bedsForecast([unit, closedUnit], releases, admissions, [], NOW);
    for (const entry of forecast.horizons) {
      expect(entry).toMatchObject({
        readyNow: READY,
        confirmed: 1,
        expected: 0,
        heldUp: 0,
        overdue: 0,
        plannedNotFlagged: 1,
        low: READY + 1,
        likely: READY + 1,
        high: READY + 2,
      });
    }
  });

  it.each([
    // Clinical owner ruling 14 Oct 2026: main's R-B-09 rule, min(allocatable, empty), unclamped.
    { beds: 4, empty: 8, allocatable: 10, ready: 8 },
    { beds: 8, empty: 3, allocatable: 10, ready: 3 },
    { beds: 8, empty: 6, allocatable: 2, ready: 2 },
  ])("bounds Ready by physical, empty and allocatable capacity ($ready)", ({ beds, empty, allocatable, ready }) => {
    const staleUnit: Unit = {
      ...unit,
      isClosed: false,
      beds,
      empty: { ...unit.empty, value: empty },
      allocatable: { ...unit.allocatable, value: allocatable },
    };
    for (const entry of bedsForecast([staleUnit], [], [], [], NOW).horizons) {
      expect(entry).toMatchObject({ readyNow: ready, low: ready, likely: ready, high: ready });
    }
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
