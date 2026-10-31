"use client";

// The summary's Open ED journeys card: every ED as a sortable table, or, for a site bed manager with
// one ED, that ED's five figures as one row of tiles.

import { Siren } from "lucide-react";

import { Badge, CardBody, StatusGlyph, durMinutes, tableClasses } from "@/components/wf";
import { ED_ELEVATED_PRESSURE_WAIT_MINUTES, ED_SEVERE_PRESSURE_WAIT_MINUTES } from "../ward-operational-defaults";
import type { SummaryEd } from "./statistics-network-cards";
import { exactStatisticsCount, statisticsCountText, type StatisticsCount } from "./statistics-small-numbers";
import { StatCard } from "./statistics-hero";
import { hoursLabel } from "./statistics-bands";
import { SortTh, medianText, waitText, type EdSortKey } from "./statistics-screen-parts";
import styles from "./statistics-v6.module.css";

export function StatisticsEdJourneysCard({
  siteName,
  longestEd,
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
  /** Set for a site bed manager: its own site's ED only. */
  siteName: string | undefined;
  longestEd: SummaryEd | null;
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
      // The menu's ED icon; a clock is for time only.
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
        {/* The ED table's typed filter went in the search and forms review (D-91, Josh, 30 Oct 2026):
            15 EDs need none, and the header search finds one by name. */}
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
