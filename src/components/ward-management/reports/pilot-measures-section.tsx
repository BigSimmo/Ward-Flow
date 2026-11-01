"use client";

import { useMemo } from "react";

import { useSmallNumber } from "@/components/ward-management/shell/ward-access";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import type { Unit } from "@/components/ward-management/ward-model";

import type { ExecutiveReportingWeek } from "../statistics/executive-statistics-contract";
import {
  statisticsCountText as reportCount,
  exactStatisticsCount,
  type StatisticsCount,
} from "../statistics/statistics-small-numbers";
import {
  per100,
  pilotMeasures,
  type DurationSummary,
  type PilotMeasures,
  type PilotMeasuresInput,
} from "./pilot-measures";
import type { ReportWeek } from "./weekly-report";

type ReportCount = StatisticsCount;
type ReportDuration = Omit<DurationSummary, "sampleSize" | "population" | "median" | "p90"> & {
  sampleSize: ReportCount;
  population: ReportCount;
  median: number | null | undefined;
  p90: number | null | undefined;
};

/** The pilot measures of one week, from the operational selector or the row-free executive DTO. */
export type WeeklyPilot = PilotMeasures | ExecutiveReportingWeek["pilot"];

function exactCount(value: ReportCount): number | undefined {
  return exactStatisticsCount(value) ?? undefined;
}

/** A typical time, or why there is none, always with its sample (owner ruling, 30 Aug 2026). */
export type DurationFigure = {
  typical: string;
  slow: string;
  /** Typical minutes, for a bar; `null` when there is no figure to publish. */
  minutes: number | null;
  note: string;
};

function durationFigure(summary: ReportDuration, what: string, empty = `No ${what} this week`): DurationFigure {
  const sample = `from ${reportCount(summary.sampleSize)} of ${reportCount(summary.population)} ${what}`;
  if (summary.median == null || summary.p90 == null) {
    // "from 0 of 0 beds pulled" read as a broken figure, so an empty week says so plainly.
    const note = exactCount(summary.population) === 0 ? empty : `${sample}, not enough data to publish`;
    return { typical: "—", slow: "—", minutes: null, note };
  }
  return {
    typical: splitDuration(summary.median),
    slow: splitDuration(summary.p90),
    minutes: summary.median,
    note: sample,
  };
}

/** A window from the clinical values, in whole hours where it is one ("2h"), never typed here. */
function windowText(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : splitDuration(minutes);
}

/** A configured time of day ("09:30"), from minutes after midnight. */
function clockText(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function rateNote(count: ReportCount, of: ReportCount): string | undefined {
  const numerator = exactCount(count);
  const denominator = exactCount(of);
  if (numerator === undefined || denominator === undefined) return undefined;
  const rate = per100(numerator, denominator);
  return rate === undefined ? undefined : `${rate} per 100`;
}

const STEP_LABELS = {
  ask: "Request raised to first ward asked",
  answer: "First ward asked to a ward accepting",
  hold: "Ward accepting to bed pulled",
  leave: "Bed pulled to leaving the ED",
  travel: "Leaving the ED to arriving on the ward",
};

/** A count shown, and whether it is a real count above zero (for the warning glyph). */
type ShownCount = { text: number | string; positive: boolean };

function shownCount(text: number | string, value: ReportCount): ShownCount {
  const exact = exactCount(value);
  return { text, positive: exact === undefined ? text !== 0 && text !== "0" : exact > 0 };
}

/**
 * The pilot measures (decision A35) as the words and figures the Weekly page prints. Counts of
 * people follow the small number rule for an executive (`useSmallNumber`); times and beds stay
 * exact, and a person-derived rate shows only when neither count behind it is held back.
 */
export function usePilotFigures(measures: WeeklyPilot) {
  const small = useSmallNumber();
  const person = (value: ReportCount) => (typeof value === "number" ? small(value) : reportCount(value));
  const shown = (...counts: ReportCount[]) =>
    counts.every((count) => exactCount(count) !== undefined && person(count) === exactCount(count));
  const personRate = (count: ReportCount, of: ReportCount) => (shown(count, of) ? rateNote(count, of) : undefined);
  const { requests, holds, transport, completeness, bedFigures } = measures;
  const completePercent = shown(completeness.complete, completeness.arrivals)
    ? per100(exactCount(completeness.complete)!, exactCount(completeness.arrivals)!)
    : undefined;
  const steps = measures.steps.map((step) => ({
    id: step.id,
    label: "label" in step ? String(step.label) : STEP_LABELS[step.id],
    ...durationFigure(step.summary, "finished", "None finished this week"),
  }));
  const timed = steps.filter((step) => step.minutes !== null);
  const longest = timed.length
    ? timed.reduce((best, step) => (step.minutes! > best.minutes! ? step : best))
    : undefined;
  return {
    arrival: {
      ...durationFigure(measures.requestToArrival, "arrivals"),
      arrivals: person(measures.requestToArrival.population),
    },
    bedFigures: {
      onTime: bedFigures.onTime,
      wards: bedFigures.wards,
      notYet: Math.max(0, bedFigures.wards - bedFigures.confirmedToday),
      confirmedToday: bedFigures.confirmedToday,
      deadline: clockText(bedFigures.deadlineMinutes),
    },
    held: durationFigure(measures.requestToBedHeld, "beds pulled"),
    steps,
    longestStepId: longest?.id,
    requests: {
      raised: person(requests.raised),
      window: windowText(requests.windowMinutes),
      missed: shownCount(person(requests.noWardAsked), requests.noWardAsked),
      missedRate: personRate(requests.noWardAsked, requests.raised),
      duplicates: shownCount(person(requests.duplicates), requests.duplicates),
      duplicatesRate: personRate(requests.duplicates, requests.raised),
    },
    holds: {
      held: reportCount(holds.held),
      ranOut: shownCount(reportCount(holds.ranOut), holds.ranOut),
      ranOutRate: rateNote(holds.ranOut, holds.held),
      givenBack: reportCount(holds.givenBack),
    },
    transport: {
      lateWindow: windowText(CLINICAL_VALUES.lateArrivalGrace.value),
      late: shownCount(reportCount(transport.lateCollections), transport.lateCollections),
      collections: reportCount(transport.collections),
      cancelled: reportCount(transport.cancelled),
      travel: durationFigure(transport.collectedToArrived, "arrivals by transport"),
    },
    complete: {
      percent: completePercent === undefined ? "—" : `${completePercent}%`,
      complete: person(completeness.complete),
      arrivals: person(completeness.arrivals),
    },
  };
}

export type PilotFigures = ReturnType<typeof usePilotFigures>;

/** The operational desk's pilot measures for one week, from the live synthetic world. */
export function useOperationalPilot(
  input: Omit<PilotMeasuresInput, "units"> & { units: readonly Pick<Unit, "id">[] },
  week: ReportWeek,
): PilotMeasures {
  const {
    movements,
    referrals,
    patients,
    now,
    pullHoldMinutes,
    units,
    morningRollupConfirmations,
    morningRollupDeadlineMinutes,
  } = input;
  return useMemo(
    () =>
      pilotMeasures(
        {
          movements,
          referrals,
          patients,
          now,
          pullHoldMinutes,
          units,
          morningRollupConfirmations,
          morningRollupDeadlineMinutes,
        },
        week,
      ),
    [
      movements,
      referrals,
      patients,
      now,
      pullHoldMinutes,
      units,
      morningRollupConfirmations,
      morningRollupDeadlineMinutes,
      week,
    ],
  );
}
