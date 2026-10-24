"use client";

// src/components/ward-management/forecast/forecast-track-record.tsx
//
// Statistics' "Forecast track record" (forecasting build, Josh, 23 Oct 2026, screen 8). Three
// readings, each from records: how the forecast did against what happened (daily snapshots, with
// an honest empty state until two days exist), discharge dates that held by ward
// (`wardStatistics`), and ED referrals by hour of the day (`movements.openedAt`).
import { useMemo } from "react";
import { LineChart } from "lucide-react";

import { CardBody } from "@/components/wf";
import { StatCard } from "@/components/ward-management/statistics/statistics-hero";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import { isEdOriginJourney } from "@/components/ward-management/ward-ed-presence";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { wardStatistics } from "@/components/ward-management/ward-statistics";
import { kindRangeWord } from "./forecast-by-kind";
import { referralsByHour } from "./forecast-history";
import { useForecastHistory, useForecastModel } from "./use-forecast-model";
import styles from "./forecast.module.css";

const WARDS_SHOWN = 6;

export function ForecastTrackRecordCard({
  now,
  units,
  admissions,
  movements,
}: {
  now: Instant;
  units: readonly Unit[];
  admissions: Admission[];
  movements: readonly Movement[];
}) {
  const model = useForecastModel(now);
  const { record } = useForecastHistory(model, now);
  const held = useMemo(
    () =>
      units
        .map((unit) => ({ unit, outcome: wardStatistics(unit.id, admissions, now).dischargeDateOutcomes }))
        .filter((row) => row.outcome.consideredCount > 0)
        .map((row) => ({ name: row.unit.name, ...row.outcome, share: row.outcome.met / row.outcome.consideredCount }))
        .sort((a, b) => a.share - b.share || b.consideredCount - a.consideredCount)
        .slice(0, WARDS_SHOWN),
    [units, admissions, now],
  );
  const hours = useMemo(
    () => referralsByHour(movements.filter(isEdOriginJourney).map((movement) => movement.openedAt)),
    [movements],
  );
  const busiest = Math.max(1, ...hours);
  const peak = hours.indexOf(Math.max(...hours));
  const referralsOnRecord = hours.reduce((a, b) => a + b, 0);

  return (
    <StatCard
      id="forecast-track-record"
      icon={LineChart}
      title="Forecast track record"
      data-testid="ward-statistics-forecast"
    >
      <CardBody>
        <h3 className={styles.groupHead}>Forecast against what happened</h3>
        {record.days.length === 0 ? (
          <p className={styles.caption} data-testid="ward-statistics-forecast-empty">
            Needs two days of forecasts. Each day the first forecast view records tomorrow&apos;s range, and the next
            day&apos;s gap is compared with it.
          </p>
        ) : (
          <>
            <p className={styles.caption}>
              {record.inRange} of {record.days.length} {record.days.length === 1 ? "day" : "days"} landed inside the
              forecast range. Average miss {record.averageMiss} {record.averageMiss === 1 ? "bed" : "beds"}.
            </p>
            <ul className={styles.bars}>
              {record.days.slice(-7).map((day) => (
                <li key={day.day} className={styles.kv}>
                  <span>Day {day.day}</span>
                  <span>
                    forecast {kindRangeWord(day.forecast.likely)}, was {kindRangeWord(day.actual)}
                    {day.inRange ? "" : ", outside the range"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 className={styles.groupHead}>Discharge dates that held, by ward</h3>
        {held.length === 0 ? (
          <p className={styles.caption}>No ward has a discharge with a recorded planned date yet.</p>
        ) : (
          <ul className={styles.bars} data-testid="ward-statistics-forecast-held">
            {held.map((row) => (
              <li key={row.name} className={styles.barRow}>
                <span>{row.name}</span>
                <span className={styles.barTrack} aria-hidden="true">
                  <span
                    className={styles.barFill}
                    style={{ display: "block", width: `${Math.round(row.share * 100)}%` }}
                  />
                </span>
                <span className={styles.mono}>
                  {row.met} of {row.consideredCount}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.caption}>Lowest first. A date that moved before the day still counts if it held.</p>

        <h3 className={styles.groupHead}>ED referrals by hour</h3>
        <div className={styles.hours} aria-hidden="true">
          {hours.map((count, hour) => (
            <span key={hour} className={styles.hourBar} style={{ height: `${Math.round((count / busiest) * 100)}%` }} />
          ))}
        </div>
        <p className={styles.hourLabels} aria-hidden="true">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>23</span>
        </p>
        <p className={styles.caption} data-testid="ward-statistics-forecast-hours">
          {referralsOnRecord === 0
            ? "No ED referrals on record yet."
            : `${referralsOnRecord} ED referrals on record. Busiest hour starts at ${String(peak).padStart(2, "0")}:00.`}{" "}
          Shown to help staff a bed meeting, not to predict arrivals.
        </p>
      </CardBody>
    </StatCard>
  );
}
