import type { LucideIcon, LucideProps } from "lucide-react";
import { cx } from "./cx";
import styles from "./primitives.module.css";

/**
 * R-STYLE-4: four icon sizes. 14 in chips and rows, 16 in buttons, 18 in fields and list tiles, 21 in
 * headers and card tiles. `20` is the retired size: screens that still pass it draw 21 until they
 * move over (it is typed only so those screens keep compiling).
 */
export const WF_ICON_SIZES = [14, 16, 18, 21] as const;
type IconSize = (typeof WF_ICON_SIZES)[number] | /** @deprecated use 21 */ 20;

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
      size={size === 20 ? 21 : size}
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
