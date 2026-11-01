"use client";

import { useMemo, type ReactNode } from "react";
import { BedDouble, ClipboardCheck, Clock, NotebookPen, Route, Truck, UserX } from "lucide-react";

import { tableClasses } from "@/components/wf";
import { useSmallNumber } from "@/components/ward-management/shell/ward-access";
import { splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { StatCard } from "../statistics/statistics-hero";
import { PhoneCard, PhoneFacts, PhoneGroup } from "../statistics/statistics-phone-parts";

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
import styles from "./reports.module.css";
import weekly from "./weekly-report.module.css";

type Figure = { id: string; label: string; value: ReactNode; note?: string; testId?: string };
type ReportCount = StatisticsCount;
type ReportDuration = Omit<DurationSummary, "sampleSize" | "population" | "median" | "p90"> & {
  sampleSize: ReportCount;
  population: ReportCount;
  median: number | null | undefined;
  p90: number | null | undefined;
};

function exactCount(value: ReportCount): number | undefined {
  return exactStatisticsCount(value) ?? undefined;
}

/** A typical time, or why there is none, always with its sample (owner ruling, 30 Aug 2026). */
function durationFigures(
  summary: ReportDuration,
  what: string,
  empty = `No ${what} this week`,
): { typical: Figure; slow: Figure } {
  const sample = `from ${reportCount(summary.sampleSize)} of ${reportCount(summary.population)} ${what}`;
  if (summary.median == null || summary.p90 == null) {
    // "from 0 of 0 beds pulled" read as a broken figure, so an empty week says so plainly.
    const note = exactCount(summary.population) === 0 ? empty : `${sample}, not enough data to publish`;
    return {
      typical: { id: "typical", label: "Typical", value: "—", note },
      slow: { id: "slow", label: "Slowest 1 in 10", value: "—" },
    };
  }
  return {
    typical: { id: "typical", label: "Typical", value: splitDuration(summary.median), note: sample },
    slow: { id: "slow", label: "Slowest 1 in 10", value: splitDuration(summary.p90) },
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

function Card({
  isPhone,
  icon,
  title,
  meta,
  figures,
  testId,
}: {
  isPhone: boolean;
  icon: typeof Clock;
  title: string;
  meta: string;
  figures: Figure[];
  testId: string;
}) {
  if (isPhone) {
    return (
      <PhoneCard icon={icon} title={title} aside={meta}>
        <PhoneFacts
          flush
          facts={figures.map((figure) => ({
            id: figure.id,
            label: figure.label,
            note: figure.note,
            value: figure.value,
            testId: figure.testId,
          }))}
        />
      </PhoneCard>
    );
  }
  // on a wider screen each measure is a group of rows in one table, a row per figure.
  return (
    <tbody data-testid={testId} className={weekly.measureGroup}>
      {figures.map((figure, index) => (
        <tr key={figure.id}>
          {index === 0 ? (
            <th scope="rowgroup" rowSpan={figures.length} className={weekly.measureName}>
              <span className={weekly.measureTitle}>{title}</span>
              <span className={weekly.measureMeta}>{meta}</span>
            </th>
          ) : null}
          <td>{figure.label}</td>
          <td className={styles.num} data-testid={figure.testId}>
            {figure.value}
          </td>
          <td className={styles.muted}>{figure.note ?? ""}</td>
        </tr>
      ))}
    </tbody>
  );
}

/**
 * PILOT MEASURES — the four success measures Josh agreed on 24 Oct 2026 (decision A35), then the
 * supporting figures, from `pilotMeasures`. Measures 2 and 4 are counted on paper and say so.
 * Counts of people follow the small number rule for an executive (`useSmallNumber`); times and
 * beds stay exact.
 */
export function PilotMeasuresSection({
  movements,
  referrals,
  patients,
  now,
  pullHoldMinutes,
  units,
  morningRollupConfirmations,
  morningRollupDeadlineMinutes,
  week,
  isPhone,
}: {
  movements: readonly Movement[];
  referrals: readonly Referral[];
  patients: readonly Patient[];
  now: Instant;
  pullHoldMinutes: number;
  units: readonly Pick<Unit, "id">[];
  morningRollupConfirmations: PilotMeasuresInput["morningRollupConfirmations"];
  morningRollupDeadlineMinutes: number;
  week: ReportWeek;
  isPhone: boolean;
}) {
  const measures = useMemo(
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
  return <PilotMeasuresView measures={measures} isPhone={isPhone} />;
}

const STEP_LABELS = {
  ask: "Request raised to first ward asked",
  answer: "First ward asked to a ward accepting",
  hold: "Ward accepting to bed pulled",
  leave: "Bed pulled to leaving the ED",
  travel: "Leaving the ED to arriving on the ward",
};

/** The same cards and print content for operational selectors and the row-free executive DTO. */
export function PilotMeasuresView({
  measures,
  isPhone,
}: {
  measures: PilotMeasures | ExecutiveReportingWeek["pilot"];
  isPhone: boolean;
}) {
  const small = useSmallNumber();
  const person = (value: ReportCount) => (typeof value === "number" ? small(value) : reportCount(value));
  const toArrival = durationFigures(measures.requestToArrival, "arrivals");
  const held = durationFigures(measures.requestToBedHeld, "beds pulled");
  const travel = durationFigures(measures.transport.collectedToArrived, "arrivals by transport");
  const { requests, holds, transport, completeness, bedFigures } = measures;
  // A rate is worked back into the count it hides, so a person-derived rate shows only when
  // neither count behind it is held back by the small number rule.
  const shown = (...counts: ReportCount[]) =>
    counts.every((count) => exactCount(count) !== undefined && person(count) === exactCount(count));
  const personRate = (count: ReportCount, of: ReportCount) => (shown(count, of) ? rateNote(count, of) : undefined);
  const completePercent = shown(completeness.complete, completeness.arrivals)
    ? per100(exactCount(completeness.complete)!, exactCount(completeness.arrivals)!)
    : undefined;

  const cards = [
    <Card
      key="arrival"
      isPhone={isPhone}
      icon={Clock}
      title="Referral to arrival"
      meta="Measure 1"
      testId="ward-pilot-arrival"
      figures={[{ ...toArrival.typical, testId: "ward-pilot-arrival-typical" }, toArrival.slow]}
    />,
    <Card
      key="bed-figures"
      isPhone={isPhone}
      icon={BedDouble}
      title="Bed figures on time"
      meta="Measure 3 · today"
      testId="ward-pilot-bed-figures"
      figures={[
        {
          id: "on-time",
          label: `Confirmed by ${clockText(bedFigures.deadlineMinutes)}`,
          value: `${bedFigures.onTime} of ${bedFigures.wards}`,
          note: `${bedFigures.confirmedToday} confirmed today`,
          testId: "ward-pilot-bed-figures-on-time",
        },
      ]}
    />,
    <Card
      key="held"
      isPhone={isPhone}
      icon={Clock}
      title="Request to bed pulled"
      meta="Supporting"
      testId="ward-pilot-held"
      figures={[{ ...held.typical, testId: "ward-pilot-held-typical" }, held.slow]}
    />,
    <Card
      key="requests"
      isPhone={isPhone}
      icon={UserX}
      title="Missed requests"
      meta={`Supporting · ${person(requests.raised)} raised`}
      testId="ward-pilot-requests"
      figures={[
        {
          id: "missed",
          label: `No ward in ${windowText(requests.windowMinutes)}`,
          value: person(requests.noWardAsked),
          note: personRate(requests.noWardAsked, requests.raised),
          testId: "ward-pilot-missed",
        },
        {
          id: "duplicates",
          label: "Same person twice",
          value: person(requests.duplicates),
          note: personRate(requests.duplicates, requests.raised),
          testId: "ward-pilot-duplicates",
        },
      ]}
    />,
    <Card
      key="holds"
      isPhone={isPhone}
      icon={BedDouble}
      title="Bed pulls"
      meta={`${reportCount(holds.held)} pulled`}
      testId="ward-pilot-holds"
      figures={[
        {
          id: "ran-out",
          label: "Ran out",
          value: reportCount(holds.ranOut),
          note: rateNote(holds.ranOut, holds.held),
          testId: "ward-pilot-holds-ran-out",
        },
        {
          id: "given-back",
          label: "Given back",
          value: reportCount(holds.givenBack),
          note: rateNote(holds.givenBack, holds.held),
        },
      ]}
    />,
    <Card
      key="transport"
      isPhone={isPhone}
      icon={Truck}
      title="Transport"
      meta={`${reportCount(transport.collections)} collected`}
      testId="ward-pilot-transport"
      figures={[
        {
          id: "late",
          label: `Over ${windowText(CLINICAL_VALUES.lateArrivalGrace.value)} late`,
          value: reportCount(transport.lateCollections),
          note: rateNote(transport.lateCollections, transport.collections),
          testId: "ward-pilot-transport-late",
        },
        { ...travel.typical, label: "Travel, typical" },
        { id: "cancelled", label: "Cancelled", value: reportCount(transport.cancelled) },
      ]}
    />,
    <Card
      key="complete"
      isPhone={isPhone}
      icon={ClipboardCheck}
      title="Records complete"
      meta={`${person(completeness.arrivals)} arrivals`}
      testId="ward-pilot-complete"
      figures={[
        {
          id: "complete",
          label: "Every step timed",
          value: completePercent === undefined ? "—" : `${completePercent}%`,
          note: `${person(completeness.complete)} of ${person(completeness.arrivals)}`,
          testId: "ward-pilot-complete-percent",
        },
      ]}
    />,
  ];

  const stepRows = measures.steps.map((step) => {
    const figures = durationFigures(step.summary, "finished", "None finished this week");
    return {
      id: step.id,
      label: "label" in step ? step.label : STEP_LABELS[step.id],
      typical: figures.typical.value,
      note: figures.typical.note,
    };
  });

  // the two measures counted outside Ward Flow are said in words, not set as figures.
  const outside = (
    <ul className={weekly.outsideList} data-testid="ward-pilot-paper">
      <li>
        <b>Calls per placed referral</b> (measure 2) are counted on a paper tally.
      </li>
      <li>
        <b>Wrong-patient and lost changes</b> (measure 4) are counted through the incident route.
      </li>
    </ul>
  );

  const disclosure = (
    <p className={styles.disclosure}>
      Counted from recorded times. Bed figures are today&apos;s only. Targets are proposals. Transport is measured
      against the estimate. ED waits with no bed request are not counted.
    </p>
  );

  if (isPhone) {
    return (
      <section aria-labelledby="ward-pilot-heading" data-testid="ward-pilot-measures">
        <h2 id="ward-pilot-heading" className={styles.sectionHeading}>
          Pilot measures
        </h2>
        {cards.slice(0, 2)}
        <PhoneCard icon={NotebookPen} title="Counted outside Ward Flow" aside="Measures 2 and 4">
          {outside}
        </PhoneCard>
        {cards.slice(2)}
        <PhoneGroup title="Where the time goes" aside="Typical time per step">
          <PhoneFacts
            flush
            label="Where the time goes"
            facts={stepRows.map((row) => ({
              id: row.id,
              label: row.label,
              note: row.note,
              value: row.typical,
            }))}
          />
        </PhoneGroup>
        {disclosure}
      </section>
    );
  }

  return (
    <section aria-labelledby="ward-pilot-heading" className={styles.section} data-testid="ward-pilot-measures">
      <h2 id="ward-pilot-heading" className={styles.sectionHeading}>
        Pilot measures
      </h2>
      <div className={weekly.pilotGrid}>
        <StatCard title="Measures this week" icon={ClipboardCheck} meta="Agreed measures, then supporting">
          <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Pilot measures, scrollable table">
            <table className={`${tableClasses.table} ${styles.table} ${weekly.measureTable}`}>
              <caption className={styles.srOnly}>Pilot measures for the week, synthetic</caption>
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col">Figure</th>
                  <th scope="col" className={styles.num}>
                    Value
                  </th>
                  <th scope="col">Detail</th>
                </tr>
              </thead>
              {cards}
            </table>
          </div>
        </StatCard>
        <div className={weekly.pilotSide}>
          <StatCard title="Counted outside Ward Flow" icon={NotebookPen} meta="Measures 2 and 4">
            {outside}
          </StatCard>
          <StatCard title="Where the time goes" icon={Route} meta="Typical per step" data-testid="ward-pilot-steps">
            <ul className={styles.reasons}>
              {stepRows.map((row) => (
                <li key={row.id}>
                  <span>
                    {row.label}
                    <span className={styles.stepNote}> · {row.note}</span>
                  </span>
                  <span className={styles.num}>{row.typical}</span>
                </li>
              ))}
            </ul>
          </StatCard>
        </div>
      </div>
      {disclosure}
    </section>
  );
}
