// Role view (executive): a plain list for a card whose every count is held back, and the one sentence
// that explains the small number rule.
import { SrOnly } from "@/components/wf";
import { CLINICAL_VALUES } from "../ward-clinical-values";
import { exactStatisticsCount, type StatisticsCount } from "./statistics-small-numbers";

import styles from "./statistics-count-list.module.css";

/** True when no count in the group has a released number above zero, so a chart would be empty. */
export function noCountReleased(counts: readonly StatisticsCount[]): boolean {
  return counts.every((count) => (exactStatisticsCount(count) ?? 0) === 0);
}

/** Each row's label and its count as the desk may see it ("not shown", "fewer than 5", "none"). */
function CountList({
  label,
  rows,
}: {
  label: string;
  rows: readonly { id: string; label: string; value: number | string; testId?: string }[];
}) {
  return (
    <dl className={styles.list} aria-label={label}>
      {rows.map((row) => (
        <div key={row.id} className={styles.row}>
          <dt className={styles.label}>{row.label}</dt>
          <dd className={styles.value} data-testid={row.testId}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Reasons and their counts as words; a released zero reads "none", as the chart's own label does. */
export function ReasonCounts({
  label,
  rows,
  small,
}: {
  label: string;
  rows: readonly { id: string; label: string; count: StatisticsCount; testId?: string }[];
  small: (count: StatisticsCount) => number | string;
}) {
  return (
    <CountList
      label={label}
      rows={rows.map((row) => ({
        id: row.id,
        label: row.label,
        testId: row.testId,
        value: exactStatisticsCount(row.count) === 0 ? "none" : small(row.count),
      }))}
    />
  );
}

/** One sentence for the executive's small number rule, so "not shown" is explained once. */
export function SmallNumberNote({ className }: { className?: string }) {
  const under = CLINICAL_VALUES.smallNumberHidden.value;
  return (
    // One line at desktop width; "counts only, no names" stays for the spoken label, since the page
    // itself lists no one.
    <p className={className} data-testid="as-executive-small-number-note">
      <SrOnly>Counts only, no names. </SrOnly>
      Under {under} shows as &ldquo;fewer than {under}&rdquo;, and a count that would give one away as &ldquo;not
      shown&rdquo;. Beds are exact.
    </p>
  );
}
