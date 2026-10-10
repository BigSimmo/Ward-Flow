import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "./cx";
import { Icon } from "./icon";
import styles from "./primitives.module.css";

/** Text for screen readers only. */
export function SrOnly({ children, id, role }: { children: ReactNode; id?: string; role?: "status" }) {
  return (
    <span className={styles.srOnly} id={id} role={role}>
      {children}
    </span>
  );
}

/** Keyboard key, mono (`/`, `Esc`, `Ctrl K`). */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cx(styles.kbd, className)}>{children}</kbd>;
}

/**
 * Count in a rounded square (`.k`), mono. Sits behind a hairline in tabs, segments and buttons.
 * Pass `label` when the number alone would be ambiguous to a screen reader ("7 open").
 */
export function Count({ n, label, className }: { n: number | string; label?: string; className?: string }) {
  return (
    <span className={cx(styles.count, className)}>
      <span aria-hidden={label ? true : undefined}>{n}</span>
      {label ? <SrOnly>{label}</SrOnly> : null}
    </span>
  );
}

/** Round count bubble, as on the header Tasks button. */
export function CountBubble({ n, label, className }: { n: number | string; label?: string; className?: string }) {
  return (
    <span className={cx(styles.count, styles.bubble, className)}>
      <span aria-hidden={label ? true : undefined}>{n}</span>
      {label ? <SrOnly>{label}</SrOnly> : null}
    </span>
  );
}

/**
 * v10 count circle for the compact sidebar rail and the phone dock: the number in an 18px edged
 * circle, 12px mono, on the surface with a 2px ring in the colour behind it (`--wf-count-ring`).
 * An urgent count takes an amber edge, never a fill and never an extra dot.
 */
export function CountCircle({
  n,
  label,
  urgent = false,
  className,
}: {
  n: number | string;
  label?: string;
  urgent?: boolean;
  className?: string;
}) {
  return (
    <span className={cx(styles.countCircle, className)} data-urgent={urgent ? "true" : undefined}>
      <span aria-hidden={label ? true : undefined}>{n}</span>
      {label ? <SrOnly>{label}</SrOnly> : null}
    </span>
  );
}

/** Hairline. Horizontal by default. */
export function Divider({ vertical = false, className }: { vertical?: boolean; className?: string }) {
  return vertical ? (
    <span role="separator" aria-orientation="vertical" className={cx(styles.dividerV, className)} />
  ) : (
    <hr className={cx(styles.divider, className)} />
  );
}

/** Recessed box on surface-2 with a hairline, for figures inside a card. */
export function Inset({ className, ...rest }: ComponentPropsWithoutRef<"div">) {
  return <div className={cx(styles.inset, className)} {...rest} />;
}

/** Spinner for loading states. Decorative: pair it with `aria-busy` on the region or button. */
export function Spinner({ className }: { className?: string }) {
  return <span className={cx(styles.spin, className)} aria-hidden="true" />;
}

/** Neutral 30px tile holding a line icon, for card heads and list items. */
export function IconTile({ icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span className={cx(styles.tile, className)} aria-hidden="true">
      <Icon icon={icon} size={16} />
    </span>
  );
}
