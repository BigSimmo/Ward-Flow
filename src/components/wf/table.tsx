import type { ComponentPropsWithoutRef, CSSProperties, ElementType } from "react";
import { cx } from "./cx";
import { SrOnly } from "./primitives";
import styles from "./table.module.css";

/**
 * Class names for native `<table>` markup: `table`, `selected` (on a `tr`), `num` (mono cell).
 * Getters, so importing this module never reads the CSS module at load time (Playwright specs
 * import page modules without CSS).
 */
export const tableClasses = {
  get table() {
    return styles.table;
  },
  get selected() {
    return styles.selected;
  },
  get num() {
    return styles.num;
  },
  get th() {
    return styles.th;
  },
  /** On a `tr`: the act-now row's thin red full edge, no fill. */
  get actNow() {
    return styles.actNow;
  },
};

export type DataRowProps = Omit<ComponentPropsWithoutRef<"div">, "style"> & {
  /** CSS grid-template-columns shared by the head and body rows. */
  columns: string;
  /** Selected: selected surface plus the 3px slate edge (the only stripe allowed). */
  selected?: boolean;
  /** Act now: a thin red full edge and no fill (v9). The row's words still carry the meaning. */
  actNow?: boolean;
  /** Reads `--wf-row-compact` instead of the density row height. */
  compact?: boolean;
  /** Hover surface, for rows that open something. */
  interactive?: boolean;
  /**
   * v10 dim, never hide: a row a highlight does not match recedes by colour (`data-dim`, see
   * ward-flow-v9-tokens.css). It stays in place, in order and focusable.
   */
  dim?: boolean;
  /** Header row: 36px, surface-2. Use `tableClasses.th` on header cells. */
  head?: boolean;
  as?: "div" | "li";
  style?: CSSProperties;
};

/**
 * A grid row. Keep the same `columns` string on the head row and every body row. For full table
 * semantics pass `role="row"` and give cells `role="cell"`, or use `tableClasses` on a `<table>`.
 */
export function DataRow({
  columns,
  selected = false,
  actNow = false,
  compact = false,
  interactive = false,
  dim = false,
  head = false,
  as = "div",
  className,
  style,
  ...rest
}: DataRowProps) {
  const Tag = as as ElementType;
  return (
    <Tag
      className={cx(
        styles.row,
        compact && styles.compact,
        interactive && styles.interactive,
        selected && styles.selected,
        actNow && !head && styles.actNow,
        head && styles.head,
        className,
      )}
      style={{ gridTemplateColumns: columns, ...style }}
      aria-selected={rest.role === "row" && !head ? selected : undefined}
      data-dim={dim && !head ? "true" : undefined}
      {...rest}
    />
  );
}

/** A truncating cell. `align="end"` for numbers. `mono` for times and counts. */
export function Cell({
  align = "start",
  mono = false,
  className,
  ...rest
}: ComponentPropsWithoutRef<"div"> & { align?: "start" | "end"; mono?: boolean }) {
  return <div className={cx(styles.cell, align === "end" && styles.end, mono && styles.num, className)} {...rest} />;
}

/** Tier digit tile (`.sq`). Tier 1 has danger ink and a stronger edge; the digit carries it. */
export function TierTile({
  tier,
  label = "Tier",
  className,
  ...rest
}: Omit<ComponentPropsWithoutRef<"span">, "children"> & { tier: number; label?: string }) {
  return (
    <span {...rest} className={cx(styles.sq, tier === 1 && styles.t1, className)}>
      <SrOnly>
        {label} {tier}
      </SrOnly>
      <span aria-hidden="true">T{tier}</span>
    </span>
  );
}
