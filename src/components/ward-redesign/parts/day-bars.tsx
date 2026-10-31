"use client";

import { useEffect, useId, useRef, useState } from "react";

import styles from "./day-bars.module.css";

export type DayBar = {
  key: string | number;
  /** "Thu 29". */
  label: string;
  /** "Today", "Weekend", "May move". */
  sub: string;
  value: number;
  /** Solid when the figure is firm (today and tomorrow); hatched when it may still move. */
  firm: boolean;
  /** A small second figure under the bar, such as planned admissions. Hidden at 0. */
  second?: number;
};

/** The width drawn before the column is measured (and the server's width). */
const FALLBACK_W = 700;
/** Below this many pixels a day, the chart drops each day's second line and centres "1 in" under its bar. */
const NARROW_STEP = 64;
const LEFT = 32;
const RIGHT = 8;

/**
 * A short run of days as bars, with the figure printed on each. The whole chart is one image to a
 * screen reader; `summary` says every figure in words.
 *
 * Final design check (31 Oct 2026): the view box used to be a fixed 700 units scaled to the column,
 * so on a 390 px phone every label shrank to 6 or 7 px. The chart now measures its column and draws
 * one unit per pixel, so labels stay at the kit's 12 px at every width (desktop no larger than
 * before). Where a day is narrower than 64 px (a phone) the bars are a little shorter, "1 in" sits
 * centred under its bar, and each day's second line ("May move", "Weekend") is left to the legend;
 * a public holiday is named in one line under the chart instead.
 */
export function DayBars({
  days,
  summary,
  secondLabel = "in",
}: {
  days: readonly DayBar[];
  summary: string;
  secondLabel?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<number | undefined>();
  const hatchId = `wf-day-bars-hatch-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (wrap === null) return;
    const measure = () => {
      const width = Math.round(wrap.clientWidth);
      if (width > 0) setMeasured(width);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  const W = measured ?? FALLBACK_W;
  const step = (W - LEFT - RIGHT - 12) / Math.max(1, days.length);
  const narrow = step < NARROW_STEP;
  const TOP = narrow ? 20 : 24;
  const BASE = narrow ? 128 : 150;
  const BAR = Math.round(Math.min(30, Math.max(14, step * 0.5)));
  const secondY = narrow ? BASE + 26 : BASE + 12;
  const dayY = narrow ? BASE + 46 : BASE + 34;
  const H = narrow ? BASE + 56 : BASE + 64;

  const max = Math.max(5, ...days.map((day) => day.value));
  const top = niceTop(max);
  const y = (value: number) => BASE - (value / top) * (BASE - TOP);
  // A half-way line only when it is a whole number of beds (no "2.5").
  const ticks = Number.isInteger(top / 2) ? [0, top / 2, top] : [0, top];
  const holidays = narrow ? days.filter((day) => day.sub === "Public holiday") : [];

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${W} ${H}`}
        // One unit a pixel once measured, so text never scales below its set size.
        width={measured}
        height={measured === undefined ? undefined : H}
        role="img"
        aria-label={summary}
      >
        <defs>
          <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" className={styles.hatchGround} />
            <line x1="0" y1="0" x2="0" y2="6" className={styles.hatchLine} />
          </pattern>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={LEFT + 6} x2={W - RIGHT} y1={y(tick)} y2={y(tick)} className={styles.grid} />
            <text x={LEFT} y={y(tick) + 4} textAnchor="end" className={styles.axis}>
              {tick}
            </text>
          </g>
        ))}
        {days.map((day, index) => {
          const cx = LEFT + 12 + step * index + step / 2;
          const height = Math.max(0, BASE - y(day.value));
          return (
            <g key={day.key}>
              <rect
                x={cx - BAR / 2}
                y={BASE - height}
                width={BAR}
                height={height}
                rx={4}
                className={day.firm ? styles.firm : styles.later}
                fill={day.firm ? undefined : `url(#${hatchId})`}
              />
              <text x={cx} y={BASE - height - 6} textAnchor="middle" className={styles.value}>
                {day.value}
              </text>
              {day.second ? (
                <>
                  <rect
                    x={cx - BAR / 2}
                    y={BASE + 3}
                    width={BAR}
                    height={narrow ? 8 : 9}
                    rx={3}
                    className={styles.second}
                  />
                  <text
                    x={narrow ? cx : cx + BAR / 2 + 4}
                    y={secondY}
                    textAnchor={narrow ? "middle" : "start"}
                    className={styles.secondLabel}
                  >
                    {day.second} {secondLabel}
                  </text>
                </>
              ) : null}
              <text x={cx} y={dayY} textAnchor="middle" className={`${styles.day} ${day.firm ? styles.dayFirm : ""}`}>
                {day.label}
              </text>
              {narrow ? null : (
                <text x={cx} y={BASE + 51} textAnchor="middle" className={styles.daySub}>
                  {day.sub}
                </text>
              )}
            </g>
          );
        })}
        <line x1={LEFT + 6} x2={W - RIGHT} y1={BASE} y2={BASE} className={styles.base} />
      </svg>
      {holidays.length > 0 ? (
        <p className={styles.note}>Public holiday: {holidays.map((day) => day.label).join(", ")}.</p>
      ) : null}
    </div>
  );
}

function niceTop(max: number): number {
  const steps = [5, 10, 20, 30, 40, 50, 60, 80, 100];
  return steps.find((value) => value >= max) ?? Math.ceil(max / 50) * 50;
}
