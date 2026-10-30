"use client";

// Moved out of bed-manager-statistics-redesign.tsx so that fork stays under the 1,500-line cap: the
// sortable column head, the wait formats and the Open ED journeys card.

import { ChevronDown, ChevronUp, Search, Siren } from "lucide-react";

import { Badge, CardBody, Icon, StatusGlyph, TextInput, durMinutes, tableClasses } from "@/components/wf";
import {
  ED_ELEVATED_PRESSURE_WAIT_MINUTES,
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";
import { hoursText } from "@/components/ward-management/statistics/statistics-occupancy";
import type { SummaryEd } from "@/components/ward-management/statistics/statistics-network-cards";
import {
  exactStatisticsCount,
  statisticsCountText,
  type StatisticsCount,
} from "@/components/ward-management/statistics/statistics-small-numbers";
import { StatCard } from "@/components/ward-management/statistics/statistics-hero";
import styles from "@/components/ward-management/statistics/statistics-v6.module.css";
import { hoursLabel } from "@/components/ward-redesign/statistics/statistics-bands";

export type EdSortKey = "name" | "waiting" | "longest" | "median" | "over8" | "over24";

/** Minutes as a duration, or "none" when nothing is waiting. */
const waitText = (minutes: number | null) => (minutes === null ? "none" : durMinutes(Math.round(minutes)));

/** A median wait to the nearest hour ("6h", "1d 4h"), or "none" when nothing is waiting. */
const medianText = (minutes: number | null) => (minutes === null ? "none" : hoursText(Math.round(minutes / 60)));

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

export function BedManagerEdCard({
  siteName,
  longestEd,
  edSearchQuery,
  setEdSearchQuery,
  edSortCol,
  edSortAsc,
  handleEdSort,
  filteredAndSortedEds,
  departmentCount,
  small,
  totalEdWaiting,
  networkMedianWait,
  totalEdOver8,
  totalEdOver24,
}: {
  siteName: string | undefined;
  longestEd: SummaryEd | null;
  edSearchQuery: string;
  setEdSearchQuery: (query: string) => void;
  edSortCol: EdSortKey;
  edSortAsc: boolean;
  handleEdSort: (col: EdSortKey) => void;
  filteredAndSortedEds: SummaryEd[];
  departmentCount: number;
  small: (count: StatisticsCount) => ReturnType<typeof statisticsCountText>;
  totalEdWaiting: StatisticsCount;
  networkMedianWait: number | null;
  totalEdOver8: StatisticsCount;
  totalEdOver24: StatisticsCount;
}) {
  // Bed manager: one ED, its own site's. Its five figures read as one row of tiles (the family's
  // card figures), not a one-row table with a chip repeating the row and a sentence about a rail
  // this desk does not have.
  const only = siteName !== undefined && filteredAndSortedEds.length === 1 ? filteredAndSortedEds[0]! : null;
  if (only) {
    const mark =
      only.longest !== null && only.longest >= ED_SEVERE_PRESSURE_WAIT_MINUTES ? (
        <StatusGlyph tone="danger" size={9} />
      ) : only.longest !== null && only.longest >= ED_ELEVATED_PRESSURE_WAIT_MINUTES ? (
        <StatusGlyph tone="warning" size={9} />
      ) : null;
    const figures = [
      { id: "waiting", label: "Open ED journeys", value: small(only.waiting), mark: null },
      { id: "longest", label: "Longest", value: waitText(only.longest), mark },
      { id: "median", label: "Median", value: medianText(only.median), mark: null },
      { id: "over8", label: "8h+", value: small(only.over8), mark: null },
      { id: "over24", label: "24h+", value: small(only.over24), mark: null },
    ];
    return (
      <StatCard icon={Siren} title="Open ED journeys" data-testid="ward-statistics-emergency-departments">
        <CardBody>
          <dl className={styles.tiles} id="edPressureTable">
            {figures.map((figure) => (
              <div key={figure.id} className={styles.tile}>
                <dt className={styles.tileLabel}>{figure.label}</dt>
                <dd className={styles.tileValue}>
                  <span className={styles.flagged}>
                    {figure.mark}
                    {figure.value}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </StatCard>
    );
  }
  return (
    <StatCard
      // Redesign: the menu's ED icon; a clock is for time only.
      icon={Siren}
      title="Open ED journeys"
      data-testid="ward-statistics-emergency-departments"
      aside={
        longestEd && longestEd.longest !== null ? (
          <Badge
            tone={
              longestEd.longest >= ED_SEVERE_PRESSURE_WAIT_MINUTES
                ? "danger"
                : longestEd.longest >= ED_ELEVATED_PRESSURE_WAIT_MINUTES
                  ? "warning"
                  : undefined
            }
          >
            {`${durMinutes(Math.round(longestEd.longest))} longest, ${longestEd.site}`}
          </Badge>
        ) : undefined
      }
    >
      <div className={styles.toolbar}>
        {/* Bed manager: one ED, its own site's, so no filter box. */}
        {siteName ? null : (
          <TextInput
            type="search"
            icon={Search}
            boxClassName={styles.search}
            id="edSearchInput"
            placeholder="Filter departments"
            value={edSearchQuery}
            onChange={(e) => setEdSearchQuery(e.target.value)}
            aria-label="Filter emergency departments"
          />
        )}
        <span className={styles.toolbarEnd} id="edFilterCount">
          {`Marked from ${hoursLabel(ED_ELEVATED_PRESSURE_WAIT_MINUTES)} and ${hoursLabel(ED_SEVERE_PRESSURE_WAIT_MINUTES)}, as the side rail`}
        </span>
      </div>
      <div className={styles.tableWrap}>
        <table className={`${tableClasses.table} ${styles.table}`} id="edPressureTable">
          <caption className={styles.srOnly}>Emergency department waits for a mental health bed</caption>
          <thead>
            <tr>
              <SortTh id="name" label="Site" sort={edSortCol} asc={edSortAsc} onSort={handleEdSort} />
              <SortTh
                id="waiting"
                label="Open ED journeys"
                sort={edSortCol}
                asc={edSortAsc}
                onSort={handleEdSort}
                numeric
              />
              <SortTh id="longest" label="Longest" sort={edSortCol} asc={edSortAsc} onSort={handleEdSort} numeric />
              <SortTh id="median" label="Median" sort={edSortCol} asc={edSortAsc} onSort={handleEdSort} numeric />
              <SortTh id="over8" label="8h+" sort={edSortCol} asc={edSortAsc} onSort={handleEdSort} numeric />
              <SortTh id="over24" label="24h+" sort={edSortCol} asc={edSortAsc} onSort={handleEdSort} numeric />
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedEds.map((d) => (
              <tr key={d.id}>
                <th scope="row" className={styles.siteCell}>
                  <b className={styles.codeLead}>{d.site}</b>
                  <span className={styles.siteName} title={d.name}>
                    {d.name}
                  </span>
                </th>
                <td className={`${styles.num} ${exactStatisticsCount(d.waiting) === 0 ? styles.zero : ""}`}>
                  {small(d.waiting)}
                </td>
                <td className={`${styles.num} ${d.longest === null ? styles.zero : ""}`}>
                  <span className={styles.flagged}>
                    {d.longest !== null && d.longest >= ED_SEVERE_PRESSURE_WAIT_MINUTES ? (
                      <StatusGlyph tone="danger" size={9} />
                    ) : d.longest !== null && d.longest >= ED_ELEVATED_PRESSURE_WAIT_MINUTES ? (
                      <StatusGlyph tone="warning" size={9} />
                    ) : null}
                    {waitText(d.longest)}
                  </span>
                </td>
                <td className={`${styles.num} ${d.median === null ? styles.zero : ""}`}>{medianText(d.median)}</td>
                <td className={`${styles.num} ${exactStatisticsCount(d.over8) === 0 ? styles.zero : ""}`}>
                  {small(d.over8)}
                </td>
                <td className={`${styles.num} ${exactStatisticsCount(d.over24) === 0 ? styles.zero : ""}`}>
                  {small(d.over24)}
                </td>
              </tr>
            ))}
          </tbody>
          {/* Bed manager: one ED row, so no total row repeating it. */}
          <tfoot hidden={siteName !== undefined}>
            <tr>
              <th scope="row">All {departmentCount} departments</th>
              <td className={styles.num}>{small(totalEdWaiting)}</td>
              <td className={styles.num}>{waitText(longestEd?.longest ?? null)}</td>
              <td className={styles.num}>{medianText(networkMedianWait)}</td>
              <td className={styles.num}>{small(totalEdOver8)}</td>
              <td className={styles.num}>{small(totalEdOver24)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </StatCard>
  );
}
