import type { Instant } from "@/components/ward-management/ward-clock";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { MINIMUM_EFFECTIVENESS_SAMPLE } from "@/components/ward-management/ward-derivations-records";
import { movementPersonId } from "@/components/ward-management/coordinator/missed-requests-check";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";

import type { ReportWeek } from "./weekly-report";

/**
 * PILOT MEASURES — the success measures Josh agreed for a pilot (product brief, "Success measures",
 * 25 Sep 2026), counted for one report week from the times this prototype already records.
 * Read-only: nothing new is stored.
 *
 * Each figure counts only what the record holds. A movement missing a time is left out of that
 * figure and the sample says so ("from 3 of 9"), the same discipline as `effectivenessNumbers`.
 * Below `MINIMUM_EFFECTIVENESS_SAMPLE` a typical time is not published (owner ruling, 30 Aug 2026):
 * the median and 90th percentile come back `undefined`, with the sample still stated.
 *
 * These measure the system, not a clinician or a ward. Nothing here ranks a person or a ward.
 */

export type DurationSummary = {
  /** Middle value, minutes. `undefined` below the sample floor or with nothing to count. */
  median: number | undefined;
  /** The wait only one in ten exceeds (nearest rank), minutes. Same floor as `median`. */
  p90: number | undefined;
  /** How many records had both times. */
  sampleSize: number;
  /** How many records the figure is about, with or without both times. */
  population: number;
};

export type PilotStepId = "ask" | "answer" | "hold" | "leave" | "travel";

export type PilotStep = { id: PilotStepId; label: string; summary: DurationSummary };

export type PilotMeasures = {
  week: ReportWeek;
  /** Measure 1: request raised to a bed held, for beds first held in the week. */
  requestToBedHeld: DurationSummary;
  /** Where the time goes: each step's typical time, counted in the week the step finished. */
  steps: PilotStep[];
  /** Measure 2: bed requests raised in the week. */
  requests: {
    raised: number;
    /** No ward asked within `missedRequestWindow` of the request being raised. */
    noWardAsked: number;
    /** The same person already had another open bed request when this one was raised. */
    duplicates: number;
    /** The window used for `noWardAsked`, minutes. */
    windowMinutes: number;
  };
  /** Supporting measure 5: beds held in the week, and how many ran out or were given back. */
  holds: { held: number; ranOut: number; givenBack: number };
  /** Supporting measure 6: transport in the week. */
  transport: {
    collectedToArrived: DurationSummary;
    /** Collections more than `lateArrivalGrace` after the estimated time. */
    lateCollections: number;
    collections: number;
    cancelled: number;
  };
  /** Supporting measure 7: arrivals in the week with every step time recorded. */
  completeness: { arrivals: number; complete: number };
};

export type PilotMeasuresInput = {
  movements: readonly Movement[];
  referrals: readonly Referral[];
  patients: readonly Patient[];
  now: Instant;
};

function inWeek(at: Instant | null | undefined, week: ReportWeek): at is Instant {
  return typeof at === "number" && Number.isFinite(at) && at >= week.start && at < week.countedEnd;
}

/** Nearest-rank percentile of a sorted list. */
function percentile(sorted: readonly number[], fraction: number): number {
  const rank = Math.max(1, Math.ceil(fraction * sorted.length));
  return sorted[Math.min(sorted.length, rank) - 1];
}

/** A typical time from `durations`, published only at or above the sample floor. */
export function summariseDurations(durations: readonly number[], population: number): DurationSummary {
  const sorted = durations.filter((minutes) => Number.isFinite(minutes) && minutes >= 0).sort((a, b) => a - b);
  const enough = sorted.length >= MINIMUM_EFFECTIVENESS_SAMPLE;
  const middle = sorted.length / 2;
  const median = sorted.length % 2 === 1 ? sorted[Math.floor(middle)] : (sorted[middle - 1] + sorted[middle]) / 2;
  return {
    median: enough ? Math.round(median) : undefined,
    p90: enough ? percentile(sorted, 0.9) : undefined,
    sampleSize: sorted.length,
    population,
  };
}

/** The first time this movement reached `stage`, from its recorded stage changes. */
function firstReached(movement: Movement, stage: Movement["stage"]): Instant | undefined {
  return movement.stageChanges.find((change) => change.to === stage)?.at;
}

/** When the person left the ED: the recorded departure, else the first move to "moving". */
function leftEd(movement: Movement): Instant | undefined {
  return movement.leftDepartmentAt ?? firstReached(movement, "moving");
}

/** When the person arrived: the transport's arrival, else the move to "arrived", else an arrived closure. */
function arrived(movement: Movement): Instant | undefined {
  return (
    movement.transport?.arrivedAt ??
    firstReached(movement, "arrived") ??
    (movement.closure?.outcome === "arrived" ? movement.closure.at : undefined)
  );
}

/** Minutes from `from` to `to` when both are known and in order. */
function between(from: Instant | undefined, to: Instant | undefined): number | undefined {
  if (from === undefined || to === undefined || to < from) return undefined;
  return to - from;
}

/** A step counted in the week its end falls in. */
function stepSummary(
  movements: readonly Movement[],
  week: ReportWeek,
  start: (movement: Movement) => Instant | undefined,
  end: (movement: Movement) => Instant | undefined,
): DurationSummary {
  const finished = movements.filter((movement) => inWeek(end(movement), week));
  const durations = finished
    .map((movement) => between(start(movement), end(movement)))
    .filter((minutes): minutes is number => minutes !== undefined);
  return summariseDurations(durations, finished.length);
}

/** An open bed request at `at`: raised by then and not yet closed or arrived. */
function openAt(movement: Movement, at: Instant): boolean {
  if (movement.openedAt > at) return false;
  const closedAt = movement.closure?.at ?? arrived(movement);
  return closedAt === undefined || closedAt > at;
}

export function pilotMeasures(input: PilotMeasuresInput, week: ReportWeek): PilotMeasures {
  const { movements, referrals, patients, now } = input;
  const records = { movements, referrals, patients };
  const windowMinutes = CLINICAL_VALUES.missedRequestWindow.value;
  const graceMinutes = CLINICAL_VALUES.lateArrivalGrace.value;

  // Measure 1: request raised to bed first held, for holds made in the week.
  const heldInWeek = movements.filter((movement) => inWeek(firstReached(movement, "pulled"), week));
  const requestToBedHeld = summariseDurations(
    heldInWeek
      .map((movement) => between(movement.openedAt, firstReached(movement, "pulled")))
      .filter((minutes): minutes is number => minutes !== undefined),
    heldInWeek.length,
  );

  const steps: PilotStep[] = [
    {
      id: "ask",
      label: "Request raised to first ward asked",
      summary: stepSummary(
        movements,
        week,
        (m) => m.openedAt,
        (m) => m.referredAt,
      ),
    },
    {
      id: "answer",
      label: "First ward asked to a ward accepting",
      summary: stepSummary(
        movements,
        week,
        (m) => m.referredAt,
        (m) => m.acceptedAt,
      ),
    },
    {
      id: "hold",
      label: "Ward accepting to bed held",
      summary: stepSummary(
        movements,
        week,
        (m) => m.acceptedAt,
        (m) => firstReached(m, "pulled"),
      ),
    },
    {
      id: "leave",
      label: "Bed held to leaving the ED",
      summary: stepSummary(movements, week, (m) => firstReached(m, "pulled"), leftEd),
    },
    {
      id: "travel",
      label: "Leaving the ED to arriving on the ward",
      summary: stepSummary(movements, week, leftEd, arrived),
    },
  ];

  // Measure 2: requests raised in the week.
  const raised = movements.filter((movement) => inWeek(movement.openedAt, week));
  const noWardAsked = raised.filter((movement) => {
    const due = movement.openedAt + windowMinutes;
    // Too early to say: the window has not closed by the end of the counted week.
    if (due > week.countedEnd) return false;
    return movement.referredAt === undefined || movement.referredAt > due;
  }).length;
  const duplicates = raised.filter((movement) => {
    const personId = movementPersonId(movement, records);
    return (
      personId !== undefined &&
      movements.some(
        (other) =>
          other.id !== movement.id &&
          other.openedAt <= movement.openedAt &&
          openAt(other, movement.openedAt) &&
          movementPersonId(other, records) === personId,
      )
    );
  }).length;

  // Supporting measure 5: holds. A hold "ran out" when the person had not left the ED by the time
  // it lapsed; "given back" is a recorded release of the held bed.
  const ranOut = heldInWeek.filter((movement) => {
    const expires = movement.pullExpiresAt;
    if (expires === undefined) return false;
    const left = leftEd(movement);
    return left === undefined ? expires < Math.min(now, week.countedEnd) : left > expires;
  }).length;
  const givenBack = movements.reduce(
    (count, movement) =>
      count + movement.unwinds.filter((unwind) => unwind.kind === "pull_released" && inWeek(unwind.at, week)).length,
    0,
  );

  // Supporting measure 6: transport. Ward Flow records no booking time, so booked-to-collected
  // cannot be counted; lateness is measured against the estimate instead.
  const jobs = movements.map((movement) => movement.transport).filter((job) => job !== undefined);
  const collectedInWeek = jobs.filter((job) => inWeek(job.collectedAt, week));
  const lateCollections = collectedInWeek.filter(
    (job) =>
      job.estimatedAt !== undefined &&
      job.collectedAt !== undefined &&
      job.collectedAt - job.estimatedAt > graceMinutes,
  ).length;
  const arrivedJobs = jobs.filter((job) => inWeek(job.arrivedAt, week));
  const collectedToArrived = summariseDurations(
    arrivedJobs
      .map((job) => between(job.collectedAt, job.arrivedAt))
      .filter((minutes): minutes is number => minutes !== undefined),
    arrivedJobs.length,
  );
  const cancelled = jobs.filter((job) => inWeek(job.cancelledAt, week)).length;

  // Supporting measure 7: arrivals in the week with every step time recorded.
  const arrivals = movements.filter((movement) => inWeek(arrived(movement), week));
  const complete = arrivals.filter(
    (movement) =>
      movement.referredAt !== undefined &&
      movement.acceptedAt !== undefined &&
      firstReached(movement, "pulled") !== undefined &&
      leftEd(movement) !== undefined,
  ).length;

  return {
    week,
    requestToBedHeld,
    steps,
    requests: { raised: raised.length, noWardAsked, duplicates, windowMinutes },
    holds: { held: heldInWeek.length, ranOut, givenBack },
    transport: {
      collectedToArrived,
      lateCollections,
      collections: collectedInWeek.length,
      cancelled,
    },
    completeness: { arrivals: arrivals.length, complete },
  };
}

/** A rate per 100, whole number. `undefined` with nothing to divide by. */
export function per100(count: number, of: number): number | undefined {
  return of > 0 ? Math.round((count / of) * 100) : undefined;
}
