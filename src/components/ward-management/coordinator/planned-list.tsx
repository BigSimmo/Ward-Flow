"use client";

import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import Link from "next/link";
import { Fragment, useState } from "react";

import { Card, CardHead, SrOnly, StatusGlyph, type WfTone } from "@/components/wf";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import { edHref } from "@/components/ward-management/shell/ward-facade";
import { targetText } from "@/components/ward-management/forecast/ed-access-risk";
import { forecastEdName, useForecastModel } from "@/components/ward-management/forecast/use-forecast-model";
import { shiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import {
  formatInstant,
  formatInstantWithDay,
  perthDayLabel,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";

import styles from "./home-activity.module.css";
import type { PlannedKind, PlannedRow } from "./planned-model";
import { useTomorrowOutlook } from "./planned-rows";

/** Long lists show this many first, then Show more. */
const FIRST_ROWS = 8;

const KIND_TONE: Record<PlannedKind, WfTone> = {
  // Neutral rings for records; the info glyph means "to decide" on this page.
  move: "neutral",
  transport: "neutral",
  admission: "neutral",
  discharge: "success",
  target: "warning",
};

/** Home's Planned list: the rest of the shift in time order, from times the records already hold. */
export function PlannedList({
  now,
  rows,
  title = "Planned",
}: {
  now: Instant;
  rows: readonly PlannedRow[];
  title?: string;
}) {
  const until = shiftEndInstant(now);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? rows : rows.slice(0, FIRST_ROWS);

  return (
    <Card aria-labelledby="home-planned-title" data-testid="home-planned">
      <CardHead
        id="home-planned-title"
        title={title}
        // Said once here; target rows carry an amber glyph and a spoken label (no side edge).
        meta={`${formatInstant(now)}–${formatInstantWithDay(until, now)} · your default targets`}
      />
      <AccessForecastRow now={now} />
      {rows.length === 0 ? (
        <p className={styles.empty}>Nothing planned for the rest of this shift.</p>
      ) : (
        <ol className={styles.plainList} aria-label="Planned for the rest of the shift">
          {shown.map((row, index) => (
            <Fragment key={row.id}>
              {row.past && index === 0 ? <li className={styles.afterShift}>Past planned time · not done yet</li> : null}
              {!row.past && !row.later && shown[index - 1]?.past ? (
                <li className={styles.afterShift}>Rest of your shift</li>
              ) : null}
              {row.later && !shown[index - 1]?.later ? (
                <li className={styles.afterShift}>After your shift · later today</li>
              ) : null}
              <PlannedRowItem row={row} now={now} />
            </Fragment>
          ))}
        </ol>
      )}
      {rows.length > FIRST_ROWS ? (
        <div className={styles.listFoot}>
          <button
            type="button"
            className={styles.moreRow}
            onClick={() => setShowAll((all) => !all)}
            aria-expanded={showAll}
          >
            {showAll ? "Show fewer" : `Show ${rows.length - FIRST_ROWS} more`}
          </button>
        </div>
      ) : null}
      <TomorrowFoot now={now} />
    </Card>
  );
}

/**
 * Redesign: the ED access forecast that sat as a banner under Home's ED strip, now the first Planned row,
 * because it is the same kind of thing: people heading for a target. It reads today's forecast model.
 */
function AccessForecastRow({ now }: { now: Instant }) {
  const { risk } = useForecastModel(now);
  const first = [...risk.byEd].sort(
    (a, b) => b.atRisk - a.atRisk || (a.firstMinutesLeft ?? 0) - (b.firstMinutesLeft ?? 0),
  )[0];
  if (!first || first.atRisk === 0) return null;
  const total = risk.atRisk.length;
  return (
    <div className={styles.forecastRow} data-testid="home-planned-access-forecast">
      <StatusGlyph tone="warning" size={9} className={styles.rowGlyph} />
      <span className={styles.rowWho}>
        <b>
          {total} likely to pass the {targetText(risk.targetMinutes)} ED target
        </b>
      </span>
      <time className={styles.rowTimeStrong}>{formatInstantWithDay(now + (first.firstMinutesLeft ?? 0), now)}</time>
      <span className={styles.rowWhat}>
        Forecast · {first.atRisk} at {forecastEdName(first.edId)} ·{" "}
        <Link href={edHref(first.edId)} className={styles.personLink}>
          See who
        </Link>
      </span>
    </div>
  );
}

function PlannedRowItem({ row, now }: { row: PlannedRow; now: Instant }) {
  return (
    <li className={styles.twoLine} data-kind={row.kind}>
      <StatusGlyph tone={KIND_TONE[row.kind]} size={9} className={styles.rowGlyph} />
      <span className={styles.rowWho}>
        {row.recordId ? (
          <Link href={patientHref(row.recordId)} className={styles.personLink}>
            {row.who}
          </Link>
        ) : (
          <b>{row.who}</b>
        )}
      </span>
      <time className={styles.rowTimeStrong}>{formatInstantWithDay(row.at, now)}</time>
      <span className={styles.rowWhat}>
        {row.kind === "target" ? <SrOnly>Your target, not a clinical standard: </SrOnly> : null}
        <span className={styles.rowKind}>{row.what}</span> · <SpelledCodes text={row.where} />
      </span>
    </li>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Tomorrow (six features build, Josh 9 Nov 2026): one summary line of what wards have recorded for
 * tomorrow, with the people one tap away. Counts only recorded expected dates; nothing is predicted.
 */
function TomorrowFoot({ now }: { now: Instant }) {
  const { dayStart, discharges, confirmed, admissions } = useTomorrowOutlook(now);
  const [open, setOpen] = useState(false);
  const rows = [...discharges, ...admissions].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const { dayZero } = useWardFlowSelect("dayZero");
  const day = dayZero ? ` · ${perthDayLabel(dayStart, dayZero)}` : "";
  return (
    <section className={styles.tomorrow} aria-labelledby="home-tomorrow-title" data-testid="home-tomorrow">
      <h3 id="home-tomorrow-title" className={styles.afterShift}>
        Tomorrow{day}
      </h3>
      {rows.length === 0 ? (
        <p className={styles.tomorrowEmpty}>No expected discharges or planned admissions recorded for tomorrow.</p>
      ) : (
        <button
          type="button"
          className={styles.tomorrowSummary}
          aria-expanded={open}
          aria-controls={open ? "home-tomorrow-list" : undefined}
          onClick={() => setOpen((value) => !value)}
          data-testid="home-tomorrow-summary"
        >
          <span className={styles.tomorrowFigures}>
            <span>
              <b className={styles.tomorrowNumber}>{discharges.length}</b>{" "}
              {discharges.length === 1 ? "expected discharge" : "expected discharges"}
              {discharges.length > 0 ? <span className={styles.tomorrowNote}> · {confirmed} confirmed</span> : null}
            </span>
            <span>
              <b className={styles.tomorrowNumber}>{admissions.length}</b>{" "}
              {admissions.length === 1 ? "planned admission" : "planned admissions"}
            </span>
          </span>
          <span className={styles.tomorrowToggle}>{open ? "Hide" : "Show who"}</span>
        </button>
      )}
      {open && rows.length > 0 ? (
        <ol
          id="home-tomorrow-list"
          className={styles.plainList}
          aria-label={`Recorded for tomorrow: ${plural(rows.length, "person", "people")}`}
        >
          {rows.map((row) => (
            <PlannedRowItem key={row.id} row={row} now={now} />
          ))}
        </ol>
      ) : null}
      <p className={styles.tomorrowSource}>From expected dates wards have recorded. Not a prediction.</p>
    </section>
  );
}
