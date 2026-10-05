// src/components/ward-management/capacity/beds-forecast-panel.tsx
//
// Tomorrow's beds forecast on the Capacity screen. Presentation only: every figure comes from
// `bedsForecast` (`beds-forecast.ts`). Clean executive summary of rolling 24h and 48h network capacity.
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import {
  forecastHeadline,
  forecastRangeEnd,
  type BedsForecast,
  type BedsForecastHorizon,
} from "@/components/ward-management/capacity/beds-forecast";
import styles from "./beds-forecast-polished.module.css";

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
      <ForecastRangeLine low={horizon.low} likely={horizon.likely} high={horizon.high} />
      <p className={styles.range}>
        Range: {forecastRangeEnd(horizon.low)} if only confirmed discharges go, {forecastRangeEnd(horizon.high)} if
        every expected one goes
      </p>
    </div>
  );
}

/**
 * Polish (5 Oct 2026): the range was a line of small print under a large headline. Drawn on one
 * scale with zero marked, the reader sees at once whether "likely" sits near the edge of shortage.
 */
function ForecastRangeLine({ low, likely, high }: { low: number; likely: number; high: number }) {
  const min = Math.min(low, 0);
  const span = Math.max(1, Math.max(high, 0) - min);
  const at = (value: number) => `${((value - min) / span) * 100}%`;
  return (
    <div
      className={styles.rangeTrack}
      role="img"
      aria-label={`Range ${forecastRangeEnd(low)} to ${forecastRangeEnd(high)}, likely ${forecastRangeEnd(likely)}`}
    >
      <span className={styles.rangeLine} style={{ left: at(low), right: `calc(100% - ${at(high)})` }} />
      <span className={styles.rangeZero} style={{ left: at(0) }} />
      <span className={styles.rangeLikely} style={{ left: at(likely) }} />
    </div>
  );
}
