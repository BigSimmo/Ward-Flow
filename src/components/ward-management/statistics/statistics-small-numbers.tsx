/**
 * Executive Statistics (role access plan, Josh's yes 15 Oct 2026): counts only, and a count of people
 * under the small number line reads "fewer than 5". `useStatisticsCounts` decides; these two pieces
 * draw it the same way on every screen.
 */
import styles from "./statistics-v6.module.css";

/**
 * A bar or column whose count may be withheld. A withheld one draws no bar, because its length would
 * give the count away, and reads its words instead.
 */
export function withheldBar(value: number, shown: number | string): { value: number; valueText?: string } {
  return typeof shown === "string" ? { value: 0, valueText: shown } : { value };
}

/** In place of a list of people on the executive desk. */
export function PeopleNotListed({ testId = "ward-statistics-people-not-listed" }: { testId?: string }) {
  return (
    <p className={styles.muted} data-testid={testId}>
      Counts only on this desk, so people are not listed.
    </p>
  );
}
