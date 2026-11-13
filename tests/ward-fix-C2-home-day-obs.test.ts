import { describe, expect, it } from "vitest";

/*
 * Root-cause fixes 2.2, 2.4, 3.3 and 3.5 (demo-data root causes, approved by Josh 13 Nov 2026).
 * Guards so each fault cannot return. Synthetic seed data only.
 */

import { plannedRows } from "@/components/ward-management/coordinator/planned-model";
import { stayDayNumber, type Admission, type PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { buildActionInbox } from "@/components/ward-management/ward-derivations";
import { oldPackCounts, oldPackWords, wardsWithOldPack } from "@/components/ward-management/ward-downtime-pack-prints";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import {
  GENERAL_OBSERVATION,
  isConstantObservation,
  isObservation,
  NOT_RECORDED_OBSERVATION,
  OBSERVATION_LEVELS,
  observationIsRecorded,
  observationLevelName,
  observationStaff,
  observationSummary,
} from "@/components/ward-management/ward-observation";
import { upgradeLegacyObservationRows } from "@/components/ward-management/ward-observation-legacy";
import type { ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";
import { isValidSharedWardFlowState } from "@/components/ward-management/ward-shared-state-validation";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
const START_OF_DAY = 0;
const END_OF_DAY = MINUTES_PER_DAY;
const SHIFT_END = 15 * 60;
const nameOf = () => ({ formalName: "SYNTHETIC, Person" }) as ResolvedPatientInfo;

function rowsAt(state: WardFlowState, now: Instant = NOW) {
  return plannedRows({
    movements: state.movements,
    admissions: state.admissions,
    plannedAdmissions: state.plannedAdmissions,
    units: state.units,
    configuration: state.configuration,
    now,
    until: SHIFT_END,
    endOfDay: END_OF_DAY,
    startOfDay: START_OF_DAY,
    nameOf,
  });
}

function withMovement(state: WardFlowState, id: string, change: (movement: Movement) => Movement): WardFlowState {
  return { ...state, movements: state.movements.map((movement) => (movement.id === id ? change(movement) : movement)) };
}

describe("2.2 Home keeps a planned step whose time has passed (Past planned time)", () => {
  const seed = seedWardFlowState();

  it("keeps the seeded planned admission PA-SEED-03, 72 minutes late, under Past planned time", () => {
    const booking = seed.plannedAdmissions.find((planned) => planned.id === "PA-SEED-03")!;
    expect(booking.state).toBe("booked");
    expect(NOW - booking.expectedArrivalAt).toBe(72);
    const row = rowsAt(seed).find((entry) => entry.id === "admission:PA-SEED-03");
    expect(row).toMatchObject({ kind: "admission", past: true, later: false, at: booking.expectedArrivalAt });
    // Past rows lead the list.
    expect(rowsAt(seed)[0]?.past).toBe(true);
  });

  it("drops the late booking once someone acts on it", () => {
    const plannedAdmissions: PlannedAdmission[] = seed.plannedAdmissions.map((planned) =>
      planned.id === "PA-SEED-03" ? { ...planned, state: "cancelled" } : planned,
    );
    expect(rowsAt({ ...seed, plannedAdmissions }).some((row) => row.id === "admission:PA-SEED-03")).toBe(false);
  });

  it("keeps a booked transport until its inbox item appears: seeded WF-015 is in the inbox, not doubled on Home", () => {
    const wf015 = seed.movements.find((movement) => movement.id === "WF-015")!;
    const estimate = wf015.transport!.estimatedAt!;
    const passedAfter = CLINICAL_VALUES.bookingEstimatePassed.value;
    expect(NOW - estimate).toBeGreaterThanOrEqual(passedAfter);
    const inboxHas = (state: WardFlowState, now: Instant) =>
      buildActionInbox(state.movements, now, state.units).some(
        (item) => item.movementId === "WF-015" && item.title.startsWith("Booking estimate passed"),
      );
    const homeHas = (state: WardFlowState, now: Instant) =>
      rowsAt(state, now).some((row) => row.kind === "transport" && row.id.startsWith("transport:WF-015:"));
    // 75 minutes old: the inbox item carries it.
    expect(inboxHas(seed, NOW)).toBe(true);
    expect(homeHas(seed, NOW)).toBe(false);
    // Between the estimate and the inbox item, the row stays on Home (it used to vanish at once).
    for (const minutesLate of [0, 1, passedAfter - 1]) {
      const now = estimate + minutesLate;
      expect(homeHas(seed, now), `${minutesLate} minutes late`).toBe(true);
      expect(inboxHas(seed, now), `${minutesLate} minutes late`).toBe(false);
      expect(rowsAt(seed, now).find((row) => row.id.startsWith("transport:WF-015:"))?.past).toBe(minutesLate >= 0);
    }
    // From the minute the inbox item appears, Home hands over to it: never on neither list.
    expect(inboxHas(seed, estimate + passedAfter)).toBe(true);
    expect(homeHas(seed, estimate + passedAfter)).toBe(false);
  });

  it("keeps a late planned move until it leaves", () => {
    const accepted = seed.movements.find((movement) => movement.acceptedUnitId && movement.stage === "pulled")!;
    expect(accepted).toBeDefined();
    const late = withMovement(seed, accepted.id, (movement) => ({ ...movement, plannedMoveAt: NOW - 3 * 60 }));
    expect(rowsAt(late).find((row) => row.id === `move:${accepted.id}`)).toMatchObject({ kind: "move", past: true });
    const leaving = withMovement(late, accepted.id, (movement) => ({ ...movement, stage: "moving" }));
    expect(rowsAt(leaving).some((row) => row.id === `move:${accepted.id}`)).toBe(false);
  });

  it("keeps an expected discharge that passed earlier today, but not one from an earlier day", () => {
    const stay = seed.admissions.find((admission) => admission.state === "occupied")!;
    const at = (expectedDischargeAt: Instant): WardFlowState => ({
      ...seed,
      admissions: seed.admissions.map((admission) =>
        admission.id === stay.id ? ({ ...admission, expectedDischargeAt } as Admission) : admission,
      ),
    });
    expect(rowsAt(at(9 * 60)).find((row) => row.id === `discharge:${stay.id}`)).toMatchObject({ past: true });
    expect(rowsAt(at(9 * 60 - MINUTES_PER_DAY)).some((row) => row.id === `discharge:${stay.id}`)).toBe(false);
  });

  it("never lists a target under Past planned time", () => {
    expect(rowsAt(seed).filter((row) => row.past && row.kind === "target")).toEqual([]);
  });
});

describe("2.4 Day N counts Perth calendar days, the day of arrival as Day 1", () => {
  const day = (offset: number, hour: number, minute = 0) => offset * MINUTES_PER_DAY + hour * 60 + minute;

  it("moves to Day 2 at Perth midnight, not 24 hours after arrival", () => {
    const arrived = { arrivedAt: day(0, 23) };
    expect(stayDayNumber(arrived, day(0, 23))).toBe(1);
    expect(stayDayNumber(arrived, day(0, 23, 59))).toBe(1);
    expect(stayDayNumber(arrived, day(1, 0))).toBe(2);
    // The old 24-hour count read Day 1 here.
    expect(stayDayNumber(arrived, day(1, 22, 59))).toBe(2);
    expect(stayDayNumber(arrived, day(2, 0, 1))).toBe(3);
  });

  it("keeps an early-morning arrival on Day 1 all day, across earlier days too", () => {
    expect(stayDayNumber({ arrivedAt: day(0, 0, 30) }, day(0, 23, 59))).toBe(1);
    expect(stayDayNumber({ arrivedAt: day(-3, 9) }, day(0, 8))).toBe(4);
  });

  it("has no day when there is no stay, and an arrival after now reads Day 1", () => {
    expect(stayDayNumber({ arrivedAt: null }, NOW)).toBeNull();
    expect(stayDayNumber(undefined, NOW)).toBeNull();
    expect(stayDayNumber({ arrivedAt: NOW + 60 }, NOW)).toBe(1);
  });
});

describe("3.5 an observation level can be Not recorded", () => {
  it("reads Not recorded, is not General, counts no staff and is not a choice in the pickers", () => {
    expect(observationLevelName(NOT_RECORDED_OBSERVATION.level)).toBe("Not recorded");
    expect(observationSummary(NOT_RECORDED_OBSERVATION)).toBe("Not recorded");
    expect(NOT_RECORDED_OBSERVATION.level).not.toBe(GENERAL_OBSERVATION.level);
    expect(observationIsRecorded(NOT_RECORDED_OBSERVATION)).toBe(false);
    expect(observationIsRecorded(GENERAL_OBSERVATION)).toBe(true);
    expect(isConstantObservation(NOT_RECORDED_OBSERVATION)).toBe(false);
    expect(observationStaff(NOT_RECORDED_OBSERVATION.level)).toBe(0);
    expect(isObservation({ ...NOT_RECORDED_OBSERVATION })).toBe(true);
    expect((OBSERVATION_LEVELS as readonly string[]).includes(NOT_RECORDED_OBSERVATION.level)).toBe(false);
  });

  it("leaves every recorded level's staff count as it was", () => {
    expect(OBSERVATION_LEVELS.map((level) => [level, observationStaff(level)])).toEqual([
      ["general", 0],
      ["intermittent", 0],
      ["within_sight", 1],
      ["arms_length", 1],
      ["two_staff", 2],
    ]);
  });

  it("does not write General for a planned arrival turned into a stay", () => {
    const seed = seedWardFlowState();
    const booking = seed.plannedAdmissions.find((planned) => planned.id === "PA-SEED-03")!;
    const arrived = wardFlowReducer(seed, {
      type: "CONVERT_PLANNED_ADMISSION",
      role: "coordinator",
      now: NOW,
      plannedAdmissionId: booking.id,
      unitId: booking.unitId,
    });
    expect(arrived.rejections.slice(seed.rejections.length)).toEqual([]);
    const converted = arrived.plannedAdmissions.find((planned) => planned.id === booking.id)!;
    const stay = arrived.admissions.find((admission) => admission.id === converted.admissionId)!;
    expect(stay.observation).toEqual(NOT_RECORDED_OBSERVATION);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(arrived)))).toBe(true);
  });

  it("reads an old save's specialling false as Not recorded, and true as one staff as before", () => {
    const seed = seedWardFlowState();
    const [first, second] = seed.admissions;
    const strip = (admission: Admission, specialling: boolean) => {
      const { observation, ...rest } = admission;
      void observation;
      return { ...rest, specialling };
    };
    const upgraded = upgradeLegacyObservationRows({
      admissions: [strip(first!, false), strip(second!, true)],
    }) as unknown as { admissions: Admission[] };
    expect(upgraded.admissions[0]!.observation.level).toBe("not_recorded");
    expect(upgraded.admissions[1]!.observation.level).toBe("within_sight");
  });

  it("shows a stay hidden from a community desk as Not recorded, not General", () => {
    const state = seedWardFlowState();
    const catchmentPatient = state.patients.find((patient) => patient.catchmentCommunityTeam)!;
    const stay = {
      ...state.admissions.find((admission) => admission.patientId !== null)!,
      id: "adm-fix-c2-dates-only",
      patientId: catchmentPatient.id,
      referralId: null,
      movementId: null,
    };
    const custom = {
      ...state,
      admissions: [...state.admissions.filter((admission) => admission.patientId !== catchmentPatient.id), stay],
      movements: state.movements.filter((movement) => movement.patientId !== catchmentPatient.id),
      referrals: state.referrals.filter((referral) => referral.patientId !== catchmentPatient.id),
    };
    const desk: WardAccess = {
      role: "community",
      scope: { kind: "team", teamName: catchmentPatient.catchmentCommunityTeam! },
    };
    const scoped = scopeWardFlowState(custom, desk, { now: NOW, places: wardPlaceLookup(state.units) });
    expect(scoped.scoped.datesOnlyAdmissionIds.has(stay.id)).toBe(true);
    expect(scoped.state.admissions.find((admission) => admission.id === stay.id)?.observation).toEqual(
      NOT_RECORDED_OBSERVATION,
    );
    expect(isValidSharedWardFlowState(scoped.state)).toBe(true);
  });

  it("keeps the seeded ward stays as they are (what the sample day shows is Josh's call)", () => {
    const levels = new Set(seedWardFlowState().admissions.map((admission) => admission.observation.level));
    expect(levels.has("not_recorded")).toBe(false);
  });
});

describe("3.3 outage packs: never printed and over 24h old are counted apart", () => {
  const units = seedWardFlowState().units.map((unit) => unit.id);
  const old = NOW - MINUTES_PER_DAY - 30;

  it("does not word a never-printed pack as over 24h old", () => {
    const counts = oldPackCounts(wardsWithOldPack([], units, NOW));
    expect(counts).toEqual({ neverPrinted: units.length, overAge: 0 });
    expect(oldPackWords(counts)).toBe(`${units.length} outage packs never printed`);
    expect(oldPackWords(counts)).not.toMatch(/24h/);
  });

  it("words each count on its own, and only when above zero", () => {
    const records = [{ unitId: units[0]!, at: old, by: "coordinator" as const }];
    const counts = oldPackCounts(wardsWithOldPack(records, units.slice(0, 3), NOW));
    expect(counts).toEqual({ neverPrinted: 2, overAge: 1 });
    expect(oldPackWords(counts)).toBe("2 outage packs never printed, 1 over 24h old");
    expect(oldPackWords({ neverPrinted: 0, overAge: 1 })).toBe("1 outage pack over 24h old");
    expect(oldPackWords({ neverPrinted: 1, overAge: 0 })).toBe("1 outage pack never printed");
    expect(oldPackWords({ neverPrinted: 0, overAge: 0 })).toBe("");
  });
});
