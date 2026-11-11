// Feature 21 (Josh, 9 Nov 2026): expected occupancy per ward at 24, 48 and 72 hours, from the bed
// forecast's own counts for each ward, with a network total row.
import { describe, expect, it } from "vitest";

import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import { expectedOccupancy, occupancyPercent } from "@/components/ward-management/capacity/expected-occupancy";
import type { Admission, PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { bedReleases } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import type { BedRelease, Movement, Referral } from "@/components/ward-management/ward-model";

const NOW = NOW_ANCHOR;
const unit = allUnits()[0]!;

function release(id: string, overrides: Partial<BedRelease>): BedRelease {
  return {
    id,
    unitId: unit.id,
    admissionId: `AD-OC-${id}`,
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
  } as BedRelease;
}

describe("expectedOccupancy", () => {
  it("takes recorded discharges off and booked admissions on, per horizon, with low <= likely <= high", () => {
    const releases = [
      release("confirmed-today", { state: "confirmed", expectedAt: NOW + 60 }),
      release("expected-day-2", { expectedAt: NOW + MINUTES_PER_DAY + 60 }),
      release("held-up-day-3", { expectedAt: NOW + 2 * MINUTES_PER_DAY + 60, blocker: "Awaiting transport" }),
    ];
    const booking = {
      id: "PA-OC-1",
      unitId: unit.id,
      patientId: null,
      state: "booked",
      expectedArrivalAt: NOW + 2 * MINUTES_PER_DAY + 30,
    } as unknown as PlannedAdmission;
    const { rows, total } = expectedOccupancy([unit], releases, [] as Admission[], NOW, [booking]);
    const row = rows[0]!;
    const states = bedStates(unit, [], releases, []);
    const taken = states.occupied + states.pulled;
    expect(row.takenNow).toBe(taken);
    expect(row.horizons.map((h) => h.hours)).toEqual([24, 48, 72]);
    // 24 h: the confirmed one leaves. 48 h: the expected one too. 72 h: a booking arrives; the
    // held-up one only widens the range.
    expect(row.horizons.map((h) => h.likely)).toEqual([taken - 1, taken - 2, taken - 1]);
    expect(row.horizons.map((h) => h.high)).toEqual([taken - 1, taken - 1, taken]);
    expect(row.horizons[2]!.low).toBe(taken - 2);
    expect(total.horizons).toEqual(row.horizons);
    expect(total.beds).toBe(unit.beds);
  });

  it("matches the ward's own forecast counts on the seeded network, and sums wards into the total", () => {
    const units = allUnits();
    const { rows, total } = expectedOccupancy(units, bedReleases, wardAdmissions, NOW);
    expect(rows.length).toBe(units.filter((candidate) => !candidate.isClosed).length);
    for (const row of rows) {
      const ward = units.find((candidate) => candidate.id === row.unitId)!;
      const forecast = bedsForecast([ward], bedReleases, wardAdmissions, [], NOW);
      row.horizons.forEach((h, index) => {
        const counts = forecast.horizons[index]!;
        expect(h.likely).toBe(
          Math.max(row.takenNow - counts.confirmed - counts.expected + counts.plannedAdmissions, 0),
        );
        expect(h.low).toBeLessThanOrEqual(h.likely);
        expect(h.likely).toBeLessThanOrEqual(h.high);
      });
    }
    total.horizons.forEach((h, index) =>
      expect(h.likely).toBe(rows.reduce((sum, row) => sum + row.horizons[index]!.likely, 0)),
    );
    expect(total.takenNow).toBe(rows.reduce((sum, row) => sum + row.takenNow, 0));
  });

  it("counts a bed held by name for an incoming journey as taken now (WF-FIG-017)", () => {
    const journey = {
      id: "WF-OC-HOLD",
      stage: "pulled",
      acceptedUnitId: unit.id,
      heldBedNumber: 1,
    } as unknown as Movement;
    const without = expectedOccupancy([unit], [], [] as Admission[], NOW);
    const withHold = expectedOccupancy([unit], [], [] as Admission[], NOW, [], [journey]);
    expect(bedStates(unit, [], [], [], [journey]).pulled).toBe(1);
    expect(withHold.rows[0]!.takenNow).toBe(without.rows[0]!.takenNow + 1);
    expect(withHold.rows[0]!.horizons[0]!.high).toBe(without.rows[0]!.horizons[0]!.high + 1);
  });

  it("counts a booked person who already holds a named bed here once, not twice (Josh, 11 Nov 2026)", () => {
    const booking = {
      id: "PA-OC-HOLD",
      unitId: unit.id,
      patientId: "PT-OC-HOLD",
      state: "booked",
      expectedArrivalAt: NOW + 60,
    } as unknown as PlannedAdmission;
    const journey = {
      id: "WF-OC-HOLD-BOOKED",
      patientId: "PT-OC-HOLD",
      stage: "accepted_awaiting_bed",
      acceptedUnitId: unit.id,
      heldBedNumber: 1,
    } as unknown as Movement;
    const referral = {
      id: "RF-OC-HOLD-BOOKED",
      patientId: "PT-OC-HOLD",
      destinations: [
        { state: "accepted", destination: { kind: "psychiatric_ward", unitId: unit.id }, heldBedNumber: 2 },
      ],
    } as unknown as Referral;
    const empty = expectedOccupancy([unit], [], [] as Admission[], NOW);
    for (const hold of [journey, referral]) {
      const held = expectedOccupancy([unit], [], [] as Admission[], NOW, [booking], [hold]);
      // The hold is in takenNow already; the booking for the same person adds nothing more.
      expect(held.rows[0]!.takenNow).toBe(empty.rows[0]!.takenNow + 1);
      for (const [index, horizon] of held.rows[0]!.horizons.entries()) {
        expect(horizon.likely).toBe(empty.rows[0]!.horizons[index]!.likely + 1);
        expect(horizon.high).toBe(empty.rows[0]!.horizons[index]!.high + 1);
      }
    }
    // A booking for someone else still counts.
    const other = { ...booking, id: "PA-OC-OTHER", patientId: "PT-OC-OTHER" } as PlannedAdmission;
    const both = expectedOccupancy([unit], [], [] as Admission[], NOW, [booking, other], [journey]);
    expect(both.rows[0]!.horizons[0]!.likely).toBe(empty.rows[0]!.horizons[0]!.likely + 2);
  });

  it("the network forecast does not count a named referral hold and its booking twice", () => {
    const booking = {
      id: "PA-NET-HOLD",
      unitId: unit.id,
      patientId: "PT-NET-HOLD",
      state: "booked",
      expectedArrivalAt: NOW + 60,
    } as unknown as PlannedAdmission;
    const referral = {
      id: "RF-NET-HOLD",
      patientId: "PT-NET-HOLD",
      destinations: [
        { state: "accepted", destination: { kind: "psychiatric_ward", unitId: unit.id }, heldBedNumber: 2 },
      ],
    } as unknown as Referral;
    const without = bedsForecast([unit], [], [], [], NOW, [booking]);
    const held = bedsForecast([unit], [], [], [], NOW, [booking], [referral]);
    expect(without.horizons[0]!.plannedAdmissions).toBe(1);
    expect(held.horizons[0]!.plannedAdmissions).toBe(0);
    // One person, one bed: Ready drops by the hold, and the booking no longer takes another.
    expect(held.horizons[0]!.readyNow).toBe(without.horizons[0]!.readyNow - 1);
  });

  it("says a percentage, or Not recorded with no beds", () => {
    expect(occupancyPercent(18, 20)).toBe("90%");
    expect(occupancyPercent(21, 20)).toBe("105%");
    expect(occupancyPercent(3, 0)).toBe("Not recorded");
  });
});
