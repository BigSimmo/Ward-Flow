"use client";

import { useMemo, useState } from "react";

import { SrOnly, ShowMoreRow, foldHidden, foldLimit } from "@/components/wf";

import type { Admission } from "@/components/ward-management/ward-admissions";
import { perthDateLabel, type Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { Foot, StatCardR } from "@/components/ward-management/statistics/redesign/statistics-redesign-parts";
import { delayedDischargeHeatmap, heatStep } from "./delay-heatmap";
import type { ReportWeek } from "./weekly-report";
import styles from "./weekly-delay-heatmap.module.css";

/** One decimal throughout, so a column of part and whole days lines up ("2.0" beside "0.9"). */
function bedDays(value: number): string {
  return value === 0 ? "0" : value.toFixed(1);
}

/** Wards shown before "Show all": the design system's eight rows. */
const WARDS_SHOWN = 8;

/** A day with nothing lost stays blank so the shaded days stand out; a screen reader still hears 0. */
function Figure({ value, shown }: { value: number; shown: boolean }) {
  if (!shown) return null;
  if (value === 0) return <SrOnly>0</SrOnly>;
  return <>{bedDays(value)}</>;
}

/**
 * Feature 42 (Josh, 9 Nov 2026): bed days lost to delayed discharge, ward by day, for the week the
 * page shows. Rows are wards with any, most first; cells carry the figure and one neutral-to-amber
 * shade; the last column and row are totals. A phone stacks each ward over its seven day cells.
 * Every figure comes from `delayedDischargeHeatmap`; nothing here counts.
 */
export function WeeklyDelayHeatmap({
  units,
  admissions,
  bedReleases,
  week,
  now,
  dayZero,
  isPhone,
  pressureBedDays,
}: {
  units: readonly Unit[];
  admissions: readonly Admission[];
  bedReleases: readonly BedRelease[];
  week: ReportWeek;
  now: Instant;
  dayZero: Date;
  isPhone: boolean;
  /** The week's "Delayed discharge" figure in Pressure this week, so a difference is said, not left. */
  pressureBedDays?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const map = useMemo(
    () => delayedDischargeHeatmap(units, admissions, bedReleases, week.start, week.countedEnd),
    [units, admissions, bedReleases, week.start, week.countedEnd],
  );
  const hidden = foldHidden(map.rows.length, WARDS_SHOWN);
  const limit = showAll ? map.rows.length : foldLimit(map.rows.length, WARDS_SHOWN);
  const dayLabel = (start: Instant) => perthDateLabel(start, dayZero, { weekday: "short", day: "numeric" });
  const shown = (start: Instant) => start < week.countedEnd && start <= now;
  const foot = (
    <Foot
      how={[
        "A bed day counts from the current expected date (from when it was set) or from a recorded hold-up, until the person left or now. A minute covered by both counts once.",
        "A hold-up with no recorded end is not counted.",
      ]}
    >
      {map.wardsWithNone > 0 ? `${map.wardsWithNone} more wards with none` : "Every ward in view"}
      {pressureBedDays !== undefined && Math.abs(pressureBedDays - map.total) >= 0.05
        ? `. Pressure this week counts ${bedDays(pressureBedDays)} past the expected date only; this grid adds ${bedDays(
            Math.round((map.total - pressureBedDays) * 10) / 10,
          )} under recorded hold-ups.`
        : null}
    </Foot>
  );
  const legend = (
    <div className={styles.legend} aria-hidden="true">
      <span>Bed days a day</span>
      {[1, 2, 3, 4].map((step) => (
        <i key={step} className={styles.swatch} data-step={step} />
      ))}
      <span>up to {bedDays(map.max)}</span>
    </div>
  );
  return (
    <StatCardR
      id="rd-delay-heatmap"
      title="Bed days lost to delayed discharge"
      meta={`${bedDays(map.total)} bed days`}
      foot={foot}
      data-testid="ward-weekly-delay-heatmap"
    >
      {map.rows.length === 0 ? (
        <p className={styles.empty}>No bed days lost to delayed discharge in this week.</p>
      ) : isPhone ? (
        // Polish (9 Nov 2026): the phone keeps the days. Each ward is its name and week total over a
        // strip of seven narrow shaded day cells; the day letters sit once above, the totals last.
        <div className={styles.phone}>
          <div className={styles.phoneDays} aria-hidden="true">
            {map.dayStarts.map((start) => (
              <span key={start}>{dayLabel(start)}</span>
            ))}
          </div>
          <ol className={styles.list} aria-label="Wards by bed days lost this week">
            {[...map.rows.slice(0, limit), { unitId: "", name: "Total", days: map.dayTotals, total: map.total }].map(
              (row) => (
                <li key={row.unitId || "total"} data-total={row.unitId ? undefined : "true"}>
                  <span className={styles.phoneName}>{row.name}</span>
                  <span className={styles.figure}>{bedDays(row.total)}</span>
                  <span className={styles.strip}>
                    {row.days.map((value, index) => (
                      <span
                        key={map.dayStarts[index]}
                        className={styles.cell}
                        data-step={row.unitId ? heatStep(value, map.max) : undefined}
                      >
                        <SrOnly>{dayLabel(map.dayStarts[index]!)} </SrOnly>
                        <Figure value={value} shown={shown(map.dayStarts[index]!)} />
                      </span>
                    ))}
                  </span>
                </li>
              ),
            )}
          </ol>
          {legend}
        </div>
      ) : (
        <>
          <div className={styles.scroll} role="region" aria-label="Bed days lost by ward and day" tabIndex={0}>
            <table className={styles.grid}>
              <caption className="sr-only">
                Bed days lost to delayed discharge, by ward and day, synthetic. Totals in the last row and column.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Ward</th>
                  {map.dayStarts.map((start) => (
                    <th key={start} scope="col" className={styles.num}>
                      {dayLabel(start)}
                    </th>
                  ))}
                  <th scope="col" className={styles.num}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {map.rows.slice(0, limit).map((row) => (
                  <tr key={row.unitId}>
                    <th scope="row">{row.name}</th>
                    {row.days.map((value, index) => (
                      <td key={map.dayStarts[index]} className={styles.cell} data-step={heatStep(value, map.max)}>
                        <Figure value={value} shown={shown(map.dayStarts[index]!)} />
                      </td>
                    ))}
                    <td className={`${styles.num} ${styles.total}`}>{bedDays(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  {map.dayTotals.map((value, index) => (
                    <td
                      key={map.dayStarts[index]}
                      className={`${styles.num} ${styles.total}`}
                      data-zero={value === 0 ? "true" : undefined}
                    >
                      {shown(map.dayStarts[index]!) ? bedDays(value) : ""}
                    </td>
                  ))}
                  <td className={`${styles.num} ${styles.total}`}>{bedDays(map.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {legend}
        </>
      )}
      {hidden > 0 ? (
        <ShowMoreRow onClick={() => setShowAll((open) => !open)} expanded={showAll}>
          {showAll ? "Show fewer" : `Show all ${map.rows.length} wards`}
        </ShowMoreRow>
      ) : null}
    </StatCardR>
  );
}
