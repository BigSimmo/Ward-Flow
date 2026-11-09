"use client";

import { useMemo } from "react";

import type { Admission } from "@/components/ward-management/ward-admissions";
import { perthDateLabel, type Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { Foot, StatCardR } from "@/components/ward-management/statistics/redesign/statistics-redesign-parts";
import { delayedDischargeHeatmap, heatStep } from "./delay-heatmap";
import type { ReportWeek } from "./weekly-report";
import styles from "./weekly-delay-heatmap.module.css";

/** One decimal, so part days read; a whole day without the ".0". */
function bedDays(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Feature 42 (Josh, 9 Nov 2026): bed days lost to delayed discharge, ward by day, for the week the
 * page shows. Rows are wards with any, most first; cells carry the figure and one neutral-to-amber
 * shade; the last column and row are totals. A phone shows the wards' weekly totals as a list.
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
}: {
  units: readonly Unit[];
  admissions: readonly Admission[];
  bedReleases: readonly BedRelease[];
  week: ReportWeek;
  now: Instant;
  dayZero: Date;
  isPhone: boolean;
}) {
  const map = useMemo(
    () => delayedDischargeHeatmap(units, admissions, bedReleases, week.start, week.countedEnd),
    [units, admissions, bedReleases, week.start, week.countedEnd],
  );
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
    </Foot>
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
        <ol className={styles.list} aria-label="Wards by bed days lost this week">
          {map.rows.map((row) => (
            <li key={row.unitId}>
              <span>{row.name}</span>
              <span className={styles.figure}>{bedDays(row.total)}</span>
            </li>
          ))}
        </ol>
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
                {map.rows.map((row) => (
                  <tr key={row.unitId}>
                    <th scope="row">{row.name}</th>
                    {row.days.map((value, index) => (
                      <td key={map.dayStarts[index]} className={styles.cell} data-step={heatStep(value, map.max)}>
                        {shown(map.dayStarts[index]!) ? bedDays(value) : ""}
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
                    <td key={map.dayStarts[index]} className={`${styles.num} ${styles.total}`}>
                      {shown(map.dayStarts[index]!) ? bedDays(value) : ""}
                    </td>
                  ))}
                  <td className={`${styles.num} ${styles.total}`}>{bedDays(map.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className={styles.legend} aria-hidden="true">
            <span>0</span>
            {[1, 2, 3, 4].map((step) => (
              <i key={step} className={styles.swatch} data-step={step} />
            ))}
            <span>{bedDays(map.max)} bed days</span>
          </div>
        </>
      )}
    </StatCardR>
  );
}
