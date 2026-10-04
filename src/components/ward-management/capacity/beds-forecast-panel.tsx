// src/components/ward-management/capacity/beds-forecast-panel.tsx
//
// Tomorrow's beds forecast on the Capacity screen. Presentation only: every figure comes from
// `bedsForecast` (`beds-forecast.ts`). Clean executive summary of rolling 24h and 48h network capacity.
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { forecastHeadline, forecastRangeEnd, type BedsForecast, type BedsForecastHorizon } from "./beds-forecast";
import styles from "./beds-forecast.module.css";

export function BedsForecastPanel({ forecast }: { forecast: BedsForecast }) {
  return (
    <section
      className={styles.forecastSection}
      aria-label="Tomorrow's beds forecast"
      data-testid="ward-capacity-beds-forecast"
    >
      <div className={styles.forecastHeader}>
        <h3 className={styles.forecastTitle}>Tomorrow&apos;s beds</h3>
        <span className={styles.forecastScope}>Estimate, whole network</span>
      </div>
      <div className={styles.horizons}>
        {forecast.horizons.map((horizon) => (
          <ForecastHorizon key={horizon.hours} horizon={horizon} now={forecast.now} />
        ))}
      </div>
    </section>
  );
}

function ForecastHorizon({ horizon, now }: { horizon: BedsForecastHorizon; now: number }) {
  const short = horizon.likely < 0;
  return (
    <div
      className={styles.horizon}
      aria-label={`In ${horizon.hours} hours`}
      data-testid={`ward-capacity-beds-forecast-${horizon.hours}h`}
    >
      <div className={styles.horizonHeadingRow}>
        <span className={styles.horizonLabel}>In {horizon.hours} hours</span>
        <span className={styles.until}>by {formatInstantWithDay(horizon.until, now)}</span>
      </div>
      <p
        className={styles.headline}
        data-short={short ? "true" : "false"}
        data-testid={`ward-capacity-beds-forecast-${horizon.hours}h-likely`}
      >
        {forecastHeadline(horizon.likely)}
      </p>
      <p className={styles.range}>
        Range: {forecastRangeEnd(horizon.low)} to {forecastRangeEnd(horizon.high)}
      </p>
    </div>
  );
}
