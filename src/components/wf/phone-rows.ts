import styles from "./phone-rows.module.css";

/**
 * Phone rows in Home's style (Josh, 31 October 2026). Class names only; nothing applies above 48rem.
 *
 * - `chipRow` on a row of filter or highlight chips: one row that slides sideways with a soft fade at
 *   the right edge. `chip` on each chip (34px with a 48px tap area) and `zero` on a chip whose count
 *   is 0 (muted, moved to the end).
 * - `heroPills` on the holder and `heroPill` on each button in a page's dark hero band: Home's 40px
 *   changes pill, in place of tall full-width hero buttons.
 *
 * Example: `<div className={cx(chipStyles, phoneRows.chipRow)}>…<FilterChip className={phoneRows.chip} />`
 */
export const phoneRows = {
  chipRow: styles.chipRow,
  chip: styles.chip,
  zero: styles.zero,
  heroPills: styles.heroPills,
  heroPill: styles.heroPill,
} as const;
