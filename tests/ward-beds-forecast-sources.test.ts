// tests/ward-beds-forecast-sources.test.ts
//
// "Where beds are coming from" (Josh, 20 October 2026): the forecast's discharges listed ward by
// ward and window by window, exactly as each ward recorded them. Hand-built records reach each
// window on its own; the seed check proves the windows add up to the 24 hour forecast.
import { describe, expect, it } from "vitest";

import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import { bedsForecastSources } from "@/components/ward-management/capacity/beds-forecast-sources";
import type { Admission, PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { bedReleases, wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";

// 10:42 on the demonstration day: the day shift began at 07:00 and ends at 15:00.
const NOW = NOW_ANCHOR;
const DAY_SHIFT_START = 7 * 60;
const [first, second, third] = allUnits();

function ward(base: Unit, overrides: Partial<Unit> = {}): Unit {
  return { ...base, allocatable: { ...base.allocatable, confirmedAt: NOW - 30 }, ...overrides };
}

let nextId = 0;
function release(unit: Unit, overrides: Partial<BedRelease>): BedRelease {
  nextId += 1;
  return {
    id: `WR-SRC-${nextId}`,
    unitId: unit.id,
    admissionId: `AD-SRC-${nextId}`,
    state: "expected",
    expectedAt: NOW + 60,
    waitingOn: null,
    blocker: null,
    blockedBy: null,
    preparing: false,
    preparationNote: null,
    confirmedAt: NOW - 20,
    confirmedBy: "NUM Test Unit",
    ...overrides,
  };
}

function windowOf(sources: ReturnType<typeof bedsForecastSources>, id: string) {
  return sources.windows.find((window) => window.id === id)!;
}

describe("bedsForecastSources", () => {
  it("splits the next 24 hours on the shift pattern, with an overdue group last", () => {
    const units = [ward(first), ward(second)];
    const releases = [
      release(first, { expectedAt: NOW - MINUTES_PER_DAY, state: "confirmed" }),
      release(first, { expectedAt: NOW - 60 }),
      release(first, { expectedAt: 15 * 60, state: "confirmed" }),
      release(second, { expectedAt: 15 * 60 + 1, blocker: "Awaiting transport", blockedBy: "NUM Test Unit" }),
      release(second, { expectedAt: 23 * 60 }),
      release(second, { expectedAt: NOW + MINUTES_PER_DAY }),
      release(second, { expectedAt: NOW + MINUTES_PER_DAY + 1 }),
    ];
    const sources = bedsForecastSources(units, releases, [], NOW);

    expect(sources.windows.map((window) => [window.id, window.label, window.total])).toEqual([
      ["this_shift", "Day shift", 2],
      ["next_shift", "Evening shift", 2],
      ["rest_of_day", "Rest of the 24 hours", 1],
      ["overdue", "Overdue from an earlier day", 1],
    ]);
    const thisShift = windowOf(sources, "this_shift");
    expect(thisShift.until).toBe(15 * 60);
    expect([thisShift.confirmed, thisShift.expected, thisShift.heldUp]).toEqual([1, 1, 0]);
    expect(thisShift.wards[0].entries.map((entry) => entry.overdue)).toEqual([true, false]);
    const nextShift = windowOf(sources, "next_shift");
    expect([nextShift.confirmed, nextShift.expected, nextShift.heldUp]).toEqual([0, 1, 1]);
    expect(nextShift.wards[0].entries[0].blocker).toBe("Awaiting transport");
    expect(sources.laterFlagged).toBe(1);
  });

  it("keeps each entry to what the ward said, who said it and when, never the person", () => {
    const units = [ward(first)];
    const releases = [
      release(first, {
        waitingOn: "Awaiting ward round",
        preparing: true,
        confirmedBy: "NUM 4 West",
        confirmedAt: NOW - 5,
      }),
      release(first, { waitingOn: "Nothing outstanding" }),
    ];
    const [entry, quiet] = windowOf(bedsForecastSources(units, releases, [], NOW), "this_shift").wards[0].entries;

    expect(entry).toMatchObject({
      state: "expected",
      waitingOn: "Awaiting ward round",
      preparing: true,
      saidBy: "NUM 4 West",
      saidAt: NOW - 5,
    });
    expect(quiet.waitingOn).toBeNull();
    expect(Object.keys(entry).sort()).toEqual(
      ["blocker", "expectedAt", "overdue", "preparing", "releaseId", "saidAt", "saidBy", "state", "waitingOn"].sort(),
    );
  });

  it("says when a ward has not updated since the shift began, and lists wards with nothing flagged", () => {
    const stale = ward(second, { allocatable: { ...second.allocatable, confirmedAt: DAY_SHIFT_START - 1 } });
    const staleButFlagged = ward(third, { allocatable: { ...third.allocatable, confirmedAt: DAY_SHIFT_START - 1 } });
    const releases = [release(staleButFlagged, { confirmedAt: DAY_SHIFT_START + 10 })];
    const sources = bedsForecastSources([ward(first), stale, staleButFlagged], releases, [], NOW);

    expect(sources.shiftName).toBe("Day Shift");
    expect(sources.shiftStart).toBe(DAY_SHIFT_START);
    expect(sources.notUpdatedThisShift).toBe(1);
    expect(sources.openWards).toBe(3);
    expect(sources.quietWards.map((entry) => [entry.unitId, entry.updatedThisShift])).toEqual(
      [
        [first.id, true],
        [second.id, false],
      ].sort((a, b) =>
        allUnits()
          .find((unit) => unit.id === a[0])!
          .name.localeCompare(allUnits().find((unit) => unit.id === b[0])!.name),
      ),
    );
    expect(windowOf(sources, "this_shift").wards[0].updatedThisShift).toBe(true);
  });

  it("names a closed ward instead of counting its discharges", () => {
    const closed = ward(second, {
      isClosed: true,
      admissionsClosure: { reason: "staffing", at: NOW - 60, by: "Coordinator", until: NOW + 240 },
    });
    const sources = bedsForecastSources([ward(first), closed], [release(closed, {})], [], NOW);

    expect(sources.windows.every((window) => window.total === 0)).toBe(true);
    expect(sources.closedWards).toEqual([
      { unitId: second.id, name: second.name, line: "Closed to admissions · Staffing", reopenExpectedAt: NOW + 240 },
    ]);
    expect(sources.openWards).toBe(1);
  });

  it("adds planned discharge dates nobody has flagged and admissions booked in, per ward", () => {
    const occupied = wardAdmissions.find((admission) => admission.state === "occupied")!;
    const admissions = [
      { ...occupied, id: "AD-DATED", unitId: first.id, expectedDischargeAt: NOW + 120 } as Admission,
      { ...occupied, id: "AD-SRC-FLAGGED", unitId: first.id, expectedDischargeAt: NOW + 120 } as Admission,
    ];
    const releases = [{ ...release(first, {}), admissionId: "AD-SRC-FLAGGED" }];
    const booking = { id: "PA-1", unitId: first.id, state: "booked", expectedArrivalAt: 16 * 60 } as PlannedAdmission;
    const sources = bedsForecastSources([ward(first)], releases, admissions, NOW, [booking]);

    expect(windowOf(sources, "this_shift").wards[0]).toMatchObject({ datedNotFlagged: 1, bookedIn: 0 });
    expect(windowOf(sources, "next_shift").wards[0]).toMatchObject({ entries: [], datedNotFlagged: 0, bookedIn: 1 });
    expect(windowOf(sources, "next_shift").bookedIn).toBe(1);
  });

  it("adds up to the 24 hour forecast's discharges on the seed", () => {
    const forecast = bedsForecast(allUnits(), bedReleases, wardAdmissions, wardMovements, NOW);
    const day = forecast.horizons.find((horizon) => horizon.hours === 24)!;
    const listed = forecast.sources.windows.reduce((sum, window) => sum + window.total, 0);

    expect(listed).toBe(day.confirmed + day.expected + day.heldUp + day.overdue);
    expect(listed).toBeGreaterThan(0);
    expect(forecast.sources.windows.reduce((sum, window) => sum + window.datedNotFlagged, 0)).toBe(
      day.plannedNotFlagged,
    );
  });
});
