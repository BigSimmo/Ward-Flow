/** Small pieces shared by the Delays board and its graphs. */
import { StatusGlyph, type WfTone } from "@/components/wf";
import { DELAY_CAUSE_COPY, type DelayCause } from "./delays-derivations";
import { WAIT_BANDS, type BandCounts } from "./delays-board-model";
import styles from "./delays-board.module.css";

export function causeTitle(cause: DelayCause): string {
  return DELAY_CAUSE_COPY.find((entry) => entry.cause === cause)?.title ?? cause;
}

/** Under 8h, 8 to 12h, 12 to 24h and over 24h, left to right, with the counts in its name. */
export function BandBar({ bands, className }: { bands: BandCounts; className?: string }) {
  const total = bands.reduce((sum, n) => sum + n, 0);
  const label = WAIT_BANDS.map((band, index) => `${band}: ${bands[index]}`).join(", ");
  return (
    <span className={className ? `${styles.bar} ${className}` : styles.bar} role="img" aria-label={label}>
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
