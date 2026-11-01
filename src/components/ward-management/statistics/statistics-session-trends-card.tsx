"use client";

import { History } from "lucide-react";

import { CardBody, tableClasses } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { StatCard } from "./statistics-hero";
import { Now, Tile } from "./redesign/statistics-redesign-parts";
import { sessionTrends } from "./statistics-session-trends";
import styles from "./statistics-v6.module.css";
import { useEffectiveWardAccess } from "../shell/ward-access-store";
import { useExecutiveStatistics, useExecutiveStatisticsControl } from "./executive-statistics-context";
import {
  ExecutiveStatisticsUnavailable,
  exactStatisticsCount,
  statisticsCountText,
  type StatisticsCount,
} from "./statistics-small-numbers";

type TrendsProps = {
  now: Instant;
  hours?: number;
  showTotal?: boolean;
  /** As a tile of the Network page's Also recorded strip (redesign approved 1 Nov 2026, Q135). */
  tile?: boolean;
};
type PublicTrends = {
  hours: Instant[];
  rows: { id: string; label: string; counts: StatisticsCount[]; total: StatisticsCount }[];
  counted: StatisticsCount;
};

/**
 * "This session" on Statistics (fix plan item 6, session-only first step): what was recorded hour by
 * hour in this browser session. Says plainly that it covers this session only.
 */
export function StatisticsSessionTrendsCard(props: TrendsProps) {
  const access = useEffectiveWardAccess();
  const control = useExecutiveStatisticsControl();
  const data = useExecutiveStatistics();
  if (control.executive || access.role === "executive") {
    const trends =
      data?.sessionTrends.state === "available"
        ? (data.sessionTrends.windows.find((window) => window.hourCount === (props.hours ?? 4)) ?? null)
        : null;
    return (
      <SessionTrendsView
        now={data?.network.asAt.now ?? props.now}
        hours={props.hours}
        showTotal={props.showTotal}
        tile={props.tile}
        trends={trends}
      />
    );
  }
  return <OperationalSessionTrends {...props} />;
}

function OperationalSessionTrends({ now, hours, showTotal, tile }: TrendsProps) {
  const { eventLog = [] } = useWardFlowSelect("eventLog");
  const trends = sessionTrends(eventLog, now, hours);
  return <SessionTrendsView now={now} hours={hours} showTotal={showTotal} tile={tile} trends={trends} />;
}

function SessionTrendsView({
  now,
  hours,
  showTotal = true,
  tile = false,
  trends,
}: TrendsProps & { trends: PublicTrends | null }) {
  if (tile) {
    const empty = trends !== null && exactStatisticsCount(trends.counted) === 0;
    return (
      <Tile
        testId="ward-statistics-session-trends"
        title="This session"
        now={<Now>last {trends?.hours.length ?? hours ?? 4} hours</Now>}
        sub={empty ? <span data-testid="ward-statistics-session-trends-empty">Nothing recorded yet</span> : undefined}
      >
        {trends === null ? <ExecutiveStatisticsUnavailable /> : empty ? null : trendsTable(trends, now, showTotal)}
      </Tile>
    );
  }
  return (
    <StatCard
      icon={History}
      title="This session"
      data-testid="ward-statistics-session-trends"
      aside={<span className={styles.muted}>Last {trends?.hours.length ?? hours ?? 4} hours</span>}
    >
      <CardBody className={styles.bodyStack}>
        {/* With nothing recorded the card is one line, not two paragraphs of method. The
            method note stays, cut to one line, only above a table it explains. */}
        {trends === null ? (
          <ExecutiveStatisticsUnavailable />
        ) : exactStatisticsCount(trends.counted) === 0 ? (
          <p className={styles.muted} data-testid="ward-statistics-session-trends-empty">
            Nothing recorded yet
          </p>
        ) : (
          <>
            <p className={styles.muted}>Recorded in this browser since the demo started. Undone actions still count.</p>
            {trendsTable(trends, now, showTotal)}
          </>
        )}
      </CardBody>
    </StatCard>
  );
}

function trendsTable(trends: PublicTrends, now: Instant, showTotal: boolean) {
  return (
    <div className={styles.tableWrap}>
      <table className={`${tableClasses.table} ${styles.table}`}>
        <caption className={styles.srOnly}>Actions recorded this session, by hour</caption>
        <thead>
          <tr>
            <th scope="col">Recorded</th>
            {trends.hours.map((hour) => (
              <th scope="col" key={hour}>
                {formatInstantWithDay(hour, now)}
              </th>
            ))}
            {showTotal ? <th scope="col">Total</th> : null}
          </tr>
        </thead>
        <tbody>
          {trends.rows.map((row) => (
            <tr key={row.id} data-testid={`ward-statistics-session-trend-${row.id}`}>
              <th scope="row">{row.label}</th>
              {row.counts.map((count, index) => (
                <td key={trends.hours[index]} className={styles.num}>
                  {statisticsCountText(count)}
                </td>
              ))}
              {showTotal ? <td className={styles.num}>{statisticsCountText(row.total)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
