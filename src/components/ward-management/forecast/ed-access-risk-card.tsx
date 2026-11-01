"use client";

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

import { buttonClass, StatusGlyph, useIsPhone } from "@/components/wf";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { RELEASE_LOOKAHEAD_DAYS, targetText, type EdAccessRiskRow } from "./ed-access-risk";
import { BED_KIND_LABEL } from "./forecast-by-kind";
import { shortBlocker } from "./forecast-levers";
import { useForecastModel } from "./use-forecast-model";
import styles from "./forecast.module.css";
import handover from "../ed/ed-handover.module.css";

export function releaseText(row: EdAccessRiskRow, now: Instant, showWards: boolean): string {
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
  // "24 hours" as a noun here; the shared helper gives the adjective ("24 hour target").
  const hours = risk.targetMinutes % 60 === 0 ? `${risk.targetMinutes / 60} hours` : targetText(risk.targetMinutes);
  // Round 3 (Josh, 1 Nov 2026): a plain card in the Lists style, with no coloured side edge, no
  // summary sentence and no caption, and no tier (the board shows it). Surname first with the UMRN.
  const person = (row: EdAccessRiskRow) => patientOf({ movementId: row.movementId });

  return (
    <section className={handover.listsCard} aria-labelledby="forecast-ed-risk-title" data-testid="forecast-ed-risk">
      <header className={handover.listsHead}>
        <div className={handover.handoverTitle}>
          <h2 id="forecast-ed-risk-title">
            May pass {hours} in ED <span className={handover.handoverCount}>{rows.length}</span>
          </h2>
          {over > 0 ? <p>{over} already past</p> : null}
        </div>
      </header>
      {rows.length === 0 ? null : isPhone ? (
        <ul className={styles.riskList}>
          {rows.map((row) => (
            <li key={row.movementId} className={styles.riskItem}>
              <span className={styles.riskTop}>
                <b>{person(row).formalName}</b>
                <span className={styles.warn}>in {splitDuration(row.minutesLeft)}</span>
              </span>
              <span className={styles.sub}>{BED_KIND_LABEL[row.kind]}</span>
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
        <table className={handover.listTable} aria-label={`May pass ${hours} in ED`}>
          <colgroup>
            <col className={handover.colRiskWho} />
            <col className={handover.colRiskNeeds} />
            <col className={handover.colRiskIn} />
            <col />
            <col className={handover.colRiskAct} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Needs</th>
              <th scope="col">Passes {hours}</th>
              <th scope="col">Earliest release on record</th>
              <th scope="col">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.movementId}>
                <td>
                  <span className={handover.listWho}>
                    <span className={handover.listNameStatic}>{person(row).formalName}</span>
                    <span className={handover.listUmrn}>{person(row).umrn}</span>
                  </span>
                </td>
                <td>{BED_KIND_LABEL[row.kind]}</td>
                <td>
                  <span className={handover.listTime}>
                    <StatusGlyph tone="warning" size={8} />
                    in {splitDuration(row.minutesLeft)}
                  </span>
                </td>
                <td className={handover.listWrap}>{releaseText(row, now, showWards)}</td>
                <td className={handover.alignEnd}>
                  <Link href={movementHref(row.movementId)} className={buttonClass({ variant: "sec", size: "md" })}>
                    Find a bed
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
