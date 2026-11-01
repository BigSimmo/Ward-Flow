"use client";

// The summary's Open ED journeys card: every ED as a sortable table, or, for a site bed manager with
// one ED, that ED's five figures as one row of tiles.

import { Badge, CardBody, StatusGlyph, cx, durMinutes, tableClasses } from "@/components/wf";
import { useCanOpenHref } from "../shell/ward-access";
import {
  Foot,
  Glyph,
  MoreLink,
  Name,
  StatCardR,
  Z,
  redesignStyles as redesign,
} from "@/components/ward-management/statistics/redesign/statistics-redesign-parts";
import { STATISTICS_EDS_HREF } from "./statistics-sections";
import { ED_ELEVATED_PRESSURE_WAIT_MINUTES, ED_SEVERE_PRESSURE_WAIT_MINUTES } from "../ward-operational-defaults";
import type { SummaryEd } from "./statistics-network-cards";
import { exactStatisticsCount, statisticsCountText, type StatisticsCount } from "./statistics-small-numbers";
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
  const canOpen = useCanOpenHref();
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
      <StatCardR id="eds" title="Open ED journeys" data-testid="ward-statistics-emergency-departments">
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
      </StatCardR>
    );
  }
  const mark = (minutes: number | null) =>
    minutes !== null && minutes >= ED_SEVERE_PRESSURE_WAIT_MINUTES ? (
      <Glyph tone="danger" />
    ) : minutes !== null && minutes >= ED_ELEVATED_PRESSURE_WAIT_MINUTES ? (
      <Glyph tone="warning" />
    ) : null;
  const zero = (count: StatisticsCount) => (exactStatisticsCount(count) === 0 ? 0 : small(count));
  return (
    <StatCardR
      id="eds"
      title="Open ED journeys"
      meta={`${small(totalEdWaiting)} open`}
      data-testid="ward-statistics-emergency-departments"
      aside={
        longestEd && longestEd.longest !== null ? (
          <Badge
            size="sm"
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
      foot={
        // The ED table's typed filter went in the search and forms review (D-91, Josh, 30 Oct 2026):
        // 15 EDs need none, and the header search finds one by name.
        <Foot
          link={canOpen(STATISTICS_EDS_HREF) ? <MoreLink href={STATISTICS_EDS_HREF}>Open EDs</MoreLink> : undefined}
        >
          <span id="edFilterCount">{`Marked from ${hoursLabel(ED_ELEVATED_PRESSURE_WAIT_MINUTES)} and ${hoursLabel(ED_SEVERE_PRESSURE_WAIT_MINUTES)}`}</span>
        </Foot>
      }
    >
      <div
        className={redesign.tableWrap}
        tabIndex={0}
        role="region"
        aria-label="Emergency department waits for a mental health bed, scrollable table"
      >
        <table className={cx(tableClasses.table, redesign.table)} id="edPressureTable">
          <caption className="sr-only">Emergency department waits for a mental health bed</caption>
          <thead>
            <tr>
              <SortTh id="name" label="ED" sort={edSortCol} asc={edSortAsc} onSort={handleEdSort} />
              <SortTh id="waiting" label="Open" sort={edSortCol} asc={edSortAsc} onSort={handleEdSort} numeric />
              <SortTh id="longest" label="Longest" sort={edSortCol} asc={edSortAsc} onSort={handleEdSort} numeric />
              <SortTh id="over8" label="8h+" sort={edSortCol} asc={edSortAsc} onSort={handleEdSort} numeric />
              <SortTh id="over24" label="24h+" sort={edSortCol} asc={edSortAsc} onSort={handleEdSort} numeric />
              <SortTh id="median" label="Median" sort={edSortCol} asc={edSortAsc} onSort={handleEdSort} numeric />
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedEds.map((d) => (
              <tr key={d.id}>
                <th scope="row">
                  <Name name={d.name} sub={d.site} />
                </th>
                <td className={cx(redesign.r, tableClasses.num)}>
                  <Z v={zero(d.waiting)} />
                </td>
                <td className={cx(redesign.r, tableClasses.num)}>
                  <span className={redesign.gv}>
                    {mark(d.longest)}
                    <Z v={waitText(d.longest)} />
                  </span>
                </td>
                <td className={cx(redesign.r, tableClasses.num)}>
                  <Z v={zero(d.over8)} />
                </td>
                <td className={cx(redesign.r, tableClasses.num)}>
                  <Z v={zero(d.over24)} />
                </td>
                <td className={cx(redesign.r, tableClasses.num)}>
                  <Z v={medianText(d.median)} />
                </td>
              </tr>
            ))}
          </tbody>
          {/* Bed manager: one ED row, so no total row repeating it. */}
          <tfoot hidden={siteName !== undefined}>
            <tr className={redesign.total}>
              <th scope="row">All {departmentCount} EDs</th>
              <td className={cx(redesign.r, tableClasses.num)}>{small(totalEdWaiting)}</td>
              <td className={cx(redesign.r, tableClasses.num)}>{waitText(longestEd?.longest ?? null)}</td>
              <td className={cx(redesign.r, tableClasses.num)}>{small(totalEdOver8)}</td>
              <td className={cx(redesign.r, tableClasses.num)}>{small(totalEdOver24)}</td>
              <td className={cx(redesign.r, tableClasses.num)}>{medianText(networkMedianWait)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </StatCardR>
  );
}
