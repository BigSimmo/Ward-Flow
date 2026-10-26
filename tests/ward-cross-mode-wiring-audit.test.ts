import { describe, expect, it } from "vitest";
import { bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import { bedKindGaps, networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { plannedAdmissionsStillNeedingABed } from "@/components/ward-management/capacity/planned-admissions-reducer";
import { forecastByKind } from "@/components/ward-management/forecast/forecast-by-kind";
import { sevenDayHorizon } from "@/components/ward-management/forecast/forecast-horizon";
import { occupiedBeds } from "@/components/ward-management/statistics/statistics-occupancy";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardOccupancy } from "@/components/ward-management/ward-occupancy";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { nextEvent, nowFor, seededRandom } from "./helpers/ward-engine-fuzz";

function forecast(state: WardFlowState, now = NOW_ANCHOR) {
  return bedsForecast(state.units, state.bedReleases, state.admissions, state.movements, now, state.plannedAdmissions);
}

function send(state: WardFlowState, event: WardFlowEvent): WardFlowState {
  const next = wardFlowReducer(state, event);
  expect(next.rejections.length, `${event.type}: ${next.rejections.at(-1)?.reason}`).toBe(state.rejections.length);
  return next;
}

describe("cross-mode calculations after synthetic event sequences", () => {
  it("keeps Capacity, bed boxes, Statistics and both forecast views in agreement after every event", () => {
    let accepted = 0;
    let refused = 0;
    for (let seed = 401; seed < 425; seed += 1) {
      let state = seedWardFlowState();
      const random = seededRandom(seed);
      for (let step = 0; step < 120; step += 1) {
        const event = nextEvent(state, random, step);
        const next = wardFlowReducer(state, event);
        if (next.rejections.length > state.rejections.length) refused += 1;
        else accepted += 1;
        state = next;
        const now = nowFor(state, step);
        const label = `seed=${seed}, step=${step}, action=${event.type}`;
        const rows = networkWardRows(state.units, now, state.bedReleases, state.admissions, state.leaveBeds);
        const boxes = state.units.map((unit) => bedStates(unit, state.admissions, state.bedReleases, state.leaveBeds));
        const sum = (key: "ready" | "pulled" | "occupied" | "closed") =>
          boxes.reduce((total, box) => total + box[key], 0);
        for (const key of ["ready", "pulled", "occupied", "closed"] as const) {
          expect(
            rows.reduce((total, row) => total + row[key], 0),
            `${label}: ${key}`,
          ).toBe(sum(key));
          expect(
            boxes.every((box) => Number.isFinite(box[key]) && box[key] >= 0),
            `${label}: bounded ${key}`,
          ).toBe(true);
        }
        const stats = occupiedBeds(state.units, state.admissions, state.bedReleases, state.leaveBeds);
        expect(stats.inUse, `${label}: occupancy`).toBe(
          wardOccupancy(state.units, state.admissions, state.bedReleases).inUse,
        );
        expect(stats.inUse, `${label}: bed boxes in use`).toBe(sum("occupied") + sum("pulled"));
        const gaps = bedKindGaps(state.movements, state.units, now, state.admissions);
        const network = forecast(state, now);
        for (const days of [1, 2]) {
          const horizon = network.horizons[days - 1];
          const kind = forecastByKind(
            state.units,
            state.bedReleases,
            state.admissions,
            state.movements,
            now,
            days,
            state.plannedAdmissions,
          );
          for (const key of [
            "low",
            "likely",
            "high",
            "confirmed",
            "expected",
            "heldUp",
            "overdue",
            "plannedNotFlagged",
            "plannedAdmissions",
          ] as const) {
            expect(kind.total[key], `${label}: ${days} days ${key}`).toBe(horizon[key]);
          }
          expect(
            gaps.reduce((total, row) => total + row.waiting, 0),
            `${label}: waiting`,
          ).toBe(horizon.waitingForBed);
        }
      }
    }
    expect(accepted).toBeGreaterThan(0);
    expect(refused).toBeGreaterThan(0);
  }, 90_000);
});

describe("linked booking follows the person's actual bed", () => {
  it("does not count the same linked booking as fresh demand after a real pull or arrival", () => {
    let state = seedWardFlowState();
    const movement = state.movements.find((candidate) => candidate.id === "WF-001")!;
    const unitId = "fre-adult-open";
    state = send(state, {
      type: "BOOK_PLANNED_ADMISSION",
      role: "coordinator",
      now: NOW_ANCHOR,
      patientId: movement.patientId!,
      initials: null,
      sex: "Female",
      reason: "respite",
      unitId,
      expectedArrivalAt: NOW_ANCHOR + MINUTES_PER_DAY,
      expectedStayDays: 7,
      legalStatus: "Voluntary",
      ageBand: "Adult",
      calendarDate: "2026-10-24",
    });
    state = send(state, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: movement.id,
      unitIds: [unitId],
    });
    state = send(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: movement.id,
      unitId,
      actingUnitId: unitId,
    });
    const before = forecast(state).horizons[0];
    state = send(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: movement.id,
      unitId,
      actingUnitId: unitId,
      numConsulted: true,
    });
    const pulled = forecast(state).horizons[0];
    expect(pulled.waitingForBed).toBe(before.waitingForBed - 1);
    expect(pulled.plannedAdmissions).toBe(before.plannedAdmissions);
    expect(pulled.bedsNeeded).toBe(before.bedsNeeded - 1);
    expect(pulled.likely).toBe(before.likely);
    for (const days of [1, 2]) {
      const kind = forecastByKind(
        state.units,
        state.bedReleases,
        state.admissions,
        state.movements,
        NOW_ANCHOR,
        days,
        state.plannedAdmissions,
      );
      expect(kind.total.plannedAdmissions).toBe(forecast(state).horizons[days - 1].plannedAdmissions);
      expect(kind.total.plannedAdmissions).toBe(before.plannedAdmissions);
    }
    state = send(state, {
      type: "RECORD_TRANSPORT_NEED",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: movement.id,
      needed: false,
    });
    state = send(state, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: movement.id,
      actingUnitId: unitId,
    });
    expect(forecast(state).horizons[0].plannedAdmissions).toBe(before.plannedAdmissions);
  });

  it.each(["pulled", "occupied", "departed", "waitlisted"] as const)(
    "deduplicates an active %s bed only, preserving initials-only and future demand",
    (admissionState) => {
      const seed = seedWardFlowState();
      const unitId = "fre-adult-open";
      const booking = {
        ...seed.plannedAdmissions[0],
        unitId,
        patientId: "PT-044" as const,
        initials: null,
        state: "booked" as const,
        expectedArrivalAt: NOW_ANCHOR + 60,
      };
      const initials = { ...booking, id: "PA-AUDIT-INITIALS", patientId: null, initials: "AB" };
      const stay = { ...seed.admissions[0], unitId, patientId: booking.patientId, state: admissionState };
      const counted = plannedAdmissionsStillNeedingABed(
        [booking, initials],
        new Set([unitId]),
        NOW_ANCHOR + 1440,
        [],
        [stay],
      );
      expect(counted).toEqual(
        admissionState === "pulled" || admissionState === "occupied" ? [initials] : [booking, initials],
      );
    },
  );
});

describe("owner-approved linked discharge dates", () => {
  it("moves the linked release and both forecast views with the stay date, leaving completed releases unchanged", () => {
    const before = seedWardFlowState();
    const release = before.bedReleases.find(
      (candidate) =>
        candidate.state !== "discharged" &&
        candidate.blocker === null &&
        candidate.expectedAt >= NOW_ANCHOR &&
        candidate.expectedAt < NOW_ANCHOR + 1440,
    )!;
    expect(release).toBeDefined();
    const at = NOW_ANCHOR + 4 * MINUTES_PER_DAY;
    const completed = before.bedReleases.find((candidate) => candidate.state === "discharged")!;
    expect(completed).toBeDefined();
    const state = before;
    const changed = send(state, {
      type: "UPDATE_EXPECTED_DISCHARGE",
      role: "ward",
      now: NOW_ANCHOR,
      admissionId: release.admissionId,
      actingUnitId: release.unitId,
      expectedDischargeAt: at,
    });
    expect(changed.admissions.find((stay) => stay.id === release.admissionId)?.expectedDischargeAt).toBe(at);
    expect(changed.bedReleases.find((row) => row.id === release.id)).toEqual({ ...release, expectedAt: at });
    expect(changed.bedReleases.find((row) => row.id === completed.id)).toBe(completed);
    for (const days of [1, 2]) {
      const oldHorizon = forecast(state).horizons[days - 1];
      const newHorizon = forecast(changed).horizons[days - 1];
      expect(newHorizon.confirmed + newHorizon.expected).toBe(oldHorizon.confirmed + oldHorizon.expected - 1);
      expect(
        forecastByKind(
          changed.units,
          changed.bedReleases,
          changed.admissions,
          changed.movements,
          NOW_ANCHOR,
          days,
          changed.plannedAdmissions,
        ).total.likely,
      ).toBe(newHorizon.likely);
    }
    const grid = sevenDayHorizon(
      changed.units,
      changed.admissions.filter((stay) => stay.id === release.admissionId),
      [],
      NOW_ANCHOR,
    );
    expect(grid.total.out[4]).toBe(1);
    expect(changed.units).toBe(state.units);
  });

  it("refuses an out-of-scope date edit without changing the admission or release", () => {
    const state = seedWardFlowState();
    const stay = state.admissions.find((candidate) => candidate.state === "occupied")!;
    const rejected = wardFlowReducer(state, {
      type: "UPDATE_EXPECTED_DISCHARGE",
      role: "ward",
      now: NOW_ANCHOR,
      admissionId: stay.id,
      actingUnitId: "another-ward",
      expectedDischargeAt: NOW_ANCHOR + 1440,
    });
    expect(rejected.rejections.length).toBe(state.rejections.length + 1);
    expect(rejected.admissions).toBe(state.admissions);
    expect(rejected.bedReleases).toBe(state.bedReleases);
  });
});
