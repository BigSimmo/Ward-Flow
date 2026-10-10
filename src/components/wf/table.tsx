import type { ComponentPropsWithoutRef, CSSProperties, ElementType, ReactNode } from "react";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import { Button } from "./button";
import { cx } from "./cx";
import { Icon } from "./icon";
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
  /** Header row: 36px, surface-2. Use `Th` and `SortHeader` cells inside. */
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

/** Header cell (`.th`): 11px uppercase meta ink. */
export function Th({
  children,
  align = "start",
  className,
}: {
  children?: ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  return (
    <div role="columnheader" className={cx(styles.th, align === "end" && styles.end, className)}>
      {children}
    </div>
  );
}

export type SortDirection = "ascending" | "descending" | "none";

/** Sortable header cell: a real button inside a `columnheader` carrying `aria-sort`. */
export function SortHeader({
  children,
  sort,
  onSort,
  align = "start",
  className,
}: {
  children: ReactNode;
  sort: SortDirection;
  onSort: () => void;
  align?: "start" | "end";
  className?: string;
}) {
  const glyph = sort === "ascending" ? ChevronUp : sort === "descending" ? ChevronDown : ChevronsUpDown;
  return (
    <div
      role="columnheader"
      aria-sort={sort}
      className={cx(styles.th, align === "end" && styles.end, sort !== "none" && styles.sorted, className)}
    >
      <button type="button" className={styles.sortButton} onClick={onSort}>
        {children}
        <Icon icon={glyph} size={14} />
      </button>
    </div>
  );
}

/** Tier digit tile (`.sq`). Tier 1 has danger ink and a stronger edge; the digit carries it. */
export function TierTile({ tier, label = "Tier", className }: { tier: number; label?: string; className?: string }) {
  return (
    <span className={cx(styles.sq, tier === 1 && styles.t1, className)}>
      <SrOnly>
        {label} {tier}
      </SrOnly>
      <span aria-hidden="true">T{tier}</span>
    </span>
  );
}

/** Bulk action bar under a table: "2 selected", Clear, then actions (one primary at most). */
export function BulkBar({
  selected,
  onClear,
  children,
  className,
}: {
  selected: number;
  onClear: () => void;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx(styles.bulk, className)} role="region" aria-label="Bulk actions">
      <span>{selected} selected</span>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
      {children ? <div className={styles.bulkActions}>{children}</div> : null}
    </div>
  );
}
