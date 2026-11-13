"use client";

// "May pass the access target in the next day" on the ED screen, and its one-line summary under Home's ED strip
// (forecasting build, Josh, 23 Oct 2026, screens 1 and 4). Loaded lazily on both routes so their
// phone script budgets do not grow (`forecast-lazy.tsx`).
//
// Ward names on the card are the coordinator's only (build plan decision 5, approved by Josh at
// 10:12Z 23 Oct), and only the ward that has accepted the person (Josh, 25 Oct): naming the
// earliest release elsewhere read as a best-match ward suggestion. Any other desk sees the time
// and whether a suitable release is recorded.
//
// M120 (Josh approved, D-125, 10 Nov 2026): the card is a forecast, so it names nobody. No name, no
// UMRN and no Find a bed button: each row is a bed type, its time left and the release on record,
// and the card carries the method line. People are found on the board, never from a forecast.
import { useMemo, useState } from "react";

import { Button, StatusGlyph, useIsPhone } from "@/components/wf";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { RELEASE_LOOKAHEAD_DAYS, targetText, type EdAccessRiskRow } from "./ed-access-risk";
import { BED_KIND_LABEL } from "./forecast-by-kind";
import { shortBlocker } from "./forecast-levers";
import { FORECAST_METHOD_LINE } from "@/components/ward-management/ward-forecast-method";
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
  // A16-07 (3.6): the line is said only when someone is ahead; the first in line has nobody.
  const ahead = row.ahead > 0 ? ` ${aheadText(row.ahead)}` : "";
  return `Next ${kind} release ${when}${where}${held}.${ahead}`;
}

/** "1 person ahead in the line", "3 people ahead in the line". */
function aheadText(count: number): string {
  return `${count} ${count === 1 ? "person" : "people"} ahead in the line.`;
}

/** How many people the card lists before "Show all" (Q192). */
const RISK_FIRST = 3;

export function EdAccessRiskCard({ edId, now }: { edId?: string; now: Instant }) {
  const { risk } = useForecastModel(now);
  const access = useEffectiveWardAccess();
  const showWards = access.role === "coordinator";
  const isPhone = useIsPhone();
  const rows = useMemo(() => risk.atRisk.filter((row) => edId === undefined || row.edId === edId), [risk, edId]);
  const [showAll, setShowAll] = useState(false);
  const over = edId === undefined ? risk.alreadyOver : (risk.byEd.find((ed) => ed.edId === edId)?.alreadyOver ?? 0);
  if (rows.length === 0 && over === 0) return null;
  // "24 hours" as a noun here; the shared helper gives the adjective ("24 hour target").
  const hours = risk.targetMinutes % 60 === 0 ? `${risk.targetMinutes / 60} hours` : targetText(risk.targetMinutes);
  // Round 3 (Josh, 1 Nov 2026): a plain card in the Lists style, with no coloured side edge, no
  // summary sentence and no tier (the board shows it). M120: no person, and the method line below.
  // Q192 (Josh, 1 Nov 2026): the soonest few show first, so a long list does not push the ED
  // handover below the fold. The count in the title stays the whole list.
  const shown = showAll ? rows : rows.slice(0, RISK_FIRST);
  const more =
    rows.length > RISK_FIRST ? (
      <div className={styles.riskMore}>
        <Button variant="ghost" size="sm" aria-expanded={showAll} onClick={() => setShowAll((open) => !open)}>
          {showAll ? "Show fewer" : `Show all ${rows.length}`}
        </Button>
      </div>
    ) : null;

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
          {shown.map((row) => (
            <li key={row.movementId} className={styles.riskItem}>
              <span className={styles.riskTop}>
                <b>{BED_KIND_LABEL[row.kind]}</b>
                <span className={styles.warn}>in {splitDuration(row.minutesLeft)}</span>
              </span>
              <span>{releaseText(row, now, showWards)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <table className={handover.listTable} aria-label={`May pass ${hours} in ED`}>
          <colgroup>
            <col className={handover.colRiskNeeds} />
            <col className={handover.colRiskIn} />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Needs</th>
              <th scope="col">Passes {hours}</th>
              <th scope="col">Earliest release on record</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.movementId}>
                <td>{BED_KIND_LABEL[row.kind]}</td>
                <td>
                  <span className={handover.listTime}>
                    <StatusGlyph tone="warning" size={8} />
                    in {splitDuration(row.minutesLeft)}
                  </span>
                </td>
                <td className={handover.listWrap}>{releaseText(row, now, showWards)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {more}
      <p className={styles.alertCaption} data-testid="forecast-ed-risk-method">
        {FORECAST_METHOD_LINE}
      </p>
    </section>
  );
}
