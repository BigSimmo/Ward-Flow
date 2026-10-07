import { cx } from "@/components/wf";
import type { BedStateCounts } from "@/components/ward-management/ward-bed-states";

import styles from "./bed-strip.module.css";

type StripCounts = Pick<BedStateCounts, "ready" | "pulled" | "closed" | "occupied">;

const ORDER = ["ready", "pulled", "closed", "occupied"] as const;

/**
 * One rounded cell per bed, in a fixed order: ready (green), pulled (hatched), closed (gold),
 * occupied (track). Shared by All wards and Capacity so both draw a ward the same way. The cells
 * are decorative; the accessible name carries the counts.
 */
export function BedStrip({
  counts,
  wardName,
  thin = false,
  className,
}: {
  counts: StripCounts;
  wardName: string;
  thin?: boolean;
  className?: string;
}) {
  const cells = ORDER.flatMap((state) => Array.from({ length: Math.max(0, counts[state]) }, () => state));
  return (
    <span
      role="img"
      aria-label={`${wardName}: ${counts.ready} ready, ${counts.pulled} pulled, ${counts.closed} closed, ${counts.occupied} occupied`}
      className={cx(styles.strip, thin && styles.thin, className)}
    >
      {cells.map((state, index) => (
        <span key={`${state}-${index}`} className={cx(styles.cell, styles[state])} />
      ))}
    </span>
  );
}

/** The legend for `BedStrip`, in the same order and colours. */
export function BedStripLegend({ className }: { className?: string }) {
  return (
    <span className={cx(styles.legend, className)}>
      {(["ready", "pulled", "closed", "occupied"] as const).map((state) => (
        <span key={state} className={styles.legendItem}>
          <span className={cx(styles.swatch, styles[state])} aria-hidden="true" />
          {state === "ready" ? "Ready" : state === "pulled" ? "Pulled" : state === "closed" ? "Closed" : "Occupied"}
        </span>
      ))}
    </span>
  );
}
