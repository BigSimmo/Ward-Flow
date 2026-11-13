"use client";

import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { Card, CardHead, Count, SrOnly, StatusGlyph, type WfTone } from "@/components/wf";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import { edHref } from "@/components/ward-management/shell/ward-facade";
import { targetText } from "@/components/ward-management/forecast/ed-access-risk";
import { forecastEdName, useForecastModel } from "@/components/ward-management/forecast/use-forecast-model";
import { shiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import {
  dayOf,
  formatInstant,
  formatInstantWithDay,
  MINUTES_PER_DAY,
  perthDayLabel,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";

import activity from "./home-activity.module.css";
import styles from "./home-later-today.module.css";
import type { PlannedRow } from "./planned-model";
import { useTomorrowOutlook } from "./planned-rows";

/** Long groups show this many first, then Show more (about 8 rows, D-191 build rules). */
const FIRST_ROWS = 8;

/**
 * Home's Later today (wave 4, D-191, notes item 1; F-28, K2, RC 2.2). Four short groups as an agenda:
 * Past planned time (a record whose time passed with nothing done, kept in view rather than
 * dropped), the rest of your shift, after your shift (to midnight), and Tomorrow. Each row is the
 * planned time as recorded, then the person and "what · where"; the name opens the record. A past
 * row shows its time in warning ink, never "late by" or a countdown. Nothing is predicted.
 */
export function PlannedList({
  now,
  rows,
  title = "Planned",
  tabbed = false,
}: {
  now: Instant;
  rows: readonly PlannedRow[];
  title?: string;
  /** On the phone's Later today tab the tab already names the card, so its head is visually hidden. */
  tabbed?: boolean;
}) {
  const until = shiftEndInstant(now);
  const untilText = formatInstantWithDay(until, now);
  const forecast = useAccessForecast(now);
  const endOfDay = (dayOf(now) + 1) * MINUTES_PER_DAY;
  // The ED target forecast row sits in the group its time belongs to: Tomorrow, or the rest of today.
  const forecastTomorrow = forecast !== undefined && forecast.at >= endOfDay;
  const past = rows.filter((row) => row.past);
  const shift = rows.filter((row) => !row.past && !row.later);
  const later = rows.filter((row) => !row.past && row.later);

  return (
    <Card
      aria-labelledby="home-planned-title"
      data-testid="home-planned"
      className={tabbed ? `${styles.card} ${styles.tabbed}` : styles.card}
    >
      <CardHead id="home-planned-title" title={title} meta={`${formatInstant(now)} to ${untilText} · your shift`} />
      {past.length > 0 ? (
        <AgendaGroup id="past" label="Past planned time" tone="warning" aside="not done yet" rows={past} now={now} />
      ) : null}
      <AgendaGroup
        id="shift"
        label="Rest of your shift"
        tone="neutral"
        aside={`until ${untilText}`}
        rows={shift}
        now={now}
        lead={forecast && !forecastTomorrow ? <AccessForecastRow forecast={forecast} now={now} /> : null}
        empty="Nothing else planned for the rest of this shift."
      />
      <AgendaGroup
        id="later"
        label="After your shift"
        tone="neutral"
        aside={`${untilText} to midnight`}
        rows={later}
        now={now}
        empty={`Nothing recorded after ${untilText} yet.`}
      />
      <TomorrowFoot now={now} forecast={forecastTomorrow ? forecast : undefined} />
    </Card>
  );
}

function AgendaGroup({
  id,
  label,
  tone,
  aside,
  rows,
  now,
  lead,
  empty,
}: {
  id: string;
  label: string;
  tone: WfTone;
  aside: string;
  rows: readonly PlannedRow[];
  now: Instant;
  lead?: ReactNode;
  empty?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? rows : rows.slice(0, FIRST_ROWS);
  const headId = `home-planned-${id}`;
  return (
    <section className={styles.group} aria-labelledby={headId} data-testid={`home-planned-group-${id}`}>
      <h3 className={styles.sub} id={headId}>
        <StatusGlyph tone={tone} size={10} />
        <span>{label}</span>
        <Count n={rows.length} />
        <span className={styles.subAside}>{aside}</span>
      </h3>
      {lead}
      {rows.length === 0 ? (
        lead ? null : (
          <p className={styles.empty}>{empty}</p>
        )
      ) : (
        <ol className={styles.agenda} aria-labelledby={headId}>
          {shown.map((row) => (
            <AgendaRow key={row.id} row={row} now={now} />
          ))}
        </ol>
      )}
      {rows.length > FIRST_ROWS ? (
        <button
          type="button"
          className={activity.moreRow}
          onClick={() => setShowAll((all) => !all)}
          aria-expanded={showAll}
        >
          {showAll ? "Show fewer" : `Show ${rows.length - FIRST_ROWS} more`}
        </button>
      ) : null}
    </section>
  );
}

function AgendaRow({ row, now }: { row: PlannedRow; now: Instant }) {
  return (
    <li className={styles.row} data-kind={row.kind} data-past={row.past ? "true" : undefined}>
      {/* The time as recorded; a passed one is in warning ink, said in words to a screen reader. */}
      <time className={styles.time}>
        {formatInstantWithDay(row.at, now)}
        {row.past ? <SrOnly>, past planned time</SrOnly> : null}
      </time>
      <div className={styles.main}>
        <p className={styles.who}>
          {row.recordId ? (
            <Link href={patientHref(row.recordId)} className={styles.name}>
              {row.who}
            </Link>
          ) : (
            <span className={styles.nameText}>{row.who}</span>
          )}
        </p>
        <p className={styles.line}>
          {row.kind === "target" ? <SrOnly>Your target, not a clinical standard: </SrOnly> : null}
          {row.what} ·{" "}
          <span className={styles.where}>
            <SpelledCodes text={row.where} />
          </span>
        </p>
      </div>
    </li>
  );
}

type AccessForecast = { total: number; target: string; at: Instant; atEd: number; edId: string };

/** The ED access forecast's first breach, read from today's forecast model. */
function useAccessForecast(now: Instant): AccessForecast | undefined {
  const { risk } = useForecastModel(now);
  const first = [...risk.byEd].sort(
    (a, b) => b.atRisk - a.atRisk || (a.firstMinutesLeft ?? 0) - (b.firstMinutesLeft ?? 0),
  )[0];
  if (!first || first.atRisk === 0) return undefined;
  return {
    total: risk.atRisk.length,
    target: targetText(risk.targetMinutes),
    at: now + (first.firstMinutesLeft ?? 0),
    atEd: first.atRisk,
    edId: first.edId,
  };
}

/** The forecast as an agenda row, when its time falls today (otherwise it sits in Tomorrow). */
function AccessForecastRow({ forecast, now }: { forecast: AccessForecast; now: Instant }) {
  return (
    <div className={styles.row} data-kind="forecast" data-testid="home-planned-access-forecast">
      <time className={styles.time}>{formatInstantWithDay(forecast.at, now)}</time>
      <div className={styles.main}>
        <p className={styles.who}>
          <span className={styles.nameText}>
            {forecast.total} likely to pass the {forecast.target} ED target
          </span>
        </p>
        <p className={styles.line}>
          Forecast · {forecast.atEd} at {forecastEdName(forecast.edId)} ·{" "}
          <Link href={edHref(forecast.edId)} className={styles.link}>
            See who
          </Link>
        </p>
      </div>
    </div>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Tomorrow (six features build, Josh 9 Nov 2026; wave 4 facts list): what wards have recorded for
 * tomorrow, one fact a line, with the people one tap away. Counts only recorded expected dates.
 */
function TomorrowFoot({ now, forecast }: { now: Instant; forecast: AccessForecast | undefined }) {
  const { dayStart, discharges, confirmed, admissions } = useTomorrowOutlook(now);
  const [open, setOpen] = useState(false);
  const rows = [...discharges, ...admissions].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const { dayZero } = useWardFlowSelect("dayZero");
  const day = dayZero ? ` · ${perthDayLabel(dayStart, dayZero)}` : "";
  const wards = [...new Set(admissions.map((row) => row.where))];
  return (
    <section className={styles.tomorrow} aria-labelledby="home-tomorrow-title" data-testid="home-tomorrow">
      <h3 id="home-tomorrow-title" className={styles.sub}>
        <span>Tomorrow{day}</span>
      </h3>
      <dl className={styles.facts}>
        <div>
          <dt>
            <b className={styles.figure}>{discharges.length}</b>{" "}
            {discharges.length === 1 ? "expected discharge" : "expected discharges"}
          </dt>
          <dd>
            <b className={styles.figure}>{confirmed}</b> confirmed
          </dd>
        </div>
        <div>
          <dt>
            <b className={styles.figure}>{admissions.length}</b>{" "}
            {admissions.length === 1 ? "planned admission" : "planned admissions"}
          </dt>
          <dd>{wards.length === 1 ? wards[0] : wards.length > 1 ? plural(wards.length, "ward", "wards") : null}</dd>
        </div>
        {forecast ? (
          <div data-testid="home-planned-access-forecast">
            <dt>
              <b className={styles.figure}>{forecast.total}</b> likely to pass the {forecast.target} ED target
            </dt>
            <dd>
              by {formatInstant(forecast.at)} · {forecast.atEd} at {forecastEdName(forecast.edId)} ·{" "}
              <Link href={edHref(forecast.edId)} className={styles.link}>
                See who
              </Link>
            </dd>
          </div>
        ) : null}
      </dl>
      {rows.length > 0 ? (
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={open ? "home-tomorrow-list" : undefined}
          onClick={() => setOpen((value) => !value)}
          data-testid="home-tomorrow-summary"
        >
          {open ? "Hide who" : `Show who (${plural(rows.length, "person", "people")})`}
        </button>
      ) : null}
      {open && rows.length > 0 ? (
        <ol
          id="home-tomorrow-list"
          className={styles.agenda}
          aria-label={`Recorded for tomorrow: ${plural(rows.length, "person", "people")}`}
        >
          {rows.map((row) => (
            <AgendaRow key={row.id} row={row} now={now} />
          ))}
        </ol>
      ) : null}
      <p className={styles.fine}>From expected dates wards have recorded. Not a prediction.</p>
    </section>
  );
}
