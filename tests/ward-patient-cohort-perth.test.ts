import { afterEach, describe, expect, it, vi } from "vitest";
import { calendarDateOf, perthMidnight } from "@/components/ward-management/ward-clock";
import { patientAgeYears, patientCohort } from "@/components/ward-management/ward-patients";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";

afterEach(() => vi.unstubAllEnvs());

describe.each(["Australia/Perth", "Australia/Sydney", "America/New_York"])("Perth cohorts on a %s browser", (zone) => {
  it.each([
    ["2001-10-17", 24, "Youth", "Adult"],
    ["1961-10-17", 64, "Adult", "Older adult"],
  ] as const)("changes cohort on the Perth birthday for DOB %s", (dob, age, before, birthday) => {
    vi.stubEnv("TZ", zone);
    const dayZero = perthMidnight(2026, 9, 16);
    for (const minutes of [0, 30, 1290, 1439]) {
      const at = calendarDateOf(minutes, dayZero);
      expect(patientAgeYears({ dateOfBirth: dob }, at)).toBe(age);
      expect(patientCohort(dob, at)).toBe(before);
    }
    expect(patientCohort(dob, calendarDateOf(1440, dayZero))).toBe(birthday);
  });

  it.each([
    ["2001-10-17", "Adult"],
    ["1961-10-17", "Older adult"],
  ] as const)("checks a linked booking against the Perth arrival date for DOB %s", (dob, ageBand) => {
    vi.stubEnv("TZ", zone);
    const seed = seedWardFlowState();
    const patient = { ...seed.patients.find((p) => p.id === "PT-002")!, dateOfBirth: dob };
    const state = {
      ...seed,
      admissions: seed.admissions.filter((a) => a.patientId !== patient.id),
      movements: seed.movements.filter((m) => m.patientId !== patient.id),
      plannedAdmissions: [],
      patients: seed.patients.map((p) => (p.id === patient.id ? patient : p)),
    };
    const result = wardFlowReducer(state, {
      type: "BOOK_PLANNED_ADMISSION",
      role: "coordinator",
      now: 1290,
      patientId: patient.id,
      sex: "Female",
      reason: "respite",
      unitId: "fre-adult-open",
      expectedArrivalAt: 1440,
      expectedStayDays: 7,
      legalStatus: "Voluntary",
      ageBand,
      calendarDate: "2026-10-16",
    });
    expect(result.rejections).toEqual(state.rejections);
    expect(result.plannedAdmissions.at(-1)?.ageBand).toBe(ageBand);
  });
});
