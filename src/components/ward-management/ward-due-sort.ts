import type { Instant } from "./ward-clock";

/**
 * "Due first" ordering — stream A, 9 Oct 2026. Offered as a sort option on Tasks, Legal forms and
 * Discharges beside each list's own default. Rows are ordered by the time they fall (or fell) due,
 * earliest first, so anything already past its time leads. Rows with no due time keep their
 * existing relative order and go last. The sort is stable and never drops or adds a row.
 */
export type DueSortMode = "default" | "due-first";

export const DUE_SORT_OPTIONS: readonly { id: DueSortMode; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "due-first", label: "Due first" },
];

export function sortDueFirst<T>(items: readonly T[], dueOf: (item: T) => Instant | null | undefined): T[] {
  return items
    .map((item, index) => ({ item, index, due: dueOf(item) }))
    .sort((a, b) => {
      const aHas = typeof a.due === "number" && Number.isFinite(a.due);
      const bHas = typeof b.due === "number" && Number.isFinite(b.due);
      if (aHas && bHas && a.due !== b.due) return (a.due as number) - (b.due as number);
      if (aHas !== bHas) return aHas ? -1 : 1;
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}
