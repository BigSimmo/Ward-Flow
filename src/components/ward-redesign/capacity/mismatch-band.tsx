import { Card, CardHead, StatusGlyph } from "@/components/wf";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import type { BedKindGap } from "@/components/ward-management/capacity/capacity-derivations";
import type { ForecastByKind, KindForecast } from "@/components/ward-management/forecast/forecast-by-kind";

import { gapWords, RangeLine } from "../parts/range-line";
import { Kicker } from "../parts/how-worked-out";
import type { CapacityModel } from "./use-capacity-model";
import styles from "./capacity-redesign.module.css";

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
  return (
    <Card aria-labelledby="capacity-mismatch-title">
      <CardHead
        id="capacity-mismatch-title"
        title="Where the mismatch is"
        meta={`Ready beds that fit, against people waiting, now and likely by ${formatInstantWithDay(tomorrowByKind.until, now)}`}
      />
      <ul className={styles.mismatch}>
        {gapRows.map((row) => (
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
