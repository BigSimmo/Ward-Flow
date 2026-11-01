"use client";

// src/components/ward-management/forecast/forecast-brief-panel.tsx
//
// "Brief for this meeting" on the bed meeting screen (forecasting build, Josh, 23 Oct 2026,
// screen 5). Four fixed sentences from `forecastBrief`, then how yesterday's forecast for today did.
import type { Instant } from "@/components/ward-management/ward-clock";
import { kindRangeWord } from "./forecast-by-kind";
import { forecastBrief } from "./forecast-brief";
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
      {latest ? (
        <p className={styles.caption}>
          {`Yesterday's forecast for today was ${kindRangeWord(latest.forecast.likely)}, and it is now ${kindRangeWord(latest.actual)}.`}
        </p>
      ) : null}
    </div>
  );
}
