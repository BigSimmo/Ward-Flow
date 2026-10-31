"use client";

import { useState } from "react";

import { Card, CardHead, Segmented, StatusGlyph } from "@/components/wf";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import type { BedKindGap } from "@/components/ward-management/capacity/capacity-derivations";
import type { ForecastByKind, KindForecast } from "@/components/ward-management/forecast/forecast-by-kind";

import { gapWords, RangeLine } from "../parts/range-line";
import type { CapacityModel } from "./use-capacity-model";
import styles from "./capacity-redesign.module.css";

type Range = Pick<KindForecast, "low" | "likely" | "high">;
type Show = "all" | "short" | "enough";

/**
 * Where the mismatch is: each bed type, now and likely by this time tomorrow. One card per type,
 * each with the same three lines in the same place, so the eye can run across them. Replaces the
 * table plus a separate "Tomorrow" strip. The network total is the forecast's Now figure, so it
 * is not repeated here as a fifth card (Josh, 30 Oct 2026).
 */
export function MismatchBand({ model, hideEmptyTypes = false }: { model: CapacityModel; hideEmptyTypes?: boolean }) {
  const { gapRows, tomorrowByKind, now } = model;
  const [show, setShow] = useState<Show>("all");
  const span = rangeSpan(tomorrowByKind);
  const byId = new Map(tomorrowByKind.kinds.map((kind) => [kind.id, kind]));
  const until = formatInstantWithDay(tomorrowByKind.until, now);
  // Role view (site bed manager): a site holds only some bed types (Royal Perth has no youth ward),
  // so a type with nobody waiting, no bed that fits and nothing forecast is left out, not drawn as 0.
  const typeRows = hideEmptyTypes
    ? gapRows.filter((row) => {
        const next = byId.get(row.id);
        const forecastNothing = next === undefined || (next.low === 0 && next.likely === 0 && next.high === 0);
        return row.waiting > 0 || row.bedsThatFit > 0 || !forecastNothing;
      })
    : gapRows;
  const shortRows = typeRows.filter((row) => row.gap < 0);
  const rows = show === "all" ? typeRows : show === "short" ? shortRows : typeRows.filter((row) => row.gap >= 0);
  return (
    <Card aria-labelledby="capacity-mismatch-title">
      {/* Polish (Josh, 31 Oct 2026): the title row carries a Short / Enough filter, and the bed
          types are one compact strip that scrolls sideways when the page is narrow, so the band
          never grows taller. */}
      <CardHead
        id="capacity-mismatch-title"
        title="Mismatch"
        action={
          <Segmented
            label="Show bed types"
            items={[
              { id: "all" as const, label: "All", count: typeRows.length },
              { id: "short" as const, label: "Short", count: shortRows.length },
              { id: "enough" as const, label: "Enough", count: typeRows.length - shortRows.length },
            ]}
            value={show}
            onChange={setShow}
          />
        }
      />
      {rows.length === 0 ? (
        <p className={styles.mmEmpty}>
          {show === "short" ? "No bed type is short now." : "Every bed type is short now."}
        </p>
      ) : (
        <ul className={styles.mmStrip} aria-label="Bed types, now and tomorrow">
          {rows.map((row) => (
            <MismatchTile
              key={row.id}
              title={shortNeed(row.need)}
              row={row}
              tomorrow={byId.get(row.id)}
              span={span}
              until={until}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function MismatchTile({
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
    <li className={styles.mmTile}>
      <div className={styles.mmTileHead}>
        <h3 className={styles.mmTileTitle}>{title}</h3>
        <span className={`${styles.mmTileNow} ${short ? styles.warnInk : styles.okInk}`}>
          <StatusGlyph tone={short ? "warning" : "success"} size={9} />
          {gapWords(row.gap)}
        </span>
      </div>
      <p className={styles.mmSub}>
        {row.waiting} waiting · {row.bedsThatFit} ready that fit
      </p>
      {tomorrow ? (
        <div className={styles.mmTileTomorrow}>
          <span className={styles.mmTileLabel}>
            Tomorrow<span className={styles.srOnly}>, likely by {until}:</span>
          </span>
          <RangeLine low={tomorrow.low} likely={tomorrow.likely} high={tomorrow.high} span={span} />
          <b className={tomorrow.likely < 0 ? styles.warnInk : styles.okInk}>{gapWords(tomorrow.likely)}</b>
          <span className={styles.mmTileRange}>
            <span className={styles.srOnly}>Range </span>
            {gapWords(tomorrow.low)} to {gapWords(tomorrow.high)}
          </span>
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
