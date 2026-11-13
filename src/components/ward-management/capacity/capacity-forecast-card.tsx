"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { Badge, Button, Card, CardHead } from "@/components/wf";
import type { BedKindId } from "./capacity-derivations";

import { helpItems, tagText } from "./capacity-bed-forecast";
import { LeverPopup, type HelpItem } from "./capacity-lever-popup";
import type { CapacityModel } from "./capacity-model";
import styles from "./capacity-page.module.css";

/** "17 short", "9 spare", "enough". */
export function gapShortWords(gap: number): string {
  if (gap === 0) return "enough";
  return gap < 0 ? `${-gap} short` : `${gap} spare`;
}

const KIND_SHORT: Record<BedKindId, string> = {
  locked_adult: "Locked",
  open_adult: "Open",
  older_adult: "Older",
  youth: "Youth",
};

/**
 * Forecast (wave 4, notes item 6, ruling 8, D-191): a rail card in place of the full-width forecast.
 * Tomorrow by bed type, the next two days hatched ("may move"), what goes out over seven days, and
 * "What would help tomorrow". Open shows the existing drawer with the chart and expected occupancy,
 * which leave the page. Every figure is the forecast model's (`bedsForecast`, `forecastByKind`,
 * `sevenDayHorizon`); nothing is counted here.
 */
export function ForecastCard({
  model,
  onOpen,
  onWard,
  onAskWard,
  networkWide = false,
  testId = "capacity-forecast-card",
}: {
  model: CapacityModel;
  onOpen: () => void;
  onWard: (unitId: string) => void;
  onAskWard?: (unitId: string) => void;
  networkWide?: boolean;
  testId?: string;
}) {
  const [openItem, setOpenItem] = useState<HelpItem | null>(null);
  const { forecast, tomorrowByKind, week, days, forecastModel, networkRows, now } = model;
  const [tomorrow, ...laterDays] = forecast.horizons;
  const weekOut = week.total.out.reduce((sum, value) => sum + value, 0);
  const firmOut = days.reduce((sum, day, index) => sum + (day.offset < 2 ? (week.total.out[index] ?? 0) : 0), 0);
  const byKind = tomorrowByKind.kinds
    .map((kind) =>
      kind.likely < 0
        ? `${KIND_SHORT[kind.id]} ${-kind.likely}`
        : kind.likely > 0
          ? `${KIND_SHORT[kind.id]} ${kind.likely} spare`
          : "",
    )
    .filter(Boolean)
    .join(" · ");
  const items = helpItems(forecastModel.levers, networkRows, now);
  return (
    <Card aria-labelledby="capacity-forecast-card-title" data-testid={testId}>
      <CardHead
        id="capacity-forecast-card-title"
        title="Forecast"
        meta={networkWide ? "From ward dates · Network-wide" : "From ward dates"}
        action={
          <Button
            size="sm"
            variant="ghost"
            onClick={onOpen}
            aria-haspopup="dialog"
            data-testid="capacity-forecast-open"
          >
            Open
          </Button>
        }
      />
      <ul className={styles.railRows}>
        {tomorrow ? (
          <li className={styles.railRow}>
            <span className={styles.railRowMain}>
              <span className={styles.railName}>Tomorrow</span>
              <span className={styles.railSub}>{byKind || "Every bed type has enough"}</span>
            </span>
            <span className={`${styles.railValue}${tomorrow.likely < 0 ? ` ${styles.warnInk}` : ""}`}>
              {gapShortWords(tomorrow.likely)}
            </span>
          </li>
        ) : null}
        {laterDays.slice(0, 2).map((day, index) => (
          <li key={day.hours} className={styles.railRow}>
            <span className={styles.railRowMain}>
              <span className={styles.railName}>
                <span className={styles.railHatch} aria-hidden="true" />
                In {index + 2} days
              </span>
              <span className={styles.railSub}>
                Range {gapShortWords(day.low)} to {gapShortWords(day.high)} · may move
              </span>
            </span>
            <span className={styles.railValue}>{gapShortWords(day.likely)}</span>
          </li>
        ))}
        <li className={styles.railRow}>
          <span className={styles.railRowMain}>
            <span className={styles.railName}>Going out · {days.length} days</span>
            <span className={styles.railSub}>{firmOut} firm today and tomorrow</span>
          </span>
          <span className={styles.railValue}>{weekOut} beds</span>
        </li>
      </ul>
      <p className={styles.railSubHead}>What would help tomorrow</p>
      {items.length === 0 ? (
        <p className={styles.railEmpty}>Nothing on record would move tomorrow&apos;s figure.</p>
      ) : (
        <ul className={styles.railHelps}>
          {items.map((item) => (
            <li key={item.kind}>
              <button
                type="button"
                className={styles.railHelp}
                aria-haspopup="dialog"
                onClick={() => setOpenItem(item)}
              >
                <span className={styles.railHelpTitle}>{item.title}</span>
                <Badge size="sm" className={styles.railHelpTag}>
                  {tagText(item)}
                </Badge>
                <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <LeverPopup
        item={openItem}
        now={now}
        onClose={() => setOpenItem(null)}
        onWard={(unitId) => {
          setOpenItem(null);
          onWard(unitId);
        }}
        onAskWard={onAskWard}
      />
    </Card>
  );
}
