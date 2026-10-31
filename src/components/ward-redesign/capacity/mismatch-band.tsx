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
 * Where the mismatch is: each bed type, now and likely by this time tomorrow. One card per type,
 * each with the same three lines in the same place, so the eye can run across them. Replaces the
 * table plus a separate "Tomorrow" strip. The network total is the forecast's Now figure, so it
 * is not repeated here as a fifth card (Josh, 30 Oct 2026).
 */
export function MismatchBand({ model }: { model: CapacityModel }) {
  const { gapRows, tomorrowByKind, now } = model;
  const span = rangeSpan(tomorrowByKind);
  const byId = new Map(tomorrowByKind.kinds.map((kind) => [kind.id, kind]));
  const until = formatInstantWithDay(tomorrowByKind.until, now);
  return (
    <Card aria-labelledby="capacity-mismatch-title">
      {/* Polish (Josh, 31 Oct 2026): a short title and no grey line beside it. Each card's own
          "waiting · ready that fit" line already says what is counted. */}
      <CardHead id="capacity-mismatch-title" title="Mismatch" />
      <ul className={styles.mismatch}>
        {gapRows.map((row) => (
          <MismatchCard
            key={row.id}
            title={shortNeed(row.need)}
            row={row}
            tomorrow={byId.get(row.id)}
            span={span}
            until={until}
          />
        ))}
      </ul>
    </Card>
  );
}

function MismatchCard({
  title,
  row,
  tomorrow,
  span,
  until,
}: {
  title: string;
  row: Pick<BedKindGap, "waiting" | "bedsThatFit" | "gap">;
  tomorrow: Range | undefined;
  span: number;
  until: string;
}) {
  const short = row.gap < 0;
  return (
    <li className={styles.mmCard}>
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
            <Kicker>
              Tomorrow<span className={styles.srOnly}>, by {until}</span>
            </Kicker>
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

/** "A locked adult bed" to "Locked adult": the card title names the bed type only. */
export function shortNeed(need: string): string {
  const core = need.replace(/^an? /i, "").replace(/ bed$/, "").replace("-", " ");
  return core.charAt(0).toUpperCase() + core.slice(1);
}

/** One scale for every card, so a longer band always means a wider range. */
function rangeSpan(forecast: ForecastByKind): number {
  const ends = forecast.kinds.flatMap((kind) => [Math.abs(kind.low), Math.abs(kind.high)]);
  return Math.max(4, ...ends);
}
