import type { ReactNode } from "react";
import { cx } from "./cx";
import { StatusGlyph, type WfTone } from "./status-glyph";
import styles from "./badge.module.css";

export type BadgeVariant = "default" | "plain" | "solid" | "onHero" | "mono";

export type BadgeProps = {
  /** Glyph shape and colour. Omit for a neutral label with no glyph. */
  tone?: WfTone;
  /**
   * `default` neutral chip. `plain` drops the chip (table rows, running text). `solid` slate, for
   * an active filter count only. `onHero` on the hero band. `mono` for ids such as UM100023.
   */
  variant?: BadgeVariant;
  size?: "sm" | "md";
  /** Count segment behind a hairline (`Declined | 5`). */
  n?: number | string;
  children: ReactNode;
  className?: string;
  title?: string;
};

/**
 * v6 badge. Neutral body with a coloured glyph; the word carries the meaning and the glyph is
 * `aria-hidden`. One badge per card head.
 */
export function Badge({ tone, variant = "default", size = "md", n, children, className, title }: BadgeProps) {
  return (
    <span
      className={cx(
        styles.bd,
        size === "sm" && styles.sm,
        variant === "plain" && styles.plain,
        variant === "solid" && styles.solid,
        variant === "onHero" && styles.onHero,
        variant === "mono" && styles.mono,
        className,
      )}
      title={title}
    >
      {tone ? <StatusGlyph tone={tone} size={size === "sm" ? 9 : 10} /> : null}
      <span className={styles.text}>{children}</span>
      {n != null ? <span className={styles.n}>{n}</span> : null}
    </span>
  );
}
