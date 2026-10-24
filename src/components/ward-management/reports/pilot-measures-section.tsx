"use client";

import { useMemo, type ReactNode } from "react";
import { BedDouble, ClipboardCheck, Clock, Route, Truck, UserX } from "lucide-react";

import { useSmallNumber } from "@/components/ward-management/shell/ward-access";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { StatCard } from "@/components/ward-management/statistics/statistics-hero";
import { PhoneCard, PhoneFacts, PhoneGroup } from "@/components/ward-management/statistics/statistics-phone-parts";

import { per100, pilotMeasures, type DurationSummary } from "./pilot-measures";
import type { ReportWeek } from "./weekly-report";
import styles from "./reports.module.css";

type Figure = { id: string; label: string; value: ReactNode; note?: string; testId?: string };

/** A typical time, or why there is none, always with its sample (owner ruling, 30 Aug 2026). */
function durationFigures(
  summary: DurationSummary,
  what: string,
  empty = `No ${what} this week`,
): { typical: Figure; slow: Figure } {
  const sample = `from ${summary.sampleSize} of ${summary.population} ${what}`;
  if (summary.median === undefined || summary.p90 === undefined) {
    // "from 0 of 0 beds held" read as a broken figure, so an empty week says so plainly.
    const note = summary.population === 0 ? empty : `${sample}, not enough data to publish`;
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

function rateNote(count: number, of: number): string | undefined {
  const rate = per100(count, of);
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
            label: figure.note ? `${figure.label} (${figure.note})` : figure.label,
            value: figure.value,
            testId: figure.testId,
          }))}
        />
      </PhoneCard>
    );
  }
  return (
    <StatCard title={title} icon={icon} meta={meta} data-testid={testId}>
      <dl className={styles.figures}>
        {figures.map((figure) => (
          <div key={figure.id} className={styles.figure}>
            <dt>{figure.label}</dt>
            <dd data-testid={figure.testId}>{figure.value}</dd>
            {figure.note ? <dd className={styles.figureNote}>{figure.note}</dd> : null}
          </div>
        ))}
      </dl>
    </StatCard>
  );
}

/**
 * PILOT MEASURES — the week's figures for the success measures agreed for a pilot (product brief,
 * 25 Sep 2026), from `pilotMeasures`. Counts of people follow the small number rule for an
 * executive (`useSmallNumber`); times and beds stay exact.
 */
export function PilotMeasuresSection({
  movements,
  referrals,
  patients,
  now,
  pullHoldMinutes,
  week,
  isPhone,
}: {
  movements: readonly Movement[];
  referrals: readonly Referral[];
  patients: readonly Patient[];
  now: Instant;
  pullHoldMinutes: number;
  week: ReportWeek;
  isPhone: boolean;
}) {
  const small = useSmallNumber();
  const enabled = useWardFeatureFlag("pilot-measures");
  const measures = useMemo(
    () => pilotMeasures({ movements, referrals, patients, now, pullHoldMinutes }, week),
    [movements, referrals, patients, now, pullHoldMinutes, week],
  );
  if (!enabled) return null;
  const held = durationFigures(measures.requestToBedHeld, "beds held");
  const travel = durationFigures(measures.transport.collectedToArrived, "arrivals by transport");
  const { requests, holds, transport, completeness } = measures;
  // A rate is worked back into the count it hides, so a person-derived rate shows only when
  // neither count behind it is held back by the small number rule.
  const shown = (...counts: number[]) => counts.every((count) => small(count) === count);
  const personRate = (count: number, of: number) => (shown(count, of) ? rateNote(count, of) : undefined);
  const completePercent = shown(completeness.complete, completeness.arrivals)
    ? per100(completeness.complete, completeness.arrivals)
    : undefined;

  const cards = [
    <Card
      key="held"
      isPhone={isPhone}
      icon={Clock}
      title="Request to bed pulled"
      meta="Measure 1"
      testId="ward-pilot-held"
      figures={[{ ...held.typical, testId: "ward-pilot-held-typical" }, held.slow]}
    />,
    <Card
      key="requests"
      isPhone={isPhone}
      icon={UserX}
      title="Missed requests"
      meta={`Measure 2 · ${small(requests.raised)} raised`}
      testId="ward-pilot-requests"
      figures={[
        {
          id: "missed",
          label: `No ward in ${windowText(requests.windowMinutes)}`,
          value: small(requests.noWardAsked),
          note: personRate(requests.noWardAsked, requests.raised),
          testId: "ward-pilot-missed",
        },
        {
          id: "duplicates",
          label: "Same person twice",
          value: small(requests.duplicates),
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
      meta={`${holds.held} pulled`}
      testId="ward-pilot-holds"
      figures={[
        {
          id: "ran-out",
          label: "Ran out",
          value: holds.ranOut,
          note: rateNote(holds.ranOut, holds.held),
          testId: "ward-pilot-holds-ran-out",
        },
        {
          id: "given-back",
          label: "Given back",
          value: holds.givenBack,
          note: rateNote(holds.givenBack, holds.held),
        },
      ]}
    />,
    <Card
      key="transport"
      isPhone={isPhone}
      icon={Truck}
      title="Transport"
      meta={`${transport.collections} collected`}
      testId="ward-pilot-transport"
      figures={[
        {
          id: "late",
          label: `Over ${windowText(CLINICAL_VALUES.lateArrivalGrace.value)} late`,
          value: transport.lateCollections,
          note: rateNote(transport.lateCollections, transport.collections),
          testId: "ward-pilot-transport-late",
        },
        { ...travel.typical, label: "Travel, typical" },
        { id: "cancelled", label: "Cancelled", value: transport.cancelled },
      ]}
    />,
    <Card
      key="complete"
      isPhone={isPhone}
      icon={ClipboardCheck}
      title="Records complete"
      meta={`${small(completeness.arrivals)} arrivals`}
      testId="ward-pilot-complete"
      figures={[
        {
          id: "complete",
          label: "Every step timed",
          value: completePercent === undefined ? "—" : `${completePercent}%`,
          note: `${small(completeness.complete)} of ${small(completeness.arrivals)}`,
          testId: "ward-pilot-complete-percent",
        },
      ]}
    />,
  ];

  const stepRows = measures.steps.map((step) => {
    const figures = durationFigures(step.summary, "finished", "None finished this week");
    return { id: step.id, label: step.label, typical: figures.typical.value, note: figures.typical.note };
  });

  const disclosure = (
    <p className={styles.disclosure}>
      The pilot&apos;s agreed measures, counted from the times this prototype records. Targets are still proposals.
      Booking times are not recorded, so transport is measured against the estimate. People waiting in an ED with no bed
      request at all are not held here; the daily check on Waiting lists what the record can show.
    </p>
  );

  if (isPhone) {
    return (
      <section aria-labelledby="ward-pilot-heading" data-testid="ward-pilot-measures">
        <h2 id="ward-pilot-heading" className={styles.sectionHeading}>
          Pilot measures
        </h2>
        {cards}
        <PhoneGroup title="Where the time goes" aside="Typical time per step">
          <PhoneFacts
            flush
            label="Where the time goes"
            facts={stepRows.map((row) => ({
              id: row.id,
              label: `${row.label} (${row.note})`,
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
      <div className={styles.grid3}>{cards.slice(0, 3)}</div>
      <div className={styles.grid3}>
        {cards.slice(3)}
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
      {disclosure}
    </section>
  );
}
