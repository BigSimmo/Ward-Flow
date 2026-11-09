import { describe, expect, it } from "vitest";

import { tomorrowOutlook } from "@/components/ward-management/coordinator/planned-model";
import { actionsRecordedSince } from "@/components/ward-management/bed-meeting/bed-meeting-run";
import type { Admission, PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import type { Movement, Unit } from "@/components/ward-management/ward-model";

const END_OF_TODAY = MINUTES_PER_DAY;
const unit = { id: "u1", name: "Synthetic Ward A" } as Unit;
const nameOf = () => ({ formalName: "Testperson, Synthetic" }) as never;

function stay(id: string, expectedDischargeAt: number | null, extra: Partial<Admission> = {}): Admission {
  return {
    id,
    unitId: "u1",
    state: "occupied",
    expectedDischargeAt,
    dischargeConfirmedAt: null,
    ...extra,
  } as Admission;
}

describe("Home Tomorrow outlook (six features build)", () => {
  it("counts only expected discharges and bookings recorded for tomorrow", () => {
    const outlook = tomorrowOutlook({
      admissions: [
        stay("today", END_OF_TODAY - 60),
        stay("tomorrow-a", END_OF_TODAY + 9 * 60),
        stay("tomorrow-b", END_OF_TODAY + 14 * 60, { dischargeConfirmedAt: 100 }),
        stay("day-after", END_OF_TODAY + MINUTES_PER_DAY + 60),
        stay("no-date", null),
        stay("gone", END_OF_TODAY + 60, { state: "departed" }),
      ],
      plannedAdmissions: [
        { id: "b1", state: "booked", unitId: "u1", expectedArrivalAt: END_OF_TODAY + 10 * 60 } as PlannedAdmission,
        { id: "b2", state: "cancelled", unitId: "u1", expectedArrivalAt: END_OF_TODAY + 10 * 60 } as PlannedAdmission,
      ],
      units: [unit],
      nameOf,
      endOfDay: END_OF_TODAY,
    });
    expect(outlook.discharges.map((row) => row.id)).toEqual([
      "tomorrow-discharge:tomorrow-a",
      "tomorrow-discharge:tomorrow-b",
    ]);
    expect(outlook.confirmed).toBe(1);
    expect(outlook.admissions.map((row) => row.id)).toEqual(["tomorrow-admission:b1"]);
  });
});

describe("Run meeting summary (six features build)", () => {
  it("lists only actions recorded since the meeting started", () => {
    const admission = {
      id: "s1",
      unitId: "u1",
      meetingActions: [
        { kind: "chase_ndis", owner: "coordinator", dueAt: 200, recordedAt: 50 },
        { kind: "book_transport", owner: "coordinator", dueAt: 300, recordedAt: 120, doneAt: 130 },
      ],
    } as unknown as Admission;
    const rows = actionsRecordedSince({
      startedAt: 100,
      now: 140,
      movements: [] as Movement[],
      admissions: [admission],
      units: [unit],
      nameOf: () => "Testperson, Synthetic",
      ownerText: () => "Bed coordinator",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "Book transport", done: true, name: "Testperson, Synthetic" });
  });
});
