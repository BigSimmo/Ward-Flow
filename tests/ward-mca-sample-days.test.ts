// CC-5 (mechanics and clock audit, 14 Nov 2026): sample days are drawn for the seed's own day, never
// for the day the module (or the server process) loaded. A server running past midnight drew its
// start day's dates, so its pages disagreed with the browser's and a shared world seeded days later
// got old dates. These run in one process across fake days, the way a long-running server does.
import { afterEach, describe, expect, it, vi } from "vitest";

import { demoDayZero } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { recordExtrasFor } from "@/components/ward-management/patients/patient-record-extras";
import { sampleDayText, sampleIsoDay } from "@/components/ward-management/ward-sample-days";
import { movedIsoDay, withPatientCalendarDaysMoved } from "@/components/ward-management/ward-typed-calendar-days";
import { seedWorld } from "../backend/ward-flow/engine";

afterEach(() => vi.useRealTimers());

const NOV_13 = new Date("2026-11-13T02:00:00Z"); // 10:00 Perth, 13 Nov 2026
const NOV_16 = new Date("2026-11-16T02:00:00Z"); // three days later, same process

function samplesOf(state: ReturnType<typeof seedWardFlowState>) {
  const pt002 = state.patients.find((patient) => patient.id === "PT-002")!;
  const pt036 = state.patients.find((patient) => patient.id === "PT-036")!;
  return {
    hearing: pt002.tribunalHearing?.date,
    plans: pt036.carePlans?.map((plan) => [plan.agreedOn, plan.reviewOn]),
    dateOfBirth: pt002.dateOfBirth,
  };
}

describe("sample days follow the day they are drawn for", () => {
  it("a later day in the same process draws that day's dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOV_13);
    expect(sampleIsoDay(0)).toBe("2026-11-13");
    const first = samplesOf(seedWardFlowState());
    vi.setSystemTime(NOV_16);
    expect(sampleIsoDay(0)).toBe("2026-11-16");
    const later = samplesOf(seedWardFlowState());
    expect(first.hearing).toBe("2026-11-08");
    expect(later.hearing).toBe("2026-11-11");
    expect(later.plans).toEqual([
      ["2026-03-19", "2026-09-19"],
      ["2026-10-13", "2027-01-13"],
    ]);
    // A date of birth is who the person is: it never moves.
    expect(later.dateOfBirth).toBe(first.dateOfBirth);
  });

  it("a seed given the board's day 0 draws the day of its own now, whatever the wall clock says", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOV_16);
    const dayZero = demoDayZero(NOV_13);
    // Opened at the 10:42 anchor on 13 Nov: five days before is 8 Nov.
    expect(samplesOf(seedWardFlowStateAt(0, "standard", { dayZero })).hearing).toBe("2026-11-08");
    // The same board a day and a half on (now on 14 Nov): the sample days move with it.
    expect(samplesOf(seedWardFlowStateAt(36 * 60, "standard", { dayZero })).hearing).toBe("2026-11-09");
  });

  it("a shared world seeded days after the server started gets its own day's dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOV_13);
    seedWorld(NOV_13);
    vi.setSystemTime(NOV_16);
    expect(samplesOf(seedWorld(NOV_16).state).hearing).toBe("2026-11-11");
  });

  it("the patient record's sample history is drawn per day too, and stays one object within a day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOV_13);
    const first = recordExtrasFor("PT-036");
    expect(recordExtrasFor("PT-036")).toBe(first);
    vi.setSystemTime(NOV_16);
    const later = recordExtrasFor("PT-036");
    expect(later).not.toBe(first);
    expect(sampleDayText(0)).toBe("16 Nov 2026");
    expect(JSON.stringify(later)).not.toBe(JSON.stringify(first));
  });
});

describe("one rule moves typed calendar days", () => {
  it("moves a real day by whole days, across months and years, and leaves anything else as it is", () => {
    expect(movedIsoDay("2026-11-30", 1)).toBe("2026-12-01");
    expect(movedIsoDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(movedIsoDay("2028-03-01", -1)).toBe("2028-02-29");
    expect(movedIsoDay("2026-02-30", 3)).toBe("2026-02-30");
    expect(movedIsoDay("Typed text not kept on this device", 3)).toBe("Typed text not kept on this device");
    expect(movedIsoDay("2026-08-15T00:00:00+08:00", 3)).toBe("2026-08-15T00:00:00+08:00");
  });

  it("keeps dates of birth and returns untouched records as the same object", () => {
    const patients = seedWardFlowState().patients;
    const moved = withPatientCalendarDaysMoved(patients, 2);
    moved.forEach((patient, index) => expect(patient.dateOfBirth).toBe(patients[index].dateOfBirth));
    const untouched = patients.findIndex((patient) => !patient.tribunalHearing && !patient.carePlans);
    expect(moved[untouched]).toBe(patients[untouched]);
  });
});
