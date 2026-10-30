// Source: src/components/ward-redesign/statistics/statistics-redesign.tsx (moved unchanged, so the fork stays under 1,500 lines)
import { ChevronDown, ChevronUp } from "lucide-react";

import { Icon, durMinutes } from "@/components/wf";
import { hoursText } from "@/components/ward-management/statistics/statistics-occupancy";
import styles from "@/components/ward-management/statistics/statistics-v6.module.css";

/** Minutes as a duration, or "none" when nothing is waiting. */
export const waitText = (minutes: number | null) => (minutes === null ? "none" : durMinutes(Math.round(minutes)));

/** A median wait to the nearest hour ("6h", "1d 4h"), or "none" when nothing is waiting. */
export const medianText = (minutes: number | null) => (minutes === null ? "none" : hoursText(Math.round(minutes / 60)));

/** "Royal Perth Hospital" reads "Royal Perth" in the narrow ED table; the site code leads the row. */
export const shortSiteName = (name: string) =>
  name
    .replace(/ Emergency Department$/, "")
    .replace(/ (Memorial |General )?(Hospital|Health Campus|Health Service)$/, "");

export const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export const PRESSURE_ROWS = 10;

/** Whole hours, as a short label ("4h"). */
export type WardSortKey = "name" | "beds" | "ready" | "occ" | "ref";
export type EdSortKey = "name" | "waiting" | "longest" | "median" | "over8" | "over24";

export function SortTh<K extends string>({
  id,
  label,
  sort,
  asc,
  onSort,
  numeric = false,
}: {
  id: K;
  label: string;
  sort: K;
  asc: boolean;
  onSort: (id: K) => void;
  numeric?: boolean;
}) {
  const active = sort === id;
  return (
    <th
      scope="col"
      className={`${styles.sortTh} ${numeric ? styles.num : ""}`}
      aria-sort={active ? (asc ? "ascending" : "descending") : "none"}
    >
      <button type="button" onClick={() => onSort(id)}>
        {label}
        {active ? <Icon icon={asc ? ChevronUp : ChevronDown} size={14} /> : null}
      </button>
    </th>
  );
}

/** H-0187: every site code in the ward table, spelt out once under it. */
export function SiteCodeKey({ sites }: { sites: readonly { code: string; name: string }[] }) {
  const named = [...new Map(sites.map((site) => [site.code, site.name])).entries()].toSorted(([a], [b]) =>
    a.localeCompare(b),
  );
  if (named.length === 0) return null;
  return (
    <p className={`${styles.sub} ${styles.muted}`} data-testid="ward-statistics-site-key">
      Site codes: {named.map(([code, name]) => `${code} ${name}`).join(" · ")}
    </p>
  );
}
