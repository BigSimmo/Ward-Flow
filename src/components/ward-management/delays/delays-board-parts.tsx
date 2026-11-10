/** Small pieces shared by the Delays board and its graphs. */
import { StatusGlyph, type WfTone } from "@/components/wf";
import { DELAY_CAUSE_COPY, type DelayCause } from "./delays-derivations";
import { SILENT_MINUTES, WAIT_BANDS, type BandCounts, type BoardRow } from "./delays-board-model";
import styles from "./delays-board.module.css";

export function causeTitle(cause: DelayCause): string {
  return DELAY_CAUSE_COPY.find((entry) => entry.cause === cause)?.title ?? cause;
}

/** Under 8h, 8 to 12h, 12 to 24h and over 24h, left to right, with the counts in its name. */
export function BandBar({ bands, className }: { bands: BandCounts; className?: string }) {
  const total = bands.reduce((sum, n) => sum + n, 0);
  const label = WAIT_BANDS.map((band, index) => `${band}: ${bands[index]}`).join(", ");
  // An empty bar draws nothing, so it says nothing either.
  const named = total === 0 ? { "aria-hidden": true } : { role: "img", "aria-label": label };
  return (
    <span className={className ? `${styles.bar} ${className}` : styles.bar} {...named}>
      {total === 0
        ? null
        : bands.map((n, index) =>
            n === 0 ? null : <span key={WAIT_BANDS[index]} className={styles[`band${index}`]} style={{ flex: n }} />,
          )}
    </span>
  );
}

export function Glyph({ tone }: { tone: WfTone | undefined }) {
  return tone ? <StatusGlyph tone={tone} size={9} /> : null;
}

/**
 * v10 phone group trend mark: a small bar glyph and "+N", the people in this group whose wait
 * opened recently (the board's own quiet threshold). A count of recorded arrivals, never a forecast.
 */
export function GroupTrend({ rows }: { rows: readonly BoardRow[] }) {
  const joined = rows.filter((row) => row.waited < SILENT_MINUTES).length;
  return (
    <span className={styles.phTrend} title={`${joined} joined recently`}>
      <svg viewBox="0 0 8 12" width="8" height="12" aria-hidden="true">
        <rect x="0" y="6" width="3" height="6" fill="currentColor" opacity="0.45" />
        <rect x="5" y="1" width="3" height="11" fill="currentColor" />
      </svg>
      <span aria-hidden="true">+{joined}</span>
      <span className="sr-only">{joined} joined recently</span>
    </span>
  );
}
