import { describe, expect, it } from "vitest";
import {
  ARRIVAL_LATE_GRACE_MINUTES,
  ARRIVAL_PAST_ETA_AFTER_MINUTES,
  arrivalTiming,
  arrivalTimingIsLate,
  arrivalTimingWords,
  expectedArrival,
  type ArrivalTimingMovement,
} from "@/components/ward-management/ward-arrival-timing";
import { formatClockAmPm, formatClockAmPmWithDay } from "@/components/ward-management/ward-clock-am-pm";
import { formatInstantWithDay, MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import type { Movement } from "@/components/ward-management/ward-model";

/** Late arrivals (D-221): one arrival-timing state and one phrase for every desk. Synthetic only. */

type Job = NonNullable<Movement["transport"]>;

const ETA = 11 * 60 + 5; // 11:05 am on day 0

function journey(
  options: {
    wardEta?: number;
    bookingEta?: number;
    stage?: Movement["stage"];
    job?: Partial<Job>;
    closed?: boolean;
  } = {},
): ArrivalTimingMovement {
  const hasJob = options.bookingEta !== undefined || options.job !== undefined;
  return {
    stage: options.stage ?? "moving",
    closure: options.closed ? { at: 0, outcome: "did_not_proceed", reason: "synthetic" } : undefined,
    arrivalDetails:
      options.wardEta === undefined
        ? undefined
        : { mode: "hospital_transfer", estimatedArrivalAt: options.wardEta, recordedAt: 0, recordedBy: "ed" },
    transport: hasJob
      ? {
          id: "TR-SYN",
          provider: "Patient transport service",
          escortRequired: false,
          estimatedAt: options.bookingEta,
          ...options.job,
        }
      : undefined,
  } as ArrivalTimingMovement;
}

describe("the two values come from the clinical values table", () => {
  it("P068 10 minutes and the signed 60-minute grace", () => {
    expect(ARRIVAL_PAST_ETA_AFTER_MINUTES).toBe(CLINICAL_VALUES.bookingEstimatePassed.value);
    expect(ARRIVAL_LATE_GRACE_MINUTES).toBe(CLINICAL_VALUES.lateArrivalGrace.value);
    expect([ARRIVAL_PAST_ETA_AFTER_MINUTES, ARRIVAL_LATE_GRACE_MINUTES]).toEqual([10, 60]);
  });
});

describe("arrivalTiming: minutes from the ward ETA", () => {
  const table: [minutesFromEta: number, state: string][] = [
    [-30, "due"],
    [-1, "due"],
    [0, "due"],
    [9, "due"],
    [10, "past_eta"],
    [59, "past_eta"],
    [60, "past_eta"],
    [61, "late"],
    [1440, "late"],
  ];
  it.each(table)("%i minutes past the ETA is %s", (minutes, state) => {
    const timing = arrivalTiming(journey({ wardEta: ETA }), ETA + minutes);
    expect(timing.state).toBe(state);
    expect(arrivalTimingIsLate(journey({ wardEta: ETA }), ETA + minutes)).toBe(state === "late");
    if (timing.state === "none" || timing.state === "diverted") throw new Error("expected a timed state");
    expect(timing).toMatchObject({ eta: ETA, pastAt: ETA + 10, lateAt: ETA + 60, source: "ward" });
  });
});

describe("arrivalTiming: where the time comes from", () => {
  it("prefers the ward ETA over the booking estimate", () => {
    expect(expectedArrival(journey({ wardEta: ETA, bookingEta: ETA - 30 }))).toEqual({ at: ETA, source: "ward" });
  });

  it("falls back to the booking estimate when no ward ETA is recorded, and says so", () => {
    expect(expectedArrival(journey({ bookingEta: ETA }))).toEqual({ at: ETA, source: "booking" });
    expect(arrivalTiming(journey({ bookingEta: ETA }), ETA + 61)).toMatchObject({ state: "late", source: "booking" });
  });

  it("ignores the booking estimate of a cancelled or stopped job", () => {
    expect(expectedArrival(journey({ bookingEta: ETA, job: { cancelledAt: ETA - 5 } }))).toBeUndefined();
    expect(expectedArrival(journey({ bookingEta: ETA, job: { stoppedAt: ETA - 5 } }))).toBeUndefined();
  });

  it("is none with no time at all", () => {
    expect(arrivalTiming(journey(), ETA + 500)).toEqual({ state: "none" });
    expect(arrivalTiming(journey({ job: {} }), ETA + 500)).toEqual({ state: "none" });
  });
});

describe("arrivalTiming: arrived, closed and diverted", () => {
  it("is none once the stage is arrived", () => {
    expect(arrivalTiming(journey({ wardEta: ETA, stage: "arrived" }), ETA + 600)).toEqual({ state: "none" });
  });

  it("is none when transport marked arrived but the ward has not confirmed (D-221 item 6)", () => {
    const delivered = journey({ wardEta: ETA, job: { arrivedAt: ETA + 20 } });
    expect(arrivalTiming(delivered, ETA + 600)).toEqual({ state: "none" });
    expect(arrivalTimingIsLate(delivered, ETA + 600)).toBe(false);
  });

  it("is none once the journey is closed", () => {
    expect(arrivalTiming(journey({ wardEta: ETA, closed: true }), ETA + 600)).toEqual({ state: "none" });
  });

  it("diverted replaces late (D-221 item 7)", () => {
    const diverted = journey({
      wardEta: ETA,
      job: { diversion: { at: ETA + 30, by: "officer", place: "synthetic place", reason: "synthetic" } },
    });
    expect(arrivalTiming(diverted, ETA + 600)).toEqual({ state: "diverted", at: ETA + 30 });
    expect(arrivalTimingIsLate(diverted, ETA + 600)).toBe(false);
    expect(arrivalTimingWords(arrivalTiming(diverted, ETA + 600), ETA + 600)).toBeNull();
  });
});

describe("arrivalTimingWords: one phrase on every desk", () => {
  it.each([
    [ETA - 20, { line: "ETA 11:05 am", tone: "quiet" }],
    [ETA + 46, { line: "Past ETA 11:05 am · late at 12:05 pm", tone: "neutral" }],
    [ETA + 61, { tag: "Late arrival", line: "ETA 11:05 am · late since 12:05 pm", tone: "warning" }],
  ])("ward ETA at %i", (now, words) => {
    expect(arrivalTimingWords(arrivalTiming(journey({ wardEta: ETA }), now), now)).toEqual(words);
  });

  it.each([
    [ETA - 20, { line: "Booking estimate 11:05 am", tone: "quiet" }],
    [ETA + 46, { line: "Past booking estimate 11:05 am · late at 12:05 pm", tone: "neutral" }],
    [ETA + 61, { tag: "Late arrival", line: "Booking estimate 11:05 am · late since 12:05 pm", tone: "warning" }],
  ])("booking estimate at %i names its source", (now, words) => {
    expect(arrivalTimingWords(arrivalTiming(journey({ bookingEta: ETA }), now), now)).toEqual(words);
  });

  it("is null when there is nothing to say", () => {
    expect(arrivalTimingWords({ state: "none" }, ETA)).toBeNull();
  });

  it("carries the day across midnight (R-MOVE-15, B2d-Q-2)", () => {
    const lateEvening = 23 * 60 + 45;
    const beforeMidnight = lateEvening + 12;
    expect(
      arrivalTimingWords(arrivalTiming(journey({ wardEta: lateEvening }), beforeMidnight), beforeMidnight),
    ).toEqual({ line: "Past ETA 11:45 pm · late at 12:45 am tomorrow", tone: "neutral" });
    // The same journey read after midnight: the ETA is now yesterday's.
    const justAfterMidnight = MINUTES_PER_DAY + 20;
    expect(
      arrivalTimingWords(arrivalTiming(journey({ wardEta: lateEvening }), justAfterMidnight), justAfterMidnight),
    ).toEqual({ line: "Past ETA 11:45 pm yesterday · late at 12:45 am", tone: "neutral" });
    const afterMidnight = MINUTES_PER_DAY + 90;
    expect(arrivalTimingWords(arrivalTiming(journey({ wardEta: lateEvening }), afterMidnight), afterMidnight)).toEqual({
      tag: "Late arrival",
      line: "ETA 11:45 pm yesterday · late since 12:45 am",
      tone: "warning",
    });
  });
});

describe("formatClockAmPm", () => {
  it.each([
    [0, "12:00 am"],
    [59, "12:59 am"],
    [8 * 60, "8:00 am"],
    [11 * 60 + 5, "11:05 am"],
    [12 * 60, "12:00 pm"],
    [12 * 60 + 5, "12:05 pm"],
    [13 * 60, "1:00 pm"],
    [23 * 60 + 59, "11:59 pm"],
    [-1, "11:59 pm"],
    [MINUTES_PER_DAY + 65, "1:05 am"],
  ])("%i reads %s", (instant, text) => {
    expect(formatClockAmPm(instant)).toBe(text);
  });

  it("says the day with the same words as formatInstantWithDay", () => {
    const now = 3 * MINUTES_PER_DAY + 600;
    for (const instant of [
      now,
      now - MINUTES_PER_DAY,
      now + MINUTES_PER_DAY,
      now - 3 * MINUTES_PER_DAY,
      now + 2 * MINUTES_PER_DAY,
    ]) {
      const withDay = formatClockAmPmWithDay(instant, now);
      const twentyFour = formatInstantWithDay(instant, now);
      expect(withDay.slice(formatClockAmPm(instant).length)).toBe(twentyFour.slice(5));
    }
    expect(formatClockAmPmWithDay(now + MINUTES_PER_DAY, now)).toBe("10:00 am tomorrow");
    expect(formatClockAmPmWithDay(now - 2 * MINUTES_PER_DAY, now)).toBe("10:00 am, 2 days ago");
  });
});
