// D-181 item 11 (Josh, 13 Nov 2026): a typed date of birth no longer stops saving; on this device it
// is held as the "Typed text not kept" placeholder. The follow-up: such a person counts as "age not
// recorded", never as Adult. Before this, the unreadable date fell through every band test in
// `patientCohort` and landed on Adult. Synthetic seed records only.
import { describe, expect, it } from "vitest";

import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { TYPED_TEXT_NOT_KEPT } from "@/components/ward-management/ward-flow-demo-storage-constants";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { AGE_NOT_RECORDED, cohortFitsAge, patientCohort } from "@/components/ward-management/ward-patients";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const DAY = new Date(2026, 9, 9);

describe("D-181 item 11: a date of birth that gives no age counts as age not recorded", () => {
  it("never derives Adult from the placeholder, an empty date or a date after today", () => {
    expect(patientCohort(TYPED_TEXT_NOT_KEPT, DAY)).toBe(AGE_NOT_RECORDED);
    expect(patientCohort("", DAY)).toBe(AGE_NOT_RECORDED);
    expect(patientCohort("2030-01-01", DAY)).toBe(AGE_NOT_RECORDED);
    // A real date still gives its band.
    expect(patientCohort("1990-05-01", DAY)).toBe("Adult");
    expect(patientCohort("2015-05-01", DAY)).toBe("Youth");
    expect(patientCohort("1950-05-01", DAY)).toBe("Older adult");
  });

  it("does not flag or refuse a band the record cannot contradict", () => {
    for (const band of ["Youth", "Adult", "Older adult"]) {
      expect(cohortFitsAge(band, TYPED_TEXT_NOT_KEPT, DAY)).toBe(true);
    }
    // A real date is still checked.
    expect(cohortFitsAge("Older adult", "1990-05-01", DAY)).toBe(false);
  });

  it("books a linked person whose date of birth was not kept without calling them Adult", () => {
    const seed = seedWardFlowState();
    const busy = new Set(
      [
        ...seed.admissions.filter((admission) => admission.state === "occupied" || admission.state === "pulled"),
        ...seed.plannedAdmissions,
      ].map((record) => record.patientId),
    );
    const free = seed.patients.find((patient) => !busy.has(patient.id))!;
    const state: WardFlowState = {
      ...seed,
      patients: seed.patients.map((patient) =>
        patient.id === free.id ? { ...patient, dateOfBirth: TYPED_TEXT_NOT_KEPT } : patient,
      ),
    };
    const booked = wardFlowReducer(state, {
      type: "BOOK_PLANNED_ADMISSION",
      role: "coordinator",
      now: NOW_ANCHOR,
      initials: null,
      patientId: free.id,
      sex: "Female",
      gender: "Female",
      reason: "respite",
      unitId: "fre-adult-open",
      expectedArrivalAt: NOW_ANCHOR + MINUTES_PER_DAY,
      expectedStayDays: 7,
      legalStatus: "Voluntary",
      ageBand: "Youth",
      calendarDate: "2026-10-09",
    });
    // Before the fix: "... recorded date of birth gives the Adult age group, not Youth."
    expect(booked.rejections.map((rejection) => rejection.reason).join(" ")).not.toMatch(/Adult age group/u);
    expect(booked.rejections).toEqual([]);
  });
});
