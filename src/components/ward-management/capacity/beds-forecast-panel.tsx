// src/components/ward-management/capacity/beds-forecast-panel.tsx
//
// The next 48 hours on the Capacity screen (v6). Presentation only: every figure comes from
// `bedsForecast` (`beds-forecast.ts`). Ready now is a solid column from zero; each horizon is its
// likely figure with a whisker over the low-to-high range. The same figures are written out for
// screen readers, with the exact range, beneath the drawing.
import { StatusGlyph } from "@/components/wf";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { forecastHeadline, forecastRangeEnd, type BedsForecast, type BedsForecastHorizon } from "./beds-forecast";
import styles from "./beds-forecast.module.css";

const WIDTH = 300;
const HEIGHT = 150;
const PLOT_LEFT = 34;
const PLOT_RIGHT = WIDTH - 8;
const PLOT_TOP = 10;
const PLOT_BOTTOM = HEIGHT - 26;
const BOX_WIDTH = 30;
const BOX_HALF_HEIGHT = 12;

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function niceStep(span: number): number {
  if (span <= 20) return 5;
  if (span <= 50) return 10;
  if (span <= 120) return 20;
  return 50;
}

export function BedsForecastPanel({ forecast }: { forecast: BedsForecast }) {
  const readyNow = forecast.horizons[0]?.readyNow ?? 0;
  const tomorrow = forecast.horizons[0];
  const values = [0, readyNow, ...forecast.horizons.flatMap((h) => [h.low, h.high, h.likely])];
  const step = niceStep(Math.max(...values) - Math.min(...values));
  const top = Math.ceil(Math.max(...values) / step) * step;
  const bottom = Math.floor(Math.min(...values) / step) * step;
  const span = Math.max(top - bottom, step);
  const y = (value: number) => PLOT_TOP + ((top - value) / span) * (PLOT_BOTTOM - PLOT_TOP);
  const ticks: number[] = [];
  for (let value = bottom; value <= top; value += step) ticks.push(value);
  const columns = [
    { id: "now", label: "Now" },
    ...forecast.horizons.map((horizon) => ({ id: `${horizon.hours}h`, label: `+${horizon.hours}h` })),
  ];
  const columnX = (index: number) =>
    PLOT_LEFT + ((index + 0.5) / columns.length) * (PLOT_RIGHT - PLOT_LEFT) - BOX_WIDTH / 2 - 12;

  return (
    <section
      className={styles.forecastSection}
      aria-label="Next 48 hours forecast"
      data-testid="ward-capacity-beds-forecast"
    >
      <div className={styles.forecastHeader}>
        <h3 className={styles.forecastTitle}>Next 48 hours</h3>
        <span className={styles.forecastScope}>whole network</span>
        {tomorrow ? (
          <span className={styles.forecastChip}>
            <StatusGlyph tone={tomorrow.likely < 0 ? "warning" : "success"} size={8} />
            <span className={styles.forecastChipValue}>{signed(tomorrow.likely)}</span> tomorrow
          </span>
        ) : null}
      </div>
      <svg className={styles.chart} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" focusable="false">
        {ticks.map((value) => (
          <g key={value}>
            <text className={styles.tickLabel} x={PLOT_LEFT - 8} y={y(value) + 4} textAnchor="end">
              {signed(value)}
            </text>
            {value === 0 ? (
              <line className={styles.zeroLine} x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y(0)} y2={y(0)} />
            ) : null}
          </g>
        ))}
        <g>
          <rect
            className={styles.nowBar}
            x={columnX(0)}
            y={Math.min(y(readyNow), y(0))}
            width={BOX_WIDTH}
            height={Math.max(Math.abs(y(0) - y(readyNow)), 2)}
            rx={4}
          />
          <ChartLabel x={columnX(0) + BOX_WIDTH + 4} y={y(readyNow) + 4} value={readyNow} />
        </g>
        {forecast.horizons.map((horizon, index) => {
          const x = columnX(index + 1);
          const centre = y(horizon.likely);
          return (
            <g key={horizon.hours}>
              <line
                className={styles.whisker}
                x1={x + BOX_WIDTH / 2}
                x2={x + BOX_WIDTH / 2}
                y1={y(horizon.high)}
                y2={y(horizon.low)}
              />
              <rect
                className={styles.likelyBox}
                x={x}
                y={centre - BOX_HALF_HEIGHT}
                width={BOX_WIDTH}
                height={BOX_HALF_HEIGHT * 2}
                rx={4}
              />
              <ChartLabel x={x + BOX_WIDTH + 4} y={centre + 4} value={horizon.likely} />
            </g>
          );
        })}
        {columns.map((column, index) => (
          <text
            key={column.id}
            className={styles.columnLabel}
            x={columnX(index) + BOX_WIDTH / 2}
            y={HEIGHT - 6}
            textAnchor="middle"
          >
            {column.label}
          </text>
        ))}
      </svg>
      <p className={styles.caption}>Estimate. Whiskers show the likely range.</p>
      <ul className={styles.horizons}>
        {forecast.horizons.map((horizon) => (
          <ForecastHorizon key={horizon.hours} horizon={horizon} now={forecast.now} />
        ))}
      </ul>
    </section>
  );
}

function ChartLabel({ x, y, value }: { x: number; y: number; value: number }) {
  return (
    <g>
      {value < 0 ? (
        <circle className={styles.markWarning} cx={x + 3} cy={y - 4} r={3} />
      ) : (
        <path className={styles.markSuccess} d={`M${x} ${y - 4} l2.4 2.4 l4.6 -5.2`} />
      )}
      <text className={styles.valueLabel} x={x + 10} y={y}>
        {signed(value)}
      </text>
    </g>
  );
}

function ForecastHorizon({ horizon, now }: { horizon: BedsForecastHorizon; now: number }) {
  return (
    <li
      className={styles.horizon}
      aria-label={`In ${horizon.hours} hours`}
      data-testid={`ward-capacity-beds-forecast-${horizon.hours}h`}
    >
      In {horizon.hours} hours, by {formatInstantWithDay(horizon.until, now)},{" "}
      <span data-testid={`ward-capacity-beds-forecast-${horizon.hours}h-likely`}>
        {forecastHeadline(horizon.likely)}
      </span>
      . Range {forecastRangeEnd(horizon.low)} to {forecastRangeEnd(horizon.high)}.
    </li>
  );
}
