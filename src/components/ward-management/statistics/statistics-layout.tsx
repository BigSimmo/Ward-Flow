import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cx } from "@/components/wf";

import styles from "./statistics-layout.module.css";

/**
 * One row of statistics cards, ending flush. `lead2` and `lead3` give the first column the room,
 * `halves` and `thirds` split it evenly. Mark the column that may run long with `<Follow>`: it then
 * scrolls inside at the height its neighbours set, rather than leaving blank space under them.
 */
export function FlushRow({
  layout = "halves",
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"div"> & { layout?: "lead2" | "lead3" | "halves" | "thirds"; children: ReactNode }) {
  return (
    <div className={cx(styles.row, styles[layout], className)} {...rest}>
      {children}
    </div>
  );
}

/** A column of cards whose last card takes the spare height, so the column ends flush. */
export function FlushStack({ className, children, ...rest }: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cx(styles.stack, className)} {...rest}>
      {children}
    </div>
  );
}

/**
 * The column that does not set the row's height. One card: its header stays and its body scrolls.
 * `stack`: several cards that scroll as one column. On one-column widths it shows everything again.
 */
export function Follow({
  stack = false,
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"div"> & { stack?: boolean }) {
  return (
    <div className={cx(styles.follow, stack && styles.stack, className)} data-statistics-follow="" {...rest}>
      {children}
    </div>
  );
}
