// src/components/ward-management/capacity/planned-admissions-draft.ts
//
// The booking form's draft and the pure steps the planned admissions panel takes with it: apply
// an edit, list the day options, and turn the typed day, time and stay into event fields. Kept out
// of the component so each step is tested on its own.
import {
  isPlannedAdmissionStayDays,
  PLANNED_ADMISSION_MAX_STAY_DAYS,
  PLANNED_ADMISSION_WINDOW_DAYS,
  type PlannedAdmissionReason,
} from "../ward-admissions";
import { dayOf, MINUTES_PER_DAY, minuteOfDay, type Instant } from "../ward-clock";
import type { Cohort, LegalStatus, RecordedSex } from "../ward-model";

export type PlannedAdmissionDraft = {
  who: "patient" | "initials";
  patientId: string;
  initials: string;
  sex: RecordedSex;
  reason: PlannedAdmissionReason;
  unitId: string;
  /** Days from today. Negative only when an overdue booking is being changed. */
  dayOffset: number;
  time: string;
  stayDays: string;
  legalStatus: LegalStatus;
  /** Recorded for an initials-only booking; derived from the record for a linked patient. */
  ageBand: Cohort;
};

/** Merges an edit into the open draft; with no draft open there is nothing to change. */
export function applyDraftPatch(
  current: PlannedAdmissionDraft | null,
  patch: Partial<PlannedAdmissionDraft>,
): PlannedAdmissionDraft | null {
  return current ? { ...current, ...patch } : current;
}

/** The "hh:mm" value a time input needs. Never displayed as text: rows use formatInstantWithDay. */
export function clockInputValue(instant: Instant): string {
  const minute = minuteOfDay(instant);
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

/** Minutes past midnight for a typed "hh:mm", or null when it is not a clock time. */
export function parseClockInput(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/**
 * The day options: today and the window ahead, plus the booking's own past day when an overdue
 * booking is changed, so opening and saving it never moves the arrival to today.
 */
export function plannedDayOffsets(currentOffset: number): number[] {
  const window = Array.from({ length: PLANNED_ADMISSION_WINDOW_DAYS }, (_, offset) => offset);
  return currentOffset < 0 ? [currentOffset, ...window] : window;
}

export type DraftTiming =
  { ok: true; expectedArrivalAt: Instant; expectedStayDays: number } | { ok: false; refusal: string };

/** The arrival instant and stay the draft names, or the sentence that says what to fix. */
export function draftTiming(draft: PlannedAdmissionDraft, now: Instant): DraftTiming {
  const minute = parseClockInput(draft.time);
  if (minute === null) return { ok: false, refusal: "Enter the arrival time as hh:mm." };
  const stay = /^\d+$/.test(draft.stayDays.trim()) ? Number(draft.stayDays.trim()) : Number.NaN;
  if (!isPlannedAdmissionStayDays(stay))
    return {
      ok: false,
      refusal: `Enter the expected stay as a whole number of days from 1 to ${PLANNED_ADMISSION_MAX_STAY_DAYS}.`,
    };
  return {
    ok: true,
    expectedArrivalAt: (dayOf(now) + draft.dayOffset) * MINUTES_PER_DAY + minute,
    expectedStayDays: stay,
  };
}
