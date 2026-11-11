// src/components/ward-management/capacity/expected-occupancy.ts
//
// Feature 21 (Josh, 9 Nov 2026): expected occupancy per ward for the next 24, 48 and 72 hours. Built
// from the bed forecast's own counts for each ward (`bedsForecast` run on that ward alone), so the
// figures can never disagree with the forecast: beds taken now (occupied, plus pulled and held for a
// named person on the way), less the discharges recorded in the window, plus the admissions booked
// to arrive in it. People still waiting without a ward are not given one here.
import type { Admission, PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { bedStates, type ReservationReferral } from "@/components/ward-management/ward-bed-states";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { bedsForecast } from "./beds-forecast";

/** One ward (or the network) at one horizon. Low to high is fewest to most beds taken. */
export type OccupancyAt = {
  hours: number;
  /** Everything on record goes ahead: held-up, overdue and unflagged dates leave too. */
  low: number;
  /** Confirmed and expected discharges leave; the headline figure. */
  likely: number;
  /** Only confirmed discharges leave. */
  high: number;
};

export type OccupancyRow = {
  unitId: string;
  name: string;
  beds: number;
  /** Beds taken now: occupied, pulled, and held for a named person not yet arrived. */
  takenNow: number;
  horizons: OccupancyAt[];
};

export type ExpectedOccupancy = { rows: OccupancyRow[]; total: OccupancyRow };

export function expectedOccupancy(
  units: readonly Unit[],
  releases: readonly BedRelease[],
  admissions: readonly Admission[],
  now: Instant,
  planned: readonly PlannedAdmission[] = [],
  /** Journeys and referrals holding a bed by name (WF-FIG-017), as Capacity's other figures take them. */
  reservations: readonly ReservationReferral[] = [],
): ExpectedOccupancy {
  // A closed ward counts as zero capacity (clinical owner ruling, 14 Oct 2026), so it has no row.
  const rows = units
    .filter((unit) => !unit.isClosed)
    .map((unit): OccupancyRow => {
      const states = bedStates(unit, admissions, [...releases], [], reservations);
      const takenNow = states.occupied + states.pulled;
      // The forecast for this ward alone, with nobody waiting: waiting people have no ward yet. The
      // named holds go in too, so a booking for someone already holding a bed here (in `takenNow`)
      // is not added a second time.
      const forecast = bedsForecast([unit], [...releases], [...admissions], [], now, planned, reservations);
      return {
        unitId: unit.id,
        name: unit.name,
        beds: unit.beds,
        takenNow,
        horizons: forecast.horizons.map((horizon) => {
          const high = takenNow - horizon.confirmed + horizon.plannedAdmissions;
          const likely = high - horizon.expected;
          const low = likely - horizon.heldUp - horizon.overdue - horizon.plannedNotFlagged;
          // A ward cannot hold fewer than nobody, even if a stale record says more leave than are in.
          return { hours: horizon.hours, low: Math.max(low, 0), likely: Math.max(likely, 0), high: Math.max(high, 0) };
        }),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const hours = rows[0]?.horizons.map((horizon) => horizon.hours) ?? [];
  const total: OccupancyRow = {
    unitId: "network",
    name: "Network",
    beds: rows.reduce((sum, row) => sum + row.beds, 0),
    takenNow: rows.reduce((sum, row) => sum + row.takenNow, 0),
    horizons: hours.map((h, index) => ({
      hours: h,
      low: rows.reduce((sum, row) => sum + row.horizons[index]!.low, 0),
      likely: rows.reduce((sum, row) => sum + row.horizons[index]!.likely, 0),
      high: rows.reduce((sum, row) => sum + row.horizons[index]!.high, 0),
    })),
  };
  return { rows, total };
}

/** "90%", or "Not recorded" for a ward with no beds recorded. Rounded to a whole percent. */
export function occupancyPercent(taken: number, beds: number): string {
  if (beds <= 0) return "Not recorded";
  return `${Math.round((taken / beds) * 100)}%`;
}
