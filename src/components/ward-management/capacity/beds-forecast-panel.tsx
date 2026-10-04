// src/components/ward-management/capacity/beds-forecast-panel.tsx
//
// Tomorrow's beds forecast on the Capacity screen. Presentation only: every figure comes from
// `bedsForecast` (`beds-forecast.ts`), and the working is printed beside each estimate so a
// coordinator can check it rather than trust it.
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { WardPanel } from "@/components/ward-management/ward-panel";
import {
  BEDS_FORECAST_LIMITS,
  forecastFigureText,
  forecastHeadline,
  forecastRangeEnd,
  type BedsForecast,
  type BedsForecastHorizon,
} from "./beds-forecast";
import styles from "./beds-forecast.module.css";

export function BedsForecastPanel({ forecast }: { forecast: BedsForecast }) {
  return (
    <WardPanel
      title="Tomorrow's beds"
      count="Estimate, whole network"
      blurb="Beds likely to be free, worked out from beds ready now, discharges on record and people already waiting."
      testId="ward-capacity-beds-forecast"
    >
      <div className={styles.horizons}>
        {forecast.horizons.map((horizon) => (
          <ForecastHorizon key={horizon.hours} horizon={horizon} now={forecast.now} />
        ))}
      </div>
      <ul className={styles.limits} aria-label="What this estimate cannot see">
        {BEDS_FORECAST_LIMITS.map((limit) => (
          <li key={limit}>{limit}</li>
        ))}
      </ul>
    </WardPanel>
  );
}

function ForecastHorizon({ horizon, now }: { horizon: BedsForecastHorizon; now: number }) {
  const short = horizon.likely < 0;
  return (
    <section
      className={styles.horizon}
      aria-label={`In ${horizon.hours} hours`}
      data-testid={`ward-capacity-beds-forecast-${horizon.hours}h`}
    >
      <h3 className={styles.horizonHeading}>
        In {horizon.hours} hours <span className={styles.until}>by {formatInstantWithDay(horizon.until, now)}</span>
      </h3>
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
      <details className={styles.working}>
        <summary>How this was worked out</summary>
        <dl className={styles.steps}>
          <Step label="Beds ready now" value={horizon.readyNow} sign="" />
          <Step label="Confirmed discharges due" value={horizon.confirmed} sign="+" />
          <Step label="Expected discharges due" value={horizon.expected} sign="+" />
          <Step label="People waiting for a bed now" value={horizon.waitingForBed} sign="−" />
          <Step label="Likely free" value={horizon.likely} sign="=" total />
        </dl>
        <p className={styles.note}>
          The low end counts only confirmed discharges. The high end also counts {horizon.heldUp} held up,{" "}
          {horizon.overdue} whose expected date has already passed, and {horizon.plannedNotFlagged} with a planned date
          on the discharge record that the ward has not flagged yet.
        </p>
      </details>
    </section>
  );
}

function Step({ label, value, sign, total = false }: { label: string; value: number; sign: string; total?: boolean }) {
  return (
    <div className={styles.step} data-total={total ? "true" : "false"}>
      <dt>
        <span className={styles.sign} aria-hidden="true">
          {sign}
        </span>
        {label}
      </dt>
      <dd>{total ? forecastFigureText(value) : value}</dd>
    </div>
  );
}
