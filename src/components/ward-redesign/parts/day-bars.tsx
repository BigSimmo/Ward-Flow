import styles from "./day-bars.module.css";

export type DayBar = {
  key: string | number;
  /** "Thu 29". */
  label: string;
  /** "Today", "Weekend", "May move". */
  sub: string;
  value: number;
  /** Solid when the figure is firm (today and tomorrow); hatched when it may still move. */
  firm: boolean;
  /** A small second figure under the bar, such as planned admissions. Hidden at 0. */
  second?: number;
};

const W = 700;
const H = 214;
const TOP = 24;
const BASE = 150;
const BAR = 30;

/**
 * A short run of days as bars, with the figure printed on each. Drawn in a fixed view box that
 * scales to its column, so it reads the same at 1440 px and on a tablet. The whole chart is one
 * image to a screen reader; `summary` says every figure in words.
 */
export function DayBars({
  days,
  summary,
  secondLabel = "in",
}: {
  days: readonly DayBar[];
  summary: string;
  secondLabel?: string;
}) {
  const max = Math.max(5, ...days.map((day) => day.value));
  const top = niceTop(max);
  const y = (value: number) => BASE - (value / top) * (BASE - TOP);
  const step = (W - 60) / Math.max(1, days.length);
  const ticks = [0, top / 2, top];
  return (
    <div className={styles.wrap}>
      <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        <defs>
          <pattern
            id="wf-day-bars-hatch"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" className={styles.hatchGround} />
            <line x1="0" y1="0" x2="0" y2="6" className={styles.hatchLine} />
          </pattern>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={40} x2={W - 8} y1={y(tick)} y2={y(tick)} className={styles.grid} />
            <text x={32} y={y(tick) + 4} textAnchor="end" className={styles.axis}>
              {tick}
            </text>
          </g>
        ))}
        {days.map((day, index) => {
          const cx = 52 + step * index + step / 2;
          const height = Math.max(0, BASE - y(day.value));
          return (
            <g key={day.key}>
              <rect
                x={cx - BAR / 2}
                y={BASE - height}
                width={BAR}
                height={height}
                rx={4}
                className={day.firm ? styles.firm : styles.later}
              />
              <text x={cx} y={BASE - height - 6} textAnchor="middle" className={styles.value}>
                {day.value}
              </text>
              {day.second ? (
                <>
                  <rect x={cx - BAR / 2} y={BASE + 3} width={BAR} height={9} rx={3} className={styles.second} />
                  <text x={cx + BAR / 2 + 4} y={BASE + 12} className={styles.secondLabel}>
                    {day.second} {secondLabel}
                  </text>
                </>
              ) : null}
              <text
                x={cx}
                y={BASE + 34}
                textAnchor="middle"
                className={`${styles.day} ${day.firm ? styles.dayFirm : ""}`}
              >
                {day.label}
              </text>
              <text x={cx} y={BASE + 51} textAnchor="middle" className={styles.daySub}>
                {day.sub}
              </text>
            </g>
          );
        })}
        <line x1={40} x2={W - 8} y1={BASE} y2={BASE} className={styles.base} />
      </svg>
    </div>
  );
}

function niceTop(max: number): number {
  const steps = [5, 10, 20, 30, 40, 50, 60, 80, 100];
  return steps.find((value) => value >= max) ?? Math.ceil(max / 50) * 50;
}
