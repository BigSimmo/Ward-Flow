import type { CSSProperties } from "react";

import { cx } from "@/components/wf";
import type { BedStateCounts } from "@/components/ward-management/ward-bed-states";

import styles from "./bed-strip.module.css";

type StripCounts = Pick<BedStateCounts, "ready" | "pulled" | "closed" | "occupied"> & {
  /** Inside `ready`: released beds still being made ready, stated in the accessible name. */
  pendingPreparation?: number;
};

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
  bar = false,
  className,
}: {
  counts: StripCounts;
  wardName: string;
  thin?: boolean;
  /** One proportional segment per state instead of one cell per bed (Places rows). */
  bar?: boolean;
  className?: string;
}) {
  const preparing = counts.pendingPreparation ?? 0;
  const readyText = preparing > 0 ? `${counts.ready} ready (${preparing} being made ready)` : `${counts.ready} ready`;
  const label = `${wardName}: ${readyText}, ${counts.pulled} pulled, ${counts.closed} closed, ${counts.occupied} occupied`;
  if (bar) {
    return (
      <span
        role="img"
        aria-label={label}
        className={cx(styles.strip, styles.thin, styles.bar, className)}
        style={
          {
            "--strip-ready": counts.ready,
            "--strip-pulled": counts.pulled,
            "--strip-closed": counts.closed,
            "--strip-occupied": counts.occupied,
          } as CSSProperties
        }
      >
        {ORDER.filter((state) => counts[state] > 0).map((state) => (
          <span key={state} className={cx(styles.cell, styles.segment, styles[state])} />
        ))}
      </span>
    );
  }
  const cells = ORDER.flatMap((state) => Array.from({ length: Math.max(0, counts[state]) }, () => state));
  return (
    <span role="img" aria-label={label} className={cx(styles.strip, thin && styles.thin, className)}>
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
