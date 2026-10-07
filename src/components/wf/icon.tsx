import type { LucideIcon, LucideProps } from "lucide-react";
import { cx } from "./cx";
import styles from "./primitives.module.css";

/** v6 icon sizes: 14 in chips and rows, 16 in buttons, 20 in headers and card tiles. */
export type IconSize = 14 | 16 | 20;

export type IconProps = Omit<LucideProps, "size" | "ref" | "strokeWidth"> & {
  icon: LucideIcon;
  size?: IconSize;
  /** Give a label only when the icon is the sole carrier of meaning. Otherwise it stays hidden. */
  label?: string;
};

/**
 * Lucide line icon at the v6 stroke (1.75) and sizes. Plain line icons only: no coloured tile
 * behind them. Decorative by default (`aria-hidden`).
 */
export function Icon({ icon: Glyph, size = 16, label, className, ...rest }: IconProps) {
  return (
    <Glyph
      size={size}
      strokeWidth={1.75}
      className={cx(styles.icon, className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
      {...rest}
    />
  );
}
