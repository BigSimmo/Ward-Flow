import type { CriteriaLedChip } from "@/components/ward-management/ward-discharge-criteria";
import { StatusGlyph, cx } from "@/components/wf";

import styles from "./ward-criteria-led-tag.module.css";

/**
 * D-64: the small criteria led discharge tag on a Bed board cell and a Home bed tile, shown beside
 * whatever else the tile says. The word carries the meaning and the glyph only colours it. The
 * tile's own accessible name already reads the full phrase, so the tag is hidden from screen readers.
 */
export function CriteriaLedTag({
  chip,
  short = false,
  className,
}: {
  chip: CriteriaLedChip;
  /** The Bed board cell has room for the short form only. */
  short?: boolean;
  className?: string;
}) {
  return (
    <span className={cx(styles.tag, className)} aria-hidden="true" data-testid="ward-criteria-led-tag">
      <StatusGlyph tone={chip.tone} size={8} />
      <span className={styles.text}>{short ? chip.short : chip.label}</span>
    </span>
  );
}
