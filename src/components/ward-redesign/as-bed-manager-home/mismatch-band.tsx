// Fork of src/components/ward-redesign/capacity/mismatch-band.tsx: a site bed manager branch.
import type { CSSProperties } from "react";

import { Card, CardHead, StatusGlyph } from "@/components/wf";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import type { BedKindGap } from "@/components/ward-management/capacity/capacity-derivations";
import type { ForecastByKind, KindForecast } from "@/components/ward-management/forecast/forecast-by-kind";

import { gapWords, RangeLine } from "@/components/ward-redesign/parts/range-line";
import { Kicker } from "@/components/ward-redesign/parts/how-worked-out";
import type { CapacityModel } from "./use-capacity-model";
import styles from "@/components/ward-redesign/capacity/capacity-redesign.module.css";
import site from "./capacity-site.module.css";

type Range = Pick<KindForecast, "low" | "likely" | "high">;

/**
 * Where the mismatch is: each bed type, now and likely by this time tomorrow. One card per type
 * and one for all four, each with the same three lines in the same place, so the eye can run
 * across them. Replaces the table plus a separate "Tomorrow" strip.
 */
export function MismatchBand({ model }: { model: CapacityModel }) {
  const { gapRows, gapTotals, tomorrowByKind, now } = model;
  const span = rangeSpan(tomorrowByKind);
  const byId = new Map(tomorrowByKind.kinds.map((kind) => [kind.id, kind]));
  // ROLE BRANCH (bed_manager): a site holds only some bed types (Royal Perth has no youth ward), so
  // a type with nobody waiting, no bed that fits and nothing forecast is left out, not drawn as 0.
  const rows = model.site
    ? gapRows.filter((row) => {
        const next = byId.get(row.id);
        const forecastNothing = next === undefined || (next.low === 0 && next.likely === 0 && next.high === 0);
        return row.waiting > 0 || row.bedsThatFit > 0 || !forecastNothing;
      })
    : gapRows;
  return (
    <Card aria-labelledby="capacity-mismatch-title">
      <CardHead
        id="capacity-mismatch-title"
        title="Where the mismatch is"
        meta={`Ready beds that fit, against people waiting, now and likely by ${formatInstantWithDay(tomorrowByKind.until, now)}`}
      />
      <ul
        className={model.site ? `${styles.mismatch} ${site.siteMismatch}` : styles.mismatch}
        style={model.site ? ({ "--bm-columns": rows.length + 1 } as CSSProperties) : undefined}
      >
        {rows.map((row) => (
          <MismatchCard key={row.id} title={row.need} row={row} tomorrow={byId.get(row.id)} span={span} />
        ))}
        <MismatchCard title="All four together" row={gapTotals} tomorrow={tomorrowByKind.total} span={span} total />
      </ul>
    </Card>
  );
}

function MismatchCard({
  title,
  row,
  tomorrow,
  span,
  total = false,
}: {
  title: string;
  row: Pick<BedKindGap, "waiting" | "bedsThatFit" | "gap">;
  tomorrow: Range | undefined;
  span: number;
  total?: boolean;
}) {
  const short = row.gap < 0;
  return (
    <li className={`${styles.mmCard}${total ? ` ${styles.mmTotal}` : ""}`}>
      <h3 className={styles.mmTitle}>{title}</h3>
      <p className={styles.mmNow}>
        <StatusGlyph tone={short ? "warning" : "success"} size={10} />
        <b className={styles.mmFigure}>{Math.abs(row.gap)}</b>
        {row.gap === 0 ? "exactly enough" : short ? "short" : "spare"}
      </p>
      <p className={styles.mmSub}>
        {row.waiting} waiting · {row.bedsThatFit} ready that fit
      </p>
      {tomorrow ? (
        <div className={styles.mmTomorrow}>
          <div className={styles.mmTomorrowHead}>
            <Kicker>Tomorrow</Kicker>
            <b className={tomorrow.likely < 0 ? styles.warnInk : styles.okInk}>{gapWords(tomorrow.likely)}</b>
          </div>
          <RangeLine low={tomorrow.low} likely={tomorrow.likely} high={tomorrow.high} span={span} />
          <p className={styles.mmSub}>
            {gapWords(tomorrow.low)} to {gapWords(tomorrow.high)}
          </p>
        </div>
      ) : null}
    </li>
  );
}

/** One scale for every card, so a longer band always means a wider range. */
function rangeSpan(forecast: ForecastByKind): number {
  const ends = [forecast.total, ...forecast.kinds].flatMap((kind) => [Math.abs(kind.low), Math.abs(kind.high)]);
  return Math.max(4, ...ends);
}
