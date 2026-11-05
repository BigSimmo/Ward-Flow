import { cx } from "./cx";
import styles from "./formal-name.module.css";

/**
 * A person's name, surname first ("Family, Given"), always in full and wrapping.
 *
 * DS §4 Names and §5 (the record, Q327): names are never cut short, on any screen, TV included.
 * This part used to keep the name on one line and let the surname give way first (the Q285
 * recommendation); the record now says "always in full, wrapping", so it wraps. A string with no
 * ", " (such as "Not recorded") renders as it is. `[data-formal-name]` stays as a hook for tests.
 */
export function FormalName({ name, className }: { name: string; className?: string }) {
  const cut = name.indexOf(", ");
  if (cut <= 0 || cut === name.length - 2) return <>{name}</>;
  return (
    <span className={cx(styles.name, className)} data-formal-name="">
      {name}
    </span>
  );
}
