// The Statistics summary's small helpers: wait formats, the sortable column head and the site-code
// key, shared by the summary screen and its Open ED journeys card.
import { ChevronDown, ChevronUp } from "lucide-react";

import { Icon, durMinutes } from "@/components/wf";
import { siteByCode } from "../ward-sites";
import { hoursText } from "./statistics-occupancy";
import styles from "./statistics-v6.module.css";

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

/**
 * One ward in the unit finder. A ward whose site code resolves to nothing is still listed, and says
 * so: the finder is the way into a ward's statistics page, so a ward dropped from it would be
 * unreachable and unreported, which is worse than a ward whose hospital cannot be named.
 */
export function wardFinderEntry(ward: { id: string; name: string; site: string; ready: number }) {
  return {
    id: ward.id,
    name: ward.name,
    code: ward.site,
    meta: siteByCode(ward.site) ? `${ward.ready} ready` : `${ward.ready} ready · site code matches no site`,
    ready: ward.ready,
  };
}
