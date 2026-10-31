/**
 * Executive Statistics (role access plan, Josh's yes 15 Oct 2026): counts only, and a count of people
 * under the small number line reads "fewer than 5". `useStatisticsCounts` decides; these two pieces
 * draw it the same way on every screen.
 */
import styles from "./statistics-v6.module.css";
import type { ReleasedCount } from "./executive-statistics-contract";
import { useExecutiveStatisticsControl } from "./executive-statistics-context";
import { SMALL_NUMBER_NOT_SHOWN, smallNumberText } from "../ward-access-scope";
import { CLINICAL_VALUES } from "../ward-clinical-values";

export type StatisticsCount = number | ReleasedCount;

/** A released value already carries the server's complete-bundle protection decision. */
export function releasedCountText(count: ReleasedCount): number | string {
  return count.kind === "exact" ? count.value : count.kind === "small" ? smallNumberText(1) : SMALL_NUMBER_NOT_SHOWN;
}

export function statisticsCountText(
  count: StatisticsCount,
  small: (value: number) => number | string = (value) => value,
) {
  return typeof count === "number" ? small(count) : releasedCountText(count);
}

/** Unknown counts have no numeric geometry or sort rank. Zero is a genuine released value. */
export function exactStatisticsCount(count: StatisticsCount): number | null {
  return typeof count === "number" ? count : count.kind === "exact" ? count.value : null;
}

export function sumStatisticsCounts(counts: readonly StatisticsCount[]): StatisticsCount {
  let total = 0;
  const released = counts.some((count) => typeof count !== "number");
  // A bare nonzero person count has no release decision. Do not confer one by adding a tag.
  if (released && counts.some((count) => typeof count === "number" && count !== 0)) return { kind: "withheld" };
  for (const count of counts) {
    const value = exactStatisticsCount(count);
    if (value === null) return { kind: "withheld" };
    if (
      released &&
      (!Number.isSafeInteger(value) || value < 0 || (value > 0 && value < CLINICAL_VALUES.smallNumberHidden.value))
    )
      return { kind: "withheld" };
    total += value;
  }
  if (released && !Number.isSafeInteger(total)) return { kind: "withheld" };
  return released ? { kind: "exact", value: total } : total;
}

export function ExecutiveStatisticsUnavailable({ loading }: { loading?: boolean } = {}) {
  const control = useExecutiveStatisticsControl();
  // While the first report is on its way, a calm loading line, not "unavailable" (Josh, 31 Oct 2026).
  if (loading ?? control.loading)
    return (
      <p role="status" data-testid="ward-statistics-loading">
        Loading the executive view…
      </p>
    );
  return (
    <p role="status" data-testid="ward-statistics-unavailable">
      Statistics are unavailable for this desk. Refresh the workspace to try again.
    </p>
  );
}

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
