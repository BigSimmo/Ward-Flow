// tests/ward-planned-admissions-draft.test.ts
//
// The booking form's pure draft steps (stream D review follow-up, 9 October 2026): merging an
// edit, listing the day options (an overdue booking keeps its own past day), and turning the typed
// time and stay into event fields or a sentence that says what to fix.
import { describe, expect, it } from "vitest";

import {
  applyDraftPatch,
  clockInputValue,
  draftTiming,
  parseClockInput,
  plannedDayOffsets,
  type PlannedAdmissionDraft,
} from "@/components/ward-management/capacity/planned-admissions-draft";
import { PLANNED_ADMISSION_WINDOW_DAYS } from "@/components/ward-management/ward-admissions";
import { dayOf, MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";

const NOW = 3 * MINUTES_PER_DAY + 10 * 60;

const DRAFT: PlannedAdmissionDraft = {
  who: "initials",
  patientId: "",
  initials: "AB",
  sex: "Female",
  reason: "respite",
  unitId: "fre-adult-open",
  dayOffset: 1,
  time: "09:30",
  stayDays: "7",
  legalStatus: "Voluntary",
  ageBand: "Adult",
};

describe("applyDraftPatch", () => {
  it("merges an edit into the open draft and leaves no draft as none", () => {
    expect(applyDraftPatch(DRAFT, { stayDays: "3" })).toEqual({ ...DRAFT, stayDays: "3" });
    expect(applyDraftPatch(null, { stayDays: "3" })).toBeNull();
  });
});

describe("clock input", () => {
  it("round-trips an instant's time of day and refuses what is not hh:mm", () => {
    expect(clockInputValue(MINUTES_PER_DAY + 9 * 60 + 5)).toBe("09:05");
    expect(parseClockInput("09:05")).toBe(9 * 60 + 5);
    expect(parseClockInput("24:00")).toBeNull();
    expect(parseClockInput("9:05")).toBeNull();
    expect(parseClockInput("")).toBeNull();
  });
});

describe("plannedDayOffsets", () => {
  it("lists today and the window ahead, and prepends an overdue booking's own past day", () => {
    const window = Array.from({ length: PLANNED_ADMISSION_WINDOW_DAYS }, (_, offset) => offset);
    expect(plannedDayOffsets(2)).toEqual(window);
    expect(plannedDayOffsets(-1)).toEqual([-1, ...window]);
  });
});

describe("draftTiming", () => {
  it("turns the day, time and stay into the arrival instant and whole days", () => {
    expect(draftTiming(DRAFT, NOW)).toEqual({
      ok: true,
      expectedArrivalAt: (dayOf(NOW) + 1) * MINUTES_PER_DAY + 9 * 60 + 30,
      expectedStayDays: 7,
    });
  });

  it("keeps an overdue booking's past day rather than moving it to today", () => {
    const timing = draftTiming({ ...DRAFT, dayOffset: -1 }, NOW);
    expect(timing.ok && timing.expectedArrivalAt).toBe((dayOf(NOW) - 1) * MINUTES_PER_DAY + 9 * 60 + 30);
  });

  it("refuses a time that is not hh:mm", () => {
    expect(draftTiming({ ...DRAFT, time: "" }, NOW)).toEqual({
      ok: false,
      refusal: "Enter the arrival time as hh:mm.",
    });
  });

  it("refuses a stay that is not a whole number of days in range, never sending NaN", () => {
    for (const stayDays of ["", "abc", "2.5", "0", "-3", "1e2", "366"]) {
      const timing = draftTiming({ ...DRAFT, stayDays }, NOW);
      expect(timing.ok).toBe(false);
      expect(!timing.ok && timing.refusal).toMatch(
        /^Enter the expected stay as a whole number of days from 1 to \d+\.$/,
      );
    }
    expect(draftTiming({ ...DRAFT, stayDays: " 14 " }, NOW)).toMatchObject({ ok: true, expectedStayDays: 14 });
  });
});
