"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { Card, CardHead, Segmented, StatusGlyph } from "@/components/wf";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import type { BedKindGap } from "./capacity-derivations";
import type { ForecastByKind, KindForecast } from "@/components/ward-management/forecast/forecast-by-kind";

import { gapWords, RangeLine } from "./capacity-range-line";
import type { CapacityModel } from "./capacity-model";
import { MismatchPopup } from "./capacity-mismatch-popup";
import styles from "./capacity-page.module.css";

type Range = Pick<KindForecast, "low" | "likely" | "high">;
type Show = "all" | "short" | "enough";

/**
 * Where the mismatch is: each bed type, now and likely by this time tomorrow. One card per type,
 * each with the same three lines in the same place, so the eye can run across them. Replaces the
 * table plus a separate "Tomorrow" strip. The network total is the forecast's Now figure, so it
 * is not repeated here as a fifth card (Josh, 30 Oct 2026).
 */
export function MismatchBand({
  model,
  hideEmptyTypes = false,
  onWard,
  networkWide = false,
}: {
  model: CapacityModel;
  hideEmptyTypes?: boolean;
  /** A service is chosen, but who is waiting is counted across the network, so the card says so. */
  networkWide?: boolean;
  /** Opens a ward's drawer from the pop-up's ready-bed list. */
  onWard?: (unitId: string) => void;
}) {
  const { gapRows, tomorrowByKind, now } = model;
  const [show, setShow] = useState<Show>("all");
  const [openKind, setOpenKind] = useState<BedKindGap["id"] | null>(null);
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
    <Card aria-labelledby="capacity-mismatch-title" data-testid="capacity-mismatch">
      {/* Polish (Josh, 31 Oct 2026): the title row carries a Short / Enough filter, and the bed
          types are one compact strip that scrolls sideways when the page is narrow, so the band
          never grows taller. */}
      <CardHead
        id="capacity-mismatch-title"
        title="Mismatch"
        meta={networkWide ? "Network-wide" : undefined}
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
        // A8 (accessibility check, 2 Nov 2026): the strip scrolls sideways, so a keyboard can reach it.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling region must take focus
        <ul className={styles.mmStrip} aria-label="Bed types, now and tomorrow" tabIndex={0}>
          {rows.map((row) => (
            <MismatchTile
              key={row.id}
              title={shortNeed(row.need)}
              row={row}
              tomorrow={byId.get(row.id)}
              span={span}
              until={until}
              onOpen={() => setOpenKind(row.id)}
            />
          ))}
        </ul>
      )}
      <MismatchPopup
        row={gapRows.find((row) => row.id === openKind) ?? null}
        title={shortNeed(gapRows.find((row) => row.id === openKind)?.need ?? "")}
        tomorrow={openKind ? byId.get(openKind) : undefined}
        now={now}
        onClose={() => setOpenKind(null)}
        units={model.gapUnits}
        onWard={
          onWard
            ? (unitId) => {
                setOpenKind(null);
                onWard(unitId);
              }
            : undefined
        }
      />
    </Card>
  );
}

function MismatchTile({
  title,
  row,
  tomorrow,
  span,
  until,
  onOpen,
}: {
  title: string;
  row: Pick<BedKindGap, "waiting" | "bedsThatFit" | "gap">;
  tomorrow: Range | undefined;
  span: number;
  until: string;
  onOpen: () => void;
}) {
  const short = row.gap < 0;
  // Capacity issue 1 (Josh, 3 Nov 2026): each card opens who is waiting and where the fitting beds
  // are. The card keeps its heading and figures; its one button stretches over the whole card, so a
  // tap anywhere opens it. Now and Tomorrow sit on the same labelled scale (short to the left of 0,
  // spare to the right), so the two points read as a timeline rather than two separate lines.
  return (
    <li className={`${styles.mmTile} ${styles.mmTileButton}`} data-tone={short ? "warning" : "success"}>
      <h3 className={styles.mmTileTitle}>{title}</h3>
      <p className={`${styles.mmHero} ${short ? styles.warnInk : styles.okInk}`}>
        <StatusGlyph tone={short ? "warning" : "success"} size={10} />
        {row.gap === 0 ? (
          <span className={styles.mmHeroWord}>exactly enough</span>
        ) : (
          <>
            <b>{Math.abs(row.gap)}</b> <span className={styles.mmHeroWord}>{short ? "short" : "spare that fit"}</span>
          </>
        )}
      </p>
      <p className={styles.mmSub}>
        {row.waiting} waiting · {row.bedsThatFit} ready that fit
        {/* WF-16: "spare" below is ready-that-fit minus waiting, not the network's all-ready count. */}
      </p>
      <div className={styles.mmScale}>
        <span className={styles.mmTileLabel}>Now</span>
        <RangeLine low={row.gap} likely={row.gap} high={row.gap} span={span} />
        <b className={short ? styles.warnInk : styles.okInk}>{gapWords(row.gap)}</b>
        {tomorrow ? (
          <>
            <span className={styles.mmTileLabel}>
              Tomorrow<span className={styles.srOnly}>, likely by {until}:</span>
            </span>
            <RangeLine low={tomorrow.low} likely={tomorrow.likely} high={tomorrow.high} span={span} />
            <b className={tomorrow.likely < 0 ? styles.warnInk : styles.okInk}>{gapWords(tomorrow.likely)}</b>
          </>
        ) : null}
        <span className={styles.mmAxis} aria-hidden="true">
          <span>Short</span>
          <span>0</span>
          <span>Spare that fit</span>
        </span>
      </div>
      {tomorrow ? (
        <p className={styles.mmTileRange}>
          Tomorrow could be {gapWords(tomorrow.low)} to {gapWords(tomorrow.high)}
        </p>
      ) : null}
      <button type="button" className={styles.mmTileOpen} aria-haspopup="dialog" onClick={onOpen}>
        Who is waiting and where<span className={styles.srOnly}>, {title}</span>
        <ChevronRight strokeWidth={1.75} size={14} aria-hidden="true" />
      </button>
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
