import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { formatClockAmPmWithDay } from "@/components/ward-management/ward-clock-am-pm";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * ONE ARRIVAL-TIMING STATE FOR EVERY DESK (Josh, 14 Nov 2026, ruling item 11; D-221).
 *
 * | State      | When                                                      |
 * |------------|-----------------------------------------------------------|
 * | `due`      | before the expected time plus `bookingEstimatePassed`     |
 * | `past_eta` | from expected + 10 minutes (P068, unsigned) to + 60       |
 * | `late`     | more than the signed `lateArrivalGrace` (60) past         |
 * | `diverted` | `transport.diversion` recorded and the journey still open |
 * | `none`     | no time, arrived (stage or transport), or closed          |
 *
 * The expected time is the ward ETA (`arrivalDetails.estimatedArrivalAt`), else the booking
 * estimate (`transport.estimatedAt`) of a live job, and the result names which (D-221 item 1).
 * Transport marked arrived but not yet confirmed by the ward is not late (item 6), and a diversion
 * replaces late (item 7). Both values are read from `CLINICAL_VALUES`; nothing new is invented.
 *
 * `past_eta` starts AT the P068 minute (as the Alerts row does today, `>=`); `late` starts AFTER
 * the grace (as `isArrivalLate` does today, `>`). Pure: `now` is always a parameter.
 */
export const ARRIVAL_PAST_ETA_AFTER_MINUTES = CLINICAL_VALUES.bookingEstimatePassed.value;
export const ARRIVAL_LATE_GRACE_MINUTES = CLINICAL_VALUES.lateArrivalGrace.value;

export type ArrivalTimeSource = "ward" | "booking";

export type ArrivalTiming =
  | { state: "none" }
  | { state: "diverted"; at: Instant }
  | {
      state: "due" | "past_eta" | "late";
      /** The expected arrival time the clock runs from. */
      eta: Instant;
      /** `eta` plus the P068 minutes: from here the row reads "Past ETA". */
      pastAt: Instant;
      /** `eta` plus the signed grace: after this minute the row reads "Late arrival". */
      lateAt: Instant;
      source: ArrivalTimeSource;
    };

export type ArrivalTimingMovement = Pick<Movement, "arrivalDetails" | "transport" | "stage" | "closure">;

/** The time the late clock runs from, and where it came from, or `undefined` when none is recorded. */
export function expectedArrival(
  movement: ArrivalTimingMovement,
): { at: Instant; source: ArrivalTimeSource } | undefined {
  const wardEta = movement.arrivalDetails?.estimatedArrivalAt;
  if (wardEta !== undefined) return { at: wardEta, source: "ward" };
  const job = movement.transport;
  if (!job || job.cancelledAt !== undefined || job.stoppedAt !== undefined) return undefined;
  return job.estimatedAt === undefined ? undefined : { at: job.estimatedAt, source: "booking" };
}

export function arrivalTiming(movement: ArrivalTimingMovement, now: Instant): ArrivalTiming {
  if (movement.closure !== undefined) return { state: "none" };
  if (movement.stage === "arrived" || movement.transport?.arrivedAt !== undefined) return { state: "none" };
  const diversion = movement.transport?.diversion;
  if (diversion !== undefined) return { state: "diverted", at: diversion.at };
  const expected = expectedArrival(movement);
  if (expected === undefined) return { state: "none" };
  const eta = expected.at;
  const pastAt = eta + ARRIVAL_PAST_ETA_AFTER_MINUTES;
  const lateAt = eta + ARRIVAL_LATE_GRACE_MINUTES;
  const state = now > lateAt ? "late" : now >= pastAt ? "past_eta" : "due";
  return { state, eta, pastAt, lateAt, source: expected.source };
}

/** The yes/no the old `isArrivalLate` callers need, from the one rule. */
export function arrivalTimingIsLate(movement: ArrivalTimingMovement, now: Instant): boolean {
  return arrivalTiming(movement, now).state === "late";
}

type ArrivalTimingTone = "quiet" | "neutral" | "warning";

export type ArrivalTimingWords = {
  /** A row tag, only when late. */
  tag?: string;
  line: string;
  tone: ArrivalTimingTone;
};

/**
 * THE ONE PHRASE for an arrival time, the same on every desk. Every time is am/pm and carries its
 * day when it is not `now`'s day ("late at 12:59 am tomorrow"). A booking estimate is named as one.
 *
 * `null` for `none`, and for `diverted`: the diverted words and ink are PR A's diversion row's,
 * not a second copy here (late spec section 1).
 */
export function arrivalTimingWords(timing: ArrivalTiming, now: Instant): ArrivalTimingWords | null {
  if (timing.state === "none" || timing.state === "diverted") return null;
  const label = timing.source === "ward" ? "ETA" : "Booking estimate";
  const eta = formatClockAmPmWithDay(timing.eta, now);
  const lateAt = formatClockAmPmWithDay(timing.lateAt, now);
  if (timing.state === "due") return { line: `${label} ${eta}`, tone: "quiet" };
  if (timing.state === "past_eta") {
    const pastLabel = timing.source === "ward" ? "Past ETA" : "Past booking estimate";
    return { line: `${pastLabel} ${eta} · late at ${lateAt}`, tone: "neutral" };
  }
  return { tag: "Late arrival", line: `${label} ${eta} · late since ${lateAt}`, tone: "warning" };
}
