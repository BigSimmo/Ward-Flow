"use client";

// src/components/ward-management/forecast/ed-access-risk-card.tsx
//
// "Access risk in the next day" on the ED screen, and its one-line summary under Home's ED strip
// (forecasting build, Josh, 23 Oct 2026, screens 1 and 4). Loaded lazily on both routes so their
// phone script budgets do not grow (`forecast-lazy.tsx`).
//
// Ward names on the card are the coordinator's only (build plan decision 5, approved by Josh at
// 10:12Z 23 Oct). Any other desk sees the time and whether a suitable release is recorded.
import Link from "next/link";
import { useMemo } from "react";

import { buttonClass, Card, useIsPhone } from "@/components/wf";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { edHref, movementHref } from "@/components/ward-management/shell/ward-facade";
import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { RELEASE_LOOKAHEAD_DAYS, type EdAccessRiskRow } from "./ed-access-risk";
import { BED_KIND_LABEL } from "./forecast-by-kind";
import { shortBlocker } from "./forecast-levers";
import { forecastEdName, useForecastModel } from "./use-forecast-model";
import styles from "./forecast.module.css";

/** "24 hour" for a whole-hour target, else "20h 30m": the access target as Settings states it. */
export function targetText(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60} hour` : splitDuration(minutes);
}

function releaseText(row: EdAccessRiskRow, now: Instant, showWards: boolean): string {
  const kind = BED_KIND_LABEL[row.kind].toLowerCase();
  const lookahead = `the next ${RELEASE_LOOKAHEAD_DAYS} days`;
  if (!row.nextRelease) {
    const declined = row.declines > 0 ? ` Declined by ${row.declines} ${row.declines === 1 ? "ward" : "wards"}.` : "";
    return row.acceptedUnitName && showWards
      ? `Accepted at ${row.acceptedUnitName}. No release there in ${lookahead}.${declined}`
      : `No ${kind} release due in ${lookahead}.${declined}`;
  }
  const when = formatInstantWithDay(row.nextRelease.at, now);
  const where = showWards ? ` at ${row.nextRelease.unitName}` : "";
  const held = row.nextRelease.blocker ? `, held up for ${shortBlocker(row.nextRelease.blocker).toLowerCase()}` : "";
  return `Next ${kind} release ${when}${where}${held}. Others are ahead in the line.`;
}

export function EdAccessRiskCard({ edId, now }: { edId?: string; now: Instant }) {
  const { risk } = useForecastModel(now);
  const access = useEffectiveWardAccess();
  const showWards = access.role === "coordinator";
  const patientOf = usePatientOf();
  const isPhone = useIsPhone();
  const rows = useMemo(() => risk.atRisk.filter((row) => edId === undefined || row.edId === edId), [risk, edId]);
  const over = edId === undefined ? risk.alreadyOver : (risk.byEd.find((ed) => ed.edId === edId)?.alreadyOver ?? 0);
  if (rows.length === 0 && over === 0) return null;
  const hours = targetText(risk.targetMinutes);
  const summary = `${rows.length} ${rows.length === 1 ? "person" : "people"} will pass the ${hours} access target before a suitable bed is due.${
    over > 0 ? ` ${over} already ${over === 1 ? "has" : "have"}.` : ""
  }`;
  const name = (row: EdAccessRiskRow) => patientOf({ movementId: row.movementId }).displayName;

  return (
    <Card className={styles.riskCard} aria-labelledby="forecast-ed-risk-title" data-testid="forecast-ed-risk">
      <div className={styles.section}>
        <div className={styles.header}>
          <h2 id="forecast-ed-risk-title" className={styles.title}>
            Access risk in the next day
          </h2>
          <span className={styles.meta}>{summary}</span>
        </div>
        {rows.length === 0 ? null : isPhone ? (
          <ul className={styles.riskList}>
            {rows.map((row) => (
              <li key={row.movementId} className={styles.riskItem}>
                <span className={styles.riskTop}>
                  <b>{name(row)}</b>
                  <span className={styles.warn}>in {splitDuration(row.minutesLeft)}</span>
                </span>
                <span className={styles.sub}>
                  Tier {row.urgency} · {BED_KIND_LABEL[row.kind]}
                </span>
                <span>{releaseText(row, now, showWards)}</span>
                <Link
                  href={movementHref(row.movementId)}
                  className={buttonClass({ variant: "sec", size: "sm", className: styles.leverAction })}
                >
                  Find a bed
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <table className={styles.riskTable}>
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Needs</th>
                <th scope="col">Passes {hours} target</th>
                <th scope="col">Earliest suitable release on record</th>
                <th scope="col">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.movementId}>
                  <td>
                    <b>{name(row)}</b>
                    <span className={styles.sub}>Tier {row.urgency}</span>
                  </td>
                  <td>{BED_KIND_LABEL[row.kind]}</td>
                  <td className={styles.warn}>in {splitDuration(row.minutesLeft)}</td>
                  <td>{releaseText(row, now, showWards)}</td>
                  <td>
                    <Link href={movementHref(row.movementId)} className={buttonClass({ variant: "sec", size: "sm" })}>
                      Find a bed
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className={styles.caption}>
          Earliest release is what wards have recorded. It is not a bed for this person, and new arrivals are not
          predicted. People are lined up for beds in the order they were referred.
        </p>
      </div>
    </Card>
  );
}

/** Home's one line under the ED strip: the department with the most people at risk. */
export function HomeEdAccessLine({ now }: { now: Instant }) {
  const { risk } = useForecastModel(now);
  const first = [...risk.byEd].sort(
    (a, b) => b.atRisk - a.atRisk || (a.firstMinutesLeft ?? 0) - (b.firstMinutesLeft ?? 0),
  )[0];
  if (!first || first.atRisk === 0) return null;
  const others = risk.atRisk.length - first.atRisk;
  return (
    <p className={styles.edLine} data-testid="home-ed-access-risk">
      <span className={styles.edLineText}>
        <b>
          {first.atRisk} {first.atRisk === 1 ? "person" : "people"} at {forecastEdName(first.edId)}
        </b>{" "}
        {first.atRisk === 1 ? "passes" : "pass"} the {targetText(risk.targetMinutes)} access target before a suitable
        bed is due, first in {splitDuration(first.firstMinutesLeft ?? 0)}.
        {others > 0 ? ` ${others} more at other departments.` : ""}
      </span>
      <Link href={edHref(first.edId)} className={buttonClass({ variant: "ghost", size: "sm" })}>
        See who
      </Link>
    </p>
  );
}
