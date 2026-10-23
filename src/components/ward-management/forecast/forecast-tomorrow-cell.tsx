// src/components/ward-management/forecast/forecast-tomorrow-cell.tsx
//
// Tomorrow's likely figure for one bed type, with its range in words (forecasting build, Josh,
// 23 Oct 2026, screens 1 and 2). Shared by the Capacity mismatch table and Home's Beds that fit.
import { kindRangeWord, signedFigure } from "./forecast-by-kind";
import styles from "./forecast.module.css";

export function ForecastTomorrowFigure({ likely, low, high }: { likely: number; low: number; high: number }) {
  return (
    <span className={styles.tomorrowCell}>
      <span className={`${styles.tomorrowValue} ${likely < 0 ? styles.short : styles.spare}`}>
        {signedFigure(likely)}
      </span>
      <span>
        Range {kindRangeWord(low)} to {kindRangeWord(high)}
      </span>
    </span>
  );
}
