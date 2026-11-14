"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";
import { occupancyPercent, occupiedBeds } from "@/components/ward-management/statistics/statistics-occupancy";
import { openEdJourneys } from "@/components/ward-management/ward-shared-figures";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import {
  useExecutiveStatistics,
  useExecutiveStatisticsControl,
} from "@/components/ward-management/statistics/executive-statistics-context";
import { releasedCountText } from "@/components/ward-management/statistics/statistics-small-numbers";
import styles from "./ward-tool-figures.module.css";

const STATISTICS_HREF = "/ward-flow/statistics";

/**
 * Tools mock-up Q321, Figures. Forked from the live `NetworkFigures`: four headline figures in a
 * 2 by 2 grid, each from the same derivation the board and Statistics print (`totalReadyBedsNow`,
 * `occupancyPercent`, `openEdJourneys`), so the tool never disagrees with them. Everything else
 * lives on Statistics, behind one quiet link.
 */
type Figure = { label: string; value: string };

export function ToolFigures({ onNavigate }: { onNavigate: () => void }) {
  return useExecutiveStatisticsControl().executive ? (
    <ExecutiveFigures onNavigate={onNavigate} />
  ) : (
    <OperationalFigures onNavigate={onNavigate} />
  );
}

function OperationalFigures({ onNavigate }: { onNavigate: () => void }) {
  const { units, admissions, movements, referrals, bedReleases, leaveBeds } = useWardFlowSelect(
    "units",
    "admissions",
    "movements",
    "referrals",
    "bedReleases",
    "leaveBeds",
  );
  const now = useWardFlowClock();
  const occupied = occupiedBeds(units, admissions, bedReleases, leaveBeds);
  const ed = openEdJourneys(movements, now);
  const figures: Figure[] = [
    {
      label: "Beds ready",
      value: String(totalReadyBedsNow(units, admissions, bedReleases, [...movements, ...referrals])),
    },
    { label: "Occupancy", value: occupied.beds ? `${occupancyPercent(occupied)}%` : "—" },
    { label: "ED journeys open", value: String(ed.total) },
    { label: "Waiting in ED", value: String(ed.stillInEd) },
  ];
  return <FiguresView figures={figures} now={now} scope="Whole network" onNavigate={onNavigate} />;
}

function ExecutiveFigures({ onNavigate }: { onNavigate: () => void }) {
  const report = useExecutiveStatistics();
  if (!report) return <p role="status">Figures show once this report is ready.</p>;
  const beds = report.network.beds;
  const figures: Figure[] = [
    { label: "Beds ready", value: String(beds.ready) },
    { label: "Occupancy", value: beds.total ? `${occupancyPercent({ beds: beds.total, inUse: beds.inUse })}%` : "—" },
    { label: "Open movements", value: String(releasedCountText(report.network.people.stillOpen)) },
    { label: "Waiting in ED", value: String(releasedCountText(report.network.people.waitingInEd)) },
  ];
  return (
    <FiguresView
      figures={figures}
      now={report.network.asAt.now}
      scope={report.network.scope.kind === "service" ? report.network.scope.service : "Whole network"}
      onNavigate={onNavigate}
    />
  );
}

function FiguresView({
  figures,
  now,
  scope,
  onNavigate,
}: {
  figures: Figure[];
  now: number;
  scope: string;
  onNavigate: () => void;
}) {
  // Access audit (31 Oct 2026): the Statistics link shows only for a desk that may open it (D-80).
  const canOpen = useCanOpenHref();
  return (
    <div className={styles.body} data-testid="ward-stats-drawer-content">
      <p className={styles.meta}>
        <span className={styles.scope}>{scope}</span>
        <span className={styles.clock}>Synthetic · {formatInstant(now)}</span>
      </p>
      <dl className={styles.grid}>
        {figures.map((figure) => (
          <div key={figure.label} className={styles.cell}>
            <dt className={styles.label}>{figure.label}</dt>
            <dd className={styles.value} data-words={/\d/u.test(figure.value) ? undefined : true}>
              {figure.value}
            </dd>
          </div>
        ))}
      </dl>
      {canOpen(STATISTICS_HREF) ? (
        <Link className={styles.more} href={STATISTICS_HREF} onClick={onNavigate}>
          See all on Statistics <ArrowUpRight aria-hidden="true" strokeWidth={1.75} />
        </Link>
      ) : null}
    </div>
  );
}
