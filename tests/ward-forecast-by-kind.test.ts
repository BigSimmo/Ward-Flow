// tests/ward-forecast-by-kind.test.ts
//
// Forecast by bed type (forecasting build, screen 2). Asserted once against the seed, where the
// four bed types must add up to the network forecast, then on hand-built records for the sorting.
import { describe, expect, it } from "vitest";

import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import {
  bedKindOfBed,
  bedKindOfPlannedAdmission,
  forecastByKind,
  kindRangeWord,
} from "@/components/ward-management/forecast/forecast-by-kind";
import type { Admission, PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { wardAdmissions, wardPlannedAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { bedReleases, wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

const units = allUnits();

describe("forecastByKind", () => {
  it("adds up to the network forecast for tomorrow and the day after", () => {
    const network = bedsForecast(units, bedReleases, wardAdmissions, wardMovements, NOW_ANCHOR, wardPlannedAdmissions);
    for (const days of [1, 2]) {
      const byKind = forecastByKind(
        units,
        bedReleases,
        wardAdmissions,
        wardMovements,
        NOW_ANCHOR,
        days,
        wardPlannedAdmissions,
      );
      const horizon = network.horizons.find((entry) => entry.hours === days * 24)!;
      expect(byKind.kinds.map((kind) => kind.id)).toEqual(["locked_adult", "open_adult", "older_adult", "youth"]);
      expect(byKind.total.likely).toBe(horizon.likely);
      expect(byKind.total.low).toBe(horizon.low);
      expect(byKind.total.high).toBe(horizon.high);
      for (const kind of byKind.kinds) {
        expect(kind.low).toBeLessThanOrEqual(kind.likely);
        expect(kind.likely).toBeLessThanOrEqual(kind.high);
      }
    }
  });

  it("sorts a bed by the ward's cohort and, on an adult ward, by its designation", () => {
    const adult = units.find((unit) => unit.cohort === "Adult")!;
    const older = units.find((unit) => unit.cohort === "Older adult")!;
    const base = wardAdmissions[0];
    expect(bedKindOfBed(adult, { ...base, bedKind: "locked" } as Admission)).toBe("locked_adult");
    expect(bedKindOfBed(adult, { ...base, bedKind: "open" } as Admission)).toBe("open_adult");
    expect(bedKindOfBed(older, { ...base, bedKind: "locked" } as Admission)).toBe("older_adult");
  });

  it("sorts a bed with no recorded designation by its bed number, then by the ward", () => {
    const adult = units.find((unit) => unit.cohort === "Adult")!;
    const mixed = { ...adult, beds: 10, lockedBeds: 4 };
    const allLocked = { ...adult, beds: 10, lockedBeds: 10 };
    const unrecorded = { ...wardAdmissions[0], bedKind: undefined, bedNumber: undefined } as Admission;
    expect(bedKindOfBed(mixed, { ...unrecorded, bedNumber: 2 })).toBe("locked_adult");
    expect(bedKindOfBed(mixed, { ...unrecorded, bedNumber: 7 })).toBe("open_adult");
    expect(bedKindOfBed(mixed, unrecorded)).toBe("open_adult");
    expect(bedKindOfBed(allLocked, unrecorded)).toBe("locked_adult");
    expect(bedKindOfBed(allLocked, undefined)).toBe("locked_adult");
  });

  it("sorts a planned admission by age band and legal status", () => {
    const booking = { ageBand: "Adult", legalStatus: "Voluntary" } as PlannedAdmission;
    expect(bedKindOfPlannedAdmission(booking)).toBe("open_adult");
    expect(bedKindOfPlannedAdmission({ ...booking, legalStatus: "Involuntary inpatient" })).toBe("locked_adult");
    expect(bedKindOfPlannedAdmission({ ...booking, ageBand: "Youth" })).toBe("youth");
  });

  it("words a range end the way the mismatch table does", () => {
    expect([kindRangeWord(-4), kindRangeWord(0), kindRangeWord(3)]).toEqual(["4 short", "even", "3 spare"]);
  });
});
