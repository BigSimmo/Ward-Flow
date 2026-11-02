import { cx } from "./cx";
import styles from "./formal-name.module.css";

/**
 * A person's name, surname first ("Family, Given"), on one line that can be cut short.
 *
 * Q285 (pre-launch check D7, 2 Nov 2026): a plain ellipsis cut a long surname and lost the given
 * name, so two people with one long surname looked the same. The surname now gives way first and
 * the given name stays in view; a very long given name keeps at least part of itself as well. The
 * whole name shows on hover. A string with no ", " (such as "Not recorded") renders as it is.
 * A parent that wraps names in full can undo the one-line cut through `[data-formal-name]`.
 */
export function FormalName({ name, className }: { name: string; className?: string }) {
  const cut = name.indexOf(", ");
  if (cut <= 0 || cut === name.length - 2) return <>{name}</>;
  const family = name.slice(0, cut);
  const given = name.slice(cut + 2);
  return (
    <span className={cx(styles.name, className)} title={name} data-formal-name="">
      <span className={styles.family}>{family}</span>
      <span className={styles.given}>{`, ${given}`}</span>
    </span>
  );
}
