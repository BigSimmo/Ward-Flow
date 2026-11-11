"use client";

// src/components/ward-management/forecast/forecast-brief-panel.tsx
//
// "Brief for this meeting" on the bed meeting screen (forecasting build, Josh, 23 Oct 2026,
// screen 5). Four fixed sentences from `forecastBrief`, then the latest dated historical comparison.
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { kindRangeWord } from "./forecast-by-kind";
import { forecastBrief } from "./forecast-brief";
import { FORECAST_METHOD_LINE } from "@/components/ward-management/ward-forecast-method";
import { forecastEdName, useForecastHistory, useForecastModel } from "./use-forecast-model";
import styles from "./forecast.module.css";

export function ForecastBriefPanel({ now }: { now: Instant }) {
  const model = useForecastModel(now);
  const { record } = useForecastHistory(model, now);
  const lines = forecastBrief(model.tomorrow, model.levers, model.risk, forecastEdName);
  const latest = record.days.at(-1);
  return (
    <div data-testid="forecast-brief">
      <dl className={styles.brief}>
        {lines.map((line) => (
          <div key={line.label} className={styles.briefItem}>
            <dt className={styles.briefLabel}>{line.label}</dt>
            <dd className={styles.briefItem}>{line.text}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.caption} data-testid="forecast-brief-method">
        {FORECAST_METHOD_LINE}
      </p>
      {latest ? (
        <p className={styles.caption}>
          {`Forecast recorded ${formatInstantWithDay(latest.forecastAt, now)}: ${kindRangeWord(latest.forecast.likely)} for the next day. Result recorded ${formatInstantWithDay(latest.actualAt, now)}: ${kindRangeWord(latest.actual)}.`}
        </p>
      ) : null}
    </div>
  );
}
