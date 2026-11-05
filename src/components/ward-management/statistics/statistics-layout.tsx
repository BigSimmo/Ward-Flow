import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cx } from "@/components/wf";

import styles from "./statistics-layout.module.css";

/**
 * One row of statistics cards, ending flush. `lead2` and `lead3` give the first column the room,
 * `halves` and `thirds` split it evenly. A column marked `<Follow>` grows with its content (D-95).
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
 * A column of one card or several (`stack`) that grows with its content at every width: D-95 keeps
 * one page scroll, so it never scrolls inside (audit C5, 5 Nov 2026). Its last card fills any spare
 * height so the row still ends flush.
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
