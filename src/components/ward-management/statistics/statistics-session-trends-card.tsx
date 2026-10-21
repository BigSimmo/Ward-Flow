"use client";

import { History } from "lucide-react";

import { CardBody, tableClasses } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { StatCard } from "./statistics-hero";
import { sessionTrends } from "./statistics-session-trends";
import styles from "./statistics-v6.module.css";

/**
 * "This session" on Statistics (fix plan item 6, session-only first step): what was recorded hour by
 * hour in this browser session. Says plainly that it covers this session only.
 */
export function StatisticsSessionTrendsCard({ now }: { now: Instant }) {
  const { eventLog = [] } = useWardFlowSelect("eventLog");
  const trends = sessionTrends(eventLog, now);
  return (
    <StatCard
      icon={History}
      title="This session"
      data-testid="ward-statistics-session-trends"
      aside={<span className={styles.muted}>Last {trends.hours.length} hours</span>}
    >
      <CardBody className={styles.bodyStack}>
        <p className={styles.muted}>
          Counted from what was recorded in this browser since the demo started. Earlier days are not held yet, and an
          undone action still counts.
        </p>
        {trends.counted === 0 ? (
          <p className={styles.muted} data-testid="ward-statistics-session-trends-empty">
            Nothing counted yet this session. Referrals, decisions, arrivals and departures appear here as they are
            recorded.
          </p>
        ) : (
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
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {trends.rows.map((row) => (
                  <tr key={row.id} data-testid={`ward-statistics-session-trend-${row.id}`}>
                    <th scope="row">{row.label}</th>
                    {row.counts.map((count, index) => (
                      <td key={trends.hours[index]} className={styles.num}>
                        {count}
                      </td>
                    ))}
                    <td className={styles.num}>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </StatCard>
  );
}
