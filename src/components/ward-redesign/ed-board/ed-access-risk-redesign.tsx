"use client";

// src/components/ward-management/forecast/ed-access-risk-card.tsx
//
// "May pass the access target in the next day" on the ED screen, and its one-line summary under Home's ED strip
// (forecasting build, Josh, 23 Oct 2026, screens 1 and 4). Loaded lazily on both routes so their
// phone script budgets do not grow (`forecast-lazy.tsx`).
//
// Ward names on the card are the coordinator's only (build plan decision 5, approved by Josh at
// 10:12Z 23 Oct), and only the ward that has accepted the person (Josh, 25 Oct): naming the
// earliest release elsewhere read as a best-match ward suggestion. Any other desk sees the time
// and whether a suitable release is recorded.
import Link from "next/link";
import { useMemo } from "react";

import { buttonClass, Card, useIsPhone } from "@/components/wf";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import {
  RELEASE_LOOKAHEAD_DAYS,
  targetText,
  type EdAccessRiskRow,
} from "@/components/ward-management/forecast/ed-access-risk";
import { BED_KIND_LABEL } from "@/components/ward-management/forecast/forecast-by-kind";
import { shortBlocker } from "@/components/ward-management/forecast/forecast-levers";
import { useForecastModel } from "@/components/ward-management/forecast/use-forecast-model";
import styles from "@/components/ward-management/forecast/forecast.module.css";

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
  const where = showWards && row.acceptedUnitName ? ` at ${row.nextRelease.unitName}` : "";
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
  // Redesign (D-83): surname first, as on the board below it.
  const name = (row: EdAccessRiskRow) => patientOf({ movementId: row.movementId }).formalName;

  return (
    <Card className={styles.riskCard} aria-labelledby="forecast-ed-risk-title" data-testid="forecast-ed-risk">
      <div className={styles.section}>
        <div className={styles.header}>
          <h2 id="forecast-ed-risk-title" className={styles.title}>
            May pass the access target in the next day
          </h2>
          <span className={styles.meta}>{summary}</span>
        </div>
        {/* Forecast integration (Josh, 27 Oct 2026): read before the rows, so the tier beside a name is
            never taken as the queue order. */}
        <p className={styles.caption} data-testid="forecast-ed-risk-caption">
          Lined up in the order they were referred, not by tier or clinical priority. Earliest release is what wards
          have recorded. It is not a bed for this person, and new arrivals are not predicted.
        </p>
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
      </div>
    </Card>
  );
}
