"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

import { Button, Card, CardHead, SrOnly, StatusGlyph, type WfTone } from "@/components/wf";
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
  type Instant,
} from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";

import styles from "./home-activity.module.css";
import { plannedRows, type PlannedKind, type PlannedRow } from "./planned-model";

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

/** The rest of the shift's planned rows, read once by Home for the tab count and the list. */
export function usePlannedRows(now: Instant): readonly PlannedRow[] {
  const { movements, admissions, plannedAdmissions, units, configuration } = useWardFlowSelect(
    "movements",
    "admissions",
    "plannedAdmissions",
    "units",
    "configuration",
  );
  const nameOf = usePatientOf();
  const until = shiftEndInstant(now);
  const endOfDay = (dayOf(now) + 1) * MINUTES_PER_DAY;
  return useMemo(
    () =>
      plannedRows({
        movements,
        admissions,
        plannedAdmissions: plannedAdmissions ?? [],
        units,
        configuration,
        now,
        until,
        endOfDay,
        nameOf,
      }),
    [movements, admissions, plannedAdmissions, units, configuration, now, until, endOfDay, nameOf],
  );
}

/** Home's Planned list: the rest of the shift in time order, from times the records already hold. */
export function PlannedList({ now, rows }: { now: Instant; rows: readonly PlannedRow[] }) {
  const until = shiftEndInstant(now);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? rows : rows.slice(0, FIRST_ROWS);

  return (
    <Card aria-labelledby="home-planned-title" data-testid="home-planned">
      <CardHead
        id="home-planned-title"
        title="Planned"
        // Said once here; target rows carry an amber glyph and edge, and a spoken label.
        meta={`${formatInstant(now)}–${formatInstant(until)} · your default targets`}
      />
      <AccessForecastRow now={now} />
      {rows.length === 0 ? (
        <p className={styles.empty}>Nothing planned for the rest of this shift.</p>
      ) : (
        <ol className={styles.plainList} aria-label="Planned for the rest of the shift">
          {shown.map((row, index) => (
            <Fragment key={row.id}>
              {row.later && !shown[index - 1]?.later ? (
                <li className={styles.afterShift}>After your shift · later today</li>
              ) : null}
              <li className={styles.twoLine} data-kind={row.kind}>
                <StatusGlyph tone={KIND_TONE[row.kind]} size={9} className={styles.rowGlyph} />
                <span className={styles.rowWho}>
                  {row.patientId ? (
                    <Link href={patientHref(row.patientId)} className={styles.personLink}>
                      {row.who}
                    </Link>
                  ) : (
                    <b>{row.who}</b>
                  )}
                </span>
                <time className={styles.rowTimeStrong}>{formatInstant(row.at)}</time>
                <span className={styles.rowWhat}>
                  {row.kind === "target" ? <SrOnly>Your target, not a clinical standard: </SrOnly> : null}
                  <span className={styles.rowKind}>{row.what}</span> · {row.where}
                </span>
              </li>
            </Fragment>
          ))}
        </ol>
      )}
      {rows.length > FIRST_ROWS ? (
        <div className={styles.listFoot}>
          <Button variant="ghost" size="sm" onClick={() => setShowAll((all) => !all)} aria-expanded={showAll}>
            {showAll ? "Show fewer" : `Show ${rows.length - FIRST_ROWS} more`}
          </Button>
        </div>
      ) : null}
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
